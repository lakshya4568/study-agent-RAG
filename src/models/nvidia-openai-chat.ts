// eslint-disable-next-line @typescript-eslint/no-require-imports
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

const NVIDIA_CHAT_MODEL = "moonshotai/kimi-k2-instruct"; // Using Kimi K2 Instruct
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

function getRequiredApiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    throw new Error(
      "NVIDIA_API_KEY is not set. Add it to your environment before running the agent."
    );
  }
  return key;
}

export interface NVIDIAChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export class NVIDIAOpenAIChat {
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(options: NVIDIAChatOptions = {}) {
    this.client = new OpenAI({
      apiKey: getRequiredApiKey(),
      baseURL: NVIDIA_BASE_URL,
      timeout: 120000, // 2 minute timeout to prevent indefinite hangs
    });
    this.model = options.model || NVIDIA_CHAT_MODEL;
    this.temperature = options.temperature ?? 0.2;
    this.maxTokens = options.maxTokens ?? 2000;
  }

  /**
   * Helper to execute completions with exponential backoff on 429 rate limit or 5xx server errors
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    initialDelayMs = 1500
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.response?.status;
        const isRateLimitOrServerErr =
          status === 429 || (status >= 500 && status < 600) || err?.code === "ECONNRESET";

        if (attempt < maxRetries && isRateLimitOrServerErr) {
          const delay = initialDelayMs * Math.pow(2, attempt) + Math.random() * 500;
          console.warn(
            `[NVIDIA Chat] Request returned ${status || "network error"}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  }

  /**
   * Invoke the chat model with messages (no tools)
   */
  async invoke(messages: ChatCompletionMessageParam[]): Promise<string> {
    const completion = await this.executeWithRetry(() =>
      this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      })
    );

    return completion.choices[0]?.message?.content || "";
  }

  /**
   * Invoke the chat model with tools enabled
   */
  async invokeWithTools(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolExecutor: (toolName: string, args: any) => Promise<string>
  ): Promise<{
    content: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolCalls?: Array<{ name: string; args: any; result: string }>;
  }> {
    const conversationMessages: ChatCompletionMessageParam[] = [...messages];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allExecutedTools: Array<{ name: string; args: any; result: string }> =
      [];
    const MAX_ITERATIONS = 5;
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const completion = await this.executeWithRetry(() =>
        this.client.chat.completions.create({
          model: this.model,
          messages: conversationMessages,
          tools,
          tool_choice: "auto",
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        })
      );

      const choice = completion.choices[0];
      let toolCalls = choice.message?.tool_calls || [];
      let content = choice.message?.content || "";

      // Check for raw tool call tokens in content if no structured tool calls found
      if (
        toolCalls.length === 0 &&
        content.includes("<|tool_calls_section_begin|>")
      ) {
        const parsed = this.parseToolCallsFromContent(content);
        if (parsed.toolCalls.length > 0) {
          toolCalls = parsed.toolCalls;
          content = parsed.cleanContent;
        }
      }

      // If no tool calls, we have our final answer
      if (toolCalls.length === 0) {
        return {
          content: content,
          toolCalls: allExecutedTools,
        };
      }

      // Add assistant message with tool calls to history
      conversationMessages.push({
        role: "assistant",
        content: content || "Calling tools...",
        tool_calls: toolCalls,
      });

      // Execute tool calls
      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;
        const toolName = toolCall.function.name;
        let toolArgs: any = {};
        try {
          const rawArgs = toolCall.function.arguments;
          let parsed = JSON.parse(rawArgs);

          if (typeof parsed === "string") {
            try {
              if (
                parsed.trim().startsWith("{") ||
                parsed.trim().startsWith("[")
              ) {
                parsed = JSON.parse(parsed);
              }
            } catch {
              // Keep as string
            }
          }

          toolArgs = parsed;
        } catch {
          try {
            const fixed = toolCall.function.arguments.replace(/'/g, '"');
            toolArgs = JSON.parse(fixed);
          } catch {
            console.error(
              `Failed to parse arguments for tool ${toolName}:`,
              toolCall.function.arguments
            );
          }
        }

        if (typeof toolArgs !== "object" || toolArgs === null) {
          console.warn(
            `Tool arguments for ${toolName} are not an object:`,
            toolArgs
          );
        }

        let toolResult = "";
        try {
          toolResult = await toolExecutor(toolName, toolArgs);
        } catch (error) {
          toolResult = `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
        }

        allExecutedTools.push({
          name: toolName,
          args: toolArgs,
          result: toolResult,
        });

        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    // Synthesize response if iterations limit was reached
    if (allExecutedTools.length > 0) {
      try {
        conversationMessages.push({
          role: "user",
          content: "Please summarize the results from the tools executed above into a helpful response.",
        });
        const summary = await this.invoke(conversationMessages);
        return {
          content: summary,
          toolCalls: allExecutedTools,
        };
      } catch {
        // Fallback to reporting tool execution count
      }
    }

    const lastMsg = conversationMessages[conversationMessages.length - 1];
    return {
      content:
        lastMsg.role === "assistant" && lastMsg.content
          ? String(lastMsg.content)
          : "Completed tool operations.",
      toolCalls: allExecutedTools,
    };
  }

  /**
   * Parse raw tool call tokens from content
   * Format: <|tool_calls_section_begin|><|tool_call_begin|>name:id<|tool_call_argument_begin|>args<|tool_call_end|><|tool_calls_section_end|>
   */
  private parseToolCallsFromContent(content: string): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolCalls: any[];
    cleanContent: string;
  } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolCalls: any[] = [];
    // Use [\s\S] to match any character including newlines
    const toolCallRegex =
      /<\|tool_call_begin\|>([\s\S]*?)<\|tool_call_argument_begin\|>([\s\S]*?)<\|tool_call_end\|>/g;
    let match;

    while ((match = toolCallRegex.exec(content)) !== null) {
      const [_, nameAndId, args] = match;
      // nameAndId might be "functions.tool_name:id" or just "tool_name:id"
      const parts = nameAndId.trim().split(":");
      const id = parts.pop() || "0";
      const fnName = parts.join(":"); // Rejoin in case name has colons, though unlikely
      const name = fnName.replace("functions.", "").trim();

      toolCalls.push({
        id: `call_${id}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
        type: "function",
        function: {
          name: name,
          arguments: args.trim(),
        },
      });
    }

    // Remove the tool calls section from content
    const cleanContent = content
      .replace(
        /<\|tool_calls_section_begin\|>[\s\S]*?<\|tool_calls_section_end\|>/g,
        ""
      )
      .trim();

    return { toolCalls, cleanContent };
  }

  /**
   * Get the underlying OpenAI client for advanced usage
   */
  getClient(): OpenAI {
    return this.client;
  }
}

export function createNVIDIAOpenAIChat(
  options: NVIDIAChatOptions = {}
): NVIDIAOpenAIChat {
  return new NVIDIAOpenAIChat(options);
}

export const nvidiaChatDefaults = {
  modelName: NVIDIA_CHAT_MODEL,
  baseURL: NVIDIA_BASE_URL,
};

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
   * Invoke the chat model with messages (no tools)
   */
  async invoke(messages: ChatCompletionMessageParam[]): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    });

    return completion.choices[0].message.content || "";
  }

  /**
   * Invoke the chat model with tools enabled
   * This handles the complete tool-calling flow with recursion:
   * 1. Send initial request with tools
   * 2. If tool calls are made, execute them
   * 3. Send results back to model
   * 4. Repeat until model provides final answer
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
    const MAX_ITERATIONS = 5; // Prevent infinite loops
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: conversationMessages,
        tools,
        tool_choice: "auto",
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const choice = completion.choices[0];
      let toolCalls = choice.message?.tool_calls || [];
      let content = choice.message.content || "";

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
        content: content || "Calling tools...", // Ensure non-empty content
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

          // Handle double-encoded JSON (stringified JSON inside string)
          if (typeof parsed === "string") {
            try {
              // Check if it looks like a JSON object or array
              if (
                parsed.trim().startsWith("{") ||
                parsed.trim().startsWith("[")
              ) {
                parsed = JSON.parse(parsed);
              }
            } catch (e) {
              // Keep as string if second parse fails
            }
          }

          toolArgs = parsed;
        } catch (e) {
          // Fallback: Try to fix single quotes (common in some models)
          try {
            const fixed = toolCall.function.arguments.replace(/'/g, '"');
            toolArgs = JSON.parse(fixed);
          } catch (e2) {
            console.error(
              `Failed to parse arguments for tool ${toolName}:`,
              toolCall.function.arguments
            );
          }
        }

        // Ensure toolArgs is an object (unless the tool specifically accepts a string, but standard is object)
        if (typeof toolArgs !== "object" || toolArgs === null) {
          // If it's a primitive, wrap it? Or just leave it and let validation fail?
          // For now, let's assume it should be an object.
          // If it's a string that wasn't JSON, maybe it's the value for the single argument?
          // But we don't know the argument name.
          // Let's just log a warning.
          console.warn(
            `Tool arguments for ${toolName} are not an object:`,
            toolArgs
          );
        }

        // Execute the tool
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

        // Add tool result to conversation
        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    // If we hit max iterations, return what we have
    const lastMsg = conversationMessages[conversationMessages.length - 1];
    return {
      content:
        lastMsg.role === "assistant" && lastMsg.content
          ? String(lastMsg.content)
          : "Max iterations reached without final response.",
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

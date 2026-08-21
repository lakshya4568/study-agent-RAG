// eslint-disable-next-line @typescript-eslint/no-require-imports
import OpenAI from "openai";
import { ChatOpenAI } from "@langchain/openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

// Groq configuration
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b"; // Verified high-speed working model

// NVIDIA configuration
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";

export interface ModelProviderConfig {
  provider: "groq" | "nvidia" | "auto";
  apiKey: string;
  baseURL: string;
  model: string;
}

export function resolveModelConfig(preferred?: "groq" | "nvidia"): ModelProviderConfig {
  const groqKey = process.env.GROQ_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  if (preferred === "groq" && groqKey) {
    return {
      provider: "groq",
      apiKey: groqKey,
      baseURL: GROQ_BASE_URL,
      model: GROQ_DEFAULT_MODEL,
    };
  }

  if (preferred === "nvidia" && nvidiaKey) {
    return {
      provider: "nvidia",
      apiKey: nvidiaKey,
      baseURL: NVIDIA_BASE_URL,
      model: NVIDIA_DEFAULT_MODEL,
    };
  }

  // Auto resolution: prefer Groq for speed & reliability if available, else NVIDIA
  if (groqKey) {
    return {
      provider: "groq",
      apiKey: groqKey,
      baseURL: GROQ_BASE_URL,
      model: GROQ_DEFAULT_MODEL,
    };
  }

  if (nvidiaKey) {
    return {
      provider: "nvidia",
      apiKey: nvidiaKey,
      baseURL: NVIDIA_BASE_URL,
      model: NVIDIA_DEFAULT_MODEL,
    };
  }

  throw new Error(
    "No AI API key found. Please configure GROQ_API_KEY or NVIDIA_API_KEY in your .env file or Settings."
  );
}

export interface NVIDIAChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  provider?: "groq" | "nvidia" | "auto";
  responseFormat?: { type: "json_object" | "text" };
}

export class NVIDIAOpenAIChat {
  private client: OpenAI;
  private config: ModelProviderConfig;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private responseFormat?: { type: "json_object" | "text" };

  constructor(options: NVIDIAChatOptions = {}) {
    this.config = resolveModelConfig(options.provider === "auto" ? undefined : options.provider);
    this.model = options.model || this.config.model;
    this.temperature = options.temperature ?? 0.2;
    this.maxTokens = options.maxTokens ?? 3000;
    this.responseFormat = options.responseFormat;

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: 60000,
    });
  }

  getProvider(): string {
    return this.config.provider;
  }

  getModelName(): string {
    return this.model;
  }

  /**
   * Helper to execute completions with exponential backoff on 429 rate limit or 5xx server errors
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 2,
    initialDelayMs = 1000
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
            `[${this.config.provider.toUpperCase()} Chat] Request returned ${status || "network error"}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})...`
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
   * Sanitize model text output by removing <think>...</think> blocks from reasoning models
   */
  private sanitizeContent(content: string): string {
    if (!content) return "";
    return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  }

  /**
   * Invoke the chat model with messages (no tools)
   */
  async invoke(
    messages: ChatCompletionMessageParam[],
    options?: { responseFormat?: { type: "json_object" | "text" } }
  ): Promise<string> {
    const format = options?.responseFormat || this.responseFormat;
    const completion = await this.executeWithRetry(() =>
      this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        ...(format ? { response_format: format } : {}),
      })
    );

    const rawContent = completion.choices[0]?.message?.content || "";
    return this.sanitizeContent(rawContent);
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
    const allExecutedTools: Array<{ name: string; args: any; result: string }> = [];
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
      const toolCalls = choice.message?.tool_calls || [];
      const content = choice.message?.content || "";

      // If no tool calls, we have our final answer
      if (toolCalls.length === 0) {
        return {
          content: this.sanitizeContent(content),
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
              if (parsed.trim().startsWith("{") || parsed.trim().startsWith("[")) {
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
          content: this.sanitizeContent(summary),
          toolCalls: allExecutedTools,
        };
      } catch {
        // Fallback
      }
    }

    const lastMsg = conversationMessages[conversationMessages.length - 1];
    return {
      content:
        lastMsg.role === "assistant" && lastMsg.content
          ? this.sanitizeContent(String(lastMsg.content))
          : "Completed tool operations.",
      toolCalls: allExecutedTools,
    };
  }

  /**
   * Creates a LangChain ChatOpenAI instance with the resolved model & baseURL
   */
  toLangChainChatModel(): ChatOpenAI {
    return new ChatOpenAI({
      apiKey: this.config.apiKey,
      configuration: {
        baseURL: this.config.baseURL,
      },
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });
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
  modelName: GROQ_DEFAULT_MODEL,
  baseURL: GROQ_BASE_URL,
};


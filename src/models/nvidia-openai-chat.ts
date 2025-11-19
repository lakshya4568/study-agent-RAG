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
   * This handles the complete tool-calling flow:
   * 1. Send initial request with tools
   * 2. If tool calls are made, execute them
   * 3. Send results back to model for final response
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
    // First call: LLM interprets input, may return tool calls
    const firstCompletion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    });

    const firstChoice = firstCompletion.choices[0];
    const toolCalls = firstChoice.message?.tool_calls || [];

    // If no tool calls, return direct response
    if (toolCalls.length === 0) {
      return {
        content: firstChoice.message.content || "",
      };
    }

    // Execute tool calls and collect results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const executedTools: Array<{ name: string; args: any; result: string }> =
      [];
    const conversationMessages: ChatCompletionMessageParam[] = [
      ...messages,
      {
        role: "assistant",
        content: "Calling tools...", // CRITICAL: Non-empty content required by NVIDIA API
        tool_calls: toolCalls,
      },
    ];

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue;
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      // Execute the tool
      const toolResult = await toolExecutor(toolName, toolArgs);
      executedTools.push({
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

    // Second call: Get final response with tool results
    const secondCompletion = await this.client.chat.completions.create({
      model: this.model,
      messages: conversationMessages,
      tools,
      tool_choice: "auto",
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    });

    return {
      content: secondCompletion.choices[0].message.content || "",
      toolCalls: executedTools,
    };
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

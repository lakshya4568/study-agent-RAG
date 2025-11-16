import { ChatOpenAI } from "@langchain/openai";

const NVIDIA_CHAT_MODEL = "meta/llama-3.1-8b-instruct";
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

type ChatOpenAIOptions = ConstructorParameters<typeof ChatOpenAI>[0];

export function createNVIDIAChat(
  overrides: Partial<ChatOpenAIOptions> = {}
): ChatOpenAI {
  return new ChatOpenAI({
    modelName: NVIDIA_CHAT_MODEL,
    temperature: 0.2,
    openAIApiKey: getRequiredApiKey(),
    configuration: {
      baseURL: NVIDIA_BASE_URL,
    },
    ...overrides,
  });
}

export const nvidiaChatDefaults = {
  modelName: NVIDIA_CHAT_MODEL,
  baseURL: NVIDIA_BASE_URL,
};

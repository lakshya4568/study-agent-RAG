import {
  OpenAIEmbeddings,
  type OpenAIEmbeddingsParams,
} from "@langchain/openai";

const NVIDIA_EMBED_MODEL = "nvidia/nv-embed-qa";
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

export function createNVIDIAEmbeddings(
  overrides: Partial<OpenAIEmbeddingsParams> = {}
): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    modelName: NVIDIA_EMBED_MODEL,
    openAIApiKey: getRequiredApiKey(),
    configuration: {
      baseURL: NVIDIA_BASE_URL,
    },
    ...overrides,
  });
}

export const nvidiaEmbeddingDefaults = {
  modelName: NVIDIA_EMBED_MODEL,
  baseURL: NVIDIA_BASE_URL,
};

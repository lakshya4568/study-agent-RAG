import {
  OpenAIEmbeddings,
  type OpenAIEmbeddingsParams,
} from "@langchain/openai";

// Latest NVIDIA embedding model optimized for Q&A and semantic search
// Using -passage suffix for document/passage embeddings (for indexing)
// Note: For queries, use -query suffix instead
const NVIDIA_EMBED_MODEL = "nvidia/nv-embedqa-e5-v5-passage";
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

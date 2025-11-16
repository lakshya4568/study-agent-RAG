import {
  OpenAIEmbeddings,
  type OpenAIEmbeddingsParams,
} from "@langchain/openai";
import type { OpenAI as OpenAIClient } from "openai";

// Latest NVIDIA Retrieval QA embedding model (see docs.api.nvidia.com/nim/reference/nvidia-nv-embedqa-e5-v5)
// NVIDIA exposes a single model identifier and expects clients to set the appropriate
// input type (query vs passage) at call time; LangChain handles batching/query/document flows.
const NVIDIA_EMBED_MODEL = "nvidia/nv-embedqa-e5-v5";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

type NvidiaInputType = "query" | "passage";
type NvidiaEmbeddingRequest = Parameters<
  OpenAIClient["embeddings"]["create"]
>[0] & {
  input_type: NvidiaInputType;
};

type OpenAIEmbeddingsCtorParams = ConstructorParameters<
  typeof OpenAIEmbeddings
>[0];

class NvidiaEmbeddings extends OpenAIEmbeddings {
  constructor(fields?: OpenAIEmbeddingsCtorParams) {
    super(fields);
  }

  private chunkArray<T>(items: T[]): T[][] {
    if (items.length === 0) {
      return [];
    }
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += this.batchSize) {
      chunks.push(items.slice(i, i + this.batchSize));
    }
    return chunks;
  }

  private sanitizeInput(text: string): string {
    return this.stripNewLines ? text.replace(/\n/g, " ") : text;
  }

  private buildRequest(
    input: string | string[],
    inputType: NvidiaInputType
  ): NvidiaEmbeddingRequest {
    const params: NvidiaEmbeddingRequest = {
      model: this.model,
      input,
      input_type: inputType,
    };

    if (this.dimensions) {
      params.dimensions = this.dimensions;
    }

    return params;
  }

  override async embedDocuments(texts: string[]): Promise<number[][]> {
    const normalized = texts.map((text) => this.sanitizeInput(text));
    const batches = this.chunkArray(normalized);
    const responses = await Promise.all(
      batches.map((batch) =>
        this.embeddingWithRetry(this.buildRequest(batch, "passage"))
      )
    );

    const embeddings: number[][] = [];
    responses.forEach(({ data }) => {
      data.forEach((entry) => embeddings.push(entry.embedding));
    });
    return embeddings;
  }

  override async embedQuery(text: string): Promise<number[]> {
    const sanitized = this.sanitizeInput(text);
    const { data } = await this.embeddingWithRetry(
      this.buildRequest(sanitized, "query")
    );
    return data[0].embedding;
  }
}

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
  overrides: OpenAIEmbeddingsCtorParams = {}
): OpenAIEmbeddings {
  const { configuration, ...rest } = overrides ?? {};

  return new NvidiaEmbeddings({
    modelName: NVIDIA_EMBED_MODEL,
    openAIApiKey: getRequiredApiKey(),
    configuration: {
      baseURL: NVIDIA_BASE_URL,
      ...configuration,
    },
    ...rest,
  });
}

export const nvidiaEmbeddingDefaults = {
  modelName: NVIDIA_EMBED_MODEL,
  baseURL: NVIDIA_BASE_URL,
};

"""
RAG Configuration Module

Centralized configuration for all RAG pipeline components.
Supports multiple NVIDIA embedding and reranking models with easy switching.
"""

from dataclasses import dataclass, field
from typing import Optional, List
import os
from dotenv import load_dotenv

load_dotenv()


@dataclass
class ModelConfig:
    """Configuration for a specific NVIDIA model."""

    model_id: str
    description: str = ""
    max_tokens: int = 512
    dimensions: Optional[int] = None


# ── Available NVIDIA Embedding Models ──────────────────────────────────────────
EMBEDDING_MODELS = {
    "nv-embedqa-1b-v2": ModelConfig(
        model_id="nvidia/llama-3.2-nv-embedqa-1b-v2",
        description="Multilingual QA retrieval with long context support (1B params)",
        max_tokens=512,
        dimensions=2048,
    ),
    "nemoretriever-300m-v2": ModelConfig(
        model_id="nvidia/llama-3.2-nemoretriever-300m-embed-v2",
        description="Multilingual QA retrieval, lightweight (300M params)",
        max_tokens=512,
        dimensions=1024,
    ),
    "nv-embedcode-7b": ModelConfig(
        model_id="nvidia/nv-embedcode-7b-v1",
        description="Code retrieval, text+code hybrid (7B params)",
        max_tokens=8192,
        dimensions=4096,
    ),
    "nv-embedqa-e5-v5": ModelConfig(
        model_id="nvidia/nv-embedqa-e5-v5",
        description="English text QA embedding (E5-based)",
        max_tokens=512,
        dimensions=1024,
    ),
    "bge-m3": ModelConfig(
        model_id="baai/bge-m3",
        description="Dense, multi-vector, and sparse retrieval",
        max_tokens=8192,
        dimensions=1024,
    ),
}

# ── Available NVIDIA Reranking Models ──────────────────────────────────────────
RERANKING_MODELS = {
    "nv-rerankqa-1b-v2": ModelConfig(
        model_id="nvidia/llama-3.2-nv-rerankqa-1b-v2",
        description="Multilingual, cross-lingual QA reranking (1B params)",
    ),
    "nemoretriever-500m-rerank-v2": ModelConfig(
        model_id="nvidia/llama-3.2-nemoretriever-500m-rerank-v2",
        description="GPU-accelerated passage reranking (500M params)",
    ),
}

# ── Available LLM Models ──────────────────────────────────────────────────────
LLM_MODELS = {
    "kimi-k2-instruct": ModelConfig(
        model_id="moonshotai/kimi-k2-instruct",
        description="Kimi K2 Instruct - multi-modal reasoning",
        max_tokens=4096,
    ),
}


@dataclass
class ChunkingConfig:
    """Configuration for document chunking."""

    chunk_size: int = 512  # tokens
    chunk_overlap: int = 128  # 25% overlap
    encoding_name: str = "cl100k_base"
    separators: List[str] = field(default_factory=lambda: [
        "\n\n\n",  # Section breaks
        "\n\n",    # Paragraph breaks
        "\n",      # Line breaks
        ". ",      # Sentence ends
        "? ",      # Question ends
        "! ",      # Exclamation ends
        "; ",      # Semicolons
        ", ",      # Commas
        " ",       # Words
        "",        # Characters (fallback)
    ])


@dataclass
class RetrieverConfig:
    """Configuration for document retrieval."""

    top_k: int = 10           # Initial retrieval count (before reranking)
    top_n: int = 5            # Final count after reranking
    use_hybrid: bool = True   # Enable hybrid (keyword + semantic) search
    keyword_weight: float = 0.3  # Weight for keyword search in hybrid mode
    semantic_weight: float = 0.7  # Weight for semantic search in hybrid mode
    similarity_threshold: float = 0.0  # Minimum similarity score


@dataclass
class GeneratorConfig:
    """Configuration for response generation."""

    temperature: float = 0.6
    top_p: float = 0.9
    max_completion_tokens: int = 4096
    streaming: bool = True


@dataclass
class RAGConfig:
    """Master configuration for the entire RAG pipeline."""

    # API Key
    nvidia_api_key: str = field(default_factory=lambda: os.getenv("NVIDIA_API_KEY", ""))

    # Model selections (keys into the model registries above)
    embedding_model: str = "nv-embedqa-1b-v2"
    reranking_model: str = "nv-rerankqa-1b-v2"
    llm_model: str = "kimi-k2-instruct"

    # Component configs
    chunking: ChunkingConfig = field(default_factory=ChunkingConfig)
    retriever: RetrieverConfig = field(default_factory=RetrieverConfig)
    generator: GeneratorConfig = field(default_factory=GeneratorConfig)

    # Storage
    chroma_persist_dir: str = field(
        default_factory=lambda: os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    )
    collection_name: str = "study_materials"

    # Feature flags
    enable_reranking: bool = True
    enable_hybrid_search: bool = True
    enable_metrics: bool = True

    # Rate limiting (NVIDIA free tier: 40 req/min)
    rate_limit_rpm: int = 40

    def get_embedding_model(self) -> ModelConfig:
        """Get the active embedding model configuration."""
        if self.embedding_model not in EMBEDDING_MODELS:
            raise ValueError(
                f"Unknown embedding model: {self.embedding_model}. "
                f"Available: {list(EMBEDDING_MODELS.keys())}"
            )
        return EMBEDDING_MODELS[self.embedding_model]

    def get_reranking_model(self) -> ModelConfig:
        """Get the active reranking model configuration."""
        if self.reranking_model not in RERANKING_MODELS:
            raise ValueError(
                f"Unknown reranking model: {self.reranking_model}. "
                f"Available: {list(RERANKING_MODELS.keys())}"
            )
        return RERANKING_MODELS[self.reranking_model]

    def get_llm_model(self) -> ModelConfig:
        """Get the active LLM model configuration."""
        if self.llm_model not in LLM_MODELS:
            raise ValueError(
                f"Unknown LLM model: {self.llm_model}. "
                f"Available: {list(LLM_MODELS.keys())}"
            )
        return LLM_MODELS[self.llm_model]

    def validate(self) -> None:
        """Validate the configuration."""
        if not self.nvidia_api_key:
            raise ValueError("NVIDIA_API_KEY is required")
        self.get_embedding_model()
        self.get_reranking_model()
        self.get_llm_model()

    @classmethod
    def from_env(cls) -> "RAGConfig":
        """Create config from environment variables."""
        return cls(
            nvidia_api_key=os.getenv("NVIDIA_API_KEY", ""),
            embedding_model=os.getenv("RAG_EMBEDDING_MODEL", "nv-embedqa-1b-v2"),
            reranking_model=os.getenv("RAG_RERANKING_MODEL", "nv-rerankqa-1b-v2"),
            llm_model=os.getenv("RAG_LLM_MODEL", "kimi-k2-instruct"),
            chroma_persist_dir=os.getenv("CHROMA_PERSIST_DIR", "./chroma_db"),
            collection_name=os.getenv("RAG_COLLECTION_NAME", "study_materials"),
            enable_reranking=os.getenv("RAG_ENABLE_RERANKING", "true").lower() == "true",
            enable_hybrid_search=os.getenv("RAG_ENABLE_HYBRID", "true").lower() == "true",
        )

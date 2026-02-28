"""
NVIDIA Embedder Module

Handles embedding generation using NVIDIA AI Endpoints.
Supports multiple embedding models with rate limiting.
"""

import time
import logging
from typing import List, Optional

from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings

from .config import RAGConfig, EMBEDDING_MODELS

logger = logging.getLogger(__name__)


class NVIDIAEmbedder:
    """
    NVIDIA embedding model wrapper with rate limiting and model switching.

    Supports:
    - nvidia/llama-3.2-nv-embedqa-1b-v2 (QA-optimized, recommended)
    - nvidia/llama-3.2-nemoretriever-300m-embed-v2 (lightweight)
    - nvidia/nv-embedcode-7b-v1 (code retrieval)
    - nvidia/nv-embedqa-e5-v5 (English QA)
    - baai/bge-m3 (multi-vector)
    """

    def __init__(self, config: RAGConfig):
        self.config = config
        self._client: Optional[NVIDIAEmbeddings] = None
        self._last_request_time: float = 0
        self._request_count: int = 0
        self._total_tokens_embedded: int = 0

    @property
    def model_config(self):
        return self.config.get_embedding_model()

    @property
    def model_id(self) -> str:
        return self.model_config.model_id

    def initialize(self) -> "NVIDIAEmbedder":
        """Initialize the NVIDIA embeddings client."""
        model_cfg = self.model_config
        logger.info(f"Initializing NVIDIA Embedder: {model_cfg.model_id}")
        logger.info(f"  Description: {model_cfg.description}")

        self._client = NVIDIAEmbeddings(
            model=model_cfg.model_id,
            nvidia_api_key=self.config.nvidia_api_key,
            truncate="END",  # Safely truncate long inputs
        )

        logger.info(f"✓ Embedder initialized: {model_cfg.model_id}")
        return self

    def _rate_limit(self) -> None:
        """Enforce rate limiting (NVIDIA free tier: 40 req/min)."""
        now = time.time()
        elapsed = now - self._last_request_time

        # Reset counter every 60 seconds
        if elapsed >= 60:
            self._request_count = 0
            self._last_request_time = now
            return

        if self._request_count >= self.config.rate_limit_rpm:
            wait_time = 60 - elapsed
            logger.warning(f"Rate limit reached. Waiting {wait_time:.1f}s...")
            time.sleep(wait_time)
            self._request_count = 0
            self._last_request_time = time.time()

    def embed_query(self, text: str) -> List[float]:
        """Embed a single query text."""
        if not self._client:
            raise RuntimeError("Embedder not initialized. Call initialize() first.")

        self._rate_limit()
        self._request_count += 1

        result = self._client.embed_query(text)
        self._total_tokens_embedded += len(text.split())  # approximate

        return result

    def embed_documents(self, texts: List[str], batch_size: int = 10) -> List[List[float]]:
        """
        Embed multiple documents with batching and rate limiting.

        Args:
            texts: List of document texts to embed
            batch_size: Number of texts per API call (default: 10)

        Returns:
            List of embedding vectors
        """
        if not self._client:
            raise RuntimeError("Embedder not initialized. Call initialize() first.")

        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]

            self._rate_limit()
            self._request_count += 1

            batch_embeddings = self._client.embed_documents(batch)
            all_embeddings.extend(batch_embeddings)

            logger.debug(
                f"Embedded batch {i // batch_size + 1}"
                f"/{(len(texts) + batch_size - 1) // batch_size}"
                f" ({len(batch)} texts)"
            )

        self._total_tokens_embedded += sum(len(t.split()) for t in texts)
        return all_embeddings

    def get_stats(self) -> dict:
        """Get embedding statistics."""
        return {
            "model": self.model_id,
            "total_requests": self._request_count,
            "total_tokens_embedded": self._total_tokens_embedded,
            "dimensions": self.model_config.dimensions,
        }

    @staticmethod
    def list_available_models() -> dict:
        """List all available NVIDIA embedding models."""
        return {
            name: {
                "model_id": cfg.model_id,
                "description": cfg.description,
                "max_tokens": cfg.max_tokens,
                "dimensions": cfg.dimensions,
            }
            for name, cfg in EMBEDDING_MODELS.items()
        }

"""
NVIDIA Reranker Module

Reranks retrieved documents using NVIDIA's reranking models
for improved retrieval precision.
"""

import logging
import time
from typing import List, Tuple, Optional

from langchain.schema import Document
from langchain_nvidia_ai_endpoints import NVIDIARerank

from .config import RAGConfig, RERANKING_MODELS

logger = logging.getLogger(__name__)


class NVIDIAReranker:
    """
    NVIDIA reranking model wrapper.

    Supports:
    - nvidia/llama-3.2-nv-rerankqa-1b-v2 (recommended for QA)
    - nvidia/llama-3.2-nemoretriever-500m-rerank-v2 (lightweight)
    """

    def __init__(self, config: RAGConfig):
        self.config = config
        self._client: Optional[NVIDIARerank] = None
        self._rerank_count: int = 0

    @property
    def model_config(self):
        return self.config.get_reranking_model()

    @property
    def model_id(self) -> str:
        return self.model_config.model_id

    def initialize(self) -> "NVIDIAReranker":
        """Initialize the NVIDIA reranking client."""
        if not self.config.enable_reranking:
            logger.info("Reranking disabled in config")
            return self

        model_cfg = self.model_config
        logger.info(f"Initializing NVIDIA Reranker: {model_cfg.model_id}")

        self._client = NVIDIARerank(
            model=model_cfg.model_id,
            api_key=self.config.nvidia_api_key,
        )

        logger.info(f"✓ Reranker initialized: {model_cfg.model_id}")
        return self

    def rerank(
        self,
        query: str,
        documents: List[Tuple[Document, float]],
        top_n: Optional[int] = None,
    ) -> List[Tuple[Document, float]]:
        """
        Rerank documents for improved precision.

        Args:
            query: The user query
            documents: List of (document, initial_score) tuples from retrieval
            top_n: Number of top results to return (default: config.retriever.top_n)

        Returns:
            Reranked list of (document, rerank_score) tuples
        """
        if not self.config.enable_reranking or not self._client:
            logger.debug("Reranking skipped (disabled or not initialized)")
            n = top_n or self.config.retriever.top_n
            return documents[:n]

        if not documents:
            return []

        n = top_n or self.config.retriever.top_n

        # Extract just the documents for reranking
        docs = [doc for doc, _ in documents]

        try:
            start_time = time.time()

            # Use NVIDIARerank to compress/rerank documents
            reranked = self._client.compress_documents(
                documents=docs,
                query=query,
            )

            elapsed = time.time() - start_time
            self._rerank_count += 1

            # Convert to (Document, score) tuples
            results: List[Tuple[Document, float]] = []
            for doc in reranked:
                score = doc.metadata.get("relevance_score", 0.0)
                results.append((doc, score))

            # Sort by relevance score (descending) and take top_n
            results.sort(key=lambda x: x[1], reverse=True)
            results = results[:n]

            logger.info(
                f"Reranked {len(docs)} → {len(results)} documents "
                f"in {elapsed:.2f}s"
            )

            if results:
                top_score = results[0][1]
                bottom_score = results[-1][1]
                logger.debug(
                    f"  Score range: {bottom_score:.4f} - {top_score:.4f}"
                )

            return results

        except Exception as e:
            logger.error(f"Reranking failed: {e}. Falling back to initial ranking.")
            return documents[:n]

    def get_stats(self) -> dict:
        """Get reranker statistics."""
        return {
            "model": self.model_id if self.config.enable_reranking else "disabled",
            "enabled": self.config.enable_reranking,
            "total_reranks": self._rerank_count,
        }

    @staticmethod
    def list_available_models() -> dict:
        """List all available NVIDIA reranking models."""
        return {
            name: {
                "model_id": cfg.model_id,
                "description": cfg.description,
            }
            for name, cfg in RERANKING_MODELS.items()
        }

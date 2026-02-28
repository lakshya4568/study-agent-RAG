"""
RAG Pipeline Module

Orchestrates the full RAG pipeline:
  Document Loading → Chunking → Embedding → Storage
  Query → Retrieval → Reranking → Generation → Response

All components are modular and independently configurable.
"""

import os
import logging
from typing import List, Optional, Dict, Any, AsyncIterator

from langchain.schema import Document
from langchain_community.document_loaders import PyPDFLoader

from .config import RAGConfig
from .embedder import NVIDIAEmbedder
from .chunker import SemanticChunker
from .retriever import HybridRetriever
from .reranker import NVIDIAReranker
from .generator import NVIDIAGenerator, STUDY_ASSISTANT_PROMPT, SUMMARIZATION_PROMPT
from .metrics import RAGMetrics

logger = logging.getLogger(__name__)


class RAGPipeline:
    """
    Orchestrates the complete RAG pipeline.

    Architecture:
    ┌─────────────┐   ┌──────────┐   ┌───────────────┐   ┌──────────────┐
    │  PDF/Text   │ → │ Chunker  │ → │  Embedder +   │ → │  ChromaDB    │
    │  Loader     │   │ (token)  │   │  VectorStore  │   │  (persist)   │
    └─────────────┘   └──────────┘   └───────────────┘   └──────────────┘

    ┌─────────┐   ┌─────────────┐   ┌───────────┐   ┌─────────────┐
    │  Query  │ → │  Hybrid     │ → │ Reranker  │ → │  Generator  │ → Answer
    │         │   │  Retriever  │   │ (NVIDIA)  │   │  (NVIDIA)   │
    └─────────┘   └─────────────┘   └───────────┘   └─────────────┘
    """

    def __init__(self, config: Optional[RAGConfig] = None):
        self.config = config or RAGConfig.from_env()
        self.config.validate()

        # Components (lazy-initialized)
        self.embedder = NVIDIAEmbedder(self.config)
        self.chunker = SemanticChunker(self.config)
        self.retriever = HybridRetriever(self.config, self.embedder)
        self.reranker = NVIDIAReranker(self.config)
        self.generator = NVIDIAGenerator(self.config)
        self.metrics = RAGMetrics(enabled=self.config.enable_metrics)

        self._initialized = False

    def initialize(self) -> "RAGPipeline":
        """Initialize all pipeline components."""
        logger.info("=" * 60)
        logger.info("Initializing Enhanced RAG Pipeline v2.0")
        logger.info("=" * 60)

        self.embedder.initialize()
        self.retriever.initialize()
        self.reranker.initialize()
        self.generator.initialize()

        self._initialized = True

        logger.info("=" * 60)
        logger.info("✓ Pipeline ready")
        logger.info(f"  Embedding: {self.embedder.model_id}")
        logger.info(f"  Reranking: {self.reranker.model_id}")
        logger.info(f"  Generator: {self.generator.model_id}")
        logger.info(f"  Hybrid Search: {self.config.enable_hybrid_search}")
        logger.info(f"  Collection: {self.config.collection_name}")
        logger.info("=" * 60)

        return self

    def _ensure_initialized(self) -> None:
        if not self._initialized:
            raise RuntimeError("Pipeline not initialized. Call initialize() first.")

    # ── Document Ingestion ─────────────────────────────────────────────────────

    def load_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """
        Load and index a PDF document.

        Args:
            pdf_path: Path to the PDF file

        Returns:
            Dict with status, chunks count, and statistics
        """
        self._ensure_initialized()

        # Resolve path
        if not os.path.isabs(pdf_path):
            pdf_path = os.path.abspath(pdf_path)

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"File not found: {pdf_path}")

        if not pdf_path.lower().endswith(".pdf"):
            raise ValueError("Only PDF files are supported")

        source_name = os.path.basename(pdf_path)

        self.metrics.start_timer("document_load")

        # Load PDF
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()

        if not documents:
            raise ValueError("PDF has no extractable content")

        load_metric = self.metrics.stop_timer(
            "document_load", input_count=1, output_count=len(documents)
        )

        # Chunk
        self.metrics.start_timer("chunking")
        chunks, chunk_stats = self.chunker.chunk_documents(documents, source_name)
        chunk_metric = self.metrics.stop_timer(
            "chunking",
            input_count=len(documents),
            output_count=chunk_stats.total_chunks,
        )

        # Index
        self.metrics.start_timer("indexing")
        self.retriever.add_documents(chunks)
        index_metric = self.metrics.stop_timer(
            "indexing", input_count=chunk_stats.total_chunks
        )

        return {
            "status": "success",
            "chunks": chunk_stats.total_chunks,
            "message": f"Processed {source_name} into {chunk_stats.total_chunks} chunks",
            "chunk_stats": {
                "total_chunks": chunk_stats.total_chunks,
                "avg_tokens_per_chunk": round(chunk_stats.avg_tokens_per_chunk),
                "min_tokens": chunk_stats.min_tokens,
                "max_tokens": chunk_stats.max_tokens,
                "total_tokens": chunk_stats.total_tokens,
                "source_pages": chunk_stats.source_pages,
            },
            "timings": {
                "load_ms": load_metric.latency_ms if load_metric else 0,
                "chunk_ms": chunk_metric.latency_ms if chunk_metric else 0,
                "index_ms": index_metric.latency_ms if index_metric else 0,
            },
        }

    def load_text(
        self,
        text: str,
        source_name: str = "text_input",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Load and index raw text.

        Args:
            text: Raw text content
            source_name: Identifier for the source
            metadata: Optional metadata to attach

        Returns:
            Dict with status and statistics
        """
        self._ensure_initialized()

        if not text.strip():
            raise ValueError("Text cannot be empty")

        # Chunk
        self.metrics.start_timer("chunking")
        chunks, chunk_stats = self.chunker.chunk_text(text, metadata, source_name)
        self.metrics.stop_timer("chunking", input_count=1, output_count=chunk_stats.total_chunks)

        # Index
        self.metrics.start_timer("indexing")
        self.retriever.add_documents(chunks)
        self.metrics.stop_timer("indexing", input_count=chunk_stats.total_chunks)

        return {
            "status": "success",
            "chunks": chunk_stats.total_chunks,
            "message": f"Indexed {source_name}: {chunk_stats.total_chunks} chunks",
            "chunk_stats": {
                "total_chunks": chunk_stats.total_chunks,
                "avg_tokens_per_chunk": round(chunk_stats.avg_tokens_per_chunk),
                "total_tokens": chunk_stats.total_tokens,
            },
        }

    # ── Query Pipeline ─────────────────────────────────────────────────────────

    def query(
        self,
        question: str,
        top_k: Optional[int] = None,
        stream: bool = False,
    ) -> Dict[str, Any]:
        """
        Query the RAG pipeline (non-streaming).

        Pipeline: Query → Retrieve → Rerank → Generate

        Args:
            question: User question
            top_k: Override retrieval count
            stream: If True, returns streaming response (use query_stream instead)

        Returns:
            Dict with answer, sources, metrics
        """
        self._ensure_initialized()

        if not question.strip():
            raise ValueError("Question cannot be empty")

        stages = []

        # ── Retrieve ───────────────────────────────────────────────────────
        self.metrics.start_timer("retrieval")
        retrieved = self.retriever.retrieve(question, top_k=top_k)
        retrieval_metric = self.metrics.stop_timer(
            "retrieval", output_count=len(retrieved)
        )
        if retrieval_metric:
            stages.append(retrieval_metric)

        if not retrieved:
            return {
                "answer": "No relevant information found. Please upload documents first.",
                "sources": [],
                "chunks_retrieved": 0,
            }

        # ── Rerank ─────────────────────────────────────────────────────────
        self.metrics.start_timer("reranking")
        reranked = self.reranker.rerank(question, retrieved)
        rerank_metric = self.metrics.stop_timer(
            "reranking",
            input_count=len(retrieved),
            output_count=len(reranked),
        )
        if rerank_metric:
            stages.append(rerank_metric)

        # ── Generate ───────────────────────────────────────────────────────
        self.metrics.start_timer("generation")
        result = self.generator.generate(question, reranked)
        gen_metric = self.metrics.stop_timer(
            "generation", output_count=len(result.get("answer", ""))
        )
        if gen_metric:
            stages.append(gen_metric)

        # ── Record metrics ─────────────────────────────────────────────────
        query_metric = self.metrics.record_query(
            query=question,
            stages=stages,
            chunks_retrieved=len(retrieved),
            chunks_after_rerank=len(reranked),
            answer_length=len(result.get("answer", "")),
        )

        result["metrics"] = {
            "total_ms": query_metric.total_latency_ms,
            "stages": {s.stage: s.latency_ms for s in stages},
        }

        return result

    async def query_stream(
        self,
        question: str,
        top_k: Optional[int] = None,
    ) -> AsyncIterator[str]:
        """
        Query the RAG pipeline with streaming response.

        Args:
            question: User question
            top_k: Override retrieval count

        Yields:
            SSE-formatted data strings
        """
        self._ensure_initialized()

        if not question.strip():
            raise ValueError("Question cannot be empty")

        # Retrieve
        retrieved = self.retriever.retrieve(question, top_k=top_k)

        if not retrieved:
            import json
            yield f"data: {json.dumps({'content': 'No relevant information found.'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Rerank
        reranked = self.reranker.rerank(question, retrieved)

        # Stream generation
        async for chunk in self.generator.generate_stream(question, reranked):
            yield chunk

    # ── Utility Methods ────────────────────────────────────────────────────────

    def get_health(self) -> Dict[str, Any]:
        """Get pipeline health status."""
        return {
            "status": "ok" if self._initialized else "not_initialized",
            "nvidia_key_set": bool(self.config.nvidia_api_key),
            "embedding_model": self.embedder.model_id,
            "reranking_model": self.reranker.model_id,
            "llm_model": self.generator.model_id,
            "hybrid_search": self.config.enable_hybrid_search,
            "reranking_enabled": self.config.enable_reranking,
            "chunk_size_tokens": self.config.chunking.chunk_size,
            "chunk_overlap_tokens": self.config.chunking.chunk_overlap,
        }

    def get_collection_stats(self) -> Dict[str, Any]:
        """Get collection statistics."""
        return self.retriever.get_stats()

    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get performance metrics summary."""
        return self.metrics.get_summary()

    def get_pipeline_stats(self) -> Dict[str, Any]:
        """Get comprehensive stats from all components."""
        return {
            "embedder": self.embedder.get_stats(),
            "retriever": self.retriever.get_stats(),
            "reranker": self.reranker.get_stats(),
            "generator": self.generator.get_stats(),
            "metrics": self.metrics.get_summary(),
        }

    def clear_collection(self) -> Dict[str, str]:
        """Clear all documents."""
        self._ensure_initialized()
        self.retriever.clear()
        return {"status": "success", "message": "Collection cleared"}

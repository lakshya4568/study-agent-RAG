"""
Hybrid Retriever Module

Combines semantic (vector) search with keyword (BM25-style) search
for more robust document retrieval.
"""

import logging
import re
from collections import Counter
from typing import List, Tuple, Optional, Dict, Any
from pathlib import Path
import math

from langchain.schema import Document
from langchain_community.vectorstores import Chroma

from .config import RAGConfig
from .embedder import NVIDIAEmbedder

logger = logging.getLogger(__name__)


class KeywordSearcher:
    """
    Simple TF-IDF-style keyword searcher for hybrid retrieval.
    Avoids external dependencies (no rank_bm25 needed).
    """

    def __init__(self):
        self._documents: List[Document] = []
        self._doc_term_freqs: List[Counter] = []
        self._idf: Dict[str, float] = {}

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        """Simple tokenization: lowercase, alphanumeric tokens."""
        return re.findall(r"\b[a-z0-9]+\b", text.lower())

    def index(self, documents: List[Document]) -> None:
        """Index documents for keyword search."""
        self._documents = documents
        self._doc_term_freqs = []

        doc_freq: Counter = Counter()

        for doc in documents:
            tokens = self._tokenize(doc.page_content)
            tf = Counter(tokens)
            self._doc_term_freqs.append(tf)

            # Count unique terms per document
            for term in set(tokens):
                doc_freq[term] += 1

        # Compute IDF
        n_docs = len(documents)
        self._idf = {
            term: math.log((n_docs + 1) / (freq + 1)) + 1
            for term, freq in doc_freq.items()
        }

    def search(self, query: str, top_k: int = 10) -> List[Tuple[Document, float]]:
        """
        Search documents by keyword relevance (TF-IDF scoring).

        Args:
            query: Search query
            top_k: Number of results to return

        Returns:
            List of (document, score) tuples, sorted by relevance
        """
        if not self._documents:
            return []

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        scores: List[float] = []
        for tf in self._doc_term_freqs:
            score = 0.0
            doc_len = sum(tf.values()) or 1
            for term in query_tokens:
                if term in tf:
                    # TF-IDF score: (term_freq / doc_length) * idf
                    score += (tf[term] / doc_len) * self._idf.get(term, 1.0)
            scores.append(score)

        # Get top-k indices
        indexed_scores = sorted(
            enumerate(scores), key=lambda x: x[1], reverse=True
        )[:top_k]

        results = [
            (self._documents[idx], score)
            for idx, score in indexed_scores
            if score > 0
        ]

        return results


class HybridRetriever:
    """
    Hybrid retriever combining semantic and keyword search.

    Pipeline: Query → [Semantic Search + Keyword Search] → Score Fusion → Top-K
    """

    def __init__(self, config: RAGConfig, embedder: NVIDIAEmbedder):
        self.config = config
        self.embedder = embedder
        self._vector_store: Optional[Chroma] = None
        self._keyword_searcher = KeywordSearcher()
        self._total_documents: int = 0

    def initialize(self) -> "HybridRetriever":
        """Initialize the vector store."""
        persist_dir = self.config.chroma_persist_dir
        Path(persist_dir).mkdir(parents=True, exist_ok=True)

        self._vector_store = Chroma(
            collection_name=self.config.collection_name,
            embedding_function=self.embedder._client,
            persist_directory=persist_dir,
        )

        # Load existing documents into keyword index
        self._rebuild_keyword_index()

        logger.info(
            f"✓ HybridRetriever initialized: "
            f"collection='{self.config.collection_name}', "
            f"docs={self._total_documents}"
        )
        return self

    def _rebuild_keyword_index(self) -> None:
        """Rebuild the keyword search index from the vector store."""
        if not self._vector_store:
            return

        try:
            collection = self._vector_store._collection
            count = collection.count()
            self._total_documents = count

            if count > 0:
                # Fetch all documents for keyword indexing
                results = collection.get(
                    limit=min(count, 10000),
                    include=["documents", "metadatas"],
                )
                docs = [
                    Document(
                        page_content=doc,
                        metadata=meta or {},
                    )
                    for doc, meta in zip(
                        results.get("documents") or [],
                        results.get("metadatas") or [],
                    )
                ]
                self._keyword_searcher.index(docs)
                logger.info(f"Keyword index built with {len(docs)} documents")
        except Exception as e:
            logger.warning(f"Failed to rebuild keyword index: {e}")

    def add_documents(self, documents: List[Document]) -> int:
        """
        Add documents to the retriever (both vector and keyword index).

        Args:
            documents: Documents to add

        Returns:
            Number of documents added
        """
        if not self._vector_store:
            raise RuntimeError("Retriever not initialized")

        self._vector_store.add_documents(documents)
        self._total_documents += len(documents)

        # Rebuild keyword index
        self._rebuild_keyword_index()

        logger.info(f"Added {len(documents)} documents (total: {self._total_documents})")
        return len(documents)

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
    ) -> List[Tuple[Document, float]]:
        """
        Retrieve relevant documents using hybrid search.

        Args:
            query: User query
            top_k: Override default top_k

        Returns:
            List of (document, score) tuples
        """
        if not self._vector_store:
            raise RuntimeError("Retriever not initialized")

        k = top_k or self.config.retriever.top_k
        cfg = self.config.retriever

        # ── Semantic search ────────────────────────────────────────────────
        semantic_results = self._vector_store.similarity_search_with_score(
            query, k=k
        )

        if not cfg.use_hybrid or not self.config.enable_hybrid_search:
            return semantic_results

        # ── Keyword search ─────────────────────────────────────────────────
        keyword_results = self._keyword_searcher.search(query, top_k=k)

        # ── Score fusion (Reciprocal Rank Fusion) ──────────────────────────
        return self._reciprocal_rank_fusion(
            semantic_results,
            keyword_results,
            semantic_weight=cfg.semantic_weight,
            keyword_weight=cfg.keyword_weight,
            top_k=k,
        )

    @staticmethod
    def _reciprocal_rank_fusion(
        semantic_results: List[Tuple[Document, float]],
        keyword_results: List[Tuple[Document, float]],
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3,
        top_k: int = 10,
        rrf_k: int = 60,
    ) -> List[Tuple[Document, float]]:
        """
        Merge results using Reciprocal Rank Fusion (RRF).

        Score = Σ weight / (rrf_k + rank)
        """
        doc_scores: Dict[str, Tuple[Document, float]] = {}

        # Score semantic results
        for rank, (doc, _score) in enumerate(semantic_results):
            key = doc.page_content[:200]  # Use content prefix as key
            rrf_score = semantic_weight / (rrf_k + rank + 1)
            if key in doc_scores:
                existing_doc, existing_score = doc_scores[key]
                doc_scores[key] = (existing_doc, existing_score + rrf_score)
            else:
                doc_scores[key] = (doc, rrf_score)

        # Score keyword results
        for rank, (doc, _score) in enumerate(keyword_results):
            key = doc.page_content[:200]
            rrf_score = keyword_weight / (rrf_k + rank + 1)
            if key in doc_scores:
                existing_doc, existing_score = doc_scores[key]
                doc_scores[key] = (existing_doc, existing_score + rrf_score)
            else:
                doc_scores[key] = (doc, rrf_score)

        # Sort by fused score
        sorted_results = sorted(
            doc_scores.values(), key=lambda x: x[1], reverse=True
        )[:top_k]

        return sorted_results

    def get_stats(self) -> Dict[str, Any]:
        """Get retriever statistics."""
        return {
            "total_documents": self._total_documents,
            "document_count": self._total_documents,  # backward compat alias
            "collection_name": self.config.collection_name,
            "hybrid_search": self.config.enable_hybrid_search,
            "persist_dir": self.config.chroma_persist_dir,
        }

    def clear(self) -> None:
        """Clear all documents."""
        if self._vector_store:
            self._vector_store.delete_collection()
            self._total_documents = 0
            self._keyword_searcher = KeywordSearcher()
            logger.info("✓ Collection cleared")

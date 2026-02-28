"""
Semantic Chunker Module

Token-aware document chunking with semantic boundary detection.
Uses tiktoken for accurate token counting and RecursiveCharacterTextSplitter
for intelligent splitting along semantic boundaries.
"""

import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

from .config import RAGConfig

logger = logging.getLogger(__name__)

# Try to import tiktoken for accurate token counting
try:
    import tiktoken

    _TIKTOKEN_AVAILABLE = True
except ImportError:
    _TIKTOKEN_AVAILABLE = False
    logger.warning("tiktoken not available, falling back to approximate token counting")


@dataclass
class ChunkStats:
    """Statistics about a chunking operation."""

    total_chunks: int
    avg_tokens_per_chunk: float
    min_tokens: int
    max_tokens: int
    total_tokens: int
    source_pages: int


class SemanticChunker:
    """
    Token-aware semantic document chunker.

    Features:
    - Token-based splitting using tiktoken
    - Semantic boundary detection (paragraphs, sentences, etc.)
    - Rich metadata enrichment per chunk
    - Configurable chunk size and overlap
    """

    def __init__(self, config: RAGConfig):
        self.config = config
        self._tokenizer = None

        if _TIKTOKEN_AVAILABLE:
            try:
                self._tokenizer = tiktoken.get_encoding(
                    config.chunking.encoding_name
                )
            except Exception as e:
                logger.warning(f"Failed to load tiktoken encoding: {e}")

    def token_length(self, text: str) -> int:
        """Calculate token length of text."""
        if self._tokenizer:
            return len(self._tokenizer.encode(text))
        return len(text) // 4  # Fallback: ~4 chars per token

    def chunk_documents(
        self,
        documents: List[Document],
        source_name: str = "unknown",
    ) -> tuple[List[Document], ChunkStats]:
        """
        Split documents into semantically meaningful chunks.

        Args:
            documents: List of LangChain Document objects
            source_name: Name of the source for metadata

        Returns:
            Tuple of (chunked documents, chunk statistics)
        """
        cfg = self.config.chunking

        # Create token-aware splitter
        if _TIKTOKEN_AVAILABLE and self._tokenizer:
            splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
                encoding_name=cfg.encoding_name,
                chunk_size=cfg.chunk_size,
                chunk_overlap=cfg.chunk_overlap,
                separators=cfg.separators,
                is_separator_regex=False,
            )
        else:
            # Fallback to character-based splitting (4 chars ≈ 1 token)
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=cfg.chunk_size * 4,
                chunk_overlap=cfg.chunk_overlap * 4,
                separators=cfg.separators,
                is_separator_regex=False,
            )

        # Split
        chunks = splitter.split_documents(documents)

        if not chunks:
            logger.warning("No chunks produced from documents")
            return [], ChunkStats(0, 0, 0, 0, 0, 0)

        # Enrich metadata
        source_pages = set()
        for i, chunk in enumerate(chunks):
            page = chunk.metadata.get("page", 0)
            source_pages.add(page)

            chunk.metadata.update({
                "chunk_id": i,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "chunk_size_tokens": self.token_length(chunk.page_content),
                "source_name": source_name,
                "preview": chunk.page_content[:150].replace("\n", " ").strip(),
            })

        # Compute stats
        token_counts = [self.token_length(c.page_content) for c in chunks]
        stats = ChunkStats(
            total_chunks=len(chunks),
            avg_tokens_per_chunk=sum(token_counts) / len(token_counts),
            min_tokens=min(token_counts),
            max_tokens=max(token_counts),
            total_tokens=sum(token_counts),
            source_pages=len(source_pages),
        )

        logger.info(
            f"✓ Chunked '{source_name}': {stats.total_chunks} chunks, "
            f"avg {stats.avg_tokens_per_chunk:.0f} tokens/chunk, "
            f"{stats.source_pages} pages"
        )

        return chunks, stats

    def chunk_text(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
        source_name: str = "text_input",
    ) -> tuple[List[Document], ChunkStats]:
        """
        Chunk raw text input.

        Args:
            text: Raw text to chunk
            metadata: Optional metadata to attach to each chunk
            source_name: Name for the source

        Returns:
            Tuple of (chunked documents, chunk statistics)
        """
        doc = Document(
            page_content=text,
            metadata=metadata or {"source": source_name},
        )
        return self.chunk_documents([doc], source_name=source_name)

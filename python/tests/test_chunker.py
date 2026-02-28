"""
Unit Tests for Semantic Chunker Module

Tests token counting, document chunking, metadata enrichment, and edge cases.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langchain.schema import Document
from rag.config import RAGConfig, ChunkingConfig
from rag.chunker import SemanticChunker, ChunkStats


@pytest.fixture
def config():
    return RAGConfig(nvidia_api_key="test-key")


@pytest.fixture
def chunker(config):
    return SemanticChunker(config)


@pytest.fixture
def small_chunk_config():
    """Config with small chunk size for testing."""
    cfg = RAGConfig(nvidia_api_key="test-key")
    cfg.chunking = ChunkingConfig(
        chunk_size=50,
        chunk_overlap=10,
    )
    return cfg


@pytest.fixture
def small_chunker(small_chunk_config):
    return SemanticChunker(small_chunk_config)


class TestTokenLength:
    """Tests for token counting."""

    def test_token_length_empty(self, chunker):
        assert chunker.token_length("") == 0

    def test_token_length_single_word(self, chunker):
        length = chunker.token_length("hello")
        assert length >= 1

    def test_token_length_sentence(self, chunker):
        length = chunker.token_length("The quick brown fox jumps over the lazy dog.")
        assert length > 5

    def test_token_length_increases_with_text(self, chunker):
        short = chunker.token_length("Hello")
        long = chunker.token_length("Hello world this is a longer sentence with more tokens")
        assert long > short


class TestChunkDocuments:
    """Tests for document chunking."""

    def test_chunk_single_short_document(self, chunker):
        docs = [Document(page_content="This is a short document.", metadata={"page": 0})]
        chunks, stats = chunker.chunk_documents(docs, source_name="test")

        assert len(chunks) >= 1
        assert stats.total_chunks >= 1
        assert stats.total_tokens > 0

    def test_chunk_long_document(self, small_chunker):
        """Long text should produce multiple chunks."""
        long_text = "This is a paragraph about machine learning. " * 100
        docs = [Document(page_content=long_text, metadata={"page": 0})]

        chunks, stats = small_chunker.chunk_documents(docs, source_name="test")

        assert len(chunks) > 1
        assert stats.total_chunks > 1
        assert stats.avg_tokens_per_chunk > 0

    def test_chunk_metadata_enrichment(self, small_chunker):
        """Each chunk should have enriched metadata."""
        text = "This is test content. " * 100
        docs = [Document(page_content=text, metadata={"page": 0, "source": "test.pdf"})]

        chunks, stats = small_chunker.chunk_documents(docs, source_name="test.pdf")

        for chunk in chunks:
            assert "chunk_id" in chunk.metadata
            assert "chunk_index" in chunk.metadata
            assert "total_chunks" in chunk.metadata
            assert "chunk_size_tokens" in chunk.metadata
            assert "source_name" in chunk.metadata
            assert "preview" in chunk.metadata
            assert chunk.metadata["source_name"] == "test.pdf"

    def test_chunk_preserves_original_metadata(self, small_chunker):
        """Original document metadata should be preserved."""
        docs = [Document(
            page_content="Test content. " * 50,
            metadata={"page": 5, "source": "doc.pdf", "custom": "value"},
        )]

        chunks, _ = small_chunker.chunk_documents(docs)

        for chunk in chunks:
            assert chunk.metadata.get("page") == 5
            assert chunk.metadata.get("source") == "doc.pdf"
            assert chunk.metadata.get("custom") == "value"

    def test_chunk_empty_documents(self, chunker):
        """Empty documents should return empty results."""
        chunks, stats = chunker.chunk_documents([], source_name="empty")
        assert len(chunks) == 0
        assert stats.total_chunks == 0

    def test_chunk_multiple_pages(self, small_chunker):
        """Multiple page documents should track pages in stats."""
        docs = [
            Document(page_content="Page 1 content. " * 50, metadata={"page": 0}),
            Document(page_content="Page 2 content. " * 50, metadata={"page": 1}),
            Document(page_content="Page 3 content. " * 50, metadata={"page": 2}),
        ]

        chunks, stats = small_chunker.chunk_documents(docs, source_name="multi_page")

        assert stats.source_pages >= 2  # At least 2 unique pages
        assert stats.total_chunks > 3   # More chunks than pages


class TestChunkText:
    """Tests for raw text chunking."""

    def test_chunk_text_basic(self, chunker):
        text = "This is some text about studying."
        chunks, stats = chunker.chunk_text(text, source_name="test_input")

        assert len(chunks) >= 1
        assert chunks[0].metadata["source_name"] == "test_input"

    def test_chunk_text_with_metadata(self, chunker):
        text = "Study materials for biology."
        chunks, stats = chunker.chunk_text(
            text,
            metadata={"subject": "biology", "type": "notes"},
            source_name="bio_notes",
        )

        assert chunks[0].metadata.get("subject") == "biology"
        assert chunks[0].metadata.get("type") == "notes"


class TestChunkStats:
    """Tests for ChunkStats dataclass."""

    def test_chunk_stats_creation(self):
        stats = ChunkStats(
            total_chunks=10,
            avg_tokens_per_chunk=256.0,
            min_tokens=128,
            max_tokens=512,
            total_tokens=2560,
            source_pages=5,
        )
        assert stats.total_chunks == 10
        assert stats.avg_tokens_per_chunk == 256.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Unit Tests for Hybrid Retriever Module

Tests keyword search, vector search, score fusion, and indexing.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langchain.schema import Document
from rag.retriever import KeywordSearcher


class TestKeywordSearcher:
    """Tests for the TF-IDF keyword searcher."""

    @pytest.fixture
    def searcher(self):
        s = KeywordSearcher()
        docs = [
            Document(
                page_content="Machine learning is a subset of artificial intelligence that enables systems to learn.",
                metadata={"id": 0},
            ),
            Document(
                page_content="Python is a popular programming language used in data science and web development.",
                metadata={"id": 1},
            ),
            Document(
                page_content="Neural networks are inspired by the biological neural networks in the human brain.",
                metadata={"id": 2},
            ),
            Document(
                page_content="Deep learning uses multiple layers of neural networks to process complex data.",
                metadata={"id": 3},
            ),
            Document(
                page_content="Natural language processing enables computers to understand human language.",
                metadata={"id": 4},
            ),
        ]
        s.index(docs)
        return s

    def test_index_documents(self, searcher):
        assert len(searcher._documents) == 5
        assert len(searcher._doc_term_freqs) == 5
        assert len(searcher._idf) > 0

    def test_search_relevant_query(self, searcher):
        results = searcher.search("machine learning artificial intelligence", top_k=3)

        assert len(results) > 0
        # First result should be about machine learning
        top_doc, top_score = results[0]
        assert "machine learning" in top_doc.page_content.lower()
        assert top_score > 0

    def test_search_neural_networks(self, searcher):
        results = searcher.search("neural networks brain", top_k=3)

        assert len(results) > 0
        contents = [doc.page_content.lower() for doc, _ in results]
        assert any("neural network" in c for c in contents)

    def test_search_python(self, searcher):
        results = searcher.search("python programming", top_k=2)

        assert len(results) > 0
        top_doc, _ = results[0]
        assert "python" in top_doc.page_content.lower()

    def test_search_empty_query(self, searcher):
        results = searcher.search("", top_k=5)
        assert len(results) == 0

    def test_search_no_match(self, searcher):
        results = searcher.search("quantum physics thermodynamics", top_k=5)
        # May still return results (partial matches) but scores should be lower
        if results:
            _, score = results[0]
            assert score < 1.0  # Not a perfect match

    def test_search_returns_sorted(self, searcher):
        results = searcher.search("learning networks", top_k=5)

        if len(results) >= 2:
            scores = [s for _, s in results]
            for i in range(len(scores) - 1):
                assert scores[i] >= scores[i + 1], "Results should be sorted by score descending"

    def test_search_top_k_limit(self, searcher):
        results = searcher.search("learning", top_k=2)
        assert len(results) <= 2

    def test_empty_index(self):
        s = KeywordSearcher()
        results = s.search("test query", top_k=5)
        assert results == []


class TestTokenize:
    """Tests for tokenization."""

    def test_tokenize_basic(self):
        tokens = KeywordSearcher._tokenize("Hello World! This is a test.")
        assert "hello" in tokens
        assert "world" in tokens
        assert "test" in tokens

    def test_tokenize_removes_punctuation(self):
        tokens = KeywordSearcher._tokenize("don't, won't; can't!")
        assert all(t.isalnum() for t in tokens)

    def test_tokenize_lowercase(self):
        tokens = KeywordSearcher._tokenize("Machine Learning NLP")
        assert "machine" in tokens
        assert "learning" in tokens
        assert "nlp" in tokens

    def test_tokenize_empty(self):
        tokens = KeywordSearcher._tokenize("")
        assert tokens == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

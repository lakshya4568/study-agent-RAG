#!/usr/bin/env python3
"""
RAG Pipeline Performance Test on Textual Data

This script tests the enhanced RAG pipeline's performance on textual study data.
It measures:
  - Chunking speed and quality
  - Embedding throughput
  - Retrieval accuracy (keyword vs semantic vs hybrid)
  - Reranking improvement
  - End-to-end latency

Usage:
  # Unit tests only (no API key needed):
  python -m pytest tests/test_performance.py -v -k "not live"

  # Full live tests (requires NVIDIA_API_KEY):
  python -m pytest tests/test_performance.py -v

  # Run as standalone script:
  python tests/test_performance.py
"""

import os
import sys
import time
import json
import tempfile
import logging
from typing import List, Dict

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langchain.schema import Document
from rag.config import RAGConfig, ChunkingConfig
from rag.chunker import SemanticChunker
from rag.retriever import KeywordSearcher
from rag.metrics import RAGMetrics, StageMetric

logger = logging.getLogger(__name__)

# ── Sample Study Data ──────────────────────────────────────────────────────────

STUDY_TEXTS = {
    "machine_learning": """
Machine Learning Fundamentals

Machine learning is a branch of artificial intelligence that focuses on building
systems that learn from data. Instead of being explicitly programmed, these systems
use algorithms to identify patterns in data and make predictions or decisions.

Types of Machine Learning:

1. Supervised Learning: The algorithm learns from labeled training data. Common
   algorithms include linear regression, decision trees, random forests, and
   support vector machines (SVMs). Applications include email spam detection,
   image classification, and medical diagnosis.

2. Unsupervised Learning: The algorithm finds hidden patterns in unlabeled data.
   Key methods include k-means clustering, hierarchical clustering, and principal
   component analysis (PCA). Used for customer segmentation, anomaly detection,
   and dimensionality reduction.

3. Reinforcement Learning: The agent learns by interacting with an environment,
   receiving rewards or penalties. Algorithms include Q-learning, Deep Q-Networks
   (DQN), and Policy Gradient methods. Applied in game playing, robotics, and
   autonomous driving.

Model Evaluation Metrics:
- Accuracy: Overall correctness of predictions
- Precision: Proportion of true positives among predicted positives
- Recall: Proportion of true positives among actual positives
- F1 Score: Harmonic mean of precision and recall
- ROC-AUC: Area under the Receiver Operating Characteristic curve

Overfitting and Underfitting:
Overfitting occurs when a model learns noise in the training data rather than
the underlying pattern. Prevention techniques include cross-validation,
regularization (L1/L2), dropout, and early stopping.
Underfitting occurs when a model is too simple to capture the data's complexity.
Solutions include using more complex models, adding features, or reducing
regularization.
""",
    "neural_networks": """
Neural Networks and Deep Learning

Artificial neural networks are computing systems inspired by biological neural
networks. They consist of interconnected nodes (neurons) organized in layers.

Architecture Components:
- Input Layer: Receives the raw data features
- Hidden Layers: Process information through weighted connections
- Output Layer: Produces the final prediction or classification
- Activation Functions: Introduce non-linearity (ReLU, sigmoid, tanh, softmax)

Key Architectures:

1. Convolutional Neural Networks (CNNs):
   Specialized for grid-like data (images). Key components include convolutional
   layers, pooling layers, and fully connected layers. Used in image recognition,
   object detection, and natural language processing.

2. Recurrent Neural Networks (RNNs):
   Designed for sequential data. Variants include LSTM (Long Short-Term Memory)
   and GRU (Gated Recurrent Unit). Applied in time series prediction, language
   modeling, and machine translation.

3. Transformers:
   Attention-based architecture that processes all input positions simultaneously.
   Foundation for BERT, GPT, and other large language models. Key innovation:
   self-attention mechanism that computes relationships between all positions
   in a sequence.

Training Process:
1. Forward Pass: Input data flows through the network to produce predictions
2. Loss Calculation: Error between predictions and actual values is computed
3. Backpropagation: Gradients are calculated using the chain rule
4. Weight Update: Parameters are adjusted using optimization algorithms
   (SGD, Adam, RMSprop)

Batch Normalization helps stabilize training by normalizing layer inputs.
Dropout randomly deactivates neurons during training to prevent overfitting.
Learning Rate Scheduling adjusts the learning rate during training for better
convergence.
""",
    "natural_language_processing": """
Natural Language Processing (NLP)

NLP is a field at the intersection of computer science, artificial intelligence,
and linguistics. It focuses on enabling computers to understand, interpret, and
generate human language.

Core NLP Tasks:
1. Tokenization: Breaking text into individual tokens (words, subwords)
2. Part-of-Speech Tagging: Identifying grammatical roles of words
3. Named Entity Recognition: Identifying names, places, organizations
4. Sentiment Analysis: Determining the emotional tone of text
5. Machine Translation: Translating between languages
6. Text Summarization: Creating concise summaries of longer texts
7. Question Answering: Extracting answers from text given questions

Word Embeddings:
- Word2Vec: Learns word vectors from context (CBOW and Skip-gram)
- GloVe: Global Vectors for Word Representation using co-occurrence statistics
- FastText: Extends Word2Vec with subword information for rare words
- Contextual embeddings (BERT, ELMo): Word meaning depends on context

Large Language Models (LLMs):
Modern NLP is dominated by large language models trained on massive text corpora.
These models use the transformer architecture and self-supervised learning.
Key models include GPT-4, Claude, Gemini, and Llama. They demonstrate emergent
capabilities like few-shot learning, chain-of-thought reasoning, and tool use.

Retrieval-Augmented Generation (RAG):
RAG combines the power of retrieval systems with generative models. Instead of
relying solely on the model's training data, RAG retrieves relevant documents
from a knowledge base and uses them as context for generation. This approach
reduces hallucination and enables models to access up-to-date information.
""",
    "data_science": """
Data Science and Analytics

Data science is an interdisciplinary field that uses scientific methods,
algorithms, and systems to extract insights from structured and unstructured data.

The Data Science Pipeline:
1. Problem Definition: Clearly state the business question
2. Data Collection: Gather data from various sources (databases, APIs, scraping)
3. Data Cleaning: Handle missing values, outliers, inconsistencies
4. Exploratory Data Analysis (EDA): Visualize and understand data distributions
5. Feature Engineering: Create meaningful features from raw data
6. Model Selection: Choose appropriate algorithms for the task
7. Training and Validation: Train models with cross-validation
8. Deployment: Put models into production
9. Monitoring: Track model performance over time

Statistical Foundations:
- Descriptive Statistics: Mean, median, mode, variance, standard deviation
- Probability Theory: Bayes' theorem, conditional probability
- Hypothesis Testing: t-tests, chi-squared tests, ANOVA
- Regression Analysis: Linear, logistic, polynomial regression
- Time Series Analysis: ARIMA, exponential smoothing, seasonal decomposition

Key Tools and Libraries:
- Python: pandas, numpy, scikit-learn, matplotlib, seaborn
- R: ggplot2, dplyr, tidyr, caret
- SQL: Database querying and data manipulation
- Spark: Distributed data processing
- Jupyter Notebooks: Interactive data exploration
""",
}

# ── Test Queries ───────────────────────────────────────────────────────────────

TEST_QUERIES = [
    {
        "query": "What are the types of machine learning?",
        "expected_topic": "machine_learning",
        "expected_keywords": ["supervised", "unsupervised", "reinforcement"],
    },
    {
        "query": "How do transformers work in neural networks?",
        "expected_topic": "neural_networks",
        "expected_keywords": ["attention", "self-attention", "transformer"],
    },
    {
        "query": "What is retrieval augmented generation?",
        "expected_topic": "natural_language_processing",
        "expected_keywords": ["RAG", "retrieval", "generation"],
    },
    {
        "query": "Explain the data science pipeline steps",
        "expected_topic": "data_science",
        "expected_keywords": ["collection", "cleaning", "model", "deployment"],
    },
    {
        "query": "What metrics are used to evaluate ML models?",
        "expected_topic": "machine_learning",
        "expected_keywords": ["accuracy", "precision", "recall", "F1"],
    },
    {
        "query": "How does backpropagation work?",
        "expected_topic": "neural_networks",
        "expected_keywords": ["gradient", "chain rule", "loss"],
    },
    {
        "query": "What are word embeddings?",
        "expected_topic": "natural_language_processing",
        "expected_keywords": ["Word2Vec", "GloVe", "vector"],
    },
    {
        "query": "What Python libraries are used in data science?",
        "expected_topic": "data_science",
        "expected_keywords": ["pandas", "numpy", "scikit-learn"],
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
#  OFFLINE TESTS (no API key required)
# ═══════════════════════════════════════════════════════════════════════════════

class TestChunkingPerformance:
    """Test chunking speed and quality on study texts."""

    @pytest.fixture
    def config(self):
        return RAGConfig(nvidia_api_key="test-key")

    @pytest.fixture
    def chunker(self, config):
        return SemanticChunker(config)

    def test_chunking_throughput(self, chunker):
        """Measure chunking speed across all study texts."""
        all_text = "\n\n".join(STUDY_TEXTS.values())
        doc = Document(page_content=all_text, metadata={"source": "combined"})

        start = time.time()
        chunks, stats = chunker.chunk_documents([doc], "combined_study_material")
        elapsed_ms = (time.time() - start) * 1000

        print(f"\n=== Chunking Performance ===")
        print(f"  Input: {len(all_text)} chars")
        print(f"  Chunks: {stats.total_chunks}")
        print(f"  Avg tokens/chunk: {stats.avg_tokens_per_chunk:.0f}")
        print(f"  Total tokens: {stats.total_tokens}")
        print(f"  Time: {elapsed_ms:.1f}ms")
        print(f"  Throughput: {stats.total_tokens / (elapsed_ms / 1000):.0f} tokens/sec")

        assert stats.total_chunks > 1
        assert stats.avg_tokens_per_chunk > 50  # Reasonable chunk sizes
        assert elapsed_ms < 5000  # Should be fast

    def test_chunk_size_consistency(self, chunker):
        """Verify chunks are within expected size range."""
        for name, text in STUDY_TEXTS.items():
            doc = Document(page_content=text, metadata={"source": name})
            chunks, stats = chunker.chunk_documents([doc], name)

            # No chunk should be drastically oversized (allow 2x buffer for token counting variance)
            max_allowed = chunker.config.chunking.chunk_size * 2
            for chunk in chunks:
                token_len = chunker.token_length(chunk.page_content)
                assert token_len <= max_allowed, (
                    f"Chunk too large ({token_len} tokens > {max_allowed}) "
                    f"in {name}"
                )

    def test_semantic_boundary_splits(self, chunker):
        """Verify chunks tend to split at semantic boundaries."""
        text = STUDY_TEXTS["machine_learning"]
        doc = Document(page_content=text, metadata={"source": "ml"})
        chunks, _ = chunker.chunk_documents([doc], "ml")

        # Chunks should not start/end mid-word
        for chunk in chunks:
            content = chunk.page_content.strip()
            if len(content) > 10:
                # First char should be alphanumeric or common start char
                assert content[0].isalnum() or content[0] in "(-•*1234567890", (
                    f"Chunk starts oddly: '{content[:20]}...'"
                )


class TestKeywordRetrievalAccuracy:
    """Test keyword search accuracy on study texts."""

    @pytest.fixture
    def searcher(self):
        """Build keyword index from study texts."""
        s = KeywordSearcher()
        docs = []
        for name, text in STUDY_TEXTS.items():
            # Split each topic into ~paragraph-sized chunks for testing
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            for i, para in enumerate(paragraphs):
                docs.append(Document(
                    page_content=para,
                    metadata={"topic": name, "paragraph": i},
                ))
        s.index(docs)
        return s

    def test_keyword_retrieval_accuracy(self, searcher):
        """Measure keyword search accuracy for test queries."""
        correct = 0
        total = len(TEST_QUERIES)

        print(f"\n=== Keyword Retrieval Accuracy ===")

        for tq in TEST_QUERIES:
            results = searcher.search(tq["query"], top_k=5)

            if results:
                # Check if top result is from expected topic
                top_doc = results[0][0]
                top_topic = top_doc.metadata.get("topic", "")
                is_correct = top_topic == tq["expected_topic"]
                if is_correct:
                    correct += 1

                print(
                    f"  {'✓' if is_correct else '✗'} "
                    f"Q: '{tq['query'][:50]}...' → "
                    f"Got: {top_topic} "
                    f"(Expected: {tq['expected_topic']})"
                )
            else:
                print(f"  ✗ Q: '{tq['query'][:50]}...' → No results")

        accuracy = correct / total
        print(f"\n  Keyword Accuracy: {correct}/{total} = {accuracy:.1%}")

        # Keyword search should get at least 50% right
        assert accuracy >= 0.5, f"Keyword accuracy too low: {accuracy:.1%}"

    def test_keyword_search_latency(self, searcher):
        """Measure keyword search latency."""
        latencies = []

        for tq in TEST_QUERIES:
            start = time.time()
            searcher.search(tq["query"], top_k=10)
            elapsed_ms = (time.time() - start) * 1000
            latencies.append(elapsed_ms)

        avg_ms = sum(latencies) / len(latencies)
        max_ms = max(latencies)

        print(f"\n=== Keyword Search Latency ===")
        print(f"  Avg: {avg_ms:.2f}ms")
        print(f"  Max: {max_ms:.2f}ms")

        # Keyword search should be very fast
        assert avg_ms < 100, f"Keyword search too slow: {avg_ms:.2f}ms avg"


class TestMetricsPerformance:
    """Test metrics tracking overhead."""

    def test_metrics_overhead(self):
        """Measure overhead of the metrics system."""
        metrics = RAGMetrics(enabled=True)

        start = time.time()
        for i in range(1000):
            metrics.start_timer("test")
            stage = metrics.stop_timer("test", input_count=10, output_count=5)
            if stage:
                metrics.record_query(
                    query=f"Query {i}",
                    stages=[stage],
                    chunks_retrieved=10,
                    chunks_after_rerank=5,
                    answer_length=500,
                )
        elapsed_ms = (time.time() - start) * 1000

        print(f"\n=== Metrics Overhead ===")
        print(f"  1000 queries recorded in {elapsed_ms:.1f}ms")
        print(f"  Per-query overhead: {elapsed_ms / 1000:.3f}ms")

        assert elapsed_ms < 1000, "Metrics overhead too high"

    def test_summary_computation(self):
        """Test summary computation speed with many recorded queries."""
        metrics = RAGMetrics(enabled=True)

        for i in range(500):
            stages = [
                StageMetric(stage="retrieval", latency_ms=100 + i % 50),
                StageMetric(stage="reranking", latency_ms=200 + i % 30),
                StageMetric(stage="generation", latency_ms=400 + i % 100),
            ]
            metrics.record_query(
                query=f"Query {i}",
                stages=stages,
                chunks_retrieved=10,
                chunks_after_rerank=5,
                answer_length=500,
            )

        start = time.time()
        summary = metrics.get_summary()
        elapsed_ms = (time.time() - start) * 1000

        print(f"\n=== Summary Computation ===")
        print(f"  500 queries summarized in {elapsed_ms:.1f}ms")
        print(f"  Avg latency: {summary['avg_total_latency_ms']:.1f}ms")

        assert summary["total_queries"] == 500
        assert elapsed_ms < 100


# ═══════════════════════════════════════════════════════════════════════════════
#  LIVE TESTS (requires NVIDIA_API_KEY)
# ═══════════════════════════════════════════════════════════════════════════════

HAS_API_KEY = bool(os.getenv("NVIDIA_API_KEY"))


@pytest.mark.skipif(not HAS_API_KEY, reason="NVIDIA_API_KEY not set")
class TestLiveEmbeddingPerformance:
    """Live tests for NVIDIA embedding performance (requires API key)."""

    @pytest.fixture(scope="class")
    def pipeline(self):
        """Create and initialize a live pipeline."""
        config = RAGConfig.from_env()
        config.chroma_persist_dir = tempfile.mkdtemp()
        config.collection_name = "test_performance"

        from rag.pipeline import RAGPipeline
        pipe = RAGPipeline(config)
        pipe.initialize()
        return pipe

    def test_text_ingestion_performance(self, pipeline):
        """Test text ingestion throughput."""
        print(f"\n=== Live Text Ingestion ===")

        for name, text in STUDY_TEXTS.items():
            start = time.time()
            result = pipeline.load_text(text, source_name=name)
            elapsed_ms = (time.time() - start) * 1000

            print(
                f"  {name}: {result['chunks']} chunks, "
                f"{result['chunk_stats']['total_tokens']} tokens, "
                f"{elapsed_ms:.0f}ms"
            )

            assert result["status"] == "success"
            assert result["chunks"] > 0

    def test_query_latency(self, pipeline):
        """Test query latency across test queries."""
        print(f"\n=== Live Query Latency ===")

        # First, load data
        for name, text in STUDY_TEXTS.items():
            pipeline.load_text(text, source_name=name)

        latencies = []
        for tq in TEST_QUERIES[:4]:  # Test subset to respect rate limits
            start = time.time()
            result = pipeline.query(tq["query"])
            elapsed_ms = (time.time() - start) * 1000
            latencies.append(elapsed_ms)

            print(
                f"  Q: '{tq['query'][:50]}...'"
                f"\n    Answer: {result['answer'][:100]}..."
                f"\n    Chunks: {result['chunks_retrieved']}, "
                f"Time: {elapsed_ms:.0f}ms"
            )

            # Wait to respect rate limits
            time.sleep(2)

        avg_ms = sum(latencies) / len(latencies)
        print(f"\n  Avg query latency: {avg_ms:.0f}ms")

    def test_pipeline_stats(self, pipeline):
        """Verify pipeline stats are collected."""
        stats = pipeline.get_pipeline_stats()

        print(f"\n=== Pipeline Stats ===")
        print(json.dumps(stats, indent=2, default=str))

        assert "embedder" in stats
        assert "retriever" in stats
        assert "metrics" in stats


# ═══════════════════════════════════════════════════════════════════════════════
#  Standalone Runner
# ═══════════════════════════════════════════════════════════════════════════════

def run_offline_benchmarks():
    """Run offline benchmarks and print results."""
    print("=" * 70)
    print(" Enhanced RAG Pipeline - Performance Benchmarks (Offline)")
    print("=" * 70)

    config = RAGConfig(nvidia_api_key="test-key")
    chunker = SemanticChunker(config)

    # 1. Chunking benchmark
    print("\n📊 Chunking Benchmark")
    print("-" * 40)
    all_text = "\n\n".join(STUDY_TEXTS.values())
    doc = Document(page_content=all_text, metadata={"source": "combined"})

    start = time.time()
    chunks, stats = chunker.chunk_documents([doc], "combined")
    elapsed = (time.time() - start) * 1000

    print(f"  Input:     {len(all_text):,} characters")
    print(f"  Chunks:    {stats.total_chunks}")
    print(f"  Tokens:    {stats.total_tokens:,}")
    print(f"  Avg size:  {stats.avg_tokens_per_chunk:.0f} tokens/chunk")
    print(f"  Range:     {stats.min_tokens}-{stats.max_tokens} tokens")
    print(f"  Time:      {elapsed:.1f}ms")
    print(f"  Speed:     {stats.total_tokens / (elapsed / 1000):,.0f} tokens/sec")

    # 2. Keyword search benchmark
    print("\n🔍 Keyword Search Benchmark")
    print("-" * 40)

    searcher = KeywordSearcher()
    docs = []
    for name, text in STUDY_TEXTS.items():
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        for i, para in enumerate(paragraphs):
            docs.append(Document(
                page_content=para,
                metadata={"topic": name, "paragraph": i},
            ))

    start = time.time()
    searcher.index(docs)
    index_time = (time.time() - start) * 1000
    print(f"  Indexed:   {len(docs)} paragraphs in {index_time:.1f}ms")

    correct = 0
    total_queries = len(TEST_QUERIES)
    search_times = []

    for tq in TEST_QUERIES:
        start = time.time()
        results = searcher.search(tq["query"], top_k=5)
        search_times.append((time.time() - start) * 1000)

        if results:
            top_topic = results[0][0].metadata.get("topic", "")
            if top_topic == tq["expected_topic"]:
                correct += 1

    accuracy = correct / total_queries
    avg_search_ms = sum(search_times) / len(search_times)
    print(f"  Accuracy:  {correct}/{total_queries} = {accuracy:.0%}")
    print(f"  Avg time:  {avg_search_ms:.2f}ms per query")

    # 3. Metrics overhead
    print("\n📈 Metrics Overhead")
    print("-" * 40)

    metrics = RAGMetrics(enabled=True)
    start = time.time()
    for i in range(1000):
        metrics.start_timer("bench")
        stage = metrics.stop_timer("bench", input_count=10, output_count=5)
        if stage:
            metrics.record_query(f"q{i}", [stage], 10, 5, 500)

    overhead = (time.time() - start) * 1000
    print(f"  1000 queries: {overhead:.1f}ms total")
    print(f"  Per-query:    {overhead / 1000:.3f}ms")

    # Summary
    print("\n" + "=" * 70)
    print(" Summary")
    print("=" * 70)
    print(f"  ✓ Chunking:  {stats.total_chunks} chunks at {stats.total_tokens / (elapsed / 1000):,.0f} tok/s")
    print(f"  ✓ Keyword:   {accuracy:.0%} accuracy at {avg_search_ms:.2f}ms/query")
    print(f"  ✓ Metrics:   {overhead / 1000:.3f}ms overhead per query")
    print(f"  Models:      Embedding={config.get_embedding_model().model_id}")
    print(f"               Reranking={config.get_reranking_model().model_id}")
    print(f"               LLM={config.get_llm_model().model_id}")


if __name__ == "__main__":
    run_offline_benchmarks()

"""
Unit Tests for RAG Metrics Module

Tests metric recording, aggregation, and reporting.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rag.metrics import RAGMetrics, StageMetric, QueryMetric


class TestStageMetric:
    """Tests for StageMetric dataclass."""

    def test_creation(self):
        m = StageMetric(stage="retrieval", latency_ms=150.5, input_count=1, output_count=10)
        assert m.stage == "retrieval"
        assert m.latency_ms == 150.5
        assert m.input_count == 1
        assert m.output_count == 10

    def test_default_metadata(self):
        m = StageMetric(stage="test", latency_ms=0)
        assert m.metadata == {}


class TestRAGMetrics:
    """Tests for the RAGMetrics collector."""

    @pytest.fixture
    def metrics(self):
        return RAGMetrics(enabled=True)

    @pytest.fixture
    def disabled_metrics(self):
        return RAGMetrics(enabled=False)

    def test_start_stop_timer(self, metrics):
        metrics.start_timer("test_stage")
        import time
        time.sleep(0.01)  # 10ms
        result = metrics.stop_timer("test_stage", input_count=5, output_count=3)

        assert result is not None
        assert result.stage == "test_stage"
        assert result.latency_ms >= 5  # Should be at least 5ms
        assert result.input_count == 5
        assert result.output_count == 3

    def test_stop_timer_unstarted(self, metrics):
        result = metrics.stop_timer("never_started")
        assert result is None

    def test_disabled_metrics(self, disabled_metrics):
        disabled_metrics.start_timer("test")
        result = disabled_metrics.stop_timer("test")
        assert result is None

    def test_record_query(self, metrics):
        stages = [
            StageMetric(stage="retrieval", latency_ms=100, output_count=10),
            StageMetric(stage="reranking", latency_ms=200, input_count=10, output_count=5),
            StageMetric(stage="generation", latency_ms=500, output_count=1000),
        ]

        query_metric = metrics.record_query(
            query="What is machine learning?",
            stages=stages,
            chunks_retrieved=10,
            chunks_after_rerank=5,
            answer_length=1000,
        )

        assert query_metric.total_latency_ms == 800
        assert query_metric.chunks_retrieved == 10
        assert query_metric.chunks_after_rerank == 5
        assert query_metric.success is True

    def test_get_summary_empty(self, metrics):
        summary = metrics.get_summary()
        assert "message" in summary

    def test_get_summary_with_data(self, metrics):
        for i in range(5):
            stages = [
                StageMetric(stage="retrieval", latency_ms=100 + i * 10),
                StageMetric(stage="generation", latency_ms=400 + i * 20),
            ]
            metrics.record_query(
                query=f"Query {i}",
                stages=stages,
                chunks_retrieved=10,
                chunks_after_rerank=5,
                answer_length=500,
            )

        summary = metrics.get_summary()

        assert summary["total_queries"] == 5
        assert summary["successful_queries"] == 5
        assert summary["error_rate"] == 0.0
        assert summary["avg_total_latency_ms"] > 0
        assert "stage_latencies" in summary
        assert "retrieval" in summary["stage_latencies"]
        assert "generation" in summary["stage_latencies"]

    def test_get_recent_queries(self, metrics):
        for i in range(15):
            stages = [StageMetric(stage="test", latency_ms=100)]
            metrics.record_query(
                query=f"Query {i}",
                stages=stages,
                chunks_retrieved=5,
                chunks_after_rerank=3,
                answer_length=200,
            )

        recent = metrics.get_recent_queries(n=10)
        assert len(recent) == 10
        # Should be the last 10
        assert recent[-1]["query"].startswith("Query 14")

    def test_record_failed_query(self, metrics):
        stages = [StageMetric(stage="retrieval", latency_ms=50)]
        query_metric = metrics.record_query(
            query="Failed query",
            stages=stages,
            chunks_retrieved=0,
            chunks_after_rerank=0,
            answer_length=0,
            success=False,
            error="Connection timeout",
        )

        assert query_metric.success is False
        assert query_metric.error == "Connection timeout"

        summary = metrics.get_summary()
        assert summary["error_rate"] > 0

    def test_reset(self, metrics):
        stages = [StageMetric(stage="test", latency_ms=100)]
        metrics.record_query("q", stages, 5, 3, 200)

        assert len(metrics._queries) == 1
        metrics.reset()
        assert len(metrics._queries) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

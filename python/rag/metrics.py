"""
RAG Metrics Module

Performance tracking, evaluation, and benchmarking for the RAG pipeline.
Measures latency, relevance, and throughput at each pipeline stage.
"""

import time
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class StageMetric:
    """Metrics for a single pipeline stage."""

    stage: str
    latency_ms: float
    input_count: int = 0
    output_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QueryMetric:
    """Complete metrics for a single query through the pipeline."""

    query: str
    timestamp: str
    total_latency_ms: float
    stages: List[StageMetric]
    chunks_retrieved: int
    chunks_after_rerank: int
    answer_length: int
    success: bool
    error: Optional[str] = None


class RAGMetrics:
    """
    Performance metrics collector for the RAG pipeline.

    Tracks:
    - Per-stage latency (chunking, embedding, retrieval, reranking, generation)
    - Throughput
    - Quality metrics (retrieval scores)
    - Error rates
    """

    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self._queries: List[QueryMetric] = []
        self._stage_timers: Dict[str, float] = {}

    def start_timer(self, stage: str) -> None:
        """Start timing a pipeline stage."""
        if self.enabled:
            self._stage_timers[stage] = time.time()

    def stop_timer(
        self,
        stage: str,
        input_count: int = 0,
        output_count: int = 0,
        **metadata,
    ) -> Optional[StageMetric]:
        """Stop timing a pipeline stage and return the metric."""
        if not self.enabled or stage not in self._stage_timers:
            return None

        elapsed_ms = (time.time() - self._stage_timers[stage]) * 1000
        del self._stage_timers[stage]

        metric = StageMetric(
            stage=stage,
            latency_ms=round(elapsed_ms, 2),
            input_count=input_count,
            output_count=output_count,
            metadata=metadata,
        )

        logger.debug(
            f"  [{stage}] {elapsed_ms:.1f}ms "
            f"({input_count} → {output_count})"
        )

        return metric

    def record_query(
        self,
        query: str,
        stages: List[StageMetric],
        chunks_retrieved: int,
        chunks_after_rerank: int,
        answer_length: int,
        success: bool = True,
        error: Optional[str] = None,
    ) -> QueryMetric:
        """Record metrics for a complete query."""
        if not self.enabled:
            return QueryMetric(
                query=query,
                timestamp=datetime.now().isoformat(),
                total_latency_ms=0,
                stages=[],
                chunks_retrieved=0,
                chunks_after_rerank=0,
                answer_length=0,
                success=success,
                error=error,
            )

        total_ms = sum(s.latency_ms for s in stages)

        metric = QueryMetric(
            query=query,
            timestamp=datetime.now().isoformat(),
            total_latency_ms=round(total_ms, 2),
            stages=stages,
            chunks_retrieved=chunks_retrieved,
            chunks_after_rerank=chunks_after_rerank,
            answer_length=answer_length,
            success=success,
            error=error,
        )

        self._queries.append(metric)

        logger.info(
            f"Query completed: {total_ms:.0f}ms total, "
            f"{chunks_retrieved} retrieved → {chunks_after_rerank} reranked, "
            f"{answer_length} chars answer"
        )

        return metric

    def get_summary(self) -> Dict[str, Any]:
        """Get aggregated performance summary."""
        if not self._queries:
            return {"message": "No queries recorded yet"}

        total_queries = len(self._queries)
        successful = sum(1 for q in self._queries if q.success)

        # Average latencies per stage
        stage_latencies: Dict[str, List[float]] = {}
        for q in self._queries:
            for s in q.stages:
                stage_latencies.setdefault(s.stage, []).append(s.latency_ms)

        avg_stage_latencies = {
            stage: {
                "avg_ms": round(sum(times) / len(times), 2),
                "min_ms": round(min(times), 2),
                "max_ms": round(max(times), 2),
                "count": len(times),
            }
            for stage, times in stage_latencies.items()
        }

        total_latencies = [q.total_latency_ms for q in self._queries]

        return {
            "total_queries": total_queries,
            "successful_queries": successful,
            "error_rate": round((total_queries - successful) / total_queries, 4),
            "avg_total_latency_ms": round(sum(total_latencies) / len(total_latencies), 2),
            "min_total_latency_ms": round(min(total_latencies), 2),
            "max_total_latency_ms": round(max(total_latencies), 2),
            "avg_chunks_retrieved": round(
                sum(q.chunks_retrieved for q in self._queries) / total_queries, 1
            ),
            "avg_chunks_after_rerank": round(
                sum(q.chunks_after_rerank for q in self._queries) / total_queries, 1
            ),
            "avg_answer_length": round(
                sum(q.answer_length for q in self._queries) / total_queries, 0
            ),
            "stage_latencies": avg_stage_latencies,
        }

    def get_recent_queries(self, n: int = 10) -> List[Dict[str, Any]]:
        """Get the N most recent query metrics."""
        recent = self._queries[-n:]
        return [
            {
                "query": q.query[:100],
                "total_ms": q.total_latency_ms,
                "chunks": q.chunks_retrieved,
                "reranked": q.chunks_after_rerank,
                "answer_len": q.answer_length,
                "success": q.success,
                "stages": {s.stage: s.latency_ms for s in q.stages},
            }
            for q in recent
        ]

    def reset(self) -> None:
        """Reset all recorded metrics."""
        self._queries.clear()
        self._stage_timers.clear()

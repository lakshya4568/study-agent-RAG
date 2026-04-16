#!/usr/bin/env python3
"""
Smoke test for HybridRetriever using the repository README.md.

This script is intended to be run with the project's virtual environment:
  ./.venv/bin/python python/tests/smoke_retriever_readme.py
"""

from __future__ import annotations

import os
import sys
import tempfile
import uuid
from pathlib import Path

from dotenv import load_dotenv

# Ensure local package imports resolve when run from repo root
THIS_FILE = Path(__file__).resolve()
PYTHON_DIR = THIS_FILE.parents[1]
REPO_ROOT = THIS_FILE.parents[2]
sys.path.insert(0, str(PYTHON_DIR))

from rag.config import RAGConfig
from rag.chunker import SemanticChunker
from rag.embedder import NVIDIAEmbedder
from rag.retriever import HybridRetriever


def ensure_virtualenv() -> None:
    """Fail fast if Python is not running from project .venv."""
    if sys.prefix == getattr(sys, "base_prefix", sys.prefix):
        raise RuntimeError(
            "This smoke test must be run with the project virtualenv. "
            "Use: ./.venv/bin/python python/tests/smoke_retriever_readme.py"
        )


def main() -> int:
    ensure_virtualenv()

    load_dotenv(REPO_ROOT / ".env")

    if not os.getenv("NVIDIA_API_KEY"):
        raise RuntimeError("NVIDIA_API_KEY is not set in the environment")

    readme_path = REPO_ROOT / "README.md"
    if not readme_path.exists():
        raise FileNotFoundError(f"README not found: {readme_path}")

    readme_text = readme_path.read_text(encoding="utf-8")

    with tempfile.TemporaryDirectory(prefix="retriever-smoke-") as temp_dir:
        config = RAGConfig.from_env()
        config.chroma_persist_dir = temp_dir
        config.collection_name = f"retriever_smoke_{uuid.uuid4().hex[:8]}"

        embedder = NVIDIAEmbedder(config).initialize()
        retriever = HybridRetriever(config, embedder).initialize()
        chunker = SemanticChunker(config)

        chunks, chunk_stats = chunker.chunk_text(readme_text, source_name="README.md")
        if chunk_stats.total_chunks == 0:
            raise RuntimeError("Chunker produced zero chunks for README.md")

        added = retriever.add_documents(chunks)
        if added != chunk_stats.total_chunks:
            raise RuntimeError(
                f"Unexpected add count: added={added}, expected={chunk_stats.total_chunks}"
            )

        query = "What is this AI Study Agent project about?"
        first_results = retriever.retrieve(query, top_k=3)
        if not first_results:
            raise RuntimeError("Retriever returned no results on first retrieval")

        # This step validates stale/missing-collection recovery logic.
        retriever.clear()
        added_after_clear = retriever.add_documents(chunks)
        if added_after_clear != chunk_stats.total_chunks:
            raise RuntimeError(
                "Failed to add chunks after clear; missing collection recovery may be broken"
            )

        second_results = retriever.retrieve(query, top_k=3)
        if not second_results:
            raise RuntimeError("Retriever returned no results after clear-and-reload")

        print("SMOKE TEST PASSED")
        print(f"  Chunks indexed: {chunk_stats.total_chunks}")
        print(f"  First retrieval results: {len(first_results)}")
        print(f"  Post-clear retrieval results: {len(second_results)}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"SMOKE TEST FAILED: {exc}")
        raise SystemExit(1)

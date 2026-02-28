"""
Enhanced NVIDIA RAG Pipeline - Modular Architecture

A production-grade RAG system with:
- Configurable NVIDIA embedding models (nv-embedqa, nemoretriever, nv-embedcode)
- Reranking with NVIDIA NV-RerankQA
- Hybrid search (semantic + keyword)
- Token-aware chunking with semantic boundaries
- Performance metrics and evaluation
"""

from .config import RAGConfig, ModelConfig
from .embedder import NVIDIAEmbedder
from .chunker import SemanticChunker
from .retriever import HybridRetriever
from .reranker import NVIDIAReranker
from .generator import NVIDIAGenerator
from .pipeline import RAGPipeline
from .metrics import RAGMetrics

__all__ = [
    "RAGConfig",
    "ModelConfig",
    "NVIDIAEmbedder",
    "SemanticChunker",
    "HybridRetriever",
    "NVIDIAReranker",
    "NVIDIAGenerator",
    "RAGPipeline",
    "RAGMetrics",
]

__version__ = "2.0.0"

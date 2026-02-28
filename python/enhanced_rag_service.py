#!/usr/bin/env python3
"""
Enhanced NVIDIA RAG Service v2.0

FastAPI service built on the modular RAG pipeline.
Features:
- Configurable NVIDIA embedding models (nv-embedqa, nemoretriever, nv-embedcode)
- Reranking with NVIDIA NV-RerankQA
- Hybrid search (semantic + keyword via RRF)
- Token-aware semantic chunking
- Per-query performance metrics
- Streaming support
"""

import os
import json
import logging
from typing import List, Optional, Dict, Any, AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Modular RAG imports
from rag import RAGConfig, RAGPipeline

load_dotenv()

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("rag_service")

# ── Global Pipeline ────────────────────────────────────────────────────────────
pipeline: Optional[RAGPipeline] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and teardown the RAG pipeline."""
    global pipeline

    config = RAGConfig.from_env()

    logger.info("Starting Enhanced RAG Service v2.0")
    logger.info(f"  Embedding: {config.get_embedding_model().model_id}")
    logger.info(f"  Reranking: {config.get_reranking_model().model_id}")
    logger.info(f"  LLM:       {config.get_llm_model().model_id}")
    logger.info(f"  Hybrid:    {config.enable_hybrid_search}")

    pipeline = RAGPipeline(config)
    pipeline.initialize()

    logger.info("✓ RAG Service ready")
    yield

    logger.info("Shutting down RAG Service")


# ── FastAPI App ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Enhanced NVIDIA RAG Service",
    description="Modular RAG pipeline with NVIDIA embeddings, reranking, and hybrid search",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response Models ────────────────────────────────────────────────────

class DocumentRequest(BaseModel):
    pdf_path: str = Field(..., description="Path to PDF file")


class TextLoadRequest(BaseModel):
    text: str = Field(..., description="Raw text content to index")
    source_name: str = Field(default="text_input", description="Source identifier")


class QueryRequest(BaseModel):
    question: str = Field(..., description="User question")
    top_k: int = Field(default=10, description="Number of chunks to retrieve")
    stream: bool = Field(default=False, description="Enable streaming response")


class HealthResponse(BaseModel):
    status: str
    nvidia_key_set: bool
    embedding_model: str
    reranking_model: str
    llm_model: str
    hybrid_search: bool
    reranking_enabled: bool
    chunk_size_tokens: int
    chunk_overlap_tokens: int


class DocumentResponse(BaseModel):
    status: str
    chunks: int
    message: str
    chunk_stats: Dict[str, Any]
    timings: Optional[Dict[str, Any]] = None


class Source(BaseModel):
    content: str
    metadata: Dict[str, Any]


class QueryResponse(BaseModel):
    answer: str
    sources: List[Source]
    chunks_retrieved: int
    metrics: Optional[Dict[str, Any]] = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check with pipeline configuration."""
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")
    return pipeline.get_health()


@app.post("/load-document", response_model=DocumentResponse)
async def load_document(request: DocumentRequest):
    """Load and vectorize a PDF document."""
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    try:
        result = pipeline.load_pdf(request.pdf_path)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Document load error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/load-text")
async def load_text(request: TextLoadRequest):
    """Load and index raw text content."""
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    try:
        result = pipeline.load_text(request.text, request.source_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Text load error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
async def query_rag(request: QueryRequest):
    """Query the RAG pipeline with optional streaming."""
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    try:
        if request.stream:

            async def generate() -> AsyncIterator[str]:
                async for chunk in pipeline.query_stream(
                    request.question, top_k=request.top_k
                ):
                    yield chunk

            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        else:
            result = pipeline.query(request.question, top_k=request.top_k)
            return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/collection/stats")
async def get_collection_stats():
    """Get collection statistics."""
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    return pipeline.get_collection_stats()


@app.get("/metrics")
async def get_metrics():
    """Get pipeline performance metrics."""
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    return pipeline.get_metrics_summary()


@app.get("/metrics/recent")
async def get_recent_metrics():
    """Get recent query metrics."""
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    return pipeline.metrics.get_recent_queries(n=20)


@app.get("/pipeline/stats")
async def get_pipeline_stats():
    """Get comprehensive pipeline statistics."""
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    return pipeline.get_pipeline_stats()


@app.get("/models/embeddings")
async def list_embedding_models():
    """List available NVIDIA embedding models."""
    from rag.embedder import NVIDIAEmbedder
    models = NVIDIAEmbedder.list_available_models()
    current = pipeline.config.embedding_model if pipeline else "unknown"
    return {"current": current, "available": models}


@app.get("/models/reranking")
async def list_reranking_models():
    """List available NVIDIA reranking models."""
    from rag.reranker import NVIDIAReranker
    models = NVIDIAReranker.list_available_models()
    current = pipeline.config.reranking_model if pipeline else "unknown"
    return {"current": current, "available": models}


@app.delete("/collection")
async def clear_collection():
    """Clear all documents from the collection."""
    if not pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not initialized")

    return pipeline.clear_collection()


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("RAG_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

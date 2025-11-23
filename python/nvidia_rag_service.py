#!/usr/bin/env python3
"""
Enhanced NVIDIA RAG Service with Streaming Support
Optimized for Kimi K2 Instruct model with clean architecture
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, AsyncIterator
from contextlib import asynccontextmanager
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Core imports
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings, ChatNVIDIA
from langchain_community.vectorstores import Chroma
from langchain.schema import Document
from langchain_core.prompts import ChatPromptTemplate
import tiktoken

# Load environment
load_dotenv()

# Configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME = "study_materials"

# Model Configuration
EMBEDDING_MODEL = "nvidia/llama-3.2-nemoretriever-300m-embed-v2"
LLM_MODEL = "moonshotai/kimi-k2-instruct"

# RAG Configuration (Token-based)
CHUNK_SIZE = 512  # tokens
CHUNK_OVERLAP = 128  # 25% overlap
TOP_K_RETRIEVAL = 5

# Semantic separators for better chunking
SEMANTIC_SEPARATORS = [
    "\n\n\n",  # Section breaks
    "\n\n",  # Paragraph breaks
    "\n",  # Line breaks
    ". ",  # Sentence ends
    "? ",  # Question ends
    "! ",  # Exclamation ends
    "; ",  # Semicolon
    ", ",  # Comma
    " ",  # Words
    "",  # Characters
]

# Initialize tokenizer
try:
    tokenizer = tiktoken.get_encoding("cl100k_base")
except Exception as e:
    print(f"⚠️ Tiktoken failed: {e}")
    tokenizer = None

# Global instances
embeddings: Optional[NVIDIAEmbeddings] = None
llm: Optional[ChatNVIDIA] = None
llm_streaming: Optional[ChatNVIDIA] = None
vector_store: Optional[Chroma] = None


def token_length(text: str) -> int:
    """Calculate token length"""
    if tokenizer:
        return len(tokenizer.encode(text))
    return len(text) // 4  # Fallback approximation


async def initialize_clients():
    """Initialize NVIDIA clients"""
    global embeddings, llm, llm_streaming

    if not NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY not set")

    # Embeddings
    embeddings = NVIDIAEmbeddings(
        model=EMBEDDING_MODEL, nvidia_api_key=NVIDIA_API_KEY, truncate="NONE"
    )

    # LLM for standard queries
    llm = ChatNVIDIA(
        model=LLM_MODEL,
        nvidia_api_key=NVIDIA_API_KEY,
        temperature=0.6,  # Recommended for Kimi K2
        top_p=0.9,
        max_completion_tokens=4096,
    )

    # LLM for streaming queries
    llm_streaming = ChatNVIDIA(
        model=LLM_MODEL,
        nvidia_api_key=NVIDIA_API_KEY,
        temperature=0.6,
        top_p=0.9,
        max_completion_tokens=4096,
        streaming=True,  # Enable streaming
    )

    print(f"✓ NVIDIA clients initialized (Model: {LLM_MODEL})")


def get_vector_store() -> Chroma:
    """Get or create vector store"""
    global vector_store

    if vector_store is None:
        Path(CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
        vector_store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=embeddings,
            persist_directory=CHROMA_PERSIST_DIR,
        )

    return vector_store


def create_optimized_chunks(documents: List[Document]) -> List[Document]:
    """Create semantic chunks using token-based splitting"""

    # Token-based splitter
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        encoding_name="cl100k_base",
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=SEMANTIC_SEPARATORS,
        is_separator_regex=False,
    )

    # Split documents
    chunks = text_splitter.split_documents(documents)

    # Enrich metadata
    for i, chunk in enumerate(chunks):
        chunk.metadata.update(
            {
                "chunk_id": i,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "chunk_size_tokens": token_length(chunk.page_content),
                "preview": chunk.page_content[:100].replace("\n", " "),
            }
        )

    print(
        f"✓ Created {len(chunks)} chunks (avg: {sum(token_length(c.page_content) for c in chunks) // len(chunks)} tokens)"
    )

    return chunks


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown"""
    await initialize_clients()
    get_vector_store()
    print("✓ RAG service ready")
    yield


# FastAPI app
app = FastAPI(
    title="Enhanced NVIDIA RAG Service",
    description="RAG pipeline with Kimi K2 Instruct and streaming support",
    version="3.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class DocumentRequest(BaseModel):
    pdf_path: str = Field(..., description="Path to PDF file")


class QueryRequest(BaseModel):
    question: str = Field(..., description="User question")
    top_k: int = Field(default=TOP_K_RETRIEVAL, description="Number of chunks")
    stream: bool = Field(default=False, description="Enable streaming response")


class Source(BaseModel):
    content: str
    metadata: Dict[str, Any]


class QueryResponse(BaseModel):
    answer: str
    sources: List[Source]
    chunks_retrieved: int


class DocumentResponse(BaseModel):
    status: str
    chunks: int
    message: str
    chunk_stats: Dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    nvidia_key_set: bool
    embedding_model: str
    llm_model: str
    streaming_support: bool
    chunk_size_tokens: int
    chunk_overlap_tokens: int


# Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check"""
    return {
        "status": "ok",
        "nvidia_key_set": bool(NVIDIA_API_KEY),
        "embedding_model": EMBEDDING_MODEL,
        "llm_model": LLM_MODEL,
        "streaming_support": True,
        "chunk_size_tokens": CHUNK_SIZE,
        "chunk_overlap_tokens": CHUNK_OVERLAP,
    }


@app.post("/load-document", response_model=DocumentResponse)
async def load_document(request: DocumentRequest):
    """Load and vectorize PDF with semantic chunking"""
    try:
        pdf_path = request.pdf_path

        # Resolve path
        if not os.path.isabs(pdf_path):
            pdf_path = os.path.abspath(pdf_path)

        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=404, detail=f"File not found: {pdf_path}")

        if not pdf_path.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files supported")

        # Load PDF
        print(f"📥 Loading: {pdf_path}")
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()

        if not documents:
            raise HTTPException(status_code=400, detail="PDF has no content")

        # Create chunks
        chunks = create_optimized_chunks(documents)

        # Add to vector store
        store = get_vector_store()
        store.add_documents(chunks)
        store.persist()

        # Statistics
        token_counts = [token_length(c.page_content) for c in chunks]
        chunk_stats = {
            "total_chunks": len(chunks),
            "avg_tokens_per_chunk": sum(token_counts) // len(token_counts),
            "min_tokens": min(token_counts),
            "max_tokens": max(token_counts),
            "total_tokens": sum(token_counts),
        }

        print(f"✓ Indexed {len(chunks)} chunks")

        return {
            "status": "success",
            "chunks": len(chunks),
            "message": f"Processed {os.path.basename(pdf_path)} into {len(chunks)} chunks",
            "chunk_stats": chunk_stats,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
async def query_rag(request: QueryRequest):
    """Query RAG pipeline with optional streaming"""
    try:
        question = request.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        # Retrieve relevant documents
        store = get_vector_store()
        results_with_scores = store.similarity_search_with_score(
            question, k=request.top_k
        )

        if not results_with_scores:
            return {
                "answer": "No relevant information found. Please upload documents first.",
                "sources": [],
                "chunks_retrieved": 0,
            }

        relevant_docs = [doc for doc, _ in results_with_scores]

        # Log retrieved chunks
        print(f"🔍 Retrieved {len(results_with_scores)} chunks for query: '{question}'")
        for i, (doc, score) in enumerate(results_with_scores):
            source = doc.metadata.get("source", "Unknown")
            page = doc.metadata.get("page", "?")
            print(f"  [{i+1}] Score: {score:.4f} | Source: {os.path.basename(source)} (Page {page})")
            print(f"      Preview: {doc.page_content[:100].replace('\n', ' ')}...")

        # Build context
        context = "\n\n".join(
            [
                f"[Document {i+1}]\n{doc.page_content}"
                for i, doc in enumerate(relevant_docs)
            ]
        )

        # Prompt
        prompt = f"""You are a helpful study assistant. Use the following context to answer accurately and concisely.

Context from documents:
{context}

Question: {question}

Answer:"""

        # Format sources
        sources = []
        for doc, score in results_with_scores:
            metadata = doc.metadata.copy()
            metadata["retrieval_score"] = float(score)
            sources.append(
                {
                    "content": doc.page_content[:500]
                    + ("..." if len(doc.page_content) > 500 else ""),
                    "metadata": metadata,
                }
            )

        # Streaming vs non-streaming
        if request.stream:

            async def generate() -> AsyncIterator[str]:
                """Stream response chunks"""
                try:
                    async for chunk in llm_streaming.astream(prompt): # type: ignore
                        if hasattr(chunk, "content"):
                            yield f"data: {json.dumps({'content': chunk.content})}\n\n"

                    # Send sources at the end
                    yield f"data: {json.dumps({'sources': sources, 'chunks_retrieved': len(relevant_docs)})}\n\n"
                    yield "data: [DONE]\n\n"

                except Exception as e:
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"

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
            # Non-streaming response
            response = llm.invoke(prompt) #type: ignore

            return {
                "answer": response.content,
                "sources": sources,
                "chunks_retrieved": len(relevant_docs),
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/collection/stats")
async def get_collection_stats():
    """Get collection statistics"""
    try:
        store = get_vector_store()
        collection = store._collection
        count = collection.count()

        return {
            "collection_name": COLLECTION_NAME,
            "document_count": count,
            "persist_dir": CHROMA_PERSIST_DIR,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/collection")
async def clear_collection():
    """Clear all documents"""
    try:
        store = get_vector_store()
        store.delete_collection()
        print("✓ Collection cleared")

        return {"status": "success", "message": "Collection cleared"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("RAG_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

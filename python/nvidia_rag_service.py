#!/usr/bin/env python3
"""
NVIDIA RAG Service with FastAPI, LangChain, and ChromaDB Persistence
Single-machine deployment with persistent vector storage

This service provides REST endpoints for:
- Document ingestion (PDF loading and vectorization)
- RAG-based querying with NVIDIA embeddings and LLM
- Health checks and status monitoring

Usage:
    python nvidia_rag_service.py
    # or
    uvicorn nvidia_rag_service:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# LangChain imports
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings, ChatNVIDIA
from langchain_community.vectorstores import Chroma
from langchain.schema import Document

# Load environment variables
load_dotenv()

# Configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME = "study_materials"

# NVIDIA Model Configuration
EMBEDDING_MODEL = "nvidia/nv-embedqa-e5-v5"
LLM_MODEL = "meta/llama-3.1-70b-instruct"

# RAG Configuration
CHUNK_SIZE = 2048  # ~512 tokens
CHUNK_OVERLAP = 200  # ~50 tokens overlap
TOP_K_RETRIEVAL = 4

# Global instances (defined before lifespan)
embeddings: Optional[NVIDIAEmbeddings] = None
llm: Optional[ChatNVIDIA] = None
vector_store: Optional[Chroma] = None


def initialize_nvidia_clients():
    """Initialize NVIDIA embeddings and LLM clients"""
    global embeddings, llm

    if not NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY environment variable is not set")

    try:
        embeddings = NVIDIAEmbeddings(
            model=EMBEDDING_MODEL, nvidia_api_key=NVIDIA_API_KEY, truncate="NONE"
        )

        llm = ChatNVIDIA(
            model=LLM_MODEL,
            nvidia_api_key=NVIDIA_API_KEY,
            temperature=0.1,
            max_completion_tokens=2048,
        )

        print(
            f"✓ NVIDIA clients initialized (Embedding: {EMBEDDING_MODEL}, LLM: {LLM_MODEL})",
            file=sys.stderr,
        )
    except Exception as e:
        print(f"✗ Failed to initialize NVIDIA clients: {e}", file=sys.stderr)
        raise


def get_vector_store() -> Chroma:
    """Get or create ChromaDB vector store with persistent storage"""
    global vector_store

    if vector_store is None:
        # Ensure persist directory exists
        Path(CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)

        vector_store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=embeddings,
            persist_directory=CHROMA_PERSIST_DIR,
        )
        print(
            f"✓ ChromaDB initialized (persist_dir: {CHROMA_PERSIST_DIR})",
            file=sys.stderr,
        )

    return vector_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    # Startup
    try:
        initialize_nvidia_clients()
        get_vector_store()  # Initialize ChromaDB
        print("✓ RAG service ready", file=sys.stderr)
    except Exception as e:
        print(f"✗ Startup failed: {e}", file=sys.stderr)
        raise

    yield

    # Shutdown (if needed)
    pass


# Initialize FastAPI with lifespan
app = FastAPI(
    title="NVIDIA RAG Service",
    description="RAG pipeline with NVIDIA embeddings and ChromaDB persistence",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Electron app origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response validation
class DocumentRequest(BaseModel):
    pdf_path: str = Field(..., description="Absolute or relative path to PDF file")


class QueryRequest(BaseModel):
    question: str = Field(..., description="User's question to answer")
    chat_history: List[Dict[str, str]] = Field(
        default=[], description="Previous conversation context"
    )
    top_k: int = Field(
        default=TOP_K_RETRIEVAL, description="Number of chunks to retrieve"
    )


class DocumentResponse(BaseModel):
    status: str
    chunks: int
    message: str


class Source(BaseModel):
    content: str
    metadata: Dict[str, Any]


class QueryResponse(BaseModel):
    answer: str
    sources: List[Source]
    chunks_retrieved: int


class HealthResponse(BaseModel):
    status: str
    nvidia_key_set: bool
    persist_dir: str
    collection_name: str
    embedding_model: str
    llm_model: str


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "nvidia_key_set": bool(NVIDIA_API_KEY),
        "persist_dir": CHROMA_PERSIST_DIR,
        "collection_name": COLLECTION_NAME,
        "embedding_model": EMBEDDING_MODEL,
        "llm_model": LLM_MODEL,
    }


@app.post("/load-document", response_model=DocumentResponse)
async def load_document(request: DocumentRequest):
    """
    Load and vectorize a PDF document

    This endpoint:
    1. Loads PDF from the provided path
    2. Splits into chunks with semantic boundaries
    3. Generates embeddings using NVIDIA
    4. Stores in ChromaDB with persistence
    """
    try:
        pdf_path = request.pdf_path

        # Resolve path (support relative and absolute)
        if not os.path.isabs(pdf_path):
            pdf_path = os.path.abspath(pdf_path)

        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=404, detail=f"File not found: {pdf_path}")

        if not pdf_path.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        # Load PDF
        print(f"Loading PDF: {pdf_path}", file=sys.stderr)
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()

        if not documents:
            raise HTTPException(
                status_code=400, detail="PDF contains no extractable content"
            )

        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=[
                "\n\n\n",
                "\n\n",
                "\n",
                ". ",
                "! ",
                "? ",
                "; ",
                ": ",
                ", ",
                " ",
                "",
            ],
        )
        split_docs = text_splitter.split_documents(documents)

        # Add to vector store
        store = get_vector_store()
        store.add_documents(split_docs)

        # Persist to disk
        store.persist()

        print(
            f"✓ Loaded {len(split_docs)} chunks from {os.path.basename(pdf_path)}",
            file=sys.stderr,
        )

        return {
            "status": "success",
            "chunks": len(split_docs),
            "message": f"Successfully loaded {len(split_docs)} chunks from {os.path.basename(pdf_path)}",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Error loading document: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """
    Query the RAG pipeline

    This endpoint:
    1. Retrieves relevant document chunks using similarity search
    2. Constructs a prompt with context
    3. Generates answer using NVIDIA LLM
    4. Returns answer with source citations
    """
    try:
        question = request.question

        if not question or not question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        # Retrieve relevant documents
        store = get_vector_store()
        retriever = store.as_retriever(
            search_type="similarity", search_kwargs={"k": request.top_k}
        )

        relevant_docs = retriever.get_relevant_documents(question)

        if not relevant_docs:
            return {
                "answer": "I don't have enough information in my knowledge base to answer this question. Please upload relevant documents first.",
                "sources": [],
                "chunks_retrieved": 0,
            }

        # Build context from retrieved documents
        context = "\n\n".join(
            [
                f"[Document {i+1}]\n{doc.page_content}"
                for i, doc in enumerate(relevant_docs)
            ]
        )

        # Construct prompt
        prompt = f"""You are a helpful study assistant. Use the following context from study materials to answer the question accurately and concisely.

Context from documents:
{context}

Question: {question}

Instructions:
- Answer based ONLY on the provided context
- If the context doesn't contain the answer, say so
- Cite specific information from the documents when relevant
- Be clear and educational in your explanation

Answer:"""

        # Generate response
        response = llm.invoke(prompt)  # type: ignore

        # Format sources
        sources = [
            {
                "content": doc.page_content[:500]
                + ("..." if len(doc.page_content) > 500 else ""),
                "metadata": doc.metadata,
            }
            for doc in relevant_docs
        ]

        print(f"✓ Answered query with {len(relevant_docs)} chunks", file=sys.stderr)

        return {
            "answer": response.content,
            "sources": sources,
            "chunks_retrieved": len(relevant_docs),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Error querying RAG: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/collection")
async def clear_collection():
    """Clear all documents from the collection"""
    try:
        global vector_store

        if vector_store:
            # Delete and recreate collection
            vector_store._client.delete_collection(name=COLLECTION_NAME)
            vector_store = None  # Force recreation
            get_vector_store()  # Recreate empty collection

        return {"status": "success", "message": "Collection cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/collection/stats")
async def collection_stats():
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


if __name__ == "__main__":
    import uvicorn

    # Get port from environment or use default
    PORT = int(os.getenv("RAG_PORT", "8000"))

    print("=" * 60, file=sys.stderr)
    print("NVIDIA RAG Service Starting", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print(f"Port: {PORT}", file=sys.stderr)
    print(f"Persist Directory: {CHROMA_PERSIST_DIR}", file=sys.stderr)
    print(f"Collection Name: {COLLECTION_NAME}", file=sys.stderr)
    print(f"Embedding Model: {EMBEDDING_MODEL}", file=sys.stderr)
    print(f"LLM Model: {LLM_MODEL}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")

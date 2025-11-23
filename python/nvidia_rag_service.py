#!/usr/bin/env python3
"""
NVIDIA RAG Service with Optimized Semantic Chunking
Enhanced document processing with better chunk creation for retrieval
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# LangChain imports
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings, ChatNVIDIA
from langchain_community.vectorstores import Chroma
from langchain.schema import Document
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
import asyncio
import tiktoken
import warnings

# Suppress LangChain deprecation warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)


# MCP imports for tool integration
try:
    from langchain_mcp_adapters.client import MultiServerMCPClient

    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    print(
        "⚠️ langchain-mcp-adapters not installed. MCP tools disabled.", file=sys.stderr
    )

# Load environment variables
load_dotenv()

# Configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
COLLECTION_NAME = "study_materials"

# NVIDIA Model Configuration
EMBEDDING_MODEL = "nvidia/llama-3.2-nemoretriever-300m-embed-v2"
LLM_MODEL = "moonshotai/kimi-k2-instruct"

# Optimized RAG Configuration (Token-based for better alignment)
# Using tokens instead of characters for better model alignment
CHUNK_SIZE = 512  # tokens (roughly 2000 characters)
CHUNK_OVERLAP = 128  # tokens (25% overlap recommended)
TOP_K_RETRIEVAL = 5

# Separators for better semantic boundaries
SEMANTIC_SEPARATORS = [
    "\n\n\n",  # Multiple newlines (chapter/section breaks)
    "\n\n",  # Paragraph breaks
    "\n",  # Line breaks
    ". ",  # Sentence ends
    "! ",  # Exclamation ends
    "? ",  # Question ends
    "; ",  # Semicolon breaks
    ": ",  # Colon breaks
    ", ",  # Comma breaks
    " ",  # Word breaks
    "",  # Character breaks
]

# Initialize tokenizer for token counting (using cl100k_base encoding for general use)
try:
    tokenizer = tiktoken.get_encoding("cl100k_base")
except Exception as e:
    print(
        f"⚠️ Failed to load tiktoken encoder, falling back to character-based: {e}",
        file=sys.stderr,
    )
    tokenizer = None

# MCP Server Configuration
MCP_SERVERS = {}
mcp_config_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mcp.json"
)
if os.path.exists(mcp_config_path):
    try:
        with open(mcp_config_path, "r") as f:
            config = json.load(f)
            servers = config.get("mcpServers", {})
            for name, server_config in servers.items():
                if "command" in server_config:
                    MCP_SERVERS[name] = {
                        "transport": "stdio",
                        "command": server_config["command"],
                        "args": server_config.get("args", []),
                        "env": server_config.get("env", {}),
                    }
                elif "url" in server_config:
                    MCP_SERVERS[name] = {
                        "transport": "sse",
                        "url": server_config["url"],
                        "env": server_config.get("env", {}),
                    }
        print(f"✓ Loaded {len(MCP_SERVERS)} MCP servers from mcp.json", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Failed to load mcp.json: {e}", file=sys.stderr)
else:
    print(f"ℹ️ mcp.json not found at {mcp_config_path}", file=sys.stderr)

# Global instances
embeddings: Optional[NVIDIAEmbeddings] = None
llm: Optional[ChatNVIDIA] = None
llm_with_tools: Optional[Any] = None
vector_store: Optional[Chroma] = None
mcp_client: Optional[Any] = None
mcp_tools: List[Any] = []
tools_loaded: bool = False


def token_length_function(text: str) -> int:
    """Calculate token length for text using tiktoken"""
    if tokenizer:
        return len(tokenizer.encode(text))
    else:
        # Fallback: approximate 1 token ≈ 4 characters
        return len(text) // 4


class StructuredAnswer(BaseModel):
    """Structured answer format with citations"""

    answer: str = Field(description="The main answer to the question")
    confidence: str = Field(description="Confidence level: high, medium, or low")
    key_points: List[str] = Field(
        description="Key points from the answer as bullet points"
    )
    citations: List[int] = Field(description="List of document indices used (1-based)")


async def load_mcp_tools() -> List[Any]:
    """Load tools from MCP servers asynchronously"""
    global mcp_client, mcp_tools, tools_loaded
    if not MCP_AVAILABLE:
        print("⚠️ MCP not available, skipping tool loading", file=sys.stderr)
        return []
    if not MCP_SERVERS:
        print("ℹ️ No MCP servers configured, skipping tool loading", file=sys.stderr)
        return []
    try:
        print("🔧 Loading MCP tools from servers...", file=sys.stderr)
        mcp_client = MultiServerMCPClient(MCP_SERVERS)  # type: ignore
        print("  - Connecting to MCP servers...", file=sys.stderr)
        tools = await mcp_client.get_tools()
        mcp_tools = tools
        tools_loaded = True
        print(
            f"✓ Loaded {len(tools)} MCP tools: {[t.name for t in tools]}",
            file=sys.stderr,
        )
        return tools
    except Exception as e:
        print(f"✗ Failed to load MCP tools: {e}", file=sys.stderr)
        mcp_tools = []
        tools_loaded = False
        return []


async def initialize_nvidia_clients():
    """Initialize NVIDIA embeddings and LLM clients"""
    global embeddings, llm, llm_with_tools
    if not NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY environment variable is not set")

    try:
        embeddings = NVIDIAEmbeddings(
            model=EMBEDDING_MODEL, nvidia_api_key=NVIDIA_API_KEY, truncate="NONE"
        )
        print("  - Embeddings initialized", file=sys.stderr)

        llm = ChatNVIDIA(
            model=LLM_MODEL,
            nvidia_api_key=NVIDIA_API_KEY,
            temperature=0.6,
            top_p=0.9,
            top_p=0.9,
            max_completion_tokens=4096,
        )

        # Load MCP tools if available
        loaded_tools = []
        if MCP_AVAILABLE and MCP_SERVERS:
            try:
                print("  - Loading MCP tools...", file=sys.stderr)
                loaded_tools = await load_mcp_tools()
            except Exception as e:
                print(f"⚠️ MCP tool loading failed: {e}", file=sys.stderr)

        if loaded_tools:
            llm_with_tools = llm.bind_tools(loaded_tools, tool_choice="auto")
            print(f"✓ LLM bound with {len(loaded_tools)} MCP tools", file=sys.stderr)
        else:
            llm_with_tools = llm.bind_tools([], tool_choice="auto")
            print("ℹ️ LLM initialized without MCP tools", file=sys.stderr)

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


def create_optimized_chunks(documents: List[Document]) -> List[Document]:
    """
    Create optimized semantic chunks using token-based splitting
    This approach is similar to ChatGPT's chunking strategy:
    - Token-based measurement (not character-based)
    - Semantic separators that preserve context
    - Optimal overlap for context retention
    - Metadata enrichment for better retrieval
    """
    # Create token-based text splitter with semantic separators
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        encoding_name="cl100k_base",  # Use tiktoken for accurate token counting
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=SEMANTIC_SEPARATORS,
        is_separator_regex=False,
    )

    print(f"📄 Processing {len(documents)} document pages...", file=sys.stderr)

    # Split documents
    chunks = text_splitter.split_documents(documents)

    # Enrich metadata for better retrieval
    enriched_chunks = []
    for i, chunk in enumerate(chunks):
        # Add chunk metadata
        chunk.metadata.update(
            {
                "chunk_id": i,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "chunk_size_tokens": token_length_function(chunk.page_content),
            }
        )

        # Add first 100 characters as preview for debugging
        chunk.metadata["preview"] = chunk.page_content[:100].replace("\n", " ")

        enriched_chunks.append(chunk)

    print(
        f"✓ Created {len(enriched_chunks)} optimized semantic chunks", file=sys.stderr
    )
    print(
        f"  - Average size: {sum(token_length_function(c.page_content) for c in enriched_chunks) // len(enriched_chunks)} tokens",
        file=sys.stderr,
    )
    print(
        f"  - Chunk size range: {min(token_length_function(c.page_content) for c in enriched_chunks)}-{max(token_length_function(c.page_content) for c in enriched_chunks)} tokens",
        file=sys.stderr,
    )

    return enriched_chunks


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    try:
        await initialize_nvidia_clients()
        get_vector_store()
        print("✓ RAG service ready", file=sys.stderr)
    except Exception as e:
        print(f"✗ Startup failed: {e}", file=sys.stderr)
        raise
    yield


# Initialize FastAPI with lifespan
app = FastAPI(
    title="NVIDIA RAG Service",
    description="RAG pipeline with optimized semantic chunking and NVIDIA embeddings",
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
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
    chunk_stats: Dict[str, Any]


class Source(BaseModel):
    content: str
    metadata: Dict[str, Any]


class QueryResponse(BaseModel):
    answer: str
    sources: List[Source]
    chunks_retrieved: int


class ToolDefinition(BaseModel):
    name: str
    description: str
    inputSchema: Optional[Dict[str, Any]] = None
    serverId: str
    serverName: str


class AgentQueryRequest(BaseModel):
    question: str
    use_rag: bool = True
    auto_route: bool = True
    top_k: int = 5
    max_iterations: int = 5
    tools: Optional[List[ToolDefinition]] = None


class AgentQueryResponse(BaseModel):
    success: bool
    answer: str
    sources: Optional[List[str]] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None


class StructuredQueryResponse(BaseModel):
    answer: str
    confidence: str
    key_points: List[str]
    citations: List[int]
    sources: List[Source]
    chunks_retrieved: int


class HealthResponse(BaseModel):
    status: str
    nvidia_key_set: bool
    persist_dir: str
    collection_name: str
    embedding_model: str
    llm_model: str
    chunk_size_tokens: int
    chunk_overlap_tokens: int


class EmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to embed")


class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    dimensions: int


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
        "chunk_size_tokens": CHUNK_SIZE,
        "chunk_overlap_tokens": CHUNK_OVERLAP,
    }


@app.post("/load-document", response_model=DocumentResponse)
async def load_document(request: DocumentRequest):
    """
    Load and vectorize a PDF document with optimized semantic chunking
    """
    try:
        pdf_path = request.pdf_path

        # Resolve path
        if not os.path.isabs(pdf_path):
            pdf_path = os.path.abspath(pdf_path)

        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=404, detail=f"File not found: {pdf_path}")

        if not pdf_path.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        # Load PDF
        print(f"📥 Loading PDF: {pdf_path}", file=sys.stderr)
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()

        if not documents:
            raise HTTPException(
                status_code=400, detail="PDF contains no extractable content"
            )

        print(f"✓ Loaded {len(documents)} pages from PDF", file=sys.stderr)

        # Create optimized chunks with semantic boundaries
        chunks = create_optimized_chunks(documents)

        # Add to vector store
        store = get_vector_store()
        store.add_documents(chunks)

        # Persist to disk
        store.persist()

        # Calculate statistics
        token_counts = [token_length_function(c.page_content) for c in chunks]
        chunk_stats = {
            "total_chunks": len(chunks),
            "avg_tokens_per_chunk": (
                sum(token_counts) // len(token_counts) if token_counts else 0
            ),
            "min_tokens": min(token_counts) if token_counts else 0,
            "max_tokens": max(token_counts) if token_counts else 0,
            "total_tokens": sum(token_counts),
        }

        print(f"✓ Indexed {len(chunks)} chunks to ChromaDB", file=sys.stderr)
        print(f"  Stats: {chunk_stats}", file=sys.stderr)

        return {
            "status": "success",
            "chunks": len(chunks),
            "message": f"Successfully processed {os.path.basename(pdf_path)} into {len(chunks)} semantic chunks",
            "chunk_stats": chunk_stats,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Error loading document: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """Query the RAG pipeline with enhanced retrieval and scoring"""
    try:
        question = request.question
        if not question or not question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        # Retrieve relevant documents with scores
        store = get_vector_store()
        # Use similarity_search_with_score to get relevance scores
        results_with_scores = store.similarity_search_with_score(
            question, k=request.top_k
        )

        if not results_with_scores:
            return {
                "answer": "I don't have enough information in my knowledge base to answer this question. Please upload relevant documents first.",
                "sources": [],
                "chunks_retrieved": 0,
            }

        relevant_docs = [doc for doc, _ in results_with_scores]

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

Answer:"""

        print(f"📝 Generated Prompt for RAG:\n{prompt}", file=sys.stderr)

        # Generate response
        response = llm.invoke(prompt)  # type: ignore

        # Format sources with scores in metadata
        sources = []
        for doc, score in results_with_scores:
            # Create a copy of metadata to avoid modifying the original
            metadata = doc.metadata.copy()
            # Add retrieval score (lower is better for L2/Euclidean, higher is better for Cosine depending on impl)
            # Chroma default is usually L2 (lower is better), but LangChain might normalize.
            # We'll just pass the raw score.
            metadata["retrieval_score"] = float(score)

            sources.append(
                {
                    "content": doc.page_content[:500]
                    + ("..." if len(doc.page_content) > 500 else ""),
                    "metadata": metadata,
                }
            )

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


@app.post("/query-agent", response_model=AgentQueryResponse)
async def query_agent(request: AgentQueryRequest):
    """
    Advanced agent query with tool support and RAG integration.
    Allows the LLM to decide whether to use RAG context, call tools, or answer directly.
    """
    try:
        question = request.question
        if not question or not question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        # 1. Retrieve Context (if RAG is enabled)
        context_text = ""
        sources_list = []

        if request.use_rag:
            try:
                store = get_vector_store()
                # Use similarity_search_with_score for consistency and better debugging
                results_with_scores = store.similarity_search_with_score(
                    question, k=request.top_k
                )

                relevant_docs = [doc for doc, _ in results_with_scores]

                if relevant_docs:
                    context_text = "\n\n".join(
                        [
                            f"[Document {i+1}]\n{doc.page_content}"
                            for i, doc in enumerate(relevant_docs)
                        ]
                    )
                    # Include scores in sources list for debugging/transparency
                    sources_list = []
                    for doc, score in results_with_scores:
                        source_info = doc.metadata.get("source", "Unknown")
                        page = doc.metadata.get("page", "?")
                        sources_list.append(
                            f"{source_info} (Page {page}, Score: {score:.4f})"
                        )
            except Exception as e:
                print(
                    f"⚠️ RAG retrieval failed (continuing without context): {e}",
                    file=sys.stderr,
                )

        # 2. Prepare Tools
        if llm is None:
            raise HTTPException(status_code=503, detail="LLM service not initialized")

        active_llm = llm
        if request.tools:
            # Convert client-provided tool definitions to LangChain format
            langchain_tools = []
            for tool in request.tools:
                # Create a dynamic tool definition for the LLM
                tool_def = {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.inputSchema
                    or {"type": "object", "properties": {}},
                }
                langchain_tools.append(tool_def)

            # Bind tools to the LLM
            if langchain_tools:
                active_llm = llm.bind_tools(langchain_tools, tool_choice="auto")

        # 3. Construct Prompt
        system_prompt = """You are an intelligent study assistant with access to tools and study materials.
Your goal is to help the user learn effectively.

"""
        if context_text:
            system_prompt += f"""
Here is relevant context from the user's study materials:
{context_text}

Instructions:
- Use the provided context to answer questions about the study material.
- If the context is relevant, cite it.
- If the user asks to perform an action (like creating a quiz, flashcards, or tracking progress), USE THE AVAILABLE TOOLS.
- Do not hallucinate tool outputs. Just generate the tool call.
"""
        else:
            system_prompt += """
Instructions:
- Answer the user's question to the best of your ability.
- If the user asks to perform an action, USE THE AVAILABLE TOOLS.
"""

        messages = [("system", system_prompt), ("user", question)]

        # 4. Invoke LLM
        response = active_llm.invoke(messages)

        # 5. Process Response
        tool_calls = []
        # Use getattr to safely access tool_calls as it might not be typed in BaseMessage
        response_tool_calls = getattr(response, "tool_calls", None)

        if response_tool_calls:
            for tc in response_tool_calls:
                tool_calls.append({"name": tc["name"], "arguments": tc["args"]})

        return {
            "success": True,
            "answer": response.content or "I've prepared some actions for you.",
            "sources": sources_list,
            "tool_calls": tool_calls if tool_calls else None,
        }

    except Exception as e:
        print(f"✗ Error in agent query: {e}", file=sys.stderr)
        return {
            "success": False,
            "answer": "An error occurred while processing your request.",
            "error": str(e),
        }


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
    """Clear all documents from collection"""
    try:
        store = get_vector_store()
        store.delete_collection()
        print("✓ Collection cleared", file=sys.stderr)
        return {"status": "success", "message": "Collection cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed", response_model=EmbeddingResponse)
async def embed_texts(request: EmbeddingRequest):
    """Embed texts using the initialized NVIDIA embeddings model"""
    try:
        if not embeddings:
            raise HTTPException(
                status_code=503, detail="Embeddings model not initialized"
            )

        vectors = embeddings.embed_documents(request.texts)
        dims = len(vectors[0]) if vectors else 0

        return {"embeddings": vectors, "dimensions": dims}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("RAG_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

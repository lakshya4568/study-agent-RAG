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
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool
import asyncio
from typing import Callable

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

# RAG Configuration
CHUNK_SIZE = 2048  # ~512 tokens
CHUNK_OVERLAP = 200  # ~50 tokens overlap
TOP_K_RETRIEVAL = 4

# MCP Server Configuration (can be customized via environment)
MCP_SERVERS = {
    # Example MCP server configs - customize based on your needs
    # "github": {
    #     "transport": "sse",
    #     "url": os.getenv("MCP_GITHUB_URL", "http://localhost:8001/mcp"),
    # },
    # "filesystem": {
    #     "transport": "stdio",
    #     "command": "npx",
    #     "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
    # },
}

# Global instances (defined before lifespan)
embeddings: Optional[NVIDIAEmbeddings] = None
llm: Optional[ChatNVIDIA] = None
llm_with_tools: Optional[Any] = None  # LLM with function calling enabled
vector_store: Optional[Chroma] = None
mcp_client: Optional[Any] = None  # MCP client for tool discovery
mcp_tools: List[Any] = []  # Loaded MCP tools
tools_loaded: bool = False


# Structured output schema for RAG responses
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

        # Get all tools from configured MCP servers
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


def initialize_nvidia_clients():
    """Initialize NVIDIA embeddings and LLM clients"""
    global embeddings, llm, llm_with_tools

    if not NVIDIA_API_KEY:
        raise ValueError("NVIDIA_API_KEY environment variable is not set")

    try:
        embeddings = NVIDIAEmbeddings(
            model=EMBEDDING_MODEL, nvidia_api_key=NVIDIA_API_KEY, truncate="NONE"
        )

        llm = ChatNVIDIA(
            model=LLM_MODEL,
            nvidia_api_key=NVIDIA_API_KEY,
            temperature=0.6,
            top_p=0.9,
            max_tokens=4096,
        )

        # Load MCP tools if available
        loaded_tools = []
        if MCP_AVAILABLE and MCP_SERVERS:
            try:
                # Run async tool loading in sync context
                loaded_tools = asyncio.run(load_mcp_tools())
            except Exception as e:
                print(f"⚠️ MCP tool loading failed: {e}", file=sys.stderr)

        # Enable function calling and structured output with MCP tools
        if loaded_tools:
            llm_with_tools = llm.bind_tools(loaded_tools, tool_choice="auto")
            print(f"✓ LLM bound with {len(loaded_tools)} MCP tools", file=sys.stderr)
        else:
            llm_with_tools = llm.bind_tools(
                [], tool_choice="auto"
            )  # Ready for tool binding
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


class StructuredQueryResponse(BaseModel):
    """Enhanced response with structured output"""

    answer: str
    confidence: str
    key_points: List[str]
    citations: List[int]
    sources: List[Source]
    chunks_retrieved: int


class AgentQueryRequest(BaseModel):
    """Request for agent-based query with tool calling"""

    question: str = Field(..., description="User's question to answer")
    use_rag: bool = Field(default=True, description="Whether to use RAG for context")
    auto_route: bool = Field(
        default=True, description="Whether to automatically route the request"
    )
    top_k: int = Field(
        default=TOP_K_RETRIEVAL, description="Number of chunks to retrieve for RAG"
    )
    max_iterations: int = Field(default=10, description="Maximum agent iterations")


class ToolCall(BaseModel):
    """Tool call information"""

    name: str
    arguments: Dict[str, Any]
    result: Optional[str] = None


class AgentQueryResponse(BaseModel):
    """Response from agent with tool usage"""

    answer: str
    tool_calls: List[ToolCall]
    sources: List[Source]
    chunks_retrieved: int
    iterations: int


class RouteResponse(BaseModel):
    """Response from the router deciding the execution strategy"""

    strategy: str = Field(
        description="The selected strategy: RAG, TOOL, HYBRID, or GENERAL"
    )
    reasoning: str = Field(description="Brief reason for the choice")


async def route_request(question: str, llm_client: ChatNVIDIA) -> RouteResponse:
    """
    Route the user query to the appropriate strategy
    """
    try:
        parser = PydanticOutputParser(pydantic_object=RouteResponse)

        prompt = f"""You are an expert router for a study assistant. Your task is to decide the best strategy to answer a user's question.

Available strategies:
1. "RAG": Use this when the user asks about specific documents, study materials, or information that would be found in the knowledge base.
2. "TOOL": Use this when the user asks to perform a specific action (e.g., read a file, list directory, search github, calculate something) that requires using external tools.
3. "HYBRID": Use this when the user asks a complex question that requires both retrieving information from documents AND performing an action or using a tool.
4. "GENERAL": Use this for general conversation, greetings, or questions that don't need external tools or specific document context.

User Question: {question}

Instructions:
- Analyze the user's intent carefully.
- If the user asks to "list files", "read file", "search code", etc., prioritize "TOOL".
- If the user asks "what does this document say", prioritize "RAG".
- If the user asks "summarize the file I just uploaded", prioritize "RAG" (or "HYBRID" if file reading is needed).
- Return the strategy and a brief reasoning.

{parser.get_format_instructions()}"""

        response = await llm_client.ainvoke(prompt)

        # Parse the output
        try:
            content_str = str(response.content) if response.content else ""
            # Clean up potential markdown code blocks if the model adds them
            if "```json" in content_str:
                content_str = content_str.split("```json")[1].split("```")[0].strip()
            elif "```" in content_str:
                content_str = content_str.split("```")[1].split("```")[0].strip()

            return parser.parse(content_str)
        except Exception:
            # Fallback to simple keyword matching if parsing fails
            lower_q = question.lower()
            if (
                "read" in lower_q
                or "list" in lower_q
                or "search" in lower_q
                or "tool" in lower_q
            ):
                return RouteResponse(
                    strategy="TOOL", reasoning="Fallback: Keywords detected"
                )
            return RouteResponse(
                strategy="GENERAL", reasoning="Fallback: Parsing failed"
            )

    except Exception as e:
        print(f"⚠️ Routing failed: {e}", file=sys.stderr)
        return RouteResponse(strategy="GENERAL", reasoning=f"Error: {str(e)}")


class HealthResponse(BaseModel):
    status: str
    nvidia_key_set: bool
    persist_dir: str
    collection_name: str
    embedding_model: str
    llm_model: str
    function_calling_enabled: bool
    structured_output_enabled: bool
    mcp_available: bool
    mcp_tools_loaded: int
    mcp_tool_names: List[str]


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    tool_names = [t.name for t in mcp_tools] if mcp_tools else []
    return {
        "status": "ok",
        "nvidia_key_set": bool(NVIDIA_API_KEY),
        "persist_dir": CHROMA_PERSIST_DIR,
        "collection_name": COLLECTION_NAME,
        "embedding_model": EMBEDDING_MODEL,
        "llm_model": LLM_MODEL,
        "function_calling_enabled": True,
        "structured_output_enabled": True,
        "mcp_available": MCP_AVAILABLE,
        "mcp_tools_loaded": len(mcp_tools),
        "mcp_tool_names": tool_names,
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

        relevant_docs = retriever.invoke(question)

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


@app.post("/query-structured", response_model=StructuredQueryResponse)
async def query_rag_structured(request: QueryRequest):
    """
    Query the RAG pipeline with structured output

    This endpoint provides enhanced responses with:
    - Confidence scoring
    - Key points extraction
    - Document citations
    - Structured JSON format
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

        relevant_docs = retriever.invoke(question)

        if not relevant_docs:
            return {
                "answer": "I don't have enough information in my knowledge base to answer this question.",
                "confidence": "low",
                "key_points": ["No relevant documents found"],
                "citations": [],
                "sources": [],
                "chunks_retrieved": 0,
            }

        # Build context with document numbers
        context = "\n\n".join(
            [
                f"[Document {i+1}]\n{doc.page_content}"
                for i, doc in enumerate(relevant_docs)
            ]
        )

        # Create structured output parser
        parser = PydanticOutputParser(pydantic_object=StructuredAnswer)

        # Construct prompt with structured output instructions
        prompt = f"""You are a helpful study assistant. Use the following context from study materials to answer the question.

Context from documents:
{context}

Question: {question}

Instructions:
- Answer based ONLY on the provided context
- Assess your confidence level (high/medium/low) based on context relevance
- Extract 3-5 key points from your answer
- Cite which documents you used (by number, e.g., [1, 2])
- Be clear and educational

{parser.get_format_instructions()}

Provide your response in the exact JSON format specified above."""

        # Generate structured response
        response = llm.invoke(prompt)  # type: ignore

        # Parse the structured output
        try:
            # Ensure content is a string
            content_str = str(response.content) if response.content else ""
            structured = parser.parse(content_str)
            answer = structured.answer
            confidence = structured.confidence
            key_points = structured.key_points
            citations = structured.citations
        except Exception as parse_error:
            # Fallback if parsing fails
            print(f"⚠️ Structured parsing failed: {parse_error}", file=sys.stderr)
            answer = response.content
            confidence = "medium"
            key_points = ["Unable to extract structured key points"]
            citations = list(range(1, len(relevant_docs) + 1))

        # Format sources
        sources = [
            {
                "content": doc.page_content[:500]
                + ("..." if len(doc.page_content) > 500 else ""),
                "metadata": doc.metadata,
            }
            for doc in relevant_docs
        ]

        print(
            f"✓ Answered structured query with {len(relevant_docs)} chunks (confidence: {confidence})",
            file=sys.stderr,
        )

        return {
            "answer": answer,
            "confidence": confidence,
            "key_points": key_points,
            "citations": citations,
            "sources": sources,
            "chunks_retrieved": len(relevant_docs),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Error in structured query: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query-agent", response_model=AgentQueryResponse)
async def query_agent(request: AgentQueryRequest):
    """
    Query using agent with MCP tool calling capabilities

    This endpoint:
    - Uses LLM with bound MCP tools for function calling
    - Optionally retrieves RAG context
    - Executes tool calls as needed
    - Returns final answer with tool usage logs
    """
    try:
        question = request.question

        if not question or not question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        # Check if tools are available
        if not mcp_tools:
            return {
                "answer": "No MCP tools are currently loaded. Please configure MCP servers.",
                "tool_calls": [],
                "sources": [],
                "chunks_retrieved": 0,
                "iterations": 0,
            }

        # Determine strategy via routing
        strategy = "GENERAL"
        if request.auto_route:
            route_result = await route_request(question, llm)  # type: ignore
            strategy = route_result.strategy
            print(
                f"🧭 Routing decision: {strategy} ({route_result.reasoning})",
                file=sys.stderr,
            )
        else:
            # Manual override or default behavior
            strategy = "HYBRID" if request.use_rag else "TOOL"

        # Configure execution based on strategy
        should_use_rag = request.use_rag and (strategy in ["RAG", "HYBRID"])
        should_use_tools = strategy in ["TOOL", "HYBRID"]

        # Retrieve RAG context if requested and routed
        relevant_docs = []
        rag_context = ""
        if should_use_rag:
            store = get_vector_store()
            retriever = store.as_retriever(
                search_type="similarity", search_kwargs={"k": request.top_k}
            )
            relevant_docs = retriever.invoke(question)

            if relevant_docs:
                rag_context = "\n\nContext from knowledge base:\n" + "\n\n".join(
                    [
                        f"[Doc {i+1}] {doc.page_content[:300]}..."
                        for i, doc in enumerate(relevant_docs[:3])
                    ]
                )
                print(
                    f"📚 Retrieved {len(relevant_docs)} docs for RAG context",
                    file=sys.stderr,
                )

        # Prepare messages with RAG context
        user_message = question + rag_context

        # Select LLM client (with or without tools)
        # If strategy is RAG or GENERAL, we might not strictly need tools,
        # but keeping them bound allows for "surprise" tool usage if the model really wants to.
        # However, to strictly enforce "RAG ONLY", we could use plain `llm`.
        # For now, we'll use `llm_with_tools` if tools are enabled in strategy,
        # otherwise plain `llm` to prevent accidental tool calls.
        active_llm = llm_with_tools if should_use_tools else llm

        # Agent loop with tool calling
        messages = [{"role": "user", "content": user_message}]
        tool_calls_log: List[ToolCall] = []
        iterations = 0

        for i in range(request.max_iterations):
            iterations += 1

            # Invoke LLM
            response = active_llm.invoke(messages)  # type: ignore

            # Check if tool calls were made
            if hasattr(response, "tool_calls") and response.tool_calls:
                print(
                    f"🔧 Agent iteration {i+1}: {len(response.tool_calls)} tool calls",
                    file=sys.stderr,
                )

                # Execute each tool call
                for tool_call in response.tool_calls:
                    tool_name = tool_call.get("name", "")
                    tool_args = tool_call.get("args", {})
                    tool_id = tool_call.get("id", "")

                    print(
                        f"  🔨 Calling tool: {tool_name} with {tool_args}",
                        file=sys.stderr,
                    )

                    # Find and execute the tool
                    tool_result = "Tool not found"
                    for mcp_tool in mcp_tools:
                        if mcp_tool.name == tool_name:
                            try:
                                tool_result = await mcp_tool.ainvoke(tool_args)
                                print(
                                    f"  ✓ Tool result: {str(tool_result)[:100]}...",
                                    file=sys.stderr,
                                )
                            except Exception as tool_error:
                                tool_result = f"Tool execution error: {str(tool_error)}"
                                print(f"  ✗ Tool error: {tool_error}", file=sys.stderr)
                            break

                    # Log tool call
                    tool_calls_log.append(
                        ToolCall(
                            name=tool_name, arguments=tool_args, result=str(tool_result)
                        )
                    )

                    # Add tool result to messages
                    messages.append(
                        {
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [tool_call],  # type: ignore
                        }
                    )
                    messages.append(
                        {
                            "role": "tool",
                            "content": str(tool_result),
                            "tool_call_id": tool_id,
                        }
                    )
            else:
                # No more tool calls, we have final answer
                final_answer = (
                    response.content if hasattr(response, "content") else str(response)
                )
                print(f"✓ Agent completed in {iterations} iterations", file=sys.stderr)

                # Format sources
                sources = [
                    {
                        "content": doc.page_content[:500]
                        + ("..." if len(doc.page_content) > 500 else ""),
                        "metadata": doc.metadata,
                    }
                    for doc in relevant_docs
                ]

                return {
                    "answer": final_answer,
                    "tool_calls": tool_calls_log,
                    "sources": sources,
                    "chunks_retrieved": len(relevant_docs),
                    "iterations": iterations,
                }

        # Max iterations reached
        return {
            "answer": "Agent reached maximum iterations without completing.",
            "tool_calls": tool_calls_log,
            "sources": [],
            "chunks_retrieved": len(relevant_docs),
            "iterations": iterations,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Error in agent query: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/mcp/tools")
async def list_mcp_tools():
    """List all available MCP tools"""
    if not mcp_tools:
        return {
            "tools": [],
            "count": 0,
            "message": "No MCP tools loaded. Configure MCP_SERVERS in environment.",
        }

    tools_info = []
    for tool in mcp_tools:
        tools_info.append(
            {
                "name": tool.name,
                "description": (
                    tool.description
                    if hasattr(tool, "description")
                    else "No description"
                ),
                "schema": tool.args if hasattr(tool, "args") else {},
            }
        )

    return {
        "tools": tools_info,
        "count": len(tools_info),
        "message": f"Loaded {len(tools_info)} MCP tools",
    }


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

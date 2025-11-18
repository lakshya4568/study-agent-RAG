# MCP Tools Setup Guide

## Overview

The NVIDIA RAG Service now supports **Model Context Protocol (MCP)** for function calling and tool integration with the **Moonshot AI Kimi-K2-Instruct** model. MCP provides a standardized way to discover and use tools across different LLM providers.

## Features Added

✅ **MCP Tool Discovery** - Automatically loads tools from configured MCP servers  
✅ **Function Calling** - Kimi-K2-Instruct model with native tool calling support  
✅ **Structured Outputs** - Pydantic schemas for validated responses  
✅ **Agent Endpoint** - `/query-agent` for agentic workflows with tool loops  
✅ **RAG Integration** - Combines vector search with tool execution  
✅ **Async Support** - Proper async/await for MCP connections

## Updated Models

### Embedding Model

```python
EMBEDDING_MODEL = "nvidia/llama-3.2-nemoretriever-300m-embed-v2"
```

- Latest NeMo Retriever model
- Higher quality embeddings for semantic search

### Chat Model

```python
LLM_MODEL = "moonshotai/kimi-k2-instruct"
```

- Native function calling support
- Up to 256K context window
- Optimized for agentic workflows
- Parameters:
  - `temperature`: 0.6 (balanced creativity/precision)
  - `top_p`: 0.9 (nucleus sampling)
  - `max_tokens`: 4096

## Installation

### 1. Install Required Packages

```bash
cd python
pip install -r requirements.txt
```

New dependencies:

- `langchain-mcp-adapters>=0.1.0` - MCP client for LangChain
- `langgraph>=0.2.0` - Agent graph framework (optional, for advanced workflows)

### 2. Configure MCP Servers

Edit `python/nvidia_rag_service.py` to add your MCP server configurations:

```python
MCP_SERVERS = {
    # Example: Local filesystem server
    "filesystem": {
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
    },
    
    # Example: Remote HTTP server
    "github": {
        "transport": "sse",  # Server-Sent Events
        "url": "http://localhost:8001/mcp",
        "headers": {
            "Authorization": "Bearer YOUR_TOKEN_HERE"
        }
    },
    
    # Example: WebSocket server
    "custom_tools": {
        "transport": "websocket",
        "url": "wss://your-mcp-server.com/ws",
    },
}
```

### 3. Set Environment Variables

```bash
# Required
export NVIDIA_API_KEY="your_nvidia_api_key"

# Optional MCP configurations
export MCP_GITHUB_URL="http://localhost:8001/mcp"
export CHROMA_PERSIST_DIR="./chroma_db"
```

## API Endpoints

### 1. Health Check with MCP Status

```bash
GET /health
```

Response:

```json
{
  "status": "ok",
  "nvidia_key_set": true,
  "embedding_model": "nvidia/llama-3.2-nemoretriever-300m-embed-v2",
  "llm_model": "moonshotai/kimi-k2-instruct",
  "function_calling_enabled": true,
  "structured_output_enabled": true,
  "mcp_available": true,
  "mcp_tools_loaded": 5,
  "mcp_tool_names": ["read_file", "write_file", "list_directory", "search_files", "get_file_info"]
}
```

### 2. List Available MCP Tools

```bash
GET /mcp/tools
```

Response:

```json
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read contents of a file",
      "schema": {
        "path": "string"
      }
    }
  ],
  "count": 5,
  "message": "Loaded 5 MCP tools"
}
```

### 3. Query with Agent and Tools

```bash
POST /query-agent
Content-Type: application/json

{
  "question": "Analyze the Python files in src/ and summarize the main classes",
  "use_rag": true,
  "top_k": 4,
  "max_iterations": 10
}
```

Response:

```json
{
  "answer": "I found 3 main classes in the src/ directory...",
  "tool_calls": [
    {
      "name": "list_directory",
      "arguments": {"path": "src/"},
      "result": "['agent/', 'rag/', 'models/']"
    },
    {
      "name": "read_file",
      "arguments": {"path": "src/agent/StudyAgentService.ts"},
      "result": "export class StudyAgentService { ... }"
    }
  ],
  "sources": [...],
  "chunks_retrieved": 4,
  "iterations": 3
}
```

### 4. Regular Query (without tools)

```bash
POST /query
```

Standard RAG query without tool calling (original endpoint).

### 5. Structured Query

```bash
POST /query-structured
```

Enhanced RAG with confidence scores, key points, and citations.

## Example MCP Server Setups

### Option 1: Official MCP Filesystem Server

```bash
# Install globally
npm install -g @modelcontextprotocol/server-filesystem

# Or use npx (no install needed)
# Update MCP_SERVERS in code:
MCP_SERVERS = {
    "filesystem": {
        "transport": "stdio",
        "command": "npx",
        "args": [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            "/Users/yourname/Desktop/AI STUDY AGENT/src"
        ],
    }
}
```

### Option 2: Custom Python MCP Server

Create `mcp_server.py`:

```python
from fastapi import FastAPI
from sse_starlette.sse import EventSourceResponse
import json

app = FastAPI()

@app.post("/mcp")
async def mcp_endpoint(request: dict):
    """MCP JSON-RPC endpoint"""
    method = request.get("method")
    
    if method == "tools/list":
        return {
            "tools": [
                {
                    "name": "calculate",
                    "description": "Perform calculations",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "expression": {"type": "string"}
                        }
                    }
                }
            ]
        }
    
    elif method == "tools/call":
        tool_name = request["params"]["name"]
        args = request["params"]["arguments"]
        
        if tool_name == "calculate":
            result = eval(args["expression"])  # Use safely in production!
            return {"content": [{"type": "text", "text": str(result)}]}
    
    return {"error": "Unknown method"}

# Run with: uvicorn mcp_server:app --port 8001
```

### Option 3: Use Existing MCP Servers

Popular MCP server implementations:

- **GitHub MCP**: Access GitHub repos, issues, PRs
- **Google Drive MCP**: Read/write Google Docs
- **Slack MCP**: Send messages, read channels
- **Database MCP**: Query SQL databases
- **Browser MCP**: Web scraping and automation

See: <https://github.com/modelcontextprotocol/servers>

## Testing the Setup

### 1. Start the RAG Service

```bash
cd python
source ../.venv/bin/activate  # or activate your venv
python nvidia_rag_service.py
```

Look for startup messages:

```
✓ NVIDIA clients initialized (Embedding: nvidia/llama-3.2-nemoretriever-300m-embed-v2, LLM: moonshotai/kimi-k2-instruct)
🔧 Loading MCP tools from servers...
✓ Loaded 5 MCP tools: ['read_file', 'write_file', ...]
✓ LLM bound with 5 MCP tools
```

### 2. Test Health Endpoint

```bash
curl http://localhost:8000/health | jq
```

### 3. Test Tool Listing

```bash
curl http://localhost:8000/mcp/tools | jq
```

### 4. Test Agent Query

```bash
curl -X POST http://localhost:8000/query-agent \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What files are in the src/agent directory?",
    "use_rag": false
  }' | jq
```

## Architecture

```
┌─────────────────────────────────────────────┐
│   FastAPI Service (nvidia_rag_service.py)   │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │  ChatNVIDIA (Kimi-K2-Instruct)        │ │
│  │  - temperature: 0.6                    │ │
│  │  - top_p: 0.9                          │ │
│  │  - max_tokens: 4096                    │ │
│  └───────────────┬───────────────────────┘ │
│                  │                          │
│  ┌───────────────▼───────────────────────┐ │
│  │  llm_with_tools (bound with MCP)      │ │
│  │  .bind_tools(mcp_tools, "auto")       │ │
│  └───────────────┬───────────────────────┘ │
│                  │                          │
└──────────────────┼──────────────────────────┘
                   │
                   ▼
      ┌────────────────────────┐
      │  MultiServerMCPClient  │
      │  (langchain-mcp-adapters) │
      └─────────┬───────┬──────┘
                │       │
        ┌───────▼───┐ ┌─▼────────┐
        │ MCP Server│ │MCP Server│
        │  (stdio)  │ │  (HTTP)  │
        └───────────┘ └──────────┘
```

## Workflow Example

1. **User Query**: "Read my config file and summarize it"
2. **Agent Initialization**: Load question + RAG context (if enabled)
3. **LLM Decision**: Model determines it needs `read_file` tool
4. **Tool Call**: `{"name": "read_file", "args": {"path": "config.json"}}`
5. **Tool Execution**: MCP client calls filesystem server
6. **Tool Response**: `{"content": "{\\"settings\\": {...}}"}`
7. **LLM Synthesis**: Model generates final answer with context
8. **Return**: Answer + tool_calls log + RAG sources

## Troubleshooting

### MCP Tools Not Loading

**Issue**: `⚠️ langchain-mcp-adapters not installed`

**Solution**:

```bash
pip install langchain-mcp-adapters langgraph
```

### No Tools in Health Check

**Issue**: `"mcp_tools_loaded": 0`

**Solution**: Configure `MCP_SERVERS` dict in `nvidia_rag_service.py`. If empty, no tools are loaded.

### Tool Execution Fails

**Issue**: `"Tool execution error: ..."`

**Solutions**:

- Check MCP server is running (for HTTP/SSE transports)
- Verify paths are correct (for stdio transports)
- Check authentication tokens (for authenticated servers)
- Review tool argument schemas

### Import Errors

**Issue**: `MultiServerMCPClient is unknown import symbol`

This is expected before package installation. Run:

```bash
pip install -r requirements.txt
```

## Advanced: Creating Custom Tools

You can define custom tools directly in the service:

```python
from langchain_core.tools import tool

@tool
def web_search(query: str) -> str:
    """Search the web for information"""
    # Your implementation
    return "Search results..."

# Add to MCP tools
custom_tools = [web_search]
loaded_tools.extend(custom_tools)
llm_with_tools = llm.bind_tools(loaded_tools, tool_choice="auto")
```

## Resources

- **LangChain MCP Docs**: <https://docs.langchain.com/oss/python/langchain/mcp>
- **MCP Specification**: <https://modelcontextprotocol.io/>
- **NVIDIA NIM Function Calling**: <https://docs.nvidia.com/nim/large-language-models/latest/function-calling.html>
- **Kimi-K2-Instruct Docs**: <https://docs.api.nvidia.com/nim/reference/moonshotai-kimi-k2-instruct>
- **MCP Server Examples**: <https://github.com/modelcontextprotocol/servers>

## Next Steps

1. ✅ Configure your desired MCP servers
2. ✅ Test with `/query-agent` endpoint
3. ✅ Monitor tool usage in logs
4. ✅ Combine RAG + tools for powerful hybrid queries
5. ✅ Build custom agents with LangGraph (optional)

For questions or issues, refer to the main project documentation.

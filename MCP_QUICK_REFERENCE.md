# MCP Function Calling - Quick Reference

## 🚀 Quick Start

```bash
# 1. Install dependencies
bash install-mcp-tools.sh

# 2. Configure MCP servers (optional)
# Edit python/nvidia_rag_service.py → MCP_SERVERS dict

# 3. Add NVIDIA API key
# Edit .env → NVIDIA_API_KEY=your_key

# 4. Start service
cd python && python nvidia_rag_service.py

# 5. Test
python test-mcp-integration.py
```

## 📡 API Endpoints

| Endpoint | Purpose | Tool Calling |
|----------|---------|--------------|
| `GET /health` | Service status + MCP info | ❌ |
| `GET /mcp/tools` | List available tools | ❌ |
| `POST /query` | Standard RAG query | ❌ |
| `POST /query-structured` | RAG with citations | ❌ |
| `POST /query-agent` | **Agent with tools** | ✅ |

## 🔧 Models Used

```python
# Embeddings
"nvidia/llama-3.2-nemoretriever-300m-embed-v2"

# Chat (with function calling)
"moonshotai/kimi-k2-instruct"
  temperature: 0.6
  top_p: 0.9
  max_tokens: 4096
```

## 💬 Example Requests

### Agent with Tools

```bash
curl -X POST http://localhost:8000/query-agent \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Read the README.md and summarize it",
    "use_rag": false,
    "max_iterations": 10
  }'
```

### Structured Query

```bash
curl -X POST http://localhost:8000/query-structured \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is neural network?",
    "top_k": 3
  }'
```

## 🔌 MCP Server Config

```python
# In python/nvidia_rag_service.py
MCP_SERVERS = {
    "filesystem": {
        "transport": "stdio",
        "command": "npx",
        "args": [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            "/path/to/project"
        ],
    },
}
```

## ✅ Verification Checklist

- [ ] Dependencies installed (`langchain-mcp-adapters`, `langgraph`)
- [ ] NVIDIA API key set in `.env`
- [ ] MCP servers configured (optional)
- [ ] Service starts without errors
- [ ] `/health` shows `mcp_available: true`
- [ ] `/mcp/tools` lists tools (if configured)
- [ ] Test suite passes

## 📚 Documentation Files

- `MCP_INTEGRATION_SUMMARY.md` - Complete implementation details
- `MCP_TOOLS_SETUP.md` - Detailed setup guide
- `install-mcp-tools.sh` - Automated installation
- `test-mcp-integration.py` - Test suite

## 🎯 Key Features

✅ Function calling with Kimi-K2-Instruct  
✅ MCP tool discovery and binding  
✅ Agentic workflows with tool loops  
✅ Structured output with Pydantic  
✅ RAG + tools hybrid queries  
✅ Async tool execution  
✅ Full tool call logging  

## 🛠️ Troubleshooting

**No tools loaded?**
→ Configure `MCP_SERVERS` or run without tools

**Import errors?**
→ `pip install langchain-mcp-adapters langgraph`

**Tool execution fails?**
→ Check MCP server is running and paths are correct

**Need help?**
→ See `MCP_TOOLS_SETUP.md` for full guide

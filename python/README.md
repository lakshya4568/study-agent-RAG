# Setup Instructions for NVIDIA Embeddings Python Service

## Installation

1. **Install Python Dependencies:**

```powershell
cd python
python -m pip install -r requirements.txt
```

Or use the setup script:

```powershell
python python/setup.py
```

2. **Set NVIDIA API Key:**

```powershell
$env:NVIDIA_API_KEY = "your-api-key-here"
```

Or add to `.env` file:

```
NVIDIA_API_KEY=your-api-key-here
```

## Verification

Test the Python service directly:

```powershell
python python/nvidia_embeddings_service.py
```

Then send a test request (copy-paste JSON and hit Enter):

```json
{
  "jsonrpc": "2.0",
  "method": "embed_query",
  "params": { "query": "Hello world" },
  "id": 1
}
```

You should see a response with embeddings.

## Architecture

- **Python Service**: `python/nvidia_embeddings_service.py` - Runs official NVIDIA LangChain SDK
- **Node.js Bridge**: `src/models/nvidia-embeddings.ts` - Communicates with Python via JSON-RPC
- **Protocol**: JSON-RPC 2.0 over stdin/stdout

## Troubleshooting

**Python not found:**

- Ensure Python 3.8+ is installed and in your PATH
- Try `python3` instead of `python` on some systems

**Module not found:**

- Run: `python -m pip install langchain-nvidia-ai-endpoints langchain-core`

**API Key errors:**

- Verify NVIDIA_API_KEY is set in environment
- Get API key from: https://build.nvidia.com/

**Service timeout:**

- Check Python service logs in terminal
- Verify network connectivity to NVIDIA API

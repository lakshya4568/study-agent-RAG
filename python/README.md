# Setup Instructions for NVIDIA Embeddings Python Service

## Prerequisites

**Python 3.8+** is required. Install it:

- **macOS**: `brew install python3` or download from [python.org](https://www.python.org/downloads/)
- **Windows**: Download from [python.org](https://www.python.org/downloads/)
- **Linux**: `sudo apt install python3 python3-pip`

## Installation

### Automatic Setup (Recommended)

The setup runs automatically when you start the app:

```bash
npm start
```

Or run manually:

```bash
npm run setup:python
```

### Manual Setup

**macOS/Linux:**

```bash
cd python
python3 -m pip install -r requirements.txt
```

**Windows:**

```powershell
cd python
python -m pip install -r requirements.txt
```

## Configuration

**Set NVIDIA API Key:**

**macOS/Linux:**

```bash
export NVIDIA_API_KEY="your-api-key-here"
```

**Windows:**

```powershell
$env:NVIDIA_API_KEY = "your-api-key-here"
```

Or add to `.env` file in project root:

```
NVIDIA_API_KEY=your-api-key-here
```

## Verification

Test the Python service directly:

**macOS/Linux:**

```bash
python3 python/nvidia_embeddings_service.py
```

**Windows:**

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
- Get API key from: <https://build.nvidia.com/>

**Service timeout:**

- Check Python service logs in terminal
- Verify network connectivity to NVIDIA API

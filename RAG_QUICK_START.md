# Quick Start: New RAG Architecture

## Setup (First Time Only)

### 1. Install Python Dependencies

```bash
# Run the setup script
./scripts/setup-rag-service.sh

# Or manually:
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment

Make sure `.env` has your NVIDIA API key:

```bash
NVIDIA_API_KEY="nvapi-xxx"
CHROMA_PERSIST_DIR="./chroma_db"  # Optional
RAG_PORT=8000  # Optional - preferred FastAPI port (auto-falls back if busy)
```

### 3. Install Node Dependencies (if not already done)

```bash
npm install
```

## Running the Application

### Option 1: Start Everything (Recommended)

```bash
npm start
```

This will:

1. Start the Electron app
2. Auto-start the Python RAG service on the preferred port (or the next available one)
3. Initialize ChromaDB with persistent storage
4. Open the app window

> 💡 **Multiple instances:** Each Electron instance now negotiates its own RAG port.
>
> - If `RAG_PORT` is free, that port is used.
> - If it's already taken (for example, a second app window), we automatically bind to the next available port and log the new value.
> - You can always override the preference per instance (`RAG_PORT=9100 npm start`).

### Option 2: Manual RAG Service (for testing)

```bash
# Terminal 1: Start RAG service
cd python
source .venv/bin/activate
python nvidia_rag_service.py

# Terminal 2: Start Electron
npm start
```

## Using the RAG System

### Upload Documents

1. Open the app
2. Go to "Documents" section
3. Click "Upload" and select PDF files
4. Documents are automatically:
   - Parsed
   - Chunked
   - Embedded
   - Stored in ChromaDB

### Query Documents

1. Go to "Chat" section
2. Ask questions about your uploaded documents
3. The AI will:
   - Retrieve relevant chunks
   - Generate context-aware answers
   - Cite sources

## Testing the RAG Service

### Health Check

```bash
PORT=${RAG_PORT:-8000}
curl "http://localhost:${PORT}/health"
```

Expected response:

```json
{
  "status": "ok",
  "nvidia_key_set": true,
  "persist_dir": "./chroma_db",
  "collection_name": "study_materials",
  "embedding_model": "nvidia/nv-embedqa-e5-v5",
  "llm_model": "meta/llama-3.1-70b-instruct"
}
```

### Load a Document

```bash
PORT=${RAG_PORT:-8000}
curl -X POST "http://localhost:${PORT}/load-document" \
  -H "Content-Type: application/json" \
  -d '{"pdf_path": "/absolute/path/to/document.pdf"}'
```

Expected response:

```json
{
  "status": "success",
  "chunks": 42,
  "message": "Successfully loaded 42 chunks from document.pdf"
}
```

### Query

```bash
PORT=${RAG_PORT:-8000}
curl -X POST "http://localhost:${PORT}/query" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the main topic?",
    "chat_history": [],
    "top_k": 4
  }'
```

Expected response:

```json
{
  "answer": "Based on the documents...",
  "sources": [...],
  "chunks_retrieved": 4
}
```

### Get Collection Stats

```bash
PORT=${RAG_PORT:-8000}
curl "http://localhost:${PORT}/collection/stats"
```

Expected response:

```json
{
  "collection_name": "study_materials",
  "document_count": 150,
  "persist_dir": "./chroma_db"
}
```

## Troubleshooting

### Service won't start

**Check Python virtual environment:**

```bash
cd python
source .venv/bin/activate
pip list | grep langchain
```

**Check NVIDIA API key:**

```bash
echo $NVIDIA_API_KEY
```

**Check port availability:**

```bash
PORT=${RAG_PORT:-8000}
lsof -i :${PORT}
```

### Documents won't load

**Check file path:**

- Must be absolute path
- File must exist
- Must be a valid PDF

**Check PDF content:**

- PDFs must have extractable text
- Scanned PDFs without OCR won't work

**Check logs:**

- Open Electron DevTools
- Look for Python service logs

### Queries return no results

**Check document count:**

```bash
PORT=${RAG_PORT:-8000}
curl "http://localhost:${PORT}/collection/stats"
```

**Verify embeddings:**

- Ensure NVIDIA API key is valid
- Check internet connection
- Look for error messages in logs

### Persistent storage issues

**Check directory permissions:**

```bash
ls -la chroma_db/
```

**Clear and restart:**

```bash
# Delete ChromaDB data
rm -rf chroma_db/

# Restart service
npm start
```

## Common Commands

```bash
# Setup
./scripts/setup-rag-service.sh

# Start app (auto-starts RAG service)
npm start

# Build app
npm run build

# Package app
npm run make

# Test RAG service
cd python && source .venv/bin/activate && python nvidia_rag_service.py

# Check logs
# Open DevTools in Electron app
```

## Architecture Overview

```text
Electron App (TypeScript)
    ↓ REST API
Python RAG Service (FastAPI)
    ↓ LangChain
ChromaDB (Persistent Storage)
    ↓ Embeddings
NVIDIA API (Embeddings + LLM)
```

## Key Files

- `python/nvidia_rag_service.py` - FastAPI RAG service
- `src/rag/rag-client.ts` - TypeScript REST client
- `src/rag/rag-service-manager.ts` - Service lifecycle
- `src/agent/StudyAgentService.ts` - Agent integration
- `.env` - Configuration
- `RAG_NEW_ARCHITECTURE.md` - Detailed documentation

## What's Different?

### Old Approach

- TypeScript handled PDF loading
- TypeScript handled chunking
- Separate embeddings service
- ChromaDB HTTP server
- Complex initialization

### New Approach

- Python handles everything
- Single FastAPI service
- Embedded ChromaDB
- Simple REST API
- Easy to use and maintain

## Next Steps

1. ✅ Setup complete - Service running
2. ✅ Upload your first document
3. ✅ Ask a question about it
4. 🎉 RAG is working!

For detailed information, see `RAG_NEW_ARCHITECTURE.md`.

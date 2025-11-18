# RAG Pipeline Architecture - New Implementation

## Overview

The RAG (Retrieval-Augmented Generation) pipeline has been refactored to use a **Python FastAPI service** with **persistent ChromaDB storage**. This replaces the previous TypeScript-based ChromaDB client approach.

## Architecture

```
┌─────────────────────────────────────────────┐
│     Electron App (TypeScript/Node.js)       │
│  ┌────────────────────────────────────────┐ │
│  │  StudyAgentService                     │ │
│  │  - Uses RAG Client for all operations │ │
│  └──────────────┬─────────────────────────┘ │
│                 │ REST API (HTTP)            │
│  ┌──────────────▼─────────────────────────┐ │
│  │  RAG Client (ragClient.ts)             │ │
│  │  - loadDocument(path)                  │ │
│  │  - query(question, history)            │ │
│  │  - healthCheck()                        │ │
│  │  - getCollectionStats()                │ │
│  └────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │ HTTP (localhost:<RAG_PORT>)
┌──────────────────▼──────────────────────────┐
│   Python FastAPI Service                    │
│   (nvidia_rag_service.py)                   │
│  ┌────────────────────────────────────────┐ │
│  │  Endpoints:                             │ │
│  │  POST /load-document                   │ │
│  │  POST /query                           │ │
│  │  GET  /health                          │ │
│  │  GET  /collection/stats                │ │
│  │  DELETE /collection                    │ │
│  └────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────┐ │
│  │  LangChain Components:                 │ │
│  │  - PyPDFLoader                         │ │
│  │  - RecursiveCharacterTextSplitter      │ │
│  │  - NVIDIAEmbeddings (nv-embedqa-e5-v5) │ │
│  │  - ChatNVIDIA (llama-3.1-70b-instruct) │ │
│  └────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────┐ │
│  │  ChromaDB (Persistent Local Storage)   │ │
│  │  - Collection: study_materials         │ │
│  │  - Persist Dir: ./chroma_db            │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Key Components

### Python Service (`python/nvidia_rag_service.py`)

**Purpose**: Provides REST API for document ingestion and RAG querying

**Features**:

- **Document Loading**: Parses PDFs, chunks text, generates embeddings
- **Persistent Storage**: ChromaDB with local disk persistence
- **Query Processing**: Retrieves relevant chunks and generates answers using NVIDIA LLM
- **CORS Enabled**: Allows Electron frontend to make cross-origin requests

**Configuration** (via environment variables):

- `NVIDIA_API_KEY`: Required for embeddings and LLM
- `CHROMA_PERSIST_DIR`: Directory for vector DB (default: `./chroma_db`)
- `RAG_PORT`: Service port (default: `8000`, auto-adjusts if busy)

**Models**:

- **Embeddings**: `nvidia/nv-embedqa-e5-v5`
- **LLM**: `meta/llama-3.1-70b-instruct`

### TypeScript RAG Client (`src/rag/rag-client.ts`)

**Purpose**: Provides typed interface to Python RAG service

**Methods**:

```typescript
// Health check
await ragClient.healthCheck();

// Load document
await ragClient.loadDocument('/path/to/document.pdf');

// Query RAG
const result = await ragClient.query('What is X?', chatHistory, topK);

// Get stats
const stats = await ragClient.getCollectionStats();

// Clear collection
await ragClient.clearCollection();
```

**Error Handling**: All methods throw `RAGClientError` with detailed error info

### RAG Service Manager (`src/rag/rag-service-manager.ts`)

**Purpose**: Manages Python service lifecycle

**Functions**:

```typescript
// Start service (called on app ready)
await startRAGService();

// Stop service (called on app quit)
await stopRAGService();

// Check status
const status = await getRAGServiceStatus();
```

**Features**:

- Auto-detects Python virtual environment
- Waits for service health before continuing
- Graceful shutdown with timeout
- Logs all service output

### Study Agent Service (`src/agent/StudyAgentService.ts`)

**Purpose**: Simplified agent service using RAG client

**Changes from old version**:

- ❌ No direct ChromaDB/vector store access
- ✅ Uses `ragClient` for all document operations
- ✅ Simplified initialization (no local chunking/embedding)
- ✅ Python service handles all RAG logic

**Key Methods**:

```typescript
// Initialize agent
await studyAgentService.initialize();

// Add documents (sends to Python service)
await studyAgentService.addDocuments(['/path/to/doc.pdf']);

// Query agent
const result = await studyAgentService.invoke('Question?', history);

// Get status
const status = studyAgentService.getStatus();
```

## Data Flow

### Document Ingestion

```
1. User uploads PDF via UI
   ↓
2. Electron calls studyAgentService.addDocuments()
   ↓
3. Service calls ragClient.loadDocument()
   ↓
4. HTTP POST to /load-document
   ↓
5. Python service:
   - Loads PDF with PyPDFLoader
   - Chunks text (2048 chars, 200 overlap)
   - Generates NVIDIA embeddings
   - Stores in ChromaDB
   - Persists to disk
   ↓
6. Returns chunk count to client
```

### Query Processing

```
1. User asks question via UI
   ↓
2. Electron calls studyAgentService.invoke()
   ↓
3. Service calls ragClient.query()
   ↓
4. HTTP POST to /query
   ↓
5. Python service:
   - Retrieves top-K similar chunks (default: 4)
   - Constructs prompt with context
   - Generates answer with NVIDIA LLM
   - Returns answer + source citations
   ↓
6. Agent formats response for UI
```

## Environment Setup

### Required Environment Variables

```bash
# .env file
NVIDIA_API_KEY=nvapi-xxx  # Required
CHROMA_PERSIST_DIR=/path/to/chroma_db  # Optional
RAG_PORT=8000  # Optional preferred port (leave unset to auto-select)
```

### Python Dependencies

```bash
cd python
pip install -r requirements.txt
```

**Key packages**:

- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `langchain` - RAG framework
- `langchain-nvidia-ai-endpoints` - NVIDIA models
- `chromadb` - Vector database
- `pypdf` - PDF parsing

## Running the System

### Development Mode

```bash
# Terminal 1: Start Electron app (auto-starts Python service)
npm start

# Or manually start Python service for testing
cd python
python nvidia_rag_service.py
```

### Production Build

```bash
npm run make
# Python service is bundled and started automatically
```

## API Reference

### Python FastAPI Endpoints

#### `POST /load-document`

Load and vectorize a PDF document.

**Request**:

```json
{
  "pdf_path": "/absolute/path/to/document.pdf"
}
```

**Response**:

```json
{
  "status": "success",
  "chunks": 42,
  "message": "Successfully loaded 42 chunks from document.pdf"
}
```

#### `POST /query`

Query the RAG pipeline.

**Request**:

```json
{
  "question": "What is the main topic?",
  "chat_history": [],
  "top_k": 4
}
```

**Response**:

```json
{
  "answer": "The main topic is...",
  "sources": [
    {
      "content": "Chunk text...",
      "metadata": {"page": 1, "source": "doc.pdf"}
    }
  ],
  "chunks_retrieved": 4
}
```

#### `GET /health`

Check service health and configuration.

**Response**:

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

#### `GET /collection/stats`

Get collection statistics.

**Response**:

```json
{
  "collection_name": "study_materials",
  "document_count": 150,
  "persist_dir": "./chroma_db"
}
```

#### `DELETE /collection`

Clear all documents from collection.

**Response**:

```json
{
  "status": "success",
  "message": "Collection cleared"
}
```

## Configuration

### Chunking Strategy

```python
CHUNK_SIZE = 2048  # ~512 tokens
CHUNK_OVERLAP = 200  # ~50 tokens
```

**Separators** (in priority order):

1. `\n\n\n` - Section breaks
2. `\n\n` - Paragraph breaks
3. `\n` - Line breaks
4. `.` - Sentence endings
5. `,` - Clause breaks
6. ` ` - Word breaks

### Retrieval Configuration

```python
TOP_K_RETRIEVAL = 4  # Number of chunks to retrieve
```

### Model Configuration

**Embeddings**:

- Model: `nvidia/nv-embedqa-e5-v5`
- Dimensions: 1024
- Max input: 32k tokens

**LLM**:

- Model: `meta/llama-3.1-70b-instruct`
- Temperature: 0.1
- Max tokens: 2048

## Migration Notes

### Obsolete Files

The following files are no longer used and can be removed:

- `src/rag/chroma-server.ts` - Old ChromaDB HTTP server manager
- `src/rag/in-memory-chroma-client.ts` - Old in-memory client
- `src/rag/vector-store.ts` - Old TypeScript vector store logic
- `src/rag/document-loader.ts` - Old TypeScript document loader
- `python/nvidia_embeddings_service.py` - Old embeddings-only service

### What Changed

**Before** (Old Architecture):

- TypeScript code loaded PDFs directly
- TypeScript code chunked documents
- Separate embeddings service via JSON-RPC
- ChromaDB HTTP server as separate process
- Complex vector store initialization in TypeScript

**After** (New Architecture):

- Python service handles all PDF loading
- Python service handles all chunking
- Embeddings integrated into RAG service
- ChromaDB embedded in Python service (no HTTP server)
- Simple REST API calls from TypeScript

### Benefits

✅ **Simpler**: Single Python service vs. multiple processes  
✅ **Faster**: No JSON-RPC overhead, direct LangChain integration  
✅ **Reliable**: Persistent storage with automatic management  
✅ **Maintainable**: Standard FastAPI patterns  
✅ **Scalable**: Easy to add new endpoints/features  

## Troubleshooting

### Service won't start

**Check**:

1. NVIDIA_API_KEY is set
2. Python venv exists and has dependencies
3. Your preferred RAG port (default 8000) is not already in use (Webpack dev server uses 9000)
4. Check logs in Electron DevTools

### Documents not loading

**Check**:

1. File path is absolute
2. File is a valid PDF
3. PDF has extractable text (not scanned image)
4. Check Python service logs

### Queries fail

**Check**:

1. At least one document is loaded
2. NVIDIA API key is valid
3. Internet connection available
4. Check `/collection/stats` for document count

### Persistent storage issues

**Check**:

1. CHROMA_PERSIST_DIR has write permissions
2. Disk has available space
3. ChromaDB collection is not corrupted (delete and recreate)

## Development Tips

### Testing RAG Service

```bash
# Start service manually
cd python
python nvidia_rag_service.py

# Test with curl
PORT=${RAG_PORT:-8000}
curl "http://localhost:${PORT}/health"

# Load document
curl -X POST "http://localhost:${PORT}/load-document" \
  -H "Content-Type: application/json" \
  -d '{"pdf_path": "/path/to/doc.pdf"}'

# Query
curl -X POST "http://localhost:${PORT}/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is X?", "chat_history": [], "top_k": 4}'
```

### Monitoring

- **Electron logs**: Open DevTools Console
- **Python logs**: Check terminal output or Electron console
- **Health check**: `GET /health`
- **Stats**: `GET /collection/stats`

## Future Enhancements

- [ ] Support more document types (DOCX, TXT, MD)
- [ ] Batch document loading endpoint
- [ ] Document deletion by ID
- [ ] Metadata filtering in queries
- [ ] Streaming responses for large answers
- [ ] Multi-collection support
- [ ] Query result caching
- [ ] Usage analytics/metrics

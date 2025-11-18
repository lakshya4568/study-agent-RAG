# ChromaDB Persistence Test Updates - Complete

## Overview

Updated all test scripts in the `tests/` directory to work correctly with the new **ChromaDB persistent HTTP server architecture**. Previously, tests had outdated comments and expectations referencing "in-memory" or "embedded" modes, which no longer reflect the actual implementation.

## What Changed

### ChromaDB Architecture Migration

- **Previous**: Tests assumed in-memory ChromaDB (no external server)
- **Current**: ChromaDB runs as a persistent HTTP server on `localhost:8000`
- **Storage**: Persistent SQLite database in `.chromadb/chroma_storage/`
- **Lifecycle**: Managed by Electron app (starts with app, stops on quit)

## Files Updated

### 1. `tests/test-chromadb-rag.ts`

**Changes:**

- ✅ Added server health check (Step 0) before running tests
- ✅ Removed incorrect "embedded/in-memory ChromaDB" comment
- ✅ Updated comments to reflect "persistent HTTP server for vector storage"
- ✅ Added imports: `isChromaServerRunning`, `getChromaServerUrl`, `getChromaPersistDir`
- ✅ Enhanced error messages with server startup instructions
- ✅ Added storage directory display in output

**Key Addition:**

```typescript
// Step 0: Verify ChromaDB server is running
const serverUrl = getChromaServerUrl();
const persistDir = getChromaPersistDir();
const isRunning = await isChromaServerRunning();

if (!isRunning) {
  console.error(`\n❌ ChromaDB server is not running at ${serverUrl}`);
  console.error("\n💡 Please start the ChromaDB server first:");
  console.error("   - Server should be started by Electron app");
  console.error("   - Or manually: chroma run --path .chromadb/chroma_storage --port 8000\n");
  process.exit(1);
}
```

### 2. `tests/test-rag-pipeline.ts`

**Changes:**

- ✅ Added server health check (Step 0) before running tests
- ✅ Changed "In-memory ChromaDB" → "Persistent ChromaDB HTTP server"
- ✅ Updated file header to document server requirement
- ✅ Added imports: `isChromaServerRunning`, `getChromaServerUrl`, `getChromaPersistDir`
- ✅ Updated final summary: "✓ Persistent ChromaDB HTTP server vector store"
- ✅ Added server URL to console output

**Before:**

```typescript
console.log(`   Storage: In-memory ChromaDB`);
```

**After:**

```typescript
console.log(`   Storage: Persistent ChromaDB HTTP server`);
console.log(`   Server: ${serverUrl}`);
```

### 3. `tests/test-full-integration.ts`

**Changes:**

- ✅ Added server health check (Step 0) before running tests
- ✅ Changed "ChromaDB storage (in-memory)" → "ChromaDB storage (persistent HTTP server)"
- ✅ Updated file header to document server requirement
- ✅ Added imports: `isChromaServerRunning`, `getChromaServerUrl`, `getChromaPersistDir`
- ✅ Returns `false` instead of throwing if server not running
- ✅ Enhanced error messages with server startup instructions

**Final Summary Update:**

```typescript
console.log("  ✅ ChromaDB storage (persistent HTTP server)");
```

### 4. `check-chroma-server.sh` (New File)

**Purpose:** Helper script to verify ChromaDB server is running before tests

**Features:**

- ✅ Checks HTTP status at `localhost:8000/api/v1/heartbeat`
- ✅ Exit code 0 if running, 1 if not
- ✅ Helpful error messages with startup instructions
- ✅ Can be used in test workflows or CI/CD

**Usage:**

```bash
./check-chroma-server.sh && npm run test:chromadb
```

## Requirements for All Tests

### Prerequisites

1. **ChromaDB Server Running**
   - **Primary Method**: Launch Electron app (server starts automatically)
   - **Manual Method**: `chroma run --path .chromadb/chroma_storage --port 8000`

2. **NVIDIA API Key**
   - Must be set in environment: `NVIDIA_API_KEY=your_key_here`
   - Required for embedding generation

3. **Python Environment**
   - Python 3.14 (or compatible version)
   - ChromaDB installed: `pip3 install chromadb`

### Server Details

- **URL**: `http://localhost:8000`
- **Heartbeat Endpoint**: `/api/v1/heartbeat`
- **Storage Directory**: `.chromadb/chroma_storage/`
- **Collection Name**: `study_materials`
- **Vector Dimensions**: 2048 (NVIDIA embeddings)

## Testing Workflow

### 1. Start ChromaDB Server

**Option A - Via Electron App (Recommended):**

```bash
npm start
```

The server starts automatically with the app.

**Option B - Manual Start:**

```bash
chroma run --path .chromadb/chroma_storage --port 8000
```

### 2. Verify Server is Running

```bash
./check-chroma-server.sh
```

### 3. Run Tests

```bash
# Individual tests
npm run test:chromadb       # ChromaDB integration test
npm run test:rag            # Full RAG pipeline test
npm run test:integration    # End-to-end integration test

# All tests
./run-tests.sh
```

## Error Handling

### If Server Not Running

Tests will now fail gracefully with helpful messages:

```
❌ ChromaDB server is not running at http://localhost:8000

💡 Please start the ChromaDB server first:
   - Server should be started by Electron app
   - Or manually: chroma run --path .chromadb/chroma_storage --port 8000
```

### Common Issues

**Issue**: "Connection refused" error

- **Cause**: ChromaDB server not started
- **Fix**: Launch Electron app or run manual server command

**Issue**: "Collection already exists" warnings

- **Cause**: Persistent storage retains data between test runs
- **Impact**: Usually harmless, tests will reuse/update existing collection
- **Fix**: Delete `.chromadb/chroma_storage/` to start fresh (optional)

**Issue**: Port 8000 already in use

- **Cause**: Another process using port 8000
- **Fix**: `lsof -ti:8000 | xargs kill -9` then restart server

## Benefits of These Updates

1. **Accurate Documentation** - Tests now correctly describe persistent storage
2. **Better Error Messages** - Clear instructions when server not running
3. **Fail-Fast Behavior** - Tests exit early if server unavailable
4. **Storage Visibility** - Console output shows storage directory path
5. **Cross-Platform** - Works on macOS, Linux, Windows with ChromaDB installed

## Test Output Examples

### Before (Confusing/Incorrect)

```
✅ Vector store created successfully
   Storage: In-memory ChromaDB
```

### After (Clear/Correct)

```
0️⃣  Verifying ChromaDB server...
✅ ChromaDB server is running at http://localhost:8000
📁 Storage directory: .chromadb/chroma_storage/

✅ Vector store created successfully
   Storage: Persistent ChromaDB HTTP server
   Server: http://localhost:8000
```

## Files Unchanged

These test files were not modified (no ChromaDB usage or already correct):

- `test-nvidia-api.ts` - Direct NVIDIA API test (no ChromaDB)
- `test-python-bridge.ts` - Python embedding service test (no ChromaDB)
- `test-document-upload.ts` - File handling test (no ChromaDB)
- `test-agent-e2e.ts` - Agent workflow test
- `test-agent-rag-e2e.ts` - Agent with RAG test
- `test-chroma-persistence.ts` - Already tests persistence correctly

## Summary

✅ **3 test files updated** to reflect persistent ChromaDB architecture  
✅ **1 helper script created** for server health checks  
✅ **All tests now validate server availability** before running  
✅ **Error messages improved** with actionable instructions  
✅ **Documentation accurate** - no more "in-memory" confusion  

The test suite now correctly expects and validates the persistent ChromaDB HTTP server architecture, making tests more reliable and easier to debug when server-related issues occur.

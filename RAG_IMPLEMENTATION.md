# RAG Pipeline Implementation Guide

## 🚀 Overview

This project implements a state-of-the-art **Retrieval-Augmented Generation (RAG)** system powered by:

- **NVIDIA NV-Embed-QA-E5-V5** - Latest embedding model optimized for semantic search
- **NVIDIA Llama 3.1 70B Instruct** - Advanced language model for generation
- **ChromaDB** - In-memory vector database for fast retrieval
- **LangChain** - Orchestration framework for RAG workflows

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Study Agent Service                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Document Processing                   │  │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │  │
│  │  │ PDF/Text │→ │ Chunking  │→ │ NVIDIA       │  │  │
│  │  │ Loading  │  │ (1400ch)  │  │ Embeddings   │  │  │
│  │  └──────────┘  └───────────┘  └──────────────┘  │  │
│  └────────────────────────┬────────────────────────────┘  │
│                           ↓                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │          ChromaDB Vector Store (In-Memory)          │ │
│  │  - Collection: study_materials                      │ │
│  │  - Similarity: Cosine Distance                      │ │
│  │  - Dimensions: 1024                                 │ │
│  └────────────────────────┬────────────────────────────┘ │
│                           ↓                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │            Semantic Retrieval Layer                 │ │
│  │  - Top-K similarity search                          │ │
│  │  - Score-based filtering                            │ │
│  │  - Metadata enrichment                              │ │
│  └────────────────────────┬────────────────────────────┘ │
│                           ↓                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │          NVIDIA Llama 3.1 70B (Generation)          │ │
│  │  - Context-aware responses                          │ │
│  │  - Multi-turn conversations                         │ │
│  │  - Source citation                                  │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

### Required API Keys

1. **NVIDIA API Key** (Required)

   ```bash
   # Get your free API key from https://build.nvidia.com/
   export NVIDIA_API_KEY="nvapi-xxxxxxxxxxxxx"
   ```

2. **Optional Keys** (for extended functionality)

   ```bash
   export GEMINI_API_KEY="your-gemini-key"
   export ANTHROPIC_API_KEY="your-anthropic-key"
   ```

### Environment Setup

Create a `.env` file in the project root:

```env
# Required
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxx

# Optional
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## 🔧 Configuration

### RAG Pipeline Settings

The pipeline is optimized for NVIDIA's 512-token context window:

```typescript
// src/rag/vector-store.ts
const RAG_CONFIG = {
  chunkSize: 1400,        // ~350 tokens (chars/4)
  chunkOverlap: 200,      // ~50 tokens overlap
  separators: ["\n\n", "\n", ". ", "! ", "? ", "; ", ": ", " ", ""],
  minChunkSize: 100,      // Filter tiny chunks
  maxChunks: 5000,        // Performance limit
};
```

### Embedding Model Configuration

```typescript
// src/models/nvidia-embeddings.ts
const NVIDIA_EMBED_MODEL = "nvidia/nv-embedqa-e5-v5";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const MAX_TOKENS = 512;

// Features:
// ✓ 1024-dimensional embeddings
// ✓ Input type discrimination (query vs passage)
// ✓ Batch processing (32 items)
// ✓ Automatic retry on failure
```

### Chat Model Configuration

```typescript
// src/models/nvidia-chat.ts
const NVIDIA_CHAT_MODEL = "meta/llama-3.1-70b-instruct";

// Features:
// ✓ 70B parameters for advanced reasoning
// ✓ Temperature: 0.2 (focused responses)
// ✓ Max tokens: 2000
// ✓ OpenAI-compatible API
```

## 🧪 Testing

### Run All Tests

```bash
# Full test suite
npm run test:all

# Individual test suites
npm run test:nvidia          # NVIDIA API connectivity
npm run test:rag             # RAG pipeline only
npm run test:agent-rag       # End-to-end agent with RAG
```

### Test Coverage

#### 1. RAG Pipeline Tests (`test-rag-pipeline.ts`)

```bash
npm run test:rag
```

Tests:

- ✓ NVIDIA embeddings initialization
- ✓ Document loading and metadata
- ✓ Vector store creation
- ✓ Semantic similarity search
- ✓ Score-based filtering
- ✓ Edge cases and error handling
- ✓ Performance metrics

#### 2. Enhanced Agent Tests (`test-agent-rag-e2e.ts`)

```bash
npm run test:agent-rag
```

Tests:

- ✓ Agent initialization with RAG
- ✓ Single query with retrieval
- ✓ Multi-turn conversations
- ✓ RAG-specific queries
- ✓ Performance stress testing
- ✓ Context-aware follow-ups

#### 3. Legacy Tests (Still Supported)

```bash
npm run test:chromadb        # Legacy ChromaDB test
npm run test:agent           # Legacy agent test
```

## 📊 Performance Benchmarks

### Expected Performance

```
Metric                    | Target    | Typical
--------------------------|-----------|----------
Vector Store Init         | <5s       | ~2-3s
Document Chunking         | <1s       | ~500ms
Query Embedding           | <200ms    | ~100ms
Similarity Search (k=5)   | <100ms    | ~50ms
End-to-End Query          | <3s       | ~1-2s
Multi-turn Follow-up      | <2s       | ~1s
```

### Optimization Tips

1. **Batch Processing**: Process multiple documents in parallel
2. **Chunk Size**: Adjust `RAG_CONFIG.chunkSize` based on content type
3. **Top-K**: Use lower k values (3-5) for faster retrieval
4. **Filtering**: Apply score thresholds to reduce irrelevant results

## 🔍 Usage Examples

### Basic Query

```typescript
import { StudyAgentService } from './src/agent/StudyAgentService';

const agent = new StudyAgentService({
  documentPaths: ['README.md', 'docs/guide.md']
});

await agent.initialize();

const result = await agent.sendMessage(
  "What is this project about?",
  "thread-123"
);

console.log(result.finalMessage);
```

### Advanced Retrieval

```typescript
import { createStudyMaterialVectorStore, retrieveWithScoreFilter } from './src/rag/vector-store';
import { loadStudyDocuments } from './src/rag/document-loader';

// Load and index documents
const docs = await loadStudyDocuments(['doc1.pdf', 'doc2.txt']);
const vectorStore = await createStudyMaterialVectorStore(docs);

// Retrieve with score filtering
const results = await retrieveWithScoreFilter(
  vectorStore,
  "machine learning concepts",
  k = 10,
  minSimilarity = 0.7
);

console.log(`Found ${results.length} highly relevant chunks`);
```

### Custom Chunking

```typescript
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2000,          // Larger chunks
  chunkOverlap: 300,        // More overlap
  separators: ["\n## ", "\n### ", "\n\n", "\n", " "],  // Markdown-aware
});

const chunks = await splitter.splitDocuments(documents);
```

## 🐛 Troubleshooting

### Issue: "NVIDIA_API_KEY is not set"

**Solution**:

```bash
# Check if key is set
echo $NVIDIA_API_KEY

# Set it temporarily
export NVIDIA_API_KEY="nvapi-xxxxxxxxxxxxx"

# Or add to .env file
echo "NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxx" >> .env
```

### Issue: "No documents loaded"

**Solution**:

```typescript
// Check if files exist
import fs from 'fs';

const docPaths = ['README.md', 'guide.md'];
docPaths.forEach(path => {
  if (!fs.existsSync(path)) {
    console.error(`File not found: ${path}`);
  }
});
```

### Issue: "Embedding dimension mismatch"

**Solution**:

- Ensure all embeddings use the same model
- Clear vector store and reinitialize
- Check for mixed embedding models

### Issue: "Query takes too long"

**Solution**:

```typescript
// Reduce number of retrieved documents
const results = await vectorStore.similaritySearch(query, 3); // Instead of 10

// Use score filtering
const filtered = await retrieveWithScoreFilter(
  vectorStore,
  query,
  10,
  0.8  // Higher threshold = fewer results
);
```

## 📚 Key Components

### Document Loader (`src/rag/document-loader.ts`)

```typescript
// Supports: PDF, TXT, MD, JSON, TS, JS, JSX, TSX
const docs = await loadStudyDocuments([
  'document.pdf',
  'notes.md',
  'code.ts'
]);

// Returns enriched documents with metadata:
// - source: relative path
// - fileName: base name
// - fileType: extension
// - loadedAt: timestamp
```

### Vector Store (`src/rag/vector-store.ts`)

```typescript
// Create vector store
const vectorStore = await createStudyMaterialVectorStore(docs);

// Similarity search
const results = await vectorStore.similaritySearch(query, k);

// Search with scores
const scored = await vectorStore.similaritySearchWithScore(query, k);

// Advanced filtering
const filtered = await retrieveWithScoreFilter(vectorStore, query, k, minScore);
```

### NVIDIA Embeddings (`src/models/nvidia-embeddings.ts`)

```typescript
const embeddings = createNVIDIAEmbeddings();

// Embed queries (uses "query" input_type)
const queryVec = await embeddings.embedQuery("search term");

// Embed documents (uses "passage" input_type)
const docVecs = await embeddings.embedDocuments(["doc1", "doc2"]);
```

### Agent Service (`src/agent/StudyAgentService.ts`)

```typescript
const agent = new StudyAgentService({
  documentPaths: ['doc1.md', 'doc2.pdf']
});

await agent.initialize();

// Single message
const result = await agent.sendMessage(query, threadId);

// Add more documents
await agent.addDocuments(['doc3.txt']);

// Reload with new set
await agent.reloadDocuments(['new1.md', 'new2.md']);

// Get status
const status = agent.getStatus();

// Cleanup
await agent.dispose();
```

## 🔗 References

- [NVIDIA NV-Embed-QA-E5-V5 Docs](https://docs.api.nvidia.com/nim/reference/nvidia-nv-embedqa-e5-v5)
- [NVIDIA Build Platform](https://build.nvidia.com/)
- [LangChain RAG Guide](https://docs.langchain.com/langchain/rag)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)

## 🎯 Next Steps

1. **Test the Pipeline**: Run `npm run test:all`
2. **Customize Chunking**: Adjust `RAG_CONFIG` for your use case
3. **Add Documents**: Place PDFs/text files in the project root
4. **Monitor Performance**: Check logs for embedding and retrieval times
5. **Experiment with Models**: Try different NVIDIA models from [build.nvidia.com](https://build.nvidia.com/)

## 💡 Best Practices

1. **Document Preparation**
   - Clean text before indexing
   - Remove boilerplate/headers
   - Use consistent formatting

2. **Chunk Size Selection**
   - Technical docs: 1000-1500 chars
   - Narrative text: 1500-2000 chars
   - Code files: 800-1200 chars

3. **Retrieval Tuning**
   - Start with k=5
   - Increase for broad topics
   - Decrease for specific queries

4. **Score Thresholds**
   - 0.9+: Very specific matches
   - 0.7-0.9: Good relevance
   - 0.5-0.7: Moderate relevance
   - <0.5: Low relevance

5. **Performance**
   - Index during initialization, not per query
   - Cache frequently accessed documents
   - Use score filtering to reduce processing

---

**Built with ❤️ using NVIDIA AI, LangChain, and ChromaDB**

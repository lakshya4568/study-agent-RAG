# Next Steps: Agent Graph Integration

## Current Status

The RAG infrastructure is complete, but the agent graph still needs to be updated to use the new RAG client instead of direct vector store access.

## Files That Need Updating

### 1. `src/agent/graph.ts`

**Current Issue**: Graph expects a `Chroma` vector store parameter

```typescript
export async function createStudyMentorGraph(
  vectorStore: Chroma,  // ❌ This parameter is now obsolete
  tools: ConstructorParameters<typeof ToolNode>[0]
): Promise<...> {
```

**Solution**: Remove `vectorStore` parameter or make it optional/null

```typescript
export async function createStudyMentorGraph(
  _vectorStore: null,  // Ignored, kept for API compatibility
  tools: ConstructorParameters<typeof ToolNode>[0]
): Promise<...> {
  const toolNode = new ToolNode(tools);

  const workflow = new StateGraph(StudyAgentState)
    .addNode("query", queryNode)
    .addNode("retrieve", retrieveNode)  // ✅ No vector store passed
    .addNode("tools", toolNode)
    .addNode("generate", generateNode);
  
  // ... rest of graph
}
```

### 2. `src/agent/nodes.ts`

**Current Issue**: `retrieveNode` uses direct vector store access

```typescript
export async function retrieveNode(
  state: StudyAgentStateType,
  vectorStore: Chroma  // ❌ Direct vector store access
): Promise<Partial<StudyAgentStateType>> {
  // Uses vectorStore.similaritySearchWithScore()
}
```

**Solution**: Update `retrieveNode` to use RAG client

```typescript
import { ragClient } from '../rag/rag-client';

export async function retrieveNode(
  state: StudyAgentStateType
): Promise<Partial<StudyAgentStateType>> {
  try {
    const lastMessage = state.messages[state.messages.length - 1];
    const query =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    logger.info(`Retrieving documents for query: ${query.substring(0, 100)}...`);

    // ✅ Use RAG client instead of vector store
    const result = await ragClient.query(query, [], 5);  // top_k = 5

    if (!result.sources || result.sources.length === 0) {
      logger.warn("No relevant documents found for query");
      return {
        documents: [],
        messages: [
          new SystemMessage({
            content:
              "I couldn't find any matching context in the uploaded documents yet. Upload files or try a different question.",
          }),
        ],
      };
    }

    logger.info(`Retrieved ${result.chunks_retrieved} relevant documents`);

    // Convert RAG client sources to LangChain Document format
    const docs = result.sources.map((source, idx) => ({
      pageContent: source.content,
      metadata: source.metadata,
      id: `doc-${idx}`,
    }));

    // Format context with source citations
    const contextWithSources = result.sources
      .map((source, idx) => {
        const metadata = source.metadata;
        const fileName = (metadata.fileName || metadata.source || 'unknown') as string;
        const origin = (metadata.origin || 'unknown') as string;
        const sourceLabel = `${fileName} · ${origin}`;
        return `[Source ${idx + 1}: ${sourceLabel}]\n${source.content}`;
      })
      .join("\n\n---\n\n");

    return {
      documents: docs,
      messages: [
        new SystemMessage({
          content: `Retrieved Context (use these sources to answer):\n\n${contextWithSources}`,
        }),
      ],
    };
  } catch (error) {
    logger.error("Retrieve node failed", error);
    return {
      documents: [],
      messages: [
        new SystemMessage({
          content:
            "Failed to retrieve context. Provide answer based on general knowledge.",
        }),
      ],
    };
  }
}
```

### 3. Optional: Simplify `generateNode`

The `generateNode` is likely already compatible, but you may want to simplify it since document formatting is now handled in `retrieveNode`.

## Implementation Steps

### Step 1: Update `graph.ts`

```typescript
// Change function signature
export async function createStudyMentorGraph(
  _vectorStore: null,  // Kept for API compatibility, not used
  tools: ConstructorParameters<typeof ToolNode>[0]
): Promise<...> {
  const toolNode = new ToolNode(tools);

  const workflow = new StateGraph(StudyAgentState)
    .addNode("query", queryNode)
    .addNode("retrieve", retrieveNode)  // ✅ No vector store parameter
    .addNode("tools", toolNode)
    .addNode("generate", generateNode);
  
  // ... rest stays the same
}
```

### Step 2: Update `nodes.ts`

```typescript
// Add import
import { ragClient } from '../rag/rag-client';

// Remove unused imports
// Remove: enhancedSimilaritySearch, dedupeByDocument, etc.

// Update retrieveNode signature
export async function retrieveNode(
  state: StudyAgentStateType
  // ✅ No vector store parameter
): Promise<Partial<StudyAgentStateType>> {
  // Use implementation provided above
}

// Remove helper functions that are no longer needed:
// - enhancedSimilaritySearch
// - dedupeByDocument  
// - documentIdentifier (if only used in retrieve)
```

### Step 3: Update `StudyAgentService.ts` Graph Creation

Already done! The new StudyAgentService passes `null`:

```typescript
this.graph = await createStudyMentorGraph(
  null,  // ✅ No vector store
  this.mcpTools?.tools ?? []
);
```

### Step 4: Test the Integration

1. **Start the app**:

   ```bash
   npm start
   ```

2. **Upload a document** via UI

3. **Ask a question** about the document

4. **Verify**:
   - Document loaded successfully (check logs)
   - Query returns relevant answer
   - Sources are cited
   - No errors in console

## Alternative Approach: Hybrid Mode

If you want to keep both implementations temporarily:

```typescript
// In retrieveNode
export async function retrieveNode(
  state: StudyAgentStateType,
  vectorStore?: Chroma | null  // Optional
): Promise<Partial<StudyAgentStateType>> {
  if (vectorStore) {
    // Old implementation using vector store
    return oldRetrieveLogic(state, vectorStore);
  } else {
    // New implementation using RAG client
    return newRetrieveLogic(state);
  }
}
```

## Common Issues and Solutions

### Issue: TypeScript errors about Document type

**Solution**: Make sure you're using compatible types:

```typescript
import type { Document } from "@langchain/core/documents";

// Convert RAG sources to LangChain documents
const docs: Document[] = result.sources.map((source, idx) => ({
  pageContent: source.content,
  metadata: source.metadata as Record<string, any>,
  id: `doc-${idx}`,
}));
```

### Issue: RAG client not available

**Solution**: Check that RAG service is running:

```typescript
// In retrieveNode, add error handling
try {
  const health = await ragClient.testConnection();
  if (!health) {
    throw new Error("RAG service not available");
  }
  // ... rest of code
} catch (error) {
  logger.error("RAG client error", error);
  // Return fallback response
}
```

### Issue: Sources not formatted correctly

**Solution**: Ensure metadata is properly typed:

```typescript
const fileName = String(source.metadata.fileName || source.metadata.source || 'unknown');
const origin = String(source.metadata.origin || 'unknown');
```

## Testing Checklist

- [ ] `npm start` runs without errors
- [ ] Python RAG service starts automatically
- [ ] Upload a PDF successfully
- [ ] Ask question - agent retrieves context
- [ ] Answer includes source citations
- [ ] Check logs - no vector store errors
- [ ] Restart app - documents persist

## Rollback Plan

If issues arise, you can temporarily revert:

```bash
# Restore old StudyAgentService
mv src/agent/StudyAgentService.old.ts src/agent/StudyAgentService.ts

# Restore old RAG files
mv src/rag/vector-store.ts.old src/rag/vector-store.ts
mv src/rag/chroma-server.ts.old src/rag/chroma-server.ts

# Update index.ts to use old server
# Change startRAGService() back to startChromaServer()
```

## Completion Criteria

✅ Graph no longer requires vector store parameter  
✅ Retrieve node uses RAG client REST API  
✅ Documents load and embed successfully  
✅ Queries return relevant answers  
✅ Sources are properly cited  
✅ No TypeScript errors  
✅ No runtime errors  
✅ Tests pass  

## Support

If you need help implementing these changes:

1. Check `RAG_NEW_ARCHITECTURE.md` for API details
2. Review `src/rag/rag-client.ts` for usage examples
3. Check Python service logs for issues
4. Test RAG endpoints directly with curl

The core infrastructure is complete - these final changes integrate the agent graph with the new RAG service!

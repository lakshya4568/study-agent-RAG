# RAG Pipeline Quick Start Guide

## 🚀 Testing Your Fixed RAG Pipeline

### Quick Test (Recommended First Step)

```bash
# Test with your Java cheatsheet or any PDF
npm run test:rag-complete "Java_String_Methods_CheatSheet.pdf"
```

This will:

1. ✅ Load and validate your document
2. ✅ Check metadata is properly formatted
3. ✅ Chunk the document semantically
4. ✅ Generate NVIDIA embeddings
5. ✅ Store in ChromaDB
6. ✅ Test retrieval with sample queries

### Expected Success Output

```
✅ Complete RAG Pipeline Test PASSED

✨ All steps completed successfully:
   ✓ Document loading with metadata enrichment
   ✓ Semantic chunking with deduplication
   ✓ NVIDIA embeddings generation
   ✓ ChromaDB vector storage
   ✓ Semantic similarity retrieval

🎉 Your RAG pipeline is working correctly!
```

## 🎯 What Was Fixed

### The Main Problem

```
❌ Before: Failed to add documents: Expected metadata to be 
   a string, number, boolean, SparseVector, or nullable
```

### The Solution

```
✅ After: All metadata is automatically sanitized to primitive types
   - Objects/arrays → JSON strings
   - Undefined/null → null
   - Everything else → primitives
```

## 📝 How to Use in Your App

### 1. Start the Application

```bash
npm start
```

The ChromaDB server will auto-start. Watch for:

```
✅ ChromaDB server started on port 8000
```

### 2. Upload Documents

Through the UI:

1. Click "Upload Documents" button
2. Select your PDF, text, or markdown files
3. Watch the logs for progress

Expected logs:

```
📄 Parsing PDF: your-document.pdf...
✅ Loaded PDF: your-document.pdf (X pages with text)
Split X documents into Y chunks
📤 Adding Y sanitized chunks to vector store...
✅ Successfully added chunks to vector store
```

### 3. Ask Questions

Type your question in the chat. The agent will:

1. 🔍 Search your uploaded documents
2. 📚 Retrieve relevant chunks
3. 🤖 Generate an answer with sources
4. 📖 Show citations

## 🔧 Troubleshooting

### Issue: "No extractable text from PDF"

**Solution:**

- Your PDF is image-based (scanned)
- Use OCR software (Adobe Acrobat, online tools)
- Re-upload the searchable PDF

### Issue: "NVIDIA API error"

**Solution:**

```bash
# Check your .env file has:
NVIDIA_API_KEY=nvapi-xxxxx...

# Or set it:
echo "NVIDIA_API_KEY=your-key-here" >> .env
```

### Issue: "ChromaDB connection failed"

**Solution:**

```bash
# Restart the app (server auto-starts)
npm start

# Or manually start ChromaDB:
npm run chroma:start
```

### Issue: Poor retrieval quality

**Try these:**

1. Be more specific in your questions
2. Use keywords from the document
3. Upload more relevant documents
4. Check chunk size in logs (should be ~2k chars)

## 📊 Understanding the Logs

### Good Upload Sequence

```
📚 Step 1: Loading Documents ✓
📄 Parsing PDF: file.pdf...
✅ Loaded PDF: file.pdf (5 pages with text)

✂️ Step 2: Chunking
Split 5 documents into 25 chunks
   Raw chunks: 25
   Kept chunks: 25
   Dropped (too short): 0
   Dropped (duplicates): 0

🔄 Step 3: Embedding (this takes ~30s)
✅ Successfully embedded 25 documents (2048D)

📤 Step 4: Vector Store
✅ Successfully added chunks to vector store
```

### What Each Step Means

| Step | What It Does | Time |
|------|-------------|------|
| Loading | Extracts text from files | 1-5s |
| Chunking | Splits into semantic pieces | <1s |
| Embedding | Converts to vectors (NVIDIA) | 30-60s |
| Storing | Saves to ChromaDB | 1-2s |

## ⚡ Performance Tips

### For Faster Processing

- Upload smaller documents first to test
- NVIDIA embeddings are rate-limited (40 req/min free tier)
- Batch upload related documents together

### For Better Results

- Upload well-structured PDFs (with headings, paragraphs)
- Avoid image-heavy PDFs
- Text files are fastest to process
- Markdown files preserve structure well

## 🎓 Best Practices

### Document Preparation

1. ✅ Ensure PDFs have selectable text
2. ✅ Remove unnecessary pages (covers, blank pages)
3. ✅ Name files descriptively
4. ✅ Organize by topic

### Query Formulation

1. ✅ Be specific: "What is the charAt() method?" vs "String methods"
2. ✅ Use document terminology
3. ✅ Ask one thing at a time
4. ✅ Follow up for clarification

### System Maintenance

1. ✅ Monitor logs for errors
2. ✅ Check ChromaDB storage size
3. ✅ Clear old documents if needed
4. ✅ Update embeddings if you change documents

## 📈 Monitoring Success

### Healthy System Indicators

```
✅ Documents load without errors
✅ Chunks are 500-3000 characters
✅ No metadata sanitization warnings
✅ Embeddings complete in <60s per document
✅ Retrieval returns relevant results
✅ Similarity scores > 0.7 for good matches
```

### Warning Signs

```
⚠️ Many chunks dropped (too short)
⚠️ High duplicate count
⚠️ Low similarity scores (<0.5)
⚠️ ChromaDB connection timeouts
⚠️ NVIDIA API rate limit errors
```

## 🎯 Next Steps

### 1. Test with Your Documents

```bash
npm run test:rag-complete "path/to/your/document.pdf"
```

### 2. Upload Via UI

```bash
npm start
# Then use the upload button
```

### 3. Ask Questions

Start with:

- "What topics are covered in my documents?"
- "Summarize the main points"
- "What is [specific concept] about?"

### 4. Refine Your Knowledge Base

- Add more related documents
- Remove outdated content
- Organize by subject area

## 📚 Additional Resources

- **Full Details:** See `RAG_PIPELINE_COMPLETE_FIX.md`
- **Architecture:** See diagrams in the complete fix document
- **API Reference:** See `src/rag/` TypeScript files
- **Examples:** See `tests/test-*.ts` files

## ✅ Verification Checklist

Before considering the RAG pipeline fully working:

- [ ] `npm run test:rag-complete <file>` passes
- [ ] Document uploads without metadata errors
- [ ] Chunks are created (check logs)
- [ ] Embeddings complete successfully
- [ ] ChromaDB stores the vectors
- [ ] Queries return relevant results
- [ ] Similarity scores make sense
- [ ] App doesn't crash during upload

## 🎉 Success Criteria

Your RAG pipeline is working when:

1. ✅ You can upload any text-based PDF
2. ✅ The system chunks it into ~500-3000 char pieces
3. ✅ NVIDIA generates embeddings (2048D vectors)
4. ✅ ChromaDB stores everything persistently
5. ✅ You can ask questions and get relevant answers
6. ✅ Sources are cited in responses
7. ✅ No metadata errors in logs

**If all above are true: Your RAG pipeline is production-ready! 🚀**

---

## 🆘 Need Help?

If issues persist:

1. Check logs in the console
2. Review `RAG_PIPELINE_COMPLETE_FIX.md`
3. Run the test script with `--verbose` flag
4. Check NVIDIA API quota (40 req/min free tier)
5. Verify ChromaDB is running: `curl http://localhost:8000/api/v1/heartbeat`

**Happy learning with your AI Study Agent! 📚🤖**

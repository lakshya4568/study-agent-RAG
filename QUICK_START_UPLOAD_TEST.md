# Quick Start: Testing Document Upload

## 🚀 Run the Test

```powershell
npm run test:upload
```

## ✅ Expected Output

```
✅ File found: SHARDA STUDY TRACKER FINAL.pdf
✅ NVIDIA API key configured
✅ Loaded 35 document chunks
✅ Vector store created successfully
✅ Similarity search: Working
✅ Successfully added 84 more chunks
🎉 All tests passed!
```

## 📝 Before Running

1. Make sure `NVIDIA_API_KEY` is in your `.env` file
2. Test uses: `C:\Users\Lakshya Sharma\Desktop\SHARDA STUDY TRACKER FINAL.pdf`
3. To test with a different file, edit line 20 in `tests/test-document-upload.ts`

## 🐛 If Test Fails

### File not found

→ Update `TEST_PDF_PATH` in `tests/test-document-upload.ts`

### API key error

→ Add `NVIDIA_API_KEY=your_key` to `.env` file

### Token limit error

→ Already fixed! Chunks now target ~6,000 tokens (≈24k chars) to leverage the 8,192-token window.

## 🎯 What Was Fixed

| Issue      | Before        | After                            |
| ---------- | ------------- | -------------------------------- |
| File path  | Only filename | Full absolute path               |
| Chunk size | 1000 chars    | ~24,000 chars (fits 8,192-token limit) |
| Add docs   | No chunking   | Automatic chunking               |

## 📦 Files Changed

- ✅ `src/views/Chat.tsx` - File path handling
- ✅ `src/rag/vector-store.ts` - Chunk size
- ✅ `src/agent/StudyAgentService.ts` - Document chunking
- ✅ `tests/test-document-upload.ts` - Test script
- ✅ `package.json` - npm script

## 🔍 How It Works Now

1. User clicks "Upload Docs" in UI
2. Electron file picker provides **absolute path**
3. System loads file from **actual location**
4. Splits into **~24k-char chunks** (≈6,000 tokens)
5. Creates embeddings via **NVIDIA API**
6. Stores in **ChromaDB** (in-memory)
7. Ready for **similarity search** ✨

---

**All fixes verified and tested! 🎉**

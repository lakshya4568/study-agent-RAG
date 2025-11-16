# Document Upload Test

This test script validates the document upload functionality with NVIDIA embeddings.

## Prerequisites

1. **NVIDIA API Key**: Ensure `NVIDIA_API_KEY` is set in your `.env` file
2. **Test PDF**: Update the `TEST_PDF_PATH` constant in `test-document-upload.ts` to point to your PDF file

## Running the Test

### Option 1: Using npm script

```powershell
npm run test:upload
```

### Option 2: Using PowerShell script

```powershell
.\run-upload-test.ps1
```

### Option 3: Direct execution

```powershell
npx tsx tests/test-document-upload.ts
```

## What This Test Does

1. **File Verification**: Checks if the PDF file exists at the specified path
2. **API Configuration**: Verifies NVIDIA API key is configured
3. **Document Loading**: Loads the PDF and splits it into chunks
4. **Vector Store Creation**: Creates embeddings using NVIDIA API and stores in ChromaDB
5. **Similarity Search**: Tests querying the vector store
6. **Add Documents**: Tests adding additional documents to existing store

## Expected Output

```
========================================
Document Upload Test with NVIDIA Embeddings
========================================

Step 1: Verifying file existence...
✅ File found: SHARDA STUDY TRACKER FINAL.pdf
   File size: 2.45 MB

Step 2: Checking NVIDIA API configuration...
✅ NVIDIA API key configured

Step 3: Loading document...
   Loading: C:\Users\Lakshya Sharma\Desktop\SHARDA STUDY TRACKER FINAL.pdf
✅ Loaded 24 document chunks
   First chunk preview: ...
   Metadata: {...}

Step 4: Creating vector store with NVIDIA embeddings...
   This may take a moment depending on document size...
✅ Vector store created successfully in 3.42s
   Total chunks embedded: 24

Step 5: Testing similarity search...
   Query: "What is the main topic of this document?"
   Found 3 relevant chunks:
   1. ...
   2. ...
   3. ...

Step 6: Testing adding documents to existing vector store...
   Adding 2 additional documents...
✅ Successfully added 8 more chunks to vector store

========================================
Test Summary
========================================
✅ Document loaded: SHARDA STUDY TRACKER FINAL.pdf
✅ Chunks created: 24
✅ Vector store: Operational with NVIDIA embeddings
✅ Similarity search: Working

🎉 All tests passed! Document upload system is working correctly.
```

## Troubleshooting

### Error: File not found

- Update `TEST_PDF_PATH` in `tests/test-document-upload.ts` to the correct absolute path
- Use double backslashes in Windows paths: `C:\\Users\\...`

### Error: NVIDIA_API_KEY not found

- Add `NVIDIA_API_KEY=your_key_here` to your `.env` file in the project root

### Error: Failed to create vector store

- Check your internet connection (NVIDIA API requires online access)
- Verify your API key is valid
- Check the error message for specific details

## Integration with Main App

Once this test passes, the same functionality is used by the main application when:

- Users click "Upload Docs" in the chat interface
- Files are selected via the file picker dialog
- The app processes PDFs, text files, and markdown documents

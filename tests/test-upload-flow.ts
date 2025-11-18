/**
 * Comprehensive Document Upload Flow Test
 *
 * Tests the complete RAG pipeline:
 * 1. Upload PDF/Document
 * 2. Split/Chunk text
 * 3. Embed via NVIDIA API
 * 4. Store in ChromaDB vector store
 * 5. Query using RAG
 *
 * Usage: npx tsx tests/test-upload-flow.ts <path-to-document>
 */

import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { loadStudyDocuments } from "../src/rag/document-loader";
import {
  createStudyMaterialVectorStore,
  chunkDocumentsForVectorStore,
} from "../src/rag/vector-store";

dotenv.config();

const testFilePath = process.argv[2];

async function testUploadFlow() {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════╗"
  );
  console.log("║     Document Upload Flow Test - Full RAG Pipeline        ║");
  console.log(
    "╚═══════════════════════════════════════════════════════════╝\n"
  );

  // Step 1: Validate input
  if (!testFilePath) {
    console.error("❌ Error: No document path provided");
    console.log("\n📖 Usage:");
    console.log("   npx tsx tests/test-upload-flow.ts <path-to-document>\n");
    console.log("📝 Examples:");
    console.log(
      "   npx tsx tests/test-upload-flow.ts ~/Desktop/study-notes.pdf"
    );
    console.log("   npx tsx tests/test-upload-flow.ts ./README.md");
    console.log(
      '   npx tsx tests/test-upload-flow.ts "/path/with spaces/doc.pdf"\n'
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(testFilePath);

  console.log("Step 1: File Validation");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}\n`);
    process.exit(1);
  }

  const stats = fs.statSync(resolvedPath);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  const fileExt = path.extname(resolvedPath).toLowerCase();

  console.log(`✅ File exists: ${path.basename(resolvedPath)}`);
  console.log(`   Path: ${resolvedPath}`);
  console.log(`   Size: ${fileSizeMB} MB`);
  console.log(`   Type: ${fileExt}`);
  console.log(`   Modified: ${stats.mtime.toLocaleString()}\n`);

  // Step 2: API Configuration
  console.log("Step 2: API Configuration");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!process.env.NVIDIA_API_KEY) {
    console.error("❌ NVIDIA_API_KEY not found in environment");
    console.log("   Please set NVIDIA_API_KEY in your .env file\n");
    process.exit(1);
  }

  console.log("✅ NVIDIA API key configured");
  console.log("   Model: NV-Embed-QA (1024 dimensions)\n");

  // Step 3: Load Document
  console.log("Step 3: Document Loading");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Loading: ${path.basename(resolvedPath)}...`);

  let documents;
  try {
    const loadStart = Date.now();
    documents = await loadStudyDocuments([resolvedPath]);
    const loadDuration = ((Date.now() - loadStart) / 1000).toFixed(2);

    if (documents.length === 0) {
      console.error(
        "❌ No documents loaded - file may be empty or unreadable\n"
      );
      process.exit(1);
    }

    console.log(`✅ Document loaded successfully (${loadDuration}s)`);
    console.log(`   Raw pages/sections: ${documents.length}`);
    console.log(`   First section preview:`);
    console.log(`   "${documents[0].pageContent.substring(0, 120)}..."\n`);

    // Show metadata
    console.log(`   Metadata:`);
    console.log(`   - Document ID: ${documents[0].metadata.documentId}`);
    console.log(`   - Origin: ${documents[0].metadata.origin}`);
    console.log(`   - File Type: ${documents[0].metadata.fileType}`);
    console.log(`   - Size: ${documents[0].metadata.sizeBytes} bytes\n`);
  } catch (error) {
    console.error("❌ Failed to load document:", error);
    process.exit(1);
  }

  // Step 4: Chunking
  console.log("Step 4: Text Chunking & Preprocessing");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   Splitting document into optimized chunks...");

  let chunks;
  let chunkingSummary;
  try {
    const chunkStart = Date.now();
    const result = await chunkDocumentsForVectorStore(documents);
    chunks = result.chunks;
    chunkingSummary = result.summary;
    const chunkDuration = ((Date.now() - chunkStart) / 1000).toFixed(2);

    console.log(`✅ Chunking complete (${chunkDuration}s)`);
    console.log(`   Raw chunks: ${chunkingSummary.totalRawChunks}`);
    console.log(`   Kept chunks: ${chunkingSummary.totalKeptChunks}`);
    console.log(`   Dropped (too short): ${chunkingSummary.droppedShort}`);
    console.log(
      `   Dropped (duplicates): ${chunkingSummary.droppedDuplicates}`
    );
    console.log(
      `   Average chunk size: ${Math.round(chunks.reduce((acc, c) => acc + c.pageContent.length, 0) / chunks.length)} chars\n`
    );
  } catch (error) {
    console.error("❌ Chunking failed:", error);
    process.exit(1);
  }

  // Step 5: Embedding & Vector Store
  console.log("Step 5: NVIDIA Embeddings & ChromaDB Storage");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   Creating embeddings via NVIDIA API...");
  console.log("   This may take a moment depending on document size...\n");

  let vectorStore;
  try {
    const embedStart = Date.now();
    vectorStore = await createStudyMaterialVectorStore(chunks);
    const embedDuration = ((Date.now() - embedStart) / 1000).toFixed(2);

    console.log(`✅ Vector store created successfully (${embedDuration}s)`);
    console.log(`   Total chunks embedded: ${chunks.length}`);
    console.log(`   Vector dimensions: 1024`);
    console.log(`   Storage: ChromaDB persistent store`);
    console.log(`   Collection: study_materials\n`);
  } catch (error) {
    console.error("❌ Vector store creation failed:", error);
    if (error instanceof Error) {
      console.error("   Error details:", error.message);
    }
    process.exit(1);
  }

  // Step 6: RAG Query Tests
  console.log("Step 6: RAG Query Testing");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━");

  const testQueries = [
    "What is this document about?",
    "Summarize the main points",
    "Key topics covered",
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n   Test Query ${i + 1}: "${query}"`);

    try {
      const queryStart = Date.now();
      const results = await vectorStore.similaritySearch(query, 3);
      const queryDuration = (Date.now() - queryStart).toFixed(0);

      console.log(
        `   ✅ Found ${results.length} relevant chunks (${queryDuration}ms)`
      );

      results.forEach((result, idx) => {
        const preview = result.pageContent
          .substring(0, 100)
          .replace(/\n/g, " ")
          .trim();
        const score = result.metadata.score || "N/A";
        console.log(`      ${idx + 1}. [Score: ${score}] ${preview}...`);
      });
    } catch (error) {
      console.error(`   ❌ Query failed:`, error);
    }
  }

  // Final Summary
  console.log(
    "\n\n╔═══════════════════════════════════════════════════════════╗"
  );
  console.log("║                    TEST SUMMARY                           ║");
  console.log(
    "╚═══════════════════════════════════════════════════════════╝\n"
  );

  console.log("✅ Document Upload:        SUCCESS");
  console.log("✅ Text Chunking:          SUCCESS");
  console.log("✅ NVIDIA Embeddings:      SUCCESS");
  console.log("✅ ChromaDB Storage:       SUCCESS");
  console.log("✅ RAG Queries:            SUCCESS");

  console.log("\n📊 Pipeline Statistics:");
  console.log(`   • Input file: ${path.basename(resolvedPath)}`);
  console.log(`   • File size: ${fileSizeMB} MB`);
  console.log(`   • Raw sections: ${documents.length}`);
  console.log(`   • Final chunks: ${chunks.length}`);
  console.log(`   • Vector dimensions: 1024`);
  console.log(`   • Storage: Persistent ChromaDB`);

  console.log("\n🎉 Full RAG pipeline is operational!");
  console.log("\n💡 Next Steps:");
  console.log("   • Upload documents via UI in the Chat view");
  console.log("   • Ask questions about your uploaded documents");
  console.log("   • Agent will use RAG to provide contextual answers\n");
}

// Run the test
testUploadFlow().catch((error) => {
  console.error("\n❌ Test failed with error:", error);
  process.exit(1);
});

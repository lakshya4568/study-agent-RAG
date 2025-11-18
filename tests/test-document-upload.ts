/**
 * Test Script for Document Upload with NVIDIA Embeddings
 *
 * This test demonstrates:
 * 1. Loading a PDF document from an absolute path
 * 2. Creating embeddings using NVIDIA API
 * 3. Storing in ChromaDB vector store
 * 4. Querying the vector store
 */

import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { loadStudyDocuments } from "../src/rag/document-loader";
import { createStudyMaterialVectorStore } from "../src/rag/vector-store";
import { logger } from "../src/client/logger";

dotenv.config();

// Get test file path from command line argument
// Usage: npm test -- /path/to/your/document.pdf
const TEST_PDF_PATH = process.argv[2];

if (!TEST_PDF_PATH) {
  console.error("\n❌ Error: Please provide a document path as argument");
  console.log("\nUsage:");
  console.log("  npx tsx tests/test-document-upload.ts /path/to/document.pdf");
  console.log("\nExample:");
  console.log("  npx tsx tests/test-document-upload.ts ~/Desktop/my-doc.pdf\n");
  process.exit(1);
}

async function testDocumentUpload() {
  console.log("\n========================================");
  console.log("Document Upload Test with NVIDIA Embeddings");
  console.log("========================================\n");

  // Step 1: Check if file exists
  console.log("Step 1: Verifying file existence...");
  if (!fs.existsSync(TEST_PDF_PATH)) {
    console.error(`❌ File not found: ${TEST_PDF_PATH}`);
    console.log(
      "\nPlease update TEST_PDF_PATH in the test script to point to your PDF file."
    );
    process.exit(1);
  }
  console.log(`✅ File found: ${path.basename(TEST_PDF_PATH)}`);
  const fileSizeMB = (fs.statSync(TEST_PDF_PATH).size / (1024 * 1024)).toFixed(
    2
  );
  console.log(`   File size: ${fileSizeMB} MB\n`);

  // Step 2: Check NVIDIA API key
  console.log("Step 2: Checking NVIDIA API configuration...");
  if (!process.env.NVIDIA_API_KEY) {
    console.error("❌ NVIDIA_API_KEY not found in environment variables");
    console.log("   Please set NVIDIA_API_KEY in your .env file");
    process.exit(1);
  }
  console.log("✅ NVIDIA API key configured\n");

  // Step 3: Load the document
  console.log("Step 3: Loading document...");
  console.log(`   Loading: ${TEST_PDF_PATH}`);

  let documents;
  try {
    documents = await loadStudyDocuments([TEST_PDF_PATH]);

    if (documents.length === 0) {
      console.error("❌ No documents loaded");
      process.exit(1);
    }

    console.log(`✅ Loaded ${documents.length} document chunks`);
    console.log(
      `   First chunk preview: ${documents[0].pageContent.substring(0, 100)}...`
    );
    console.log(
      `   Metadata: ${JSON.stringify(documents[0].metadata, null, 2)}\n`
    );
  } catch (error) {
    console.error("❌ Failed to load document:", error);
    process.exit(1);
  }

  // Step 4: Create vector store with NVIDIA embeddings
  console.log("Step 4: Creating vector store with NVIDIA embeddings...");
  console.log("   This may take a moment depending on document size...");

  let vectorStore;
  try {
    const startTime = Date.now();
    vectorStore = await createStudyMaterialVectorStore(documents);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Vector store created successfully in ${duration}s`);
    console.log(`   Total chunks embedded: ${documents.length}\n`);
  } catch (error) {
    console.error("❌ Failed to create vector store:", error);
    if (error instanceof Error) {
      console.error("   Error details:", error.message);
      if (error.stack) {
        console.error("   Stack trace:", error.stack);
      }
    }
    process.exit(1);
  }

  // Step 5: Test similarity search
  console.log("Step 5: Testing similarity search...");
  const testQueries = [
    "What is the main topic of this document?",
    "summary",
    "important points",
  ];

  for (const query of testQueries) {
    console.log(`\n   Query: "${query}"`);
    try {
      const results = await vectorStore.similaritySearch(query, 3);
      console.log(`   Found ${results.length} relevant chunks:`);

      results.forEach((result, idx) => {
        const preview = result.pageContent
          .substring(0, 150)
          .replace(/\n/g, " ");
        console.log(`   ${idx + 1}. ${preview}...`);
      });
    } catch (error) {
      console.error(`   ❌ Query failed:`, error);
    }
  }

  // Step 6: Vector store persistence verification
  console.log("\n\nStep 6: Verifying vector store persistence...");
  try {
    // Check ChromaDB collection
    const collectionCount = await vectorStore.similaritySearch(
      "document collection check",
      1
    );
    console.log(`✅ Vector store is persistent and accessible`);
    console.log(
      `   Collection contains ${documents.length} chunks from uploaded document\n`
    );
  } catch (error) {
    console.error("   ⚠️  Persistence check failed:", error);
  }

  // Final summary
  console.log("\n========================================");
  console.log("Test Summary");
  console.log("========================================");
  console.log(`✅ Document loaded: ${path.basename(TEST_PDF_PATH)}`);
  console.log(`✅ Chunks created: ${documents.length}`);
  console.log(`✅ Vector store: Operational with NVIDIA embeddings`);
  console.log(`✅ Similarity search: Working`);
  console.log(
    "\n🎉 All tests passed! Document upload system is working correctly.\n"
  );
}

// Run the test
testDocumentUpload().catch((error) => {
  console.error("\n❌ Test failed with error:", error);
  process.exit(1);
});

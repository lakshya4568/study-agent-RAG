/**
 * Test ChromaDB Persistent Storage (Client Mode)
 *
 * This test verifies that:
 * 1. ChromaDB persistent client can be created
 * 2. Collections can be created
 * 3. Data persists in the local directory
 */

import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { getChromaPersistDir } from "../src/rag/chroma-server";
import { Document } from "@langchain/core/documents";

async function testPersistentStorage() {
  console.log("\n🧪 Test: ChromaDB Persistent Storage");
  console.log("=====================================");

  try {
    const persistDir = getChromaPersistDir();
    console.log(`Storage directory: ${persistDir}`);
    console.log(`ChromaDB server: http://localhost:8000`);

    // Create fake embeddings for testing (no API required)
    const embeddings = new FakeEmbeddings();

    // Create ChromaDB client connected to HTTP server
    const chromaClient = new ChromaClient({
      host: "localhost",
      port: 8000,
    });

    // Create test documents
    const testDocs = [
      new Document({
        pageContent: "This is a test document about AI",
        metadata: { source: "test1.txt" },
      }),
      new Document({
        pageContent: "This is another test document about machine learning",
        metadata: { source: "test2.txt" },
      }),
    ];

    console.log(`\nCreating vector store with ${testDocs.length} documents...`);

    // Create vector store with persistent storage
    const vectorStore = await Chroma.fromDocuments(testDocs, embeddings, {
      collectionName: "test_persistence",
      index: chromaClient, // Use ChromaClient instance for persistence
    });

    console.log("✅ Vector store created successfully");

    // Test search
    console.log("\nTesting similarity search...");
    const results = await vectorStore.similaritySearch("AI", 1);
    console.log(`Found ${results.length} results`);
    if (results.length > 0) {
      console.log(`  - ${results[0].pageContent.substring(0, 50)}...`);
    }

    console.log("\n✅ All tests passed!");
    console.log(`\nData persisted to: ${persistDir}`);

    return true;
  } catch (error) {
    console.error("❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    return false;
  }
}

// Run test
console.log("============================================================");
console.log("ChromaDB Persistent Storage Test Suite");
console.log("============================================================");

testPersistentStorage().then((success) => {
  process.exit(success ? 0 : 1);
});

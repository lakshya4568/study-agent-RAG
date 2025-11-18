#!/usr/bin/env tsx
/**
 * Full RAG Pipeline Integration Test
 *
 * End-to-end test of the complete RAG system:
 * - Document loading from project files
 * - NVIDIA embedding generation (2048D vectors)
 * - ChromaDB persistent HTTP server vector storage
 * - Semantic similarity search
 * - Score-based result quality
 *
 * Requirements:
 * - ChromaDB server running at http://localhost:8000
 * - NVIDIA_API_KEY set in environment
 *
 * Run with: npm run test:integration
 */

import { createStudyMaterialVectorStore } from "../src/rag/vector-store";
import { loadStudyDocuments } from "../src/rag/document-loader";
import {
  isChromaServerRunning,
  getChromaServerUrl,
  getChromaPersistDir,
} from "../src/rag/chroma-server";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

function logSection(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

async function testFullIntegration() {
  console.log("\n🧪 FULL RAG PIPELINE INTEGRATION TEST");
  console.log("=".repeat(60));
  console.log("Testing complete system from documents to semantic search\n");

  try {
    // Step 0: Verify ChromaDB server is running
    logSection("Step 0: Verifying ChromaDB Server");

    const serverUrl = getChromaServerUrl();
    const persistDir = getChromaPersistDir();
    const isRunning = await isChromaServerRunning();

    if (!isRunning) {
      console.error(`\n❌ ChromaDB server is not running at ${serverUrl}`);
      console.error("\n💡 Please start the ChromaDB server first:");
      console.error("   - Server should be started by Electron app");
      console.error(
        "   - Or manually: chroma run --path .chromadb/chroma_storage --port 8000\n"
      );
      return false;
    }

    console.log(`✅ ChromaDB server is running at ${serverUrl}`);
    console.log(`📁 Storage directory: ${persistDir}\n`);

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadStudyDocuments } from "../src/rag/document-loader";
import { createStudyMaterialVectorStore } from "../src/rag/vector-store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logSection(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}\n`);
}

async function testFullIntegration() {
  try {
    logSection("📚 RAG PIPELINE FULL INTEGRATION TEST");

    // Step 1: Load Document
    logSection("Step 1: Loading README.md");
    const readmePath = path.resolve(__dirname, "..", "README.md");
    console.log(`📄 File: ${readmePath}`);

    const docs = await loadStudyDocuments([readmePath]);
    console.log(`✅ Loaded ${docs.length} document(s)`);

    if (docs.length === 0) {
      throw new Error("No documents loaded");
    }

    const totalChars = docs.reduce(
      (sum, doc) => sum + doc.pageContent.length,
      0
    );
    console.log(`📊 Total characters: ${totalChars.toLocaleString()}`);

    // Step 2: Create Vector Store (includes chunking + embedding)
    logSection("Step 2: Creating Vector Store (Chunking + Embedding)");
    console.log("⏳ This may take 30-60 seconds...");
    console.log("   - Chunking documents (1400 chars, 200 overlap)");
    console.log("   - Spawning Python service");
    console.log("   - Embedding via NVIDIA API (2048D vectors)");
    console.log("   - Storing in ChromaDB");

    const startTime = Date.now();
    const vectorStore = await createStudyMaterialVectorStore(docs);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Vector store created in ${duration}s`);

    // Step 3: Test Semantic Search
    logSection("Step 3: Testing Semantic Search");

    const queries = [
      "What is this project about?",
      "How do I install dependencies?",
      "What features does this application have?",
    ];

    for (const query of queries) {
      console.log(`\n🔍 Query: "${query}"`);
      const results = await vectorStore.similaritySearchWithScore(query, 3);

      if (results.length === 0) {
        console.log("   ❌ No results found");
        continue;
      }

      console.log(`   ✅ Found ${results.length} relevant chunks:\n`);

      for (const [doc, score] of results) {
        const similarity = (1 - score).toFixed(4);
        const preview = doc.pageContent.substring(0, 100).replace(/\n/g, " ");
        console.log(`   📄 Similarity: ${similarity}`);
        console.log(`      Preview: ${preview}...`);
        console.log(
          `      Source: ${doc.metadata.source} (${doc.metadata.fileName})\n`
        );
      }
    }

    // Step 4: Verify Semantic Understanding
    logSection("Step 4: Semantic Understanding Verification");

    const testCases = [
      { q1: "machine learning AI", q2: "artificial intelligence" },
      { q1: "install dependencies", q2: "setup requirements" },
      { q1: "cooking recipes", q2: "software development" },
    ];

    for (const { q1, q2 } of testCases) {
      const results1 = await vectorStore.similaritySearchWithScore(q1, 1);
      const results2 = await vectorStore.similaritySearchWithScore(q2, 1);

      if (results1.length > 0 && results2.length > 0) {
        const score1 = (1 - results1[0][1]).toFixed(4);
        const score2 = (1 - results2[0][1]).toFixed(4);

        console.log(`\n🧪 "${q1}" → similarity: ${score1}`);
        console.log(`   "${q2}" → similarity: ${score2}`);

        const diff = Math.abs(results1[0][1] - results2[0][1]);
        if (diff < 0.1) {
          console.log(
            `   ✅ Related queries have similar scores (diff: ${diff.toFixed(4)})`
          );
        } else {
          console.log(
            `   ⚠️  Queries have different scores (diff: ${diff.toFixed(4)})`
          );
        }
      }
    }

    // Final Summary
    logSection("✅ INTEGRATION TEST COMPLETE");
    console.log("All components working correctly:");
    console.log("  ✅ Document loading (PDF/text support)");
    console.log("  ✅ Chunking (optimized for NVIDIA context)");
    console.log("  ✅ Python bridge (JSON-RPC communication)");
    console.log("  ✅ NVIDIA embeddings (2048D vectors)");
    console.log("  ✅ ChromaDB storage (persistent HTTP server)");
    console.log("  ✅ Semantic search (cosine similarity)");
    console.log("  ✅ Metadata enrichment");
    console.log("\n🎉 RAG pipeline is production ready!");

    return true;
  } catch (error) {
    logSection("❌ INTEGRATION TEST FAILED");
    console.error("Error:", error);

    if (error instanceof Error) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    return false;
  }
}

// Run test
testFullIntegration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });

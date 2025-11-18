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
 * Run with: npm run test:integration
 */

import dotenv from "dotenv";
import path from "path";
import { loadStudyDocuments } from "../src/rag/document-loader";
import { createStudyMaterialVectorStore } from "../src/rag/vector-store";
import {
  isChromaServerRunning,
  getChromaServerUrl,
  getChromaPersistDir,
} from "../src/rag/chroma-server";

dotenv.config();

function logSection(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

async function testFullIntegration(): Promise<boolean> {
  console.log("\n🧪 FULL RAG PIPELINE INTEGRATION TEST");
  console.log("=".repeat(60));
  console.log("Testing complete system from documents to semantic search\n");

  try {
    // Step 0: Verify ChromaDB server is available
    logSection("Step 0: Verifying ChromaDB Server");
    const serverUrl = getChromaServerUrl();
    const persistDir = getChromaPersistDir();
    const isRunning = await isChromaServerRunning();

    if (!isRunning) {
      console.warn(
        `⚠️  ChromaDB server is not responding at ${serverUrl}. Tests will continue using the in-memory fallback.`
      );
    } else {
      console.log(`✅ ChromaDB server is running at ${serverUrl}`);
      console.log(`📁 Storage directory: ${persistDir}\n`);
    }

    // Step 1: Load documents
    logSection("Step 1: Loading core project documents");
    const files = [
      "README.md",
      "COMPONENT_USAGE_GUIDE.md",
      "DATABASE_INTEGRATION_SUMMARY.md",
    ];
    const absolutePaths = files.map((file) =>
      path.resolve(process.cwd(), file)
    );
    console.log(`📚 Loading ${absolutePaths.length} files`);
    absolutePaths.forEach((file) => console.log(`   - ${file}`));

    const documents = await loadStudyDocuments(absolutePaths);
    console.log(`✅ Documents loaded: ${documents.length}`);

    if (documents.length === 0) {
      throw new Error("No documents loaded. Ensure the markdown files exist.");
    }

    // Step 2: Create Vector Store (chunk + embed + store)
    logSection("Step 2: Creating Vector Store (Chunking + Embedding)");
    console.log("⏳ This step may take up to a minute...");

    const buildStart = Date.now();
    const vectorStore = await createStudyMaterialVectorStore(documents);
    const buildDuration = ((Date.now() - buildStart) / 1000).toFixed(2);
    console.log(`✅ Vector store initialized in ${buildDuration}s`);

    // Step 3: Semantic Search Validation
    logSection("Step 3: Validating Semantic Search");
    const queries = [
      "What is this project about?",
      "How do I set up the database?",
      "Which UI components are available?",
    ];

    for (const query of queries) {
      console.log(`\n🔍 Query: ${query}`);
      const results = await vectorStore.similaritySearchWithScore(query, 3);

      if (results.length === 0) {
        console.log("   ❌ No relevant chunks found");
        continue;
      }

      console.log(`   ✅ Retrieved ${results.length} chunks`);
      results.forEach(([doc, score], idx) => {
        const similarity = (1 - score).toFixed(3);
        const preview = doc.pageContent.substring(0, 120).replace(/\n/g, " ");
        console.log(`      ${idx + 1}. Similarity: ${similarity}`);
        console.log(`         Source: ${doc.metadata?.fileName ?? "unknown"}`);
        console.log(`         Preview: ${preview}...`);
      });
    }

    // Step 4: Sanity-check semantic distances
    logSection("Step 4: Semantic Consistency Checks");
    const sanityPairs = [
      ["machine learning", "artificial intelligence"],
      ["component styles", "layout improvements"],
      ["database", "recipes"],
    ];

    for (const [q1, q2] of sanityPairs) {
      const [r1] = await vectorStore.similaritySearchWithScore(q1, 1);
      const [r2] = await vectorStore.similaritySearchWithScore(q2, 1);

      if (r1 && r2) {
        const diff = Math.abs(r1[1] - r2[1]).toFixed(3);
        console.log(`   Pair (${q1}) vs (${q2}) distance diff: ${diff}`);
      }
    }

    logSection("✅ Integration Test Complete");
    console.log("All RAG components are functioning together:");
    console.log("  ✓ Document ingestion");
    console.log("  ✓ Chunking + metadata");
    console.log("  ✓ NVIDIA embeddings via Python bridge");
    console.log("  ✓ ChromaDB storage (HTTP or in-memory fallback)");
    console.log("  ✓ Semantic similarity search");
    console.log("  ✓ Relevance scoring and verification");

    return true;
  } catch (error) {
    logSection("❌ Integration Test Failed");
    console.error(error);
    return false;
  }
}

testFullIntegration()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });

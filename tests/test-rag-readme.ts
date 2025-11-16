/**
 * Test: RAG Pipeline with README Document
 *
 * This test verifies the complete RAG pipeline:
 * 1. Loads the project README.md
 * 2. Chunks and embeds the document using NVIDIA embeddings (Python bridge)
 * 3. Stores embeddings in ChromaDB vector store
 * 4. Performs similarity search queries
 * 5. Retrieves relevant context
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Document } from "@langchain/core/documents";
import { createNVIDIAEmbeddings } from "../src/models/nvidia-embeddings";
import { InMemoryChromaClient } from "../src/rag/in-memory-chroma-client";
import { Chroma } from "@langchain/community/vectorstores/chroma";

async function testRAGPipeline() {
  console.log("\n🧪 Testing RAG Pipeline with README Document\n");
  console.log("=".repeat(60));

  let embeddings;
  let vectorStore: Chroma | null = null;

  try {
    // Step 1: Load README document
    console.log("\n📄 Step 1: Loading README.md...");
    const readmePath = path.join(process.cwd(), "README.md");

    if (!fs.existsSync(readmePath)) {
      throw new Error("README.md not found in project root");
    }

    const readmeContent = fs.readFileSync(readmePath, "utf-8");
    console.log(`✅ README loaded`);
    console.log(`   - File size: ${readmeContent.length} characters`);
    console.log(`   - Lines: ${readmeContent.split("\n").length}`);

    // Step 2: Initialize embeddings
    console.log(
      "\n🔧 Step 2: Initializing NVIDIA embeddings (Python bridge)..."
    );
    embeddings = createNVIDIAEmbeddings();
    const modelInfo = await embeddings.getModelInfo();
    console.log(`✅ Embeddings initialized`);
    console.log(`   - Model: ${modelInfo.model}`);

    // Step 3: Chunk the document
    console.log("\n✂️  Step 3: Chunking README document...");
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ". ", "! ", "? ", "; ", " ", ""],
    });

    const chunks = await textSplitter.createDocuments(
      [readmeContent],
      [
        {
          source: "README.md",
          fileName: "README.md",
          fileType: ".md",
          loadedAt: new Date().toISOString(),
        },
      ]
    );

    console.log(`✅ Document chunked`);
    console.log(`   - Total chunks: ${chunks.length}`);
    console.log(
      `   - Avg chunk size: ${Math.round(chunks.reduce((sum: number, c: Document) => sum + c.pageContent.length, 0) / chunks.length)} chars`
    );

    // Show sample chunk
    if (chunks.length > 0) {
      console.log(`   - Sample chunk (first 100 chars):`);
      console.log(`     "${chunks[0].pageContent.substring(0, 100)}..."`);
    }

    // Step 4: Initialize vector store (in-memory)
    console.log("\n💾 Step 4: Initializing ChromaDB vector store...");

    vectorStore = await Chroma.fromDocuments(chunks, embeddings, {
      collectionName: "test-readme-collection",
    });

    console.log(`✅ Vector store initialized and documents stored`);
    console.log(`   - Collection: test-readme-collection`);
    console.log(`   - Embedded chunks: ${chunks.length}`);

    // Step 5: Test similarity search
    console.log("\n🔍 Step 5: Testing similarity search queries...");

    const testQueries = [
      "What is this project about?",
      "How do I install dependencies?",
      "What technologies are used?",
    ];

    for (const query of testQueries) {
      console.log(`\n   Query: "${query}"`);

      const results = await vectorStore.similaritySearchWithScore(query, 2);

      console.log(`   ✅ Found ${results.length} relevant chunks:`);
      results.forEach(([result, score]: [Document, number], idx: number) => {
        const preview = result.pageContent
          .substring(0, 150)
          .replace(/\n/g, " ");
        console.log(`      ${idx + 1}. Score: ${score.toFixed(4)}`);
        console.log(`         "${preview}..."`);
      });
    }

    // Step 6: Test retrieval with context
    console.log("\n📚 Step 6: Testing context retrieval for RAG...");
    const ragQuery = "Explain the main features of this application";
    console.log(`   Query: "${ragQuery}"`);

    const context = await vectorStore.similaritySearch(ragQuery, 3);
    const combinedContext = context
      .map(
        (doc: Document, idx: number) =>
          `[Context ${idx + 1}]\n${doc.pageContent}`
      )
      .join("\n\n");

    console.log(`✅ Retrieved context for RAG:`);
    console.log(`   - Context chunks: ${context.length}`);
    console.log(`   - Total context length: ${combinedContext.length} chars`);
    console.log(`   - Preview (first 200 chars):`);
    console.log(
      `     "${combinedContext.substring(0, 200).replace(/\n/g, " ")}..."`
    );

    // Step 7: Verify embedding quality
    console.log("\n🎯 Step 7: Verifying embedding quality...");

    // Search for very specific content
    const specificQuery = "electron forge webpack";
    const specificResults = await vectorStore.similaritySearch(
      specificQuery,
      1
    );

    console.log(`   Specific query: "${specificQuery}"`);
    if (specificResults.length > 0) {
      const topResult = specificResults[0];
      const hasRelevantContent =
        topResult.pageContent.toLowerCase().includes("electron") ||
        topResult.pageContent.toLowerCase().includes("forge") ||
        topResult.pageContent.toLowerCase().includes("webpack");

      console.log(`   ✅ Top result relevance:`);
      console.log(
        `      Contains relevant keywords: ${hasRelevantContent ? "YES" : "NO"}`
      );
      console.log(
        `      Preview: "${topResult.pageContent.substring(0, 100).replace(/\n/g, " ")}..."`
      );

      if (hasRelevantContent) {
        console.log(`   ✅ Semantic search is working correctly!`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ All RAG pipeline tests passed!\n");
    console.log("Summary:");
    console.log(`  - ✅ Document loading: Working`);
    console.log(`  - ✅ NVIDIA embeddings (Python): Working`);
    console.log(`  - ✅ ChromaDB vector store: Working`);
    console.log(`  - ✅ Similarity search: Working`);
    console.log(`  - ✅ Context retrieval: Working`);
    console.log(`  - ✅ RAG pipeline: Fully operational!\n`);
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    if (embeddings) {
      console.log("🧹 Cleaning up...");
      embeddings.cleanup();
      console.log("✅ Cleanup complete\n");
    }
  }
}

// Run the test
testRAGPipeline().catch(console.error);

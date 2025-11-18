/**
 * Complete RAG Pipeline Test
 * Tests the entire flow: document loading → chunking → embedding → retrieval
 */

import path from "path";
import { loadStudyDocuments } from "./src/rag/document-loader";
import {
  createStudyMaterialVectorStore,
  chunkDocumentsForVectorStore,
} from "./src/rag/vector-store";
import { logger } from "./src/client/logger";

async function testCompletePipeline() {
  console.log("\n🧪 Testing Complete RAG Pipeline\n");
  console.log("=".repeat(60));

  try {
    // Step 1: Document Loading
    console.log("\n📚 Step 1: Loading Documents");
    console.log("-".repeat(60));

    const testDocPath = process.argv[2];
    if (!testDocPath) {
      console.error("❌ Please provide a document path as argument");
      console.error("Usage: npm run test:rag-complete <path-to-document>");
      process.exit(1);
    }

    const absolutePath = path.resolve(testDocPath);
    console.log(`Loading: ${absolutePath}`);

    const documents = await loadStudyDocuments([absolutePath]);
    console.log(`✅ Loaded ${documents.length} document(s)`);

    if (documents.length === 0) {
      throw new Error("No documents loaded");
    }

    // Show sample content
    const firstDoc = documents[0];
    console.log(`\n📄 Sample Document:`);
    console.log(`   Source: ${firstDoc.metadata?.source}`);
    console.log(`   Type: ${firstDoc.metadata?.fileType}`);
    console.log(`   Content length: ${firstDoc.pageContent.length} chars`);
    console.log(`   Preview: ${firstDoc.pageContent.substring(0, 150)}...`);

    // Show all metadata
    console.log(`\n🏷️  Metadata:`);
    for (const [key, value] of Object.entries(firstDoc.metadata || {})) {
      const valueType = typeof value;
      const isPrimitive =
        ["string", "number", "boolean"].includes(valueType) || value === null;
      const status = isPrimitive ? "✅" : "❌";
      console.log(
        `   ${status} ${key}: ${valueType} = ${String(value).substring(0, 50)}`
      );
    }

    // Step 2: Chunking
    console.log("\n\n✂️  Step 2: Chunking Documents");
    console.log("-".repeat(60));

    const { chunks, summary } = await chunkDocumentsForVectorStore(documents);
    console.log(`✅ Created ${chunks.length} chunks`);
    console.log(`   Raw chunks: ${summary.totalRawChunks}`);
    console.log(`   Kept chunks: ${summary.totalKeptChunks}`);
    console.log(`   Dropped (too short): ${summary.droppedShort}`);
    console.log(`   Dropped (duplicates): ${summary.droppedDuplicates}`);

    if (summary.truncatedChunks > 0) {
      console.log(`   ⚠️  Truncated: ${summary.truncatedChunks}`);
    }

    // Show sample chunk
    if (chunks.length > 0) {
      const sampleChunk = chunks[0];
      console.log(`\n📝 Sample Chunk:`);
      console.log(`   Length: ${sampleChunk.pageContent.length} chars`);
      console.log(
        `   Preview: ${sampleChunk.pageContent.substring(0, 200)}...`
      );
      console.log(`\n   Chunk Metadata:`);
      for (const [key, value] of Object.entries(sampleChunk.metadata || {})) {
        const valueType = typeof value;
        const isPrimitive =
          ["string", "number", "boolean"].includes(valueType) || value === null;
        const status = isPrimitive ? "✅" : "❌";
        console.log(`      ${status} ${key}: ${valueType}`);
      }
    }

    // Step 3: Create Vector Store
    console.log("\n\n🗄️  Step 3: Creating Vector Store & Embedding");
    console.log("-".repeat(60));
    console.log("⏳ This may take a minute for embedding generation...");

    const vectorStore = await createStudyMaterialVectorStore(documents);
    console.log(`✅ Vector store created successfully`);

    // Step 4: Test Retrieval
    console.log("\n\n🔍 Step 4: Testing Retrieval");
    console.log("-".repeat(60));

    const testQueries = [
      "What are the main topics covered?",
      "Explain the key concepts",
      "What is this document about?",
    ];

    for (const query of testQueries) {
      console.log(`\nQuery: "${query}"`);
      const results = await vectorStore.similaritySearchWithScore(query, 3);
      console.log(`   Found ${results.length} results`);

      results.forEach(([doc, score], idx) => {
        const similarity = (1 - score).toFixed(3);
        const preview = doc.pageContent.substring(0, 100).replace(/\n/g, " ");
        console.log(`   ${idx + 1}. Similarity: ${similarity} | ${preview}...`);
      });
    }

    // Summary
    console.log("\n\n" + "=".repeat(60));
    console.log("✅ Complete RAG Pipeline Test PASSED");
    console.log("=".repeat(60));
    console.log("\n✨ All steps completed successfully:");
    console.log("   ✓ Document loading with metadata enrichment");
    console.log("   ✓ Semantic chunking with deduplication");
    console.log("   ✓ NVIDIA embeddings generation");
    console.log("   ✓ ChromaDB vector storage");
    console.log("   ✓ Semantic similarity retrieval");
    console.log("\n🎉 Your RAG pipeline is working correctly!\n");
  } catch (error) {
    console.error("\n\n❌ RAG Pipeline Test FAILED");
    console.error("=".repeat(60));

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error("\nStack trace:");
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }

    console.error("\n💡 Troubleshooting:");
    console.error("   1. Ensure NVIDIA_API_KEY is set in .env");
    console.error("   2. Check that ChromaDB server is running");
    console.error("   3. Verify the document has extractable text");
    console.error("   4. Check logs above for specific errors\n");

    process.exit(1);
  }
}

// Run the test
testCompletePipeline();

import dotenv from "dotenv";
import path from "path";
import { loadStudyDocuments } from "../src/rag/document-loader";
import { createStudyMaterialVectorStore } from "../src/rag/vector-store";

dotenv.config();

/**
 * Test ChromaDB integration and RAG pipeline
 * Verifies document loading, embedding, and similarity search
 */
async function testChromaDBIntegration() {
  console.log("🧪 Testing ChromaDB Integration & RAG Pipeline\n");

  try {
    // Test 1: Document Loading
    console.log("1️⃣  Testing Document Loading...");
    const testDocs = ["README.md", "COMPONENT_USAGE_GUIDE.md"].map((doc) =>
      path.resolve(process.cwd(), doc)
    );

    const documents = await loadStudyDocuments(testDocs);
    console.log(`   ✅ Documents loaded!`);
    console.log(`   - Total documents: ${documents.length}`);
    console.log(`   - Sample metadata:`, documents[0]?.metadata);

    if (documents.length === 0) {
      throw new Error("No documents loaded. Check if README.md exists.");
    }

    // Test 2: Vector Store Creation
    console.log("\n2️⃣  Testing ChromaDB Vector Store Creation...");
    const vectorStore = await createStudyMaterialVectorStore(documents);
    console.log(`   ✅ Vector store created successfully!`);
    console.log(`   - Collection: study_materials`);
    console.log(
      `   - ChromaDB URL: ${process.env.CHROMA_URL || "http://localhost:8000"}`
    );

    // Test 3: Similarity Search
    console.log("\n3️⃣  Testing Similarity Search...");
    const queries = [
      "What is this project about?",
      "How do I install dependencies?",
      "What are the main features?",
    ];

    for (const query of queries) {
      const results = await vectorStore.similaritySearch(query, 3);
      console.log(`\n   Query: "${query}"`);
      console.log(`   ✅ Found ${results.length} relevant chunks`);
      if (results.length > 0) {
        console.log(
          `   - Top result (first 100 chars): ${results[0].pageContent.substring(0, 100)}...`
        );
        console.log(`   - Source: ${results[0].metadata?.source || "unknown"}`);
      }
    }

    console.log("\n✅ All ChromaDB tests passed!\n");
    console.log("💡 Your RAG system is ready to use!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error && error.message.includes("ChromaDB")) {
      console.error("\n💡 Make sure ChromaDB is running:");
      console.error("   docker run -p 8000:8000 chromadb/chroma\n");
    }
    process.exit(1);
  }
}

testChromaDBIntegration();

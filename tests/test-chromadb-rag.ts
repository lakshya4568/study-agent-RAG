import dotenv from "dotenv";
import path from "path";
import { loadStudyDocuments } from "../src/rag/document-loader";
import { createStudyMaterialVectorStore } from "../src/rag/vector-store";
import {
  isChromaServerRunning,
  getChromaServerUrl,
  getChromaPersistDir,
  startChromaServer,
  stopChromaServer,
} from "../src/rag/chroma-server";

dotenv.config();

if (!process.env.CHROMA_PORT) {
  // Keep test runs isolated from any developer instance that might already use 8000
  process.env.CHROMA_PORT = "8130";
}

/**
 * Test ChromaDB integration with NVIDIA embeddings and semantic search.
 *
 * This test file verifies that the entire RAG pipeline works:
 * 1. Document loading
 * 2. Chunking
 * 3. NVIDIA embedding generation
 * 4. ChromaDB vector storage (persistent HTTP server)
 * 5. Semantic similarity search
 *
 * Requirements:
 * - ChromaDB server must be running on http://localhost:8000
 * - NVIDIA_API_KEY must be set in environment
 *
 * Run with: npm run test:chromadb
 */

async function testChromaDBIntegration() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 ChromaDB RAG Integration Test");
  console.log("=".repeat(60));

  const serverUrl = getChromaServerUrl();
  const persistDir = getChromaPersistDir();
  let serverStartedByTest = false;
  let fallbackMode = false;

  try {
    // Step 0: Verify ChromaDB server is running
    console.log("0️⃣  Verifying ChromaDB server...");
    console.log("-".repeat(60));

    let isRunning = await isChromaServerRunning();

    if (!isRunning) {
      console.warn(
        `\n⚠️  ChromaDB server not found at ${serverUrl}. Attempting to start it...`
      );
      try {
        await startChromaServer(60000);
        serverStartedByTest = true;
        isRunning = true;
      } catch (startError) {
        console.error(
          `\n❌ Failed to start ChromaDB server automatically: ${startError instanceof Error ? startError.message : startError}`
        );
        console.error(
          "\n💡 Falling back to in-memory vector store for this test run. Start the Chroma server for persistent storage.\n"
        );
        fallbackMode = true;
        process.env.CHROMA_ALLOW_IN_MEMORY_FALLBACK = "true";
      }
    }

    if (isRunning) {
      console.log(`   ✅ ChromaDB server is running at ${serverUrl}`);
      console.log(`   📁 Storage directory: ${persistDir}\n`);
    } else if (fallbackMode) {
      console.log(
        "   ⚠️ Running in in-memory mode for this test. Results will not be persisted.\n"
      );
    } else {
      throw new Error(
        "ChromaDB server is unavailable and fallback mode is disabled."
      );
    }

    // Step 1: Load test documents
    console.log("1️⃣  Loading test documents...");
    console.log("-".repeat(60));

    const testFiles = ["README.md", "COMPONENT_USAGE_GUIDE.md"];
    const testDocs = testFiles.map((file) => path.resolve(process.cwd(), file));

    console.log(`   Files to load: ${testFiles.length}`);
    testFiles.forEach((file) => console.log(`   - ${file}`));

    const documents = await loadStudyDocuments(testDocs);

    console.log(`\n   ✅ Loaded ${documents.length} documents successfully\n`);

    if (documents.length === 0) {
      throw new Error("No documents loaded. Check if README.md exists.");
    }

    // Step 2: Create vector store (this uses NVIDIA embeddings + ChromaDB)
    console.log("2️⃣  Creating vector store with NVIDIA embeddings...");
    console.log("-".repeat(60));
    console.log(
      "   💡 Using persistent ChromaDB HTTP server for vector storage\n"
    );

    const startTime = Date.now();
    const vectorStore = await createStudyMaterialVectorStore(documents);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n   ✅ Vector store created in ${duration}s`);
    console.log(`   - Collection: study_materials`);
    console.log(`   - Server: ${fallbackMode ? "in-memory" : serverUrl}`);
    console.log(`   - Storage: ${fallbackMode ? "in-memory" : persistDir}\n`);

    // Step 3: Test Similarity Search
    console.log("3️⃣  Testing Similarity Search...");
    console.log("-".repeat(60));

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
    console.log(
      `📊 ChromaDB server: ${fallbackMode ? "in-memory" : serverUrl}`
    );
    console.log(
      `📁 Storage directory: ${fallbackMode ? "in-memory" : persistDir}\n`
    );
    if (serverStartedByTest) {
      console.log(
        "🛑 Stopping temporary ChromaDB server started by the test...\n"
      );
      stopChromaServer();
    }
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error && error.message.includes("ChromaDB")) {
      console.error(
        "\n💡 Make sure ChromaDB server is running at http://localhost:8000"
      );
      console.error(
        "   Start it with: chroma run --path .chromadb/chroma_storage --port 8000"
      );
      console.error(
        "   Or launch the Electron app (it starts the server automatically)"
      );
    }
    if (serverStartedByTest) {
      stopChromaServer();
    }
    process.exit(1);
  }
}

testChromaDBIntegration();

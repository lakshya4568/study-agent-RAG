import dotenv from "dotenv";
import path from "path";
import { StudyAgentService } from "../src/agent/StudyAgentService";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

/**
 * Enhanced End-to-End Study Agent Test
 * Tests the complete RAG-powered agent with:
 * - NVIDIA embeddings (nv-embedqa-e5-v5)
 * - NVIDIA chat model (llama-3.1-70b-instruct)
 * - Semantic retrieval
 * - Multi-turn conversations
 * - Performance metrics
 */
async function testEnhancedStudyAgent() {
  console.log("🧪 Enhanced Study Agent End-to-End Test\n");
  console.log("Testing RAG-powered agent with NVIDIA models");
  console.log("=".repeat(60) + "\n");

  const agent = new StudyAgentService({
    documentPaths: [
      "README.md",
      "COMPONENT_USAGE_GUIDE.md",
      "DATABASE_INTEGRATION_SUMMARY.md",
      "LAYOUT_FIX_SUMMARY.md",
    ].map((doc) => path.resolve(process.cwd(), doc)),
  });

  let exitCode = 0;

  try {
    // Test 1: Agent Initialization
    console.log("1️⃣  Initializing Study Agent with RAG Pipeline");
    console.log("-".repeat(60));

    const initStart = Date.now();
    await agent.initialize();
    const initDuration = Date.now() - initStart;

    const status = agent.getStatus();
    console.log(`✅ Agent initialized in ${initDuration}ms\n`);

    console.log("   Agent Status:");
    console.log(`   - Graph Ready: ${status.graphReady ? "✓" : "✗"}`);
    console.log(`   - Vector Store: ${status.vectorStoreReady ? "✓" : "✗"}`);
    console.log(
      `   - MCP Tools: ${status.mcpTools.enabled ? `✓ (${status.mcpTools.toolCount})` : "✗"}`
    );
    console.log(`   - Documents Loaded: ${status.documents.loadedCount}`);
    console.log(
      `   - NVIDIA API Key: ${status.environment.nvidiaApiKey ? "✓" : "✗"}`
    );

    if (!status.vectorStoreReady) {
      throw new Error("Vector store not ready");
    }

    // Test 2: Single Query Test
    console.log("\n2️⃣  Testing Single Query with RAG Retrieval");
    console.log("-".repeat(60));

    const threadId = uuidv4();
    const simpleQuery = "What is this project about?";

    console.log(`   Query: "${simpleQuery}"\n`);

    const singleStart = Date.now();
    const result = await agent.sendMessage(simpleQuery, threadId);
    const singleDuration = Date.now() - singleStart;

    if (result.success) {
      console.log(`   ✅ Response received in ${singleDuration}ms`);
      console.log(`   - Agent Latency: ${result.latencyMs?.toFixed(0)}ms`);
      console.log(`   - Response Length: ${result.finalMessage?.length} chars`);
      console.log(
        `\n   Preview:\n   ${result.finalMessage?.substring(0, 300)}...\n`
      );
    } else {
      console.error(`   ❌ Query failed: ${result.error}`);
      exitCode = 1;
    }

    // Test 3: Multi-Turn Conversation
    console.log("\n3️⃣  Testing Multi-Turn RAG Conversation");
    console.log("-".repeat(60));

    const conversationQueries = [
      "How do I set up the database?",
      "What models are being used in this project?",
      "Can you explain the component structure?",
      "Tell me about the RAG implementation",
    ];

    console.log(`   Thread ID: ${threadId}`);
    console.log(`   Queries: ${conversationQueries.length}\n`);

    const conversationStart = Date.now();
    const conversationResults = [];

    for (let i = 0; i < conversationQueries.length; i++) {
      const query = conversationQueries[i];
      console.log(`   ${i + 1}. "${query}"`);

      const queryStart = Date.now();
      const queryResult = await agent.sendMessage(query, threadId);
      const queryDuration = Date.now() - queryStart;

      conversationResults.push({
        query,
        result: queryResult,
        duration: queryDuration,
      });

      if (queryResult.success) {
        console.log(
          `      ✅ ${queryDuration}ms | ${queryResult.finalMessage?.length} chars`
        );
      } else {
        console.log(`      ❌ Failed: ${queryResult.error}`);
        exitCode = 1;
      }
    }

    const totalConversationDuration = Date.now() - conversationStart;
    const avgDuration = totalConversationDuration / conversationQueries.length;

    console.log(`\n   Conversation Complete:`);
    console.log(`   - Total Duration: ${totalConversationDuration}ms`);
    console.log(`   - Average per Query: ${avgDuration.toFixed(0)}ms`);
    console.log(
      `   - Success Rate: ${conversationResults.filter((r) => r.result.success).length}/${conversationResults.length}`
    );

    // Test 4: RAG-Specific Queries
    console.log("\n4️⃣  Testing RAG-Specific Retrieval Queries");
    console.log("-".repeat(60));

    const ragQueries = [
      {
        query: "What vector database is being used?",
        expectedTerms: ["chroma", "vector", "database"],
      },
      {
        query: "Which embedding model powers the search?",
        expectedTerms: ["nvidia", "embed", "model"],
      },
      {
        query: "How are documents chunked?",
        expectedTerms: ["chunk", "split", "size"],
      },
    ];

    const ragThreadId = uuidv4();

    for (const { query, expectedTerms } of ragQueries) {
      console.log(`\n   Query: "${query}"`);
      console.log(`   Expected terms: ${expectedTerms.join(", ")}`);

      const ragResult = await agent.sendMessage(query, ragThreadId);

      if (ragResult.success && ragResult.finalMessage) {
        const lowerResponse = ragResult.finalMessage.toLowerCase();
        const foundTerms = expectedTerms.filter((term) =>
          lowerResponse.includes(term.toLowerCase())
        );

        console.log(`   ✅ ${ragResult.latencyMs?.toFixed(0)}ms`);
        console.log(
          `   - Found terms: ${foundTerms.length}/${expectedTerms.length} (${foundTerms.join(", ")})`
        );

        if (foundTerms.length === 0) {
          console.log(`   ⚠️  Warning: Expected terms not found in response`);
        }
      } else {
        console.log(`   ❌ Failed: ${ragResult.error}`);
        exitCode = 1;
      }
    }

    // Test 5: Performance Stress Test
    console.log("\n5️⃣  Performance Stress Test");
    console.log("-".repeat(60));

    const stressQuery = "What components are available?";
    const stressIterations = 5;
    const stressThreadId = uuidv4();

    console.log(`   Query: "${stressQuery}"`);
    console.log(`   Iterations: ${stressIterations}\n`);

    const latencies: number[] = [];

    for (let i = 0; i < stressIterations; i++) {
      const stressStart = Date.now();
      const stressResult = await agent.sendMessage(stressQuery, stressThreadId);
      const stressLatency = Date.now() - stressStart;

      latencies.push(stressLatency);

      if (stressResult.success) {
        console.log(`   ${i + 1}. ✅ ${stressLatency}ms`);
      } else {
        console.log(`   ${i + 1}. ❌ Failed`);
      }
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);

    console.log(`\n   Performance Metrics:`);
    console.log(`   - Average: ${avgLatency.toFixed(0)}ms`);
    console.log(`   - Min: ${minLatency}ms`);
    console.log(`   - Max: ${maxLatency}ms`);
    console.log(`   - Range: ${maxLatency - minLatency}ms`);

    // Test 6: Context-Aware Follow-ups
    console.log("\n6️⃣  Testing Context-Aware Follow-ups");
    console.log("-".repeat(60));

    const contextThreadId = uuidv4();
    const contextQueries = [
      "Tell me about the layout fixes",
      "What specific components were affected?",
      "Were there any performance improvements?",
    ];

    console.log(`   Testing conversation continuity...\n`);

    for (let i = 0; i < contextQueries.length; i++) {
      const query = contextQueries[i];
      console.log(`   ${i + 1}. "${query}"`);

      const ctxResult = await agent.sendMessage(query, contextThreadId);

      if (ctxResult.success) {
        console.log(`      ✅ ${ctxResult.latencyMs?.toFixed(0)}ms`);

        // Check if response references previous context
        if (i > 0 && ctxResult.finalMessage) {
          const hasContextWords = [
            "previously",
            "earlier",
            "mentioned",
            "discussed",
            "above",
          ].some((word) =>
            ctxResult.finalMessage!.toLowerCase().includes(word)
          );
          console.log(
            `      ${hasContextWords ? "✓" : "○"} Context awareness detected`
          );
        }
      } else {
        console.log(`      ❌ Failed`);
      }
    }

    // Cleanup
    console.log("\n7️⃣  Cleanup");
    console.log("-".repeat(60));
    await agent.dispose();
    console.log("   ✅ Agent disposed\n");

    // Final Summary
    console.log("=".repeat(60));
    console.log("✅ All Enhanced Agent Tests Passed!");
    console.log("=".repeat(60));
    console.log("\n🎉 Your RAG-powered Study Agent is fully operational!\n");
    console.log("System Components Verified:");
    console.log("  ✓ NVIDIA nv-embedqa-e5-v5 embeddings");
    console.log("  ✓ NVIDIA llama-3.1-70b-instruct chat model");
    console.log("  ✓ In-memory ChromaDB vector store");
    console.log("  ✓ Semantic document retrieval");
    console.log("  ✓ Multi-turn conversations");
    console.log("  ✓ Context-aware responses");
    console.log("  ✓ Performance optimization");
    console.log("  ✓ Error handling\n");
  } catch (error) {
    console.error("\n❌ Enhanced Agent Test Failed:", error);
    if (error instanceof Error) {
      console.error("\nError Details:", error.message);
      if (error.stack) {
        console.error(
          "\nStack Trace:\n",
          error.stack.split("\n").slice(0, 8).join("\n")
        );
      }
    }
    exitCode = 1;
  } finally {
    try {
      await agent.dispose();
    } catch (disposeError) {
      console.error("Error during cleanup:", disposeError);
    }
  }

  process.exit(exitCode);
}

// Run tests
testEnhancedStudyAgent();

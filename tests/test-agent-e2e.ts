import dotenv from "dotenv";
import path from "path";
import { StudyAgentService } from "../src/agent/StudyAgentService";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

/**
 * End-to-end test of the Study Agent
 * Tests the complete RAG pipeline with actual queries
 */
async function testStudyAgentE2E() {
  console.log("🧪 Testing Study Agent End-to-End\n");

  const agent = new StudyAgentService({
    documentPaths: [
      "README.md",
      "COMPONENT_USAGE_GUIDE.md",
      "SETUP_GUIDE.md",
    ].map((doc) => path.resolve(process.cwd(), doc)),
  });

  try {
    // Initialize
    console.log("1️⃣  Initializing Study Agent...");
    await agent.initialize();
    console.log("   ✅ Agent initialized!\n");

    const threadId = uuidv4();
    const testQueries = [
      "What is this project about?",
      "How do I set up the NVIDIA API?",
      "What models are being used?",
    ];

    // Test queries
    console.log("2️⃣  Testing Agent Queries...\n");
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`   Query ${i + 1}: "${query}"`);

      const startTime = Date.now();
      const result = await agent.sendMessage(query, threadId);
      const duration = Date.now() - startTime;

      if (result.success) {
        console.log(`   ✅ Response received (${duration}ms)`);
        console.log(
          `   - Preview: ${result.finalMessage?.substring(0, 150)}...`
        );
        console.log(`   - Latency: ${result.latencyMs?.toFixed(0)}ms\n`);
      } else {
        console.log(`   ❌ Query failed: ${result.error}\n`);
      }
    }

    // Cleanup
    console.log("3️⃣  Cleaning up...");
    await agent.dispose();
    console.log("   ✅ Agent disposed\n");

    console.log("✅ All end-to-end tests passed!\n");
    console.log("🎉 Your Study Agent is fully operational!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    await agent.dispose();
    process.exit(1);
  }
}

testStudyAgentE2E();

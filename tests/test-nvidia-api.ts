import dotenv from "dotenv";
import { createNVIDIAEmbeddings } from "../src/models/nvidia-embeddings";
import { createNVIDIAChat } from "../src/models/nvidia-chat";

dotenv.config();

/**
 * Test NVIDIA API integration
 * Verifies both embedding and chat models are working
 */
async function testNVIDIAIntegration() {
  console.log("🧪 Testing NVIDIA API Integration\n");

  try {
    // Test Embeddings
    console.log("1️⃣  Testing NVIDIA Embeddings (nv-embedqa-e5-v5)...");
    const embeddings = createNVIDIAEmbeddings();
    const testQuery = "What is machine learning?";
    const embeddingResult = await embeddings.embedQuery(testQuery);
    console.log(`   ✅ Embeddings working!`);
    console.log(`   - Query: "${testQuery}"`);
    console.log(`   - Vector dimension: ${embeddingResult.length}`);
    console.log(
      `   - Sample values: [${embeddingResult
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(", ")}...]`
    );

    // Test Chat
    console.log("\n2️⃣  Testing NVIDIA Chat (llama-3.1-70b-instruct)...");
    const chat = createNVIDIAChat();
    const testMessage =
      "In one sentence, what is retrieval-augmented generation?";
    const chatResponse = await chat.invoke(testMessage);
    console.log(`   ✅ Chat working!`);
    console.log(`   - Question: "${testMessage}"`);
    console.log(`   - Response: "${chatResponse.content}"`);

    console.log("\n✅ All NVIDIA API tests passed!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error && error.message.includes("NVIDIA_API_KEY")) {
      console.error(
        "\n💡 Make sure you have set NVIDIA_API_KEY in your .env file"
      );
      console.error("   Get your key from: https://build.nvidia.com/\n");
    }
    process.exit(1);
  }
}

testNVIDIAIntegration();

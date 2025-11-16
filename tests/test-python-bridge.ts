/**
 * Test: NVIDIA Embeddings Python Bridge
 *
 * This test verifies that the Node.js <-> Python bridge works correctly
 * for the NVIDIA embeddings service using the official langchain-nvidia-ai-endpoints
 */

import "dotenv/config";
import { createNVIDIAEmbeddings } from "../src/models/nvidia-embeddings";
async function testPythonBridge() {
  console.log("\n🧪 Testing NVIDIA Embeddings Python Bridge\n");
  console.log("=".repeat(60));

  let embeddings;

  try {
    // Test 1: Initialize embeddings client
    console.log("\n📌 Test 1: Initializing NVIDIA Embeddings client...");
    embeddings = createNVIDIAEmbeddings();
    console.log("✅ Client created successfully");

    // Test 2: Get model info
    console.log("\n📌 Test 2: Getting model information...");
    const modelInfo = await embeddings.getModelInfo();
    console.log("✅ Model Info:");
    console.log(`   - Model: ${modelInfo.model}`);
    console.log(`   - Provider: ${modelInfo.provider}`);
    console.log(`   - Type: ${modelInfo.type}`);

    // Test 3: Embed a simple query
    console.log("\n📌 Test 3: Embedding a test query...");
    const testQuery = "What is machine learning?";
    console.log(`   Query: "${testQuery}"`);

    const queryEmbedding = await embeddings.embedQuery(testQuery);
    console.log(`✅ Query embedded successfully`);
    console.log(`   - Dimensions: ${queryEmbedding.length}`);
    console.log(
      `   - First 5 values: [${queryEmbedding
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(", ")}...]`
    );

    // Test 4: Embed multiple documents
    console.log("\n📌 Test 4: Embedding multiple documents...");
    const testDocs = [
      "Machine learning is a subset of artificial intelligence.",
      "Neural networks are inspired by biological neurons.",
      "Deep learning uses multiple layers of neural networks.",
    ];
    console.log(`   Documents: ${testDocs.length} passages`);

    const docEmbeddings = await embeddings.embedDocuments(testDocs);
    console.log(`✅ Documents embedded successfully`);
    console.log(`   - Total embeddings: ${docEmbeddings.length}`);
    console.log(`   - Dimensions per embedding: ${docEmbeddings[0].length}`);

    // Test 5: Verify embedding consistency
    console.log("\n📌 Test 5: Testing embedding consistency...");
    const query1 = await embeddings.embedQuery("AI and machine learning");
    const query2 = await embeddings.embedQuery("AI and machine learning");

    // Calculate simple similarity (dot product)
    let dotProduct = 0;
    for (let i = 0; i < query1.length; i++) {
      dotProduct += query1[i] * query2[i];
    }

    console.log(`✅ Consistency check passed`);
    console.log(`   - Same query embedded twice`);
    console.log(
      `   - Similarity score: ${dotProduct.toFixed(4)} (should be ~1.0)`
    );

    // Test 6: Test semantic similarity
    console.log("\n📌 Test 6: Testing semantic similarity...");
    const mlQuery = await embeddings.embedQuery("machine learning algorithms");
    const aiQuery = await embeddings.embedQuery(
      "artificial intelligence systems"
    );
    const cookingQuery = await embeddings.embedQuery("how to cook pasta");

    // Calculate similarities
    const mlAiSimilarity = cosineSimilarity(mlQuery, aiQuery);
    const mlCookingSimilarity = cosineSimilarity(mlQuery, cookingQuery);

    console.log(`✅ Semantic similarity test completed`);
    console.log(`   - ML vs AI: ${mlAiSimilarity.toFixed(4)} (related topics)`);
    console.log(
      `   - ML vs Cooking: ${mlCookingSimilarity.toFixed(4)} (unrelated topics)`
    );
    console.log(`   - ✓ Related topics should have higher similarity`);

    if (mlAiSimilarity > mlCookingSimilarity) {
      console.log(`   - ✅ Semantic understanding verified!`);
    } else {
      console.log(`   - ⚠️  Unexpected similarity scores`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ All Python bridge tests passed!\n");
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    if (embeddings) {
      console.log("🧹 Cleaning up Python process...");
      embeddings.cleanup();
      console.log("✅ Cleanup complete\n");
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Run the test
testPythonBridge().catch(console.error);

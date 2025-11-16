import "dotenv/config";
import { createNVIDIAEmbeddings } from "../src/models/nvidia-embeddings";

async function testSingleDocument() {
  console.log("Testing single document embedding through bridge...\n");

  const embeddings = await createNVIDIAEmbeddings();

  const testDoc = `# AI Study Agent

This is a test document with some content.
It has multiple lines and should work fine.`;

  console.log("Document to embed:");
  console.log(testDoc);
  console.log("\nEmbedding...");

  try {
    // Test with array of 1 document
    const result = await embeddings.embedDocuments([testDoc]);
    console.log("\n✅ SUCCESS!");
    console.log(`Embeddings: ${result.length} vectors`);
    console.log(`Dimensions: ${result[0].length}`);
  } catch (error) {
    console.error("\n❌ FAILED:");
    console.error(error);
  }

  // Cleanup
  await (embeddings as any).cleanup();
}

testSingleDocument();

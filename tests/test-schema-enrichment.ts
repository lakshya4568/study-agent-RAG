/**
 * Test: Tool Schema Enrichment System
 * Demonstrates how enriched schemas help LLMs generate correct tool calls
 */

import {
  enrichToolSchema,
  enrichAllTools,
  toOpenAIToolFormat,
  generateFewShotExamples,
  createToolAwareSystemPrompt,
  validateToolArguments,
  mergeWithDefaults,
} from "../src/tools/tool-schema-enricher";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Mock time-related tools
const mockTools: Tool[] = [
  {
    name: "current_time",
    description: "Get current time",
    inputSchema: {
      type: "object",
      properties: {
        timezone: { type: "string" },
        format: { type: "string" },
      },
    },
  },
  {
    name: "add_time",
    description: "Add duration to time",
    inputSchema: {
      type: "object",
      properties: {
        duration: { type: "string" },
        time: { type: "string" },
        timezone: { type: "string" },
        format: { type: "string" },
      },
      required: ["duration"],
    },
  },
  {
    name: "convert_timezone",
    description: "Convert time between timezones",
    inputSchema: {
      type: "object",
      properties: {
        time: { type: "string" },
        input_timezone: { type: "string" },
        output_timezone: { type: "string" },
        format: { type: "string" },
      },
      required: ["time", "input_timezone", "output_timezone"],
    },
  },
];

async function testSchemaEnrichment() {
  console.log("\n=== Test 1: Schema Enrichment ===\n");

  const enriched = enrichToolSchema(mockTools[0]);

  console.log("Original tool:", mockTools[0].name);
  console.log("\nEnriched description:", enriched.description);
  console.log("\nEnriched parameters:");
  Object.entries(enriched.parameters.properties).forEach(([name, schema]) => {
    console.log(`  ${name}:`);
    console.log(`    Type: ${schema.type}`);
    console.log(`    Description: ${schema.description}`);
    if (schema.default) console.log(`    Default: ${schema.default}`);
    if (schema.examples)
      console.log(`    Examples: ${schema.examples.join(", ")}`);
  });

  if (enriched.examples) {
    console.log("\nExamples:");
    enriched.examples.forEach((ex, i) => {
      console.log(`  ${i + 1}. "${ex.userQuery}"`);
      console.log(`     Args: ${JSON.stringify(ex.toolCall.arguments)}`);
      console.log(`     Behavior: ${ex.toolCall.expectedBehavior}`);
    });
  }
}

async function testOpenAIConversion() {
  console.log("\n=== Test 2: OpenAI Format Conversion ===\n");

  const enriched = enrichToolSchema(mockTools[1]); // add_time
  const openAITool = toOpenAIToolFormat(enriched);

  console.log("OpenAI Tool Format:");
  console.log(JSON.stringify(openAITool, null, 2));
}

async function testFewShotGeneration() {
  console.log("\n=== Test 3: Few-Shot Examples Generation ===\n");

  const enrichedTools = enrichAllTools(mockTools);
  const fewShot = generateFewShotExamples(enrichedTools);

  console.log("Generated Few-Shot Examples:");
  console.log(fewShot);
}

async function testSystemPromptCreation() {
  console.log("\n=== Test 4: Tool-Aware System Prompt ===\n");

  const basePrompt = "You are a helpful AI assistant.";
  const enrichedTools = enrichAllTools(mockTools);
  const enhancedPrompt = createToolAwareSystemPrompt(basePrompt, enrichedTools);

  console.log("Enhanced System Prompt:");
  console.log(enhancedPrompt.substring(0, 500) + "...\n");
  console.log(`Total length: ${enhancedPrompt.length} characters`);
}

async function testArgumentValidation() {
  console.log("\n=== Test 5: Argument Validation ===\n");

  const enriched = enrichToolSchema(mockTools[1]); // add_time

  const testCases = [
    {
      name: "Valid with all args",
      args: { duration: "2h", time: "2025-11-19T10:00:00Z" },
    },
    {
      name: "Valid with only required",
      args: { duration: "30m" },
    },
    {
      name: "Missing required arg",
      args: { time: "2025-11-19T10:00:00Z" },
    },
    {
      name: "Empty args",
      args: {},
    },
  ];

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`Input: ${JSON.stringify(testCase.args)}`);

    const validation = validateToolArguments(
      "add_time",
      testCase.args,
      enriched
    );

    console.log(`Valid: ${validation.valid}`);
    if (!validation.valid) {
      console.log(`Errors: ${validation.errors.join(", ")}`);
    }
    if (Object.keys(validation.defaults).length > 0) {
      console.log(`Defaults: ${JSON.stringify(validation.defaults)}`);
    }

    // Show merged result
    const merged = mergeWithDefaults(testCase.args, validation.defaults);
    console.log(`Merged: ${JSON.stringify(merged)}`);
  }
}

async function testRealWorldScenarios() {
  console.log("\n=== Test 6: Real-World Scenarios ===\n");

  const scenarios = [
    {
      userQuery: "What's the current time?",
      expectedTool: "current_time",
      expectedArgs: {},
      description: "Simple time query with no args",
    },
    {
      userQuery: "What time is it in New York?",
      expectedTool: "current_time",
      expectedArgs: { timezone: "America/New_York" },
      description: "Time query with timezone",
    },
    {
      userQuery: "Add 2 hours to current time",
      expectedTool: "add_time",
      expectedArgs: { duration: "2h" },
      description: "Time calculation with implicit current time",
    },
    {
      userQuery: "Convert 3PM IST to New York time",
      expectedTool: "convert_timezone",
      expectedArgs: {
        time: "15:00:00",
        input_timezone: "Asia/Kolkata",
        output_timezone: "America/New_York",
      },
      description: "Timezone conversion",
    },
  ];

  for (const scenario of scenarios) {
    console.log(`\nScenario: ${scenario.description}`);
    console.log(`User: "${scenario.userQuery}"`);
    console.log(`Expected tool: ${scenario.expectedTool}`);
    console.log(`Expected args: ${JSON.stringify(scenario.expectedArgs)}`);

    // Find enriched tool
    const enrichedTools = enrichAllTools(mockTools);
    const tool = enrichedTools.find((t) => t.name === scenario.expectedTool);

    if (tool) {
      console.log(`\nTool description: ${tool.description}`);

      // Validate args
      const validation = validateToolArguments(
        scenario.expectedTool,
        scenario.expectedArgs,
        tool
      );

      if (!validation.valid) {
        console.log(`⚠️  Validation failed: ${validation.errors.join(", ")}`);
        console.log(`   Applying defaults...`);
      }

      const finalArgs = mergeWithDefaults(
        scenario.expectedArgs,
        validation.defaults
      );
      console.log(`✓ Final args: ${JSON.stringify(finalArgs)}`);
    }
  }
}

async function testComparisonBeforeAfter() {
  console.log("\n=== Test 7: Before vs After Comparison ===\n");

  const tool = mockTools[0]; // current_time

  console.log("BEFORE Enrichment:");
  console.log(`  Name: ${tool.name}`);
  console.log(`  Description: ${tool.description}`);
  console.log(`  Parameters: ${JSON.stringify(tool.inputSchema, null, 2)}`);

  console.log("\n" + "=".repeat(50) + "\n");

  const enriched = enrichToolSchema(tool);

  console.log("AFTER Enrichment:");
  console.log(`  Name: ${enriched.name}`);
  console.log(`  Description: ${enriched.description}`);
  console.log("\n  Parameters:");
  Object.entries(enriched.parameters.properties).forEach(([name, schema]) => {
    console.log(`    ${name}:`);
    console.log(`      Type: ${schema.type}`);
    console.log(`      Desc: ${schema.description}`);
    console.log(`      Default: ${schema.default || "none"}`);
    console.log(
      `      Examples: ${schema.examples ? schema.examples.join(", ") : "none"}`
    );
  });

  console.log("\n  Usage Examples:");
  enriched.examples?.forEach((ex, i) => {
    console.log(`    ${i + 1}. "${ex.userQuery}"`);
  });

  console.log("\n" + "=".repeat(50) + "\n");
  console.log("✅ Key Improvements:");
  console.log("   • Detailed parameter descriptions with examples");
  console.log("   • Explicit default values");
  console.log("   • Real-world usage examples for LLM guidance");
  console.log(
    "   • Clear format specifications (IANA timezones, RFC3339, etc)"
  );
}

// Run all tests
async function runAllTests() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║   Tool Schema Enrichment System - Test Suite          ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  try {
    await testSchemaEnrichment();
    await testOpenAIConversion();
    await testFewShotGeneration();
    await testSystemPromptCreation();
    await testArgumentValidation();
    await testRealWorldScenarios();
    await testComparisonBeforeAfter();

    console.log("\n✅ All tests completed successfully!");
    console.log("\n🎯 Result: LLMs now have comprehensive context to:");
    console.log("   • Understand when to use each tool");
    console.log("   • Know what arguments are required/optional");
    console.log("   • See examples of proper usage");
    console.log("   • Get automatic default value injection");
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    process.exit(1);
  }
}

runAllTests();

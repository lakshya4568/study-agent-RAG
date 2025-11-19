/**
 * Tests for Tool Call Parser
 */

import { z } from "zod";
import { ToolCallParser, ToolRegistry } from "../src/tools/tool-call-parser";

// Setup mock tools
function createTestRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Mock timezone conversion tool
  registry.registerTool(
    {
      name: "convert_timezone",
      description: "Convert time between timezones",
      inputSchema: {
        type: "object",
        properties: {
          time: { type: "string" },
          from_timezone: { type: "string" },
          to_timezone: { type: "string" },
        },
        required: ["time", "from_timezone", "to_timezone"],
      },
    },
    z.object({
      time: z.string(),
      from_timezone: z.string(),
      to_timezone: z.string(),
    })
  );

  // Mock current time tool
  registry.registerTool(
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
    z.object({
      timezone: z.string().optional(),
      format: z.string().optional(),
    })
  );

  // Mock file read tool
  registry.registerTool(
    {
      name: "read_file",
      description: "Read file contents",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          encoding: { type: "string" },
        },
        required: ["path"],
      },
    },
    z.object({
      path: z.string(),
      encoding: z.string().optional(),
    })
  );

  return registry;
}

async function testFunctionSyntax() {
  console.log("\n=== Test 1: Function Syntax Parsing ===");
  const registry = createTestRegistry();
  const parser = new ToolCallParser(registry);

  const testCases = [
    {
      input:
        "convert_timezone(time='2025-11-19T15:40:19+05:30', from_timezone='Asia/Kolkata', to_timezone='America/New_York')",
      expected: {
        toolName: "convert_timezone",
        argCount: 3,
      },
    },
    {
      input: 'read_file(path="/path/to/file.txt", encoding="utf-8")',
      expected: {
        toolName: "read_file",
        argCount: 2,
      },
    },
    {
      input: "current_time()",
      expected: {
        toolName: "current_time",
        argCount: 0,
      },
    },
  ];

  for (const testCase of testCases) {
    const result = parser.parse(testCase.input);
    console.log(`\nInput: ${testCase.input}`);
    console.log(`Success: ${result.success}`);
    console.log(`Tool calls found: ${result.toolCalls.length}`);

    if (result.toolCalls.length > 0) {
      const call = result.toolCalls[0];
      console.log(`  Tool: ${call.toolName}`);
      console.log(`  Args: ${JSON.stringify(call.args, null, 2)}`);
      console.log(`  Format: ${call.format}`);
      console.log(`  Confidence: ${call.confidence}`);

      // Validate
      const validation = parser.validate(call);
      console.log(`  Valid: ${validation.valid}`);
      if (validation.errors.length > 0) {
        console.log(`  Errors: ${validation.errors.join(", ")}`);
      }
    }

    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.join(", ")}`);
    }
  }
}

async function testJsonFormat() {
  console.log("\n=== Test 2: JSON Format Parsing ===");
  const registry = createTestRegistry();
  const parser = new ToolCallParser(registry);

  const testCases = [
    {
      input:
        '{"tool": "convert_timezone", "args": {"time": "2025-11-19T15:40:19+05:30", "from_timezone": "Asia/Kolkata", "to_timezone": "America/New_York"}}',
      expected: "convert_timezone",
    },
    {
      input:
        'Let me help you. {"tool": "read_file", "args": {"path": "/example.txt"}}',
      expected: "read_file",
    },
  ];

  for (const testCase of testCases) {
    const result = parser.parse(testCase.input);
    console.log(`\nInput: ${testCase.input.substring(0, 80)}...`);
    console.log(`Success: ${result.success}`);
    console.log(`Tool calls found: ${result.toolCalls.length}`);

    if (result.toolCalls.length > 0) {
      const call = result.toolCalls[0];
      console.log(`  Tool: ${call.toolName}`);
      console.log(`  Args: ${JSON.stringify(call.args, null, 2)}`);
      console.log(`  Format: ${call.format}`);
    }
  }
}

async function testNaturalLanguage() {
  console.log("\n=== Test 3: Natural Language Parsing ===");
  const registry = createTestRegistry();
  const parser = new ToolCallParser(registry);

  const testCases = [
    "What's the current time?",
    "Convert the time from Asia/Kolkata to America/New_York",
    "Can you tell me what time it is?",
  ];

  for (const input of testCases) {
    const result = parser.parse(input);
    console.log(`\nInput: ${input}`);
    console.log(`Success: ${result.success}`);
    console.log(`Tool calls found: ${result.toolCalls.length}`);

    if (result.toolCalls.length > 0) {
      const call = result.toolCalls[0];
      console.log(`  Tool: ${call.toolName}`);
      console.log(`  Args: ${JSON.stringify(call.args, null, 2)}`);
      console.log(`  Format: ${call.format}`);
      console.log(`  Confidence: ${call.confidence}`);
    }
  }
}

async function testMixedFormats() {
  console.log("\n=== Test 4: Mixed Format Parsing ===");
  const registry = createTestRegistry();
  const parser = new ToolCallParser(registry);

  const input = `Let me help you with that. First, I'll check the current time using current_time(), 
  then I'll read the file with read_file(path="/config.json"), 
  and finally convert the timezone using convert_timezone(time='2025-11-19T15:40:19+05:30', from_timezone='Asia/Kolkata', to_timezone='America/New_York')`;

  const result = parser.parse(input);
  console.log(`\nInput: ${input.substring(0, 100)}...`);
  console.log(`Success: ${result.success}`);
  console.log(`Tool calls found: ${result.toolCalls.length}`);

  for (let i = 0; i < result.toolCalls.length; i++) {
    const call = result.toolCalls[i];
    console.log(`\nTool Call ${i + 1}:`);
    console.log(`  Tool: ${call.toolName}`);
    console.log(`  Args: ${JSON.stringify(call.args, null, 2)}`);
    console.log(`  Format: ${call.format}`);
    console.log(`  Confidence: ${call.confidence}`);
  }
}

async function testValidation() {
  console.log("\n=== Test 5: Validation & Sanitization ===");
  const registry = createTestRegistry();
  const parser = new ToolCallParser(registry);

  const testCases = [
    {
      name: "Valid call",
      input:
        "convert_timezone(time='2025-11-19T15:40:19+05:30', from_timezone='Asia/Kolkata', to_timezone='America/New_York')",
      shouldPass: true,
    },
    {
      name: "Missing required field",
      input:
        "convert_timezone(time='2025-11-19T15:40:19+05:30', from_timezone='Asia/Kolkata')",
      shouldPass: false,
    },
    {
      name: "Optional fields only",
      input: "current_time()",
      shouldPass: true,
    },
  ];

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    const result = parser.parseAndValidate(testCase.input);

    console.log(`Valid calls: ${result.validCalls.length}`);
    console.log(`Invalid calls: ${result.invalidCalls.length}`);

    if (result.validCalls.length > 0) {
      console.log("Valid call details:");
      result.validCalls.forEach((vc) => {
        console.log(`  Tool: ${vc.call.toolName}`);
        console.log(`  Sanitized args: ${JSON.stringify(vc.args, null, 2)}`);
      });
    }

    if (result.invalidCalls.length > 0) {
      console.log("Invalid call details:");
      result.invalidCalls.forEach((ic) => {
        console.log(`  Tool: ${ic.call.toolName}`);
        console.log(`  Errors: ${ic.errors.join(", ")}`);
      });
    }

    const passed = testCase.shouldPass
      ? result.validCalls.length > 0
      : result.invalidCalls.length > 0;
    console.log(`Test ${passed ? "PASSED ✓" : "FAILED ✗"}`);
  }
}

async function testEdgeCases() {
  console.log("\n=== Test 6: Edge Cases ===");
  const registry = createTestRegistry();
  const parser = new ToolCallParser(registry);

  const testCases = [
    "This is just regular text with no tool calls",
    "unknown_tool(arg='value')",
    "convert_timezone()",
    "",
    "convert_timezone(time='test', from_timezone='', to_timezone='')",
  ];

  for (const input of testCases) {
    const result = parser.parse(input);
    console.log(`\nInput: "${input}"`);
    console.log(`Success: ${result.success}`);
    console.log(`Tool calls found: ${result.toolCalls.length}`);
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.join(", ")}`);
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   Tool Call Parser Test Suite        ║");
  console.log("╚═══════════════════════════════════════╝");

  try {
    await testFunctionSyntax();
    await testJsonFormat();
    await testNaturalLanguage();
    await testMixedFormats();
    await testValidation();
    await testEdgeCases();

    console.log("\n✓ All tests completed!");
  } catch (error) {
    console.error("\n✗ Test failed with error:", error);
    process.exit(1);
  }
}

runAllTests();

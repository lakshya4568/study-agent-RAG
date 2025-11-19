import "dotenv/config";
import { createNVIDIAOpenAIChat } from "../src/models/nvidia-openai-chat";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

// --- Sanitization Logic (from src/tools/mcp-loader.ts) ---
function sanitizeSchema(
  schema: Record<string, unknown>
): Record<string, unknown> {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchema) as unknown as Record<string, unknown>;
  }

  const newSchema: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    // Skip unsupported JSON Schema constructs for NVIDIA NIM API / Outlines
    if (
      key === "not" ||
      key === "allOf" ||
      key === "oneOf" ||
      key === "anyOf"
    ) {
      console.log(`Removing unsupported JSON Schema construct: '${key}'`);
      continue;
    }
    // Recursively sanitize nested objects
    newSchema[key] = sanitizeSchema(value as Record<string, unknown>);
  }
  return newSchema;
}

// --- Test ---
async function main() {
  console.log("=== OpenAI SDK Test with NVIDIA Kimi-K2-Instruct ===\n");

  // 1. Define a problematic schema (mimicking mcp-time)
  const problematicSchema = {
    type: "object",
    properties: {
      time: {
        type: "string",
        not: {
          const: "invalid_time",
        },
      },
    },
    required: ["time"],
  };

  console.log("Original Schema:", JSON.stringify(problematicSchema, null, 2));

  // 2. Sanitize it
  const sanitized = sanitizeSchema(problematicSchema);
  console.log("\nSanitized Schema:", JSON.stringify(sanitized, null, 2));

  // 3. Create OpenAI-compatible tool definition
  const tools: ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "get_time",
        description: "Returns the time as a string.",
        parameters: sanitized,
      },
    },
  ];

  // 4. Create NVIDIA OpenAI Chat client
  console.log("\n=== Initializing NVIDIA OpenAI Chat ===");
  const chat = createNVIDIAOpenAIChat({
    temperature: 0.2,
    maxTokens: 1024,
  });

  // 5. Test tool calling flow
  const userQuery = "What is the time? use get_time with time='12:00'";
  console.log(`\nUser Query: "${userQuery}"`);

  try {
    console.log("\n=== Invoking model with tools ===");
    const result = await chat.invokeWithTools(
      [{ role: "user", content: userQuery }],
      tools,
      async (toolName, args) => {
        console.log(`\n[Tool Executor] Executing: ${toolName}`);
        console.log(`[Tool Executor] Arguments:`, args);

        if (toolName === "get_time") {
          const timeResult = `Time is ${args.time}`;
          console.log(`[Tool Executor] Result: ${timeResult}`);
          return timeResult;
        }

        return `Unknown tool: ${toolName}`;
      }
    );

    console.log("\n=== Final Response ===");
    console.log("Content:", result.content);

    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log("\n=== Tool Calls Made ===");
      result.toolCalls.forEach((call, idx) => {
        console.log(`\nTool Call ${idx + 1}:`);
        console.log(`  Name: ${call.name}`);
        console.log(`  Args:`, call.args);
        console.log(`  Result: ${call.result}`);
      });
    }

    console.log(
      "\n✅ Test PASSED - Tool calling works with NVIDIA Kimi-K2-Instruct!"
    );
  } catch (error) {
    console.error("\n❌ Test FAILED:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

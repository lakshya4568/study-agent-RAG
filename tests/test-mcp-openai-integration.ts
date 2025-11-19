import "dotenv/config";
import { createNVIDIAOpenAIChat } from "../src/models/nvidia-openai-chat";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { sanitizeSchema } from "../src/tools/mcp-loader";

async function main() {
  console.log("=== MCP + OpenAI SDK Integration Test ===\n");

  // 1. Connect to MCP server (mcp-time)
  console.log("Connecting to mcp-time server...");
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@theo.foobar/mcp-time"],
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("✅ Connected to MCP server\n");

  // 2. List available tools
  const toolsResponse = await client.listTools();
  console.log(
    `Found ${toolsResponse.tools.length} tools:`,
    toolsResponse.tools.map((t) => t.name).join(", ")
  );
  console.log();

  // 3. Convert MCP tools to OpenAI format with sanitization
  const openaiTools: ChatCompletionTool[] = toolsResponse.tools.map(
    (mcpTool) => {
      const sanitized = sanitizeSchema(
        mcpTool.inputSchema as Record<string, unknown>
      );
      return {
        type: "function" as const,
        function: {
          name: mcpTool.name,
          description: mcpTool.description || "",
          parameters: sanitized,
        },
      };
    }
  );

  console.log("Converted to OpenAI format with sanitized schemas\n");

  // 4. Create chat client
  const chat = createNVIDIAOpenAIChat({
    temperature: 0.2,
    maxTokens: 1024,
  });

  // 5. Test query
  const userQuery = "convert the current timezone to America/New_York and use convert timezone tool";
  console.log(`User Query: "${userQuery}"\n`);

  try {
    console.log("=== Invoking model with MCP tools ===");
    const result = await chat.invokeWithTools(
      [{ role: "user", content: userQuery }],
      openaiTools,
      async (toolName, args) => {
        console.log(`\n[MCP Tool] Calling: ${toolName}`);
        console.log(`[MCP Tool] Arguments:`, args);

        // Call the actual MCP server tool
        const mcpResult = await client.callTool({
          name: toolName,
          arguments: args,
        });

        // Extract content from MCP response
        let resultContent = "";
        if (Array.isArray(mcpResult.content)) {
          for (const content of mcpResult.content) {
            if (
              typeof content === "object" &&
              content !== null &&
              "type" in content &&
              content.type === "text" &&
              "text" in content
            ) {
              resultContent = String(content.text);
              break;
            }
          }
        }

        console.log(`[MCP Tool] Result: ${resultContent}`);
        return resultContent;
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

    console.log("\n✅ MCP + OpenAI SDK Integration Test PASSED!");
  } catch (error) {
    console.error("\n❌ Test FAILED:", error);
    await client.close();
    process.exit(1);
  }

  // Cleanup
  await client.close();
  console.log("\nClosed MCP connection");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

console.log("Script loaded");
import "dotenv/config";
import { MCPClientManager } from "../src/client/MCPClientManager";
import { loadMcpConfig, patchMcpTools } from "../src/tools/mcp-loader";
import { createNVIDIAChat } from "../src/models/nvidia-chat";
import { loadMcpTools } from "@langchain/mcp-adapters";
import {
  HumanMessage,
  ToolMessage,
  AIMessage,
  ChatMessage,
  BaseMessage,
} from "@langchain/core/messages";

// Helper to ensure message content is always non-empty
function padContent(content: string | undefined | unknown) {
  const c = typeof content === "string" ? content : "";
  // At least one visible character (not just whitespace)
  return c.trim().length ? c : "ok";
}

// Strict sanitizer for LLM calls
async function safeInvoke(llm: any, messages: BaseMessage[]) {
  const sanitized = messages.map((msg) => {
    const contentStr = typeof msg.content === "string" ? msg.content : "";
    if (contentStr.trim().length === 0) {
      // Return a plain object with "ok" content, preserving other fields
      // This bypasses potential class-specific serialization issues with empty strings
      return { ...msg, content: "ok" };
    }
    return msg;
  });
  return await llm.invoke(sanitized);
}

async function main() {
  console.log("Starting MCP Context7 Test...");

  // 1. Discovery
  const config = loadMcpConfig();
  const context7Config = config.mcpServers["context7"];
  if (!context7Config) throw new Error("context7 MCP config not found.");

  const mcpManager = new MCPClientManager();
  console.log("Connecting to context7 MCP server...");

  try {
    await mcpManager.addServer({
      id: "context7",
      name: "context7",
      command: context7Config.command || "npx",
      args: context7Config.args || [],
      env: context7Config.env,
    });
  } catch (error) {
    console.error("Failed to connect to MCP server:", error);
    process.exit(1);
  }

  const session = mcpManager
    .getAllClients()
    .find((c) => c.serverId === "context7");
  if (!session) throw new Error("No context7 session");

  // Discover tools
  const rawTools = await loadMcpTools("context7", session.client);
  const tools = patchMcpTools(rawTools);
  console.log(`Loaded ${tools.length} tools from context7`);
  tools.forEach((t) => console.log(`- ${t.name}: ${t.description}`));

  // 2. Register tools with LLM
  console.log("Initializing NVIDIA LLM...");
  const llm = createNVIDIAChat();
  const llmWithTools = llm.bindTools(tools);

  // 3. Initial Query
  const query = "fetch me latest docs of langchain";
  console.log(`\nQuerying LLM: "${query}"`);

  const messages: BaseMessage[] = [new HumanMessage(query)];
  let turn = 1;
  const maxTurns = 5;

  try {
    while (turn <= maxTurns) {
      console.log(`\n--- Turn ${turn} ---`);
      const result = await safeInvoke(llmWithTools, messages);
      console.log(`LLM Response Content: "${result.content}"`);

      if (result.tool_calls && result.tool_calls.length > 0) {
        console.log("Tool Calls:", JSON.stringify(result.tool_calls, null, 2));

        const safeC = padContent(result.content as string);
        // Use ChatMessage to avoid potential AIMessage serialization quirks with tool_calls
        const aiMsg = new ChatMessage({
          content: safeC,
          role: "assistant",
        });
        (aiMsg as any).tool_calls = result.tool_calls;
        messages.push(aiMsg);

        for (const toolCall of result.tool_calls) {
          const tool = tools.find((t) => t.name === toolCall.name);
          if (tool) {
            console.log(`Executing tool ${toolCall.name}...`);
            try {
              const toolResult = await tool.invoke(toolCall.args);
              const contentStr =
                typeof toolResult === "string"
                  ? toolResult
                  : JSON.stringify(toolResult);
              console.log("Tool Result:", contentStr.substring(0, 200) + "...");

              messages.push(
                new ToolMessage({
                  tool_call_id: toolCall.id ?? "unknown",
                  content: padContent(contentStr),
                  name: toolCall.name,
                })
              );
            } catch (err) {
              console.error(`Error executing tool ${toolCall.name}:`, err);
              messages.push(
                new ToolMessage({
                  tool_call_id: toolCall.id ?? "unknown",
                  content: `Error: ${err}`,
                  name: toolCall.name,
                })
              );
            }
          } else {
            console.error(`Tool ${toolCall.name} not found`);
          }
        }
        turn++;
      } else {
        console.log("\nFinal Answer:");
        console.log(result.content);
        break;
      }
    }
  } catch (error) {
    console.error("LLM invocation failed:", error);
  }

  await mcpManager.disconnectAll();
}

main().catch(console.error);

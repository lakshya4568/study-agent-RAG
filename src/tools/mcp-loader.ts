import path from "node:path";
import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadMcpTools } from "@langchain/mcp-adapters";
import { logger } from "../client/logger";

export interface LoadedStudyTools {
  tools: Awaited<ReturnType<typeof loadMcpTools>>;
  client: Client;
  transport: StdioClientTransport;
}

function resolveServerPath(): string {
  const explicit = process.env.MCP_SERVER_PATH;
  if (explicit) {
    return path.resolve(explicit);
  }
  return path.resolve(process.cwd(), "dist", "mcp-servers", "study-tools.js");
}

function resolveServerName(resolvedPath: string): string {
  return (
    process.env.MCP_SERVER_NAME ??
    path.parse(resolvedPath).name ??
    "study-tools"
  );
}

export async function loadStudyMCPTools(): Promise<LoadedStudyTools> {
  const serverPath = resolveServerPath();
  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `Study tools MCP server not found at ${serverPath}. Run npm run build:mcp first.`
    );
  }
  const transport = new StdioClientTransport({
    command: process.env.MCP_SERVER_COMMAND ?? "node",
    args: process.env.MCP_SERVER_ARGS
      ? process.env.MCP_SERVER_ARGS.split(" ")
      : [serverPath],
    env: process.env as Record<string, string>,
  });

  const client = new Client(
    { name: "study-mentor-client", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(transport);

  const tools = await loadMcpTools(resolveServerName(serverPath), client);
  logger.info(`Loaded ${tools.length} MCP tools for the study agent.`);

  return { tools, client, transport };
}

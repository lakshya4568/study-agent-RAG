import path from "node:path";
import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadMcpTools } from "@langchain/mcp-adapters";
import { logger } from "../client/logger";
import { z } from "zod";

export interface LoadedStudyTools {
  tools: Awaited<ReturnType<typeof loadMcpTools>>;
  client: Client;
  transport: StdioClientTransport;
}

export interface McpConfig {
  mcpServers: Record<
    string,
    {
      command?: string;
      args?: string[];
      url?: string;
      env?: Record<string, string>;
    }
  >;
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

export function jsonSchemaToZod(schema: any): z.ZodType<any> {
  if (!schema) return z.any();
  if (schema.type === "object") {
    const shape: Record<string, z.ZodType<any>> = {};
    const required = new Set(schema.required || []);
    for (const [key, value] of Object.entries(schema.properties || {}) as [
      string,
      any,
    ][]) {
      let fieldSchema = jsonSchemaToZod(value);
      if (!required.has(key)) {
        // Fix for OpenAI/NVIDIA API strict mode: optional fields must be nullable
        fieldSchema = fieldSchema.optional().nullable();
      }
      shape[key] = fieldSchema;
    }
    return z.object(shape);
  }
  if (schema.type === "string") {
    if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
      return z.enum(schema.enum as [string, ...string[]]);
    }
    return z.string();
  }
  if (schema.type === "number" || schema.type === "integer") {
    return z.number();
  }
  if (schema.type === "boolean") {
    return z.boolean();
  }
  if (schema.type === "array") {
    return z.array(jsonSchemaToZod(schema.items));
  }
  return z.any();
}

export function patchMcpTools(tools: any[]): any[] {
  return tools.map((tool: any) => {
    // Check if schema is a Zod schema (has _def)
    if (tool.schema && !tool.schema._def) {
      try {
        logger.info(`Patching schema for tool ${tool.name}`);
        tool.schema = jsonSchemaToZod(tool.schema);
      } catch (e) {
        logger.warn(`Failed to convert schema for tool ${tool.name}`, e);
      }
    }
    return tool;
  });
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

  // Patch tools to ensure they have valid Zod schemas
  const patchedTools = patchMcpTools(tools);

  logger.info(`Loaded ${patchedTools.length} MCP tools for the study agent.`);

  return { tools: patchedTools, client, transport };
}

export function loadMcpConfig(): McpConfig {
  const configPath = path.resolve(process.cwd(), "mcp.json");
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      logger.error("Failed to parse mcp.json", error);
    }
  }
  return { mcpServers: {} };
}

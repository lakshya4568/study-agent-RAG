import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const progressStore = new Map<string, number>();

// Create MCP server with only tools capability
const server = new Server(
  {
    name: "StudyTools",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool schemas
const trackProgressSchema = z.object({
  topic: z.string().min(3),
  score: z.number().min(0).max(100),
});

const generateQuizSchema = z.object({
  topic: z.string().min(3),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
});

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "track_progress",
        description: "Track study progress for a topic",
        inputSchema: {
          type: "object",
          properties: {
            topic: { type: "string", minLength: 3 },
            score: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["topic", "score"],
        },
      },
      {
        name: "generate_quiz",
        description: "Generate a practice quiz for a topic and difficulty",
        inputSchema: {
          type: "object",
          properties: {
            topic: { type: "string", minLength: 3 },
            difficulty: {
              type: "string",
              enum: ["easy", "medium", "hard"],
              default: "medium",
            },
          },
          required: ["topic"],
        },
      },
      {
        name: "get_progress_report",
        description: "Retrieve all tracked progress entries",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["text", "json"],
              default: "text",
              description: "Output format",
            },
          },
        },
      },
    ],
  };
});

// Handle call tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "track_progress": {
        const { topic, score } = trackProgressSchema.parse(args);
        progressStore.set(topic, score);
        return {
          content: [
            {
              type: "text",
              text: `Progress updated: ${topic} -> ${score}%`,
            },
          ],
        };
      }

      case "generate_quiz": {
        const { topic, difficulty } = generateQuizSchema.parse(args);
        return {
          content: [
            {
              type: "text",
              text: `Quiz for ${topic} (${difficulty})\n1. Question one\n2. Question two`,
            },
          ],
        };
      }

      case "get_progress_report": {
        if (progressStore.size === 0) {
          return {
            content: [{ type: "text", text: "No progress tracked yet." }],
          };
        }
        const report = Array.from(progressStore.entries())
          .map(([topic, score]) => `${topic}: ${score}%`)
          .join("\n");
        return {
          content: [{ type: "text", text: report }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

export async function startStudyToolsServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Study tools MCP server started successfully");
}

if (require.main === module) {
  startStudyToolsServer().catch((error) => {
    console.error("Study tools MCP server failed to start", error);
    process.exit(1);
  });
}

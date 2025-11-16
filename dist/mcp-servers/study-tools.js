"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStudyToolsServer = startStudyToolsServer;
const fastmcp_1 = require("fastmcp");
const zod_1 = require("zod");
const progressStore = new Map();
const studyToolsServer = new fastmcp_1.FastMCP({
    name: "StudyTools",
    version: "0.1.0",
    instructions: "Study companion utilities for progress tracking and quiz generation.",
});
studyToolsServer.addTool({
    name: "track_progress",
    description: "Track study progress for a topic",
    parameters: zod_1.z.object({
        topic: zod_1.z.string().min(3),
        score: zod_1.z.number().min(0).max(100),
    }),
    execute: async ({ topic, score }) => {
        progressStore.set(topic, score);
        return `Progress updated: ${topic} -> ${score}%`;
    },
});
studyToolsServer.addTool({
    name: "generate_quiz",
    description: "Generate a practice quiz for a topic and difficulty",
    parameters: zod_1.z.object({
        topic: zod_1.z.string().min(3),
        difficulty: zod_1.z.enum(["easy", "medium", "hard"]).default("medium"),
    }),
    execute: async ({ topic, difficulty, }) => {
        return `Quiz for ${topic} (${difficulty})\n1. Question one\n2. Question two`;
    },
});
studyToolsServer.addTool({
    name: "get_progress_report",
    description: "Retrieve all tracked progress entries",
    parameters: zod_1.z.object({}),
    execute: async () => {
        if (progressStore.size === 0) {
            return "No progress tracked yet.";
        }
        return Array.from(progressStore.entries())
            .map(([topic, score]) => `${topic}: ${score}%`)
            .join("\n");
    },
});
async function startStudyToolsServer() {
    await studyToolsServer.start({ transportType: "stdio" });
}
if (require.main === module) {
    startStudyToolsServer().catch((error) => {
        console.error("Study tools MCP server failed to start", error);
        process.exit(1);
    });
}

const { spawn } = require("child_process");
const path = require("path");

// Path to the original server script
const originalScript =
  "/Users/proximus/Downloads/Github Repositories/googleForm-MCP/src/gform-mcp-server.js";

const child = spawn("node", [originalScript], {
  stdio: ["inherit", "pipe", "inherit"], // pipe stdout, inherit stdin/stderr
});

let buffer = "";

child.stdout.on("data", (data) => {
  buffer += data.toString();

  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);

    if (!line) continue;

    try {
      // Try to parse as JSON
      JSON.parse(line);
      // If successful, it's a valid JSON-RPC message, send to stdout
      process.stdout.write(line + "\n");
    } catch (e) {
      // If not JSON, it's a log message, send to stderr
      process.stderr.write(`[Google Forms Log] ${line}\n`);
    }
  }
});

child.on("exit", (code) => {
  process.exit(code);
});

child.on("error", (err) => {
  console.error(`Failed to start child process: ${err}`);
  process.exit(1);
});

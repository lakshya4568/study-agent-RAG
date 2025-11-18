# Quick Start: Using MCP Tools in Study Agent

## What Was Implemented

✅ **Complete MCP tool integration with user approval flow**

Your Study Agent can now:

1. Connect to any MCP server (filesystem, GitHub, custom, etc.)
2. Discover available tools automatically
3. Use tools when answering questions
4. Show you an approval dialog before executing any tool
5. Display tool results in the chat

---

## How to Use

### Step 1: Add an MCP Server

1. **Launch the app**: `npm start`

2. **Navigate to "Servers" view** (sidebar menu)

3. **Click "Add Server"**

4. **Example: Add Filesystem Server**

   ```
   Server Name: My Files
   Server ID: (leave blank - auto-generated)
   Command: npx
   NPX Package Name: @modelcontextprotocol/server-filesystem
   Additional Arguments: -y /Users/yourname/Documents
   ```

5. **Click "Add Server"** - Status should show "connected" with green badge

### Step 2: Chat with Tool Access

1. **Navigate to "Chat" view**

2. **Notice the badge** at bottom: "X tools available"

3. **Ask a question that requires tool use**:

   ```
   "What files are in my Documents folder?"
   ```

### Step 3: Approve Tool Execution

When the LLM decides to use a tool:

```
┌──────────────────────────────────────────┐
│ 🔧 Tool Execution Request                │
│                                           │
│ Tool: list_directory                     │
│ Server: My Files                         │
│ Arguments:                                │
│   path: /Users/yourname/Documents        │
│                                           │
│ [✓ Approve & Execute]  [✗ Deny]         │
└──────────────────────────────────────────┘
```

**Click "Approve & Execute"** to allow the tool to run.

**Click "Deny"** to reject the tool execution.

---

## Supported MCP Servers

### 1. Filesystem Server

**Purpose:** Read, write, list files

```
Command: npx
Package: @modelcontextprotocol/server-filesystem
Args: -y /path/to/directory
```

**Example queries:**

- "List all PDF files in my Documents"
- "Read the contents of README.md"
- "What's in my Desktop folder?"

### 2. GitHub Server

**Purpose:** Search repos, read issues, PR data

```
Command: npx
Package: @modelcontextprotocol/server-github
Args: -y
Env: GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx
```

**Example queries:**

- "Show me recent issues in microsoft/vscode"
- "What are the open PRs in my repository?"

### 3. Context7 (Documentation Search)

**Purpose:** Search library documentation

```
Command: npx
Package: @upstash/context7-mcp
Args: -y
```

**Example queries:**

- "How do I use React hooks?"
- "Show me Next.js routing examples"

### 4. Custom Servers

You can connect any MCP-compatible server:

```
Command: node
Args: /absolute/path/to/your-server.js
```

---

## Testing It Works

### Quick Test Script

Open browser DevTools (automatically opens in dev mode):

```javascript
// Test 1: Check MCP client is available
console.log(window.mcpClient);

// Test 2: Get all connected servers
const servers = await window.mcpClient.getAllServers();
console.log('Connected servers:', servers);

// Test 3: Get available tools
const tools = await window.mcpClient.getAllTools();
console.log('Available tools:', tools);
```

You should see output like:

```javascript
Connected servers: [
  {
    config: { id: "fs-server", name: "My Files", ... },
    status: "connected",
    tools: [...]
  }
]

Available tools: [
  { name: "read_file", serverId: "fs-server", ... },
  { name: "write_file", serverId: "fs-server", ... },
  { name: "list_directory", serverId: "fs-server", ... }
]
```

---

## How the Approval Flow Works

```
1. User asks question
   ↓
2. LLM sees available tools
   ↓
3. LLM decides to use a tool
   ↓
4. 🟡 Approval card appears in chat
   ↓
5. User clicks "Approve" or "Deny"
   ↓
6a. If Approved:
    - Tool executes
    - Result sent back to LLM
    - LLM generates final answer
    ↓
6b. If Denied:
    - Tool doesn't execute
    - LLM continues without that tool
    ↓
7. Final answer displayed
```

---

## Important Notes

### Security

- **All tool executions require your approval**
- You can see exactly what the tool will do before approving
- Denying a tool won't break the conversation

### Performance

- Tool approvals are polled every 2 seconds
- Multiple tools may be called for complex questions
- You can approve/deny each individually

### Backend Requirements

The Python RAG service must be running:

```bash
cd python
python nvidia_rag_service.py
```

This provides the `/query-agent` endpoint that handles tool calling.

---

## Troubleshooting

### "No tools available" badge shows 0

**Solution:**

1. Go to Servers view
2. Check server status is "connected"
3. If "error", check server command/args
4. Try removing and re-adding the server

### Approval card doesn't appear

**Solution:**

1. Check browser console for errors
2. Verify backend is running: `curl http://localhost:8000/health`
3. Make sure query actually needs a tool (try: "List my files")

### Tool execution fails after approval

**Solution:**

1. Check tool has necessary permissions
2. Verify arguments are valid (e.g., file path exists)
3. Check server logs in terminal

### Can't add server

**Solution:**

1. Verify `npx` is installed: `npx --version`
2. Check package exists: `npm view @modelcontextprotocol/server-filesystem`
3. Try full path to node/npx

---

## Example Session

**You:** "What markdown files are in my Desktop folder?"

**Agent:** *[Thinking...]*

**[Approval Card Appears]**

```
Tool: list_directory
Server: My Files
Arguments: { path: "/Users/you/Desktop", pattern: "*.md" }
```

**You:** *[Clicks "Approve & Execute"]*

**Agent:** "I found 5 markdown files on your Desktop:

- README.md
- NOTES.md  
- TODO.md
- PROJECT_IDEAS.md
- CHANGELOG.md

Would you like me to read any of them?"

---

## Next Steps

1. **Add your preferred MCP servers** in the Servers view
2. **Test with simple queries** like "list my files"
3. **Experiment with complex workflows** that need multiple tools
4. **Explore tool combinations** (e.g., "Read all TODO items from my markdown files")

---

## Advanced: Creating Custom Tools

You can create your own MCP server with custom tools. Example:

```typescript
// my-tools-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "my-tools",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "my_custom_tool",
    description: "Does something amazing",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" }
      }
    }
  }]
}));

server.setRequestHandler("tools/call", async (request) => {
  if (request.params.name === "my_custom_tool") {
    // Your tool logic here
    return {
      content: [{ type: "text", text: "Tool result!" }]
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
```

Then add it:

```
Command: node
Args: /path/to/my-tools-server.js
```

---

## Summary

🎉 **You now have a fully functional MCP tool system!**

- ✅ Add any MCP server
- ✅ Tools discovered automatically
- ✅ LLM can use tools intelligently
- ✅ You control every execution
- ✅ Safe and transparent

**Happy building!** 🚀

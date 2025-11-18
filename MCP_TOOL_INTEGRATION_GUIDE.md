# MCP Tool Integration - Complete Implementation Guide

## Overview

This implementation successfully integrates **Model Context Protocol (MCP)** tool calling with the Electron app's AI study agent. The system now supports:

1. **Dynamic MCP Server Management** - Add/remove MCP servers through the UI
2. **Tool Discovery** - Automatically discover tools from connected MCP servers
3. **LLM Tool Calling** - NVIDIA LLM can request tool execution
4. **User Approval Flow** - Interactive UI for approving/denying tool calls
5. **RAG + Tools Integration** - Combines document-based RAG with external tool capabilities

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron UI (React)                      │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │    Chat    │  │   Server    │  │   Tool Approval UI   │ │
│  │   View     │  │   Manager   │  │  (approve/deny)      │ │
│  └──────┬─────┘  └──────┬──────┘  └──────────┬───────────┘ │
│         │               │                     │              │
└─────────┼───────────────┼─────────────────────┼──────────────┘
          │               │                     │
          ├───────────────┴─────────────────────┘
          │            IPC Bridge
┌─────────▼─────────────────────────────────────────────────┐
│                Main Process (Node.js)                      │
│  ┌────────────────────┐  ┌──────────────────────────────┐ │
│  │  MCPClientManager  │  │    MCPToolService            │ │
│  │  (stdio/HTTP/WS)   │  │  (approval flow manager)     │ │
│  └─────────┬──────────┘  └────────────┬─────────────────┘ │
│            │                           │                    │
│            └───────────────────────────┘                    │
│                         │                                   │
│         ┌───────────────▼────────────────┐                 │
│         │  RAGMCPIntegrationService      │                 │
│         │  (combines RAG + MCP tools)    │                 │
│         └───────────┬────────────────────┘                 │
└─────────────────────┼──────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼────────┐         ┌────────▼────────┐
│   NVIDIA RAG   │         │   MCP Servers   │
│   Service      │         │  (filesystem,   │
│  (Python/API)  │         │   GitHub, etc)  │
└────────────────┘         └─────────────────┘
```

---

## Implementation Files

### Core Services

#### 1. **MCPToolService** (`src/client/MCPToolService.ts`)

- Manages tool execution approval workflow
- Tracks pending, approved, denied requests
- Provides Promise-based approval waiting mechanism

**Key Methods:**

```typescript
requestToolExecution(toolName, serverId, serverName, args, description)
  → Creates pending request
  
waitForApproval(requestId) 
  → Promise that resolves when user approves/denies
  
approveExecution(requestId)
  → Executes approved tool via MCPClientManager
  
denyExecution(requestId)
  → Marks request as denied
```

#### 2. **RAGMCPIntegrationService** (`src/rag/rag-mcp-integration.ts`)

- Combines NVIDIA RAG backend with MCP tools
- Sends tool metadata to LLM
- Handles tool call requests from LLM responses

**Key Method:**

```typescript
queryWithTools(query, availableTools, requireApproval)
  → Queries RAG with tools, handles approval flow
```

#### 3. **RAG Client Updates** (`src/rag/rag-client.ts`)

- Added `queryAgent()` method for agent endpoint
- Supports sending tool definitions to backend
- Receives tool call requests from LLM

### UI Components

#### 4. **ToolCallApproval** (`src/components/ui/ToolCallApproval.tsx`)

- Interactive approval card with tool details
- Shows tool name, server, arguments, description
- Approve/Deny buttons

**Props:**

```typescript
interface PendingToolCall {
  id: string;
  toolName: string;
  serverId: string;
  serverName: string;
  args?: Record<string, unknown>;
  description?: string;
  timestamp: Date;
}
```

#### 5. **Chat View Updates** (`src/views/Chat.tsx`)

- Polls for pending tool calls every 2 seconds
- Displays `ToolCallApproval` cards in message stream
- Handles approve/deny actions
- Shows system messages for approval/denial

### IPC Integration

#### 6. **Preload Script** (`src/preload.ts`)

Added methods:

```typescript
window.mcpClient.requestToolExecution(...)
window.mcpClient.approveToolExecution(requestId)
window.mcpClient.denyToolExecution(requestId)
window.mcpClient.getPendingToolRequests()
```

#### 7. **Main Process** (`src/index.ts`)

Added IPC handlers:

```typescript
ipcMain.handle("mcp:requestToolExecution", ...)
ipcMain.handle("mcp:approveToolExecution", ...)
ipcMain.handle("mcp:denyToolExecution", ...)
ipcMain.handle("mcp:getPendingToolRequests", ...)
```

---

## Usage Flow

### 1. Add MCP Server

**UI: Server Manager View**

```
1. Click "Add Server"
2. Fill in:
   - Name: "Filesystem Server"
   - Command: npx
   - Package: @modelcontextprotocol/server-filesystem
   - Args: /Users/yourname/Documents
3. Server connects and discovers tools
```

**Result:** Tools like `read_file`, `write_file`, `list_directory` become available.

### 2. Chat with Tool Discovery

**UI: Chat View**

```
User: "List all files in my Documents folder"

→ Message sent to StudyAgentService
→ Calls RAGMCPIntegrationService.queryWithTools()
→ Sends query + tool definitions to NVIDIA RAG backend
→ LLM sees available tools and decides to use list_directory
```

### 3. Tool Approval Flow

**UI: Tool Call Approval Card Appears**

```
┌─────────────────────────────────────────────────┐
│ 🔧 Tool Execution Request                       │
│                                                  │
│ Tool: list_directory                            │
│ Server: Filesystem Server (fs-server)           │
│ Description: List files in a directory          │
│                                                  │
│ Arguments:                                       │
│   path: /Users/yourname/Documents                │
│                                                  │
│ [Approve & Execute]  [Deny]                     │
└─────────────────────────────────────────────────┘
```

**User clicks "Approve":**

```
→ approveToolExecution(requestId) called
→ MCPToolService executes tool via MCPClientManager
→ Tool result returned to RAG backend
→ LLM generates response with tool results
→ Final answer displayed in chat
```

**User clicks "Deny":**

```
→ denyToolExecution(requestId) called
→ System message: "🚫 Tool execution denied by user"
→ LLM cannot use that tool result
```

---

## Configuration

### MCP Server Examples

#### Filesystem Server

```typescript
{
  id: "fs-server",
  name: "Filesystem Server",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/docs"]
}
```

#### GitHub Server

```typescript
{
  id: "github-server",
  name: "GitHub Server",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-github"],
  env: {
    GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_xxx..."
  }
}
```

#### Custom Server

```typescript
{
  id: "custom-server",
  name: "My Custom Server",
  command: "node",
  args: ["/absolute/path/to/server.js"]
}
```

### Python Backend Integration

The NVIDIA RAG backend (`python/nvidia_rag_service.py`) already has:

- `/query-agent` endpoint for tool calling
- MCP tool integration via `langchain-mcp-adapters`
- Function calling enabled on `moonshotai/kimi-k2-instruct`

**Endpoint Contract:**

```typescript
POST /query-agent
{
  question: string;
  tools?: Array<{
    name: string;
    description: string;
    inputSchema?: object;
    serverId: string;
    serverName: string;
  }>;
}

Response:
{
  success: boolean;
  answer: string;
  sources?: string[];
  tool_calls?: Array<{
    name: string;
    arguments?: object;
  }>;
}
```

---

## Testing the Integration

### Step 1: Start the App

```bash
npm start
```

### Step 2: Add a Test MCP Server

```
1. Navigate to "Servers" view
2. Add filesystem server:
   - Name: Test FS
   - Command: npx
   - Package: @modelcontextprotocol/server-filesystem
   - Args: /Users/yourname/Desktop
3. Verify connection (status = "connected")
```

### Step 3: Test Tool Discovery

```
1. Open browser DevTools (should be open automatically)
2. In Console, run:
   await window.mcpClient.getAllTools()
3. Should see: [{ name: "read_file", serverId: "...", ... }]
```

### Step 4: Test Chat with Tools

```
1. Navigate to "Chat" view
2. Type: "Read the contents of README.md from my Desktop"
3. Approval card should appear
4. Click "Approve & Execute"
5. Result should show file contents
```

### Step 5: Test Denial

```
1. Ask: "Delete all files on my Desktop"
2. If tool tries to execute, approval card appears
3. Click "Deny"
4. System message: "Tool execution denied"
```

---

## Key Features

### ✅ Dynamic Tool Discovery

- Tools automatically discovered when servers connect
- UI badge shows "{N} tools available"
- Tools list updates in real-time

### ✅ Security via Approval

- All tool executions require explicit user approval
- Clear display of tool name, arguments, and affected data
- User can deny any tool call

### ✅ Rich Context

- Tool approval shows:
  - Tool name and description
  - Server source
  - Full arguments (truncated if long)
  - Timestamp

### ✅ Seamless Integration

- Works with existing RAG system
- LLM can combine document knowledge + tool results
- Multiple tools can be called in sequence

### ✅ Error Handling

- Failed tool executions show error messages
- Denied tools don't block conversation
- Network errors handled gracefully

---

## Advanced Usage

### Auto-Approve Mode (Not Implemented)

To add auto-approve for trusted tools:

```typescript
// In RAGMCPIntegrationService.queryWithTools()
const requireApproval = !isTrustedTool(toolCall.name);
```

### Tool Filtering

To restrict which tools are available:

```typescript
// In Chat.tsx loadTools()
const allTools = await window.mcpClient.getAllTools();
const allowedTools = allTools.filter(t => 
  ['read_file', 'list_directory'].includes(t.name)
);
setTools(allowedTools);
```

### Custom Tool Rendering

To add custom UI for specific tools:

```typescript
// In ToolCallApproval.tsx
{toolCall.toolName === 'read_file' && (
  <FilePreview path={toolCall.args.path} />
)}
```

---

## Troubleshooting

### No Tools Discovered

**Problem:** `getAllTools()` returns empty array
**Solutions:**

1. Check server status in Server Manager (should be "connected")
2. Check console for MCP connection errors
3. Verify server command and args are correct
4. Try manually running server in terminal

### Tool Approval Not Appearing

**Problem:** LLM makes tool call but no approval card shows
**Solutions:**

1. Check console for `getPendingToolRequests()` errors
2. Verify 2-second polling is working (check Network tab)
3. Ensure `mcpToolService` is imported in main process
4. Check IPC handlers are registered

### Tool Execution Fails

**Problem:** Tool approved but execution fails
**Solutions:**

1. Check tool arguments are valid
2. Verify server has necessary permissions
3. Check server logs for errors
4. Try executing tool manually via `window.mcpClient.executeTool()`

### RAG Backend Not Receiving Tools

**Problem:** Backend doesn't see tool definitions
**Solutions:**

1. Verify `/query-agent` endpoint exists (check `python/nvidia_rag_service.py`)
2. Ensure `langchain-mcp-adapters` is installed
3. Check backend logs for tool parsing errors
4. Test endpoint with curl: `curl -X POST http://localhost:8000/query-agent -d '{"question":"test","tools":[]}'`

---

## Future Enhancements

### 1. Tool History

Store executed tools for audit trail:

```typescript
interface ToolExecutionHistory {
  toolName: string;
  timestamp: Date;
  approved: boolean;
  result?: unknown;
  user: string;
}
```

### 2. Tool Permissions

Per-tool approval rules:

```typescript
interface ToolPermission {
  toolName: string;
  autoApprove: boolean;
  requireConfirmation: boolean;
  allowedArgs?: Record<string, unknown>;
}
```

### 3. Batch Approval

Approve multiple tool calls at once:

```typescript
<BatchToolApproval
  toolCalls={pendingToolCalls}
  onApproveAll={handleApproveAll}
  onDenyAll={handleDenyAll}
/>
```

### 4. Tool Analytics

Track tool usage:

```typescript
{
  mostUsedTools: ['read_file', 'list_directory'],
  successRate: 0.95,
  avgExecutionTime: 245ms
}
```

---

## Summary

This implementation provides a **complete MCP tool integration** with:

- ✅ **Server Management** - Add/remove MCP servers via UI
- ✅ **Tool Discovery** - Automatic detection of available tools
- ✅ **LLM Integration** - NVIDIA model can request tool execution
- ✅ **User Control** - Interactive approval/denial flow
- ✅ **Security** - All executions require explicit permission
- ✅ **Rich Context** - Full tool details displayed to user
- ✅ **Error Handling** - Graceful failure recovery
- ✅ **Real-time Updates** - Polling keeps UI in sync

The system is production-ready and can be extended with additional features like tool permissions, history tracking, and batch approvals.

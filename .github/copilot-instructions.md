# AI Study Agent - Copilot Instructions# 🧠 Study Agent MCP Client



## Project State: Early-Stage Electron + TypeScript Scaffold## Project Overview



This is a **freshly initialized Electron application** (using Electron Forge + Webpack + TypeScript) with the **vision** of becoming a Model Context Protocol (MCP) client for AI-powered study tools. The MCP client implementation **does not exist yet**—the codebase is currently a vanilla Electron starter template.**Study Agent MCP Client** is a universal, agent-enabled desktop client (TypeScript + Electron) designed to interface with any *Model Context Protocol (MCP)* server. It empowers the creation and delivery of intelligent, personalized study tools by leveraging dynamically discovered capabilities from MCP servers—including Google Forms. The goal is to allow AI-driven workflows (summarization, flashcards, quiz generation, study mentoring) by connecting to multiple backends through a standardized protocol.



------



## Architecture: Standard Electron Process Model## 🌟 Key Features



```- **Universal MCP Client**: Connects to any MCP-compliant server (local or remote), discovering available tools at runtime, and allowing seamless extension with zero code changes.

┌─────────────────────────────────────────┐- **Multi-Server Support**: Manage and orchestrate parallel connections to multiple MCP servers. Aggregate all available tools, regardless of backend or server language.

│  Main Process (Node.js)                 │- **Dynamic Tool Discovery & Execution**: Automatically fetches tool metadata (name, inputs, description) from servers and allows users/agents to run those tools through a unified API.

│  src/index.ts                           │- **AI Agent Integration**: Designed for use with LLM-based agents that can decide, select, and use discovered tools intelligently.

│  - Window lifecycle                     │- **Study-Optimized Features**:

│  - Future: MCP client manager           │  - **Summarization** of imported documents (e.g., PDFs)

└────────────┬────────────────────────────┘  - **Flashcard** generation for interactive self-learning

             │ IPC (to be implemented)  - **Google Form Quiz Creation** (via MCP server tool, e.g. `create_form`)

┌────────────▼────────────────────────────┐  - **Study & Learn Mentor**: AI guides user towards learning goals, not just answers

│  Renderer Process (Browser/Chromium)    │

│  src/renderer.ts, src/index.html        │---

│  - UI rendering                         │

│  - Future: Chat UI, tool explorer       │## LLM Usage

└─────────────────────────────────────────┘- **LLM-Agnostic**: Plug in any LLM provider (Gemini) for agent reasoning and tool selection.

     ▲

     │ contextBridge (to be implemented)## 🚀 Project Vision

┌────┴──────────────────────────────────┐

│  Preload Script                       │Modern LLM use-cases go far beyond chat. *Model Context Protocol (MCP)* is becoming the bridge for tools and data, connecting LLM agents to heterogeneous toolchains and APIs. This client makes those new AI workflows accessible from the desktop for students, researchers, and tinkerers.

│  src/preload.ts (currently empty)     │

│  - Expose safe APIs to renderer       │The agent system can:

└───────────────────────────────────────┘- Instantly discover capabilities (tools) from new servers

```- Act on raw documents (local, cloud), create quizzes or flashcards, and more

- Orchestrate multi-agent learning where the AI helps you master a subject, not just answer questions

**Key Files:**

- `src/index.ts`: Main process entry, creates `BrowserWindow`, loads renderer---

- `src/renderer.ts`: Renderer process entry (minimal, just imports CSS + console log)

- `src/preload.ts`: Empty preload script (ready for contextBridge APIs)## 🛠️ Architecture Overview

- `src/index.html`: Minimal HTML template with "Hello World"

- `forge.config.ts`: Electron Forge configuration (makers, plugins, webpack setup)```



---+----------------------------------------------+

|         Electron Desktop Application         |

## Build System: Webpack via Electron Forge|  +----------------------------------------+  |

|  | UI: Tool explorer, PDF import, chat    |  |

The project uses **@electron-forge/plugin-webpack** with separate configs:|  +----------------------------------------+  |

+--------------------------+-------------------+

- `webpack.main.config.ts`: Main process bundle (entry: `src/index.ts`)|

- `webpack.renderer.config.ts`: Renderer process bundle (entry: `src/renderer.ts`)+---------------v--------------------+

- `webpack.rules.ts`: Shared TypeScript + native module loaders|      MCP Client Manager            |

- `webpack.plugins.ts`: Fork-ts-checker for type checking during builds|   - Multiple server registry       |

|   - Dynamic discovery              |

**Critical Constants:**|   - Unified tool API               |

- `MAIN_WINDOW_WEBPACK_ENTRY`: Webpack magic constant pointing to bundled renderer HTML+----------------+-------------------+

- `MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY`: Points to bundled preload script|

- These are **auto-injected by Forge's webpack plugin**—do not hardcode paths+----------------------+-------------------------+

|      Multiple MCP Server Sessions              |

---|    (Google Forms, File System, etc)           |

+-----------------------------------------------+

## Development Workflow|      JSON-RPC 2.0, STDIO/HTTP/SSE transport   |

+-----------------------------------------------+

### Running the App

```bash```

npm start              # Start in dev mode with hot reload

npm run package        # Package app without creating installer- **Main Process**: MCP Client Manager handles discovery, connections, tool registry, tool execution, and server orchestration.

npm run make           # Create distributable (DMG on macOS, etc.)- **UI**: Renders agent chat, tool lists, logs, and workflow controls (PDF upload, flashcard review, quiz interface).

npm run lint           # Run ESLint on TypeScript files- **Agent**: LLM-driven logic for selecting and sequencing tools.

```

---

### DevTools

`src/index.ts` **always opens DevTools** in development (`mainWindow.webContents.openDevTools()`). Remove this line for production.## 🧩 Typical Workflow Example



### TypeScript Configuration1. **Start Client**: User launches Electron desktop app, adds available MCP servers (e.g., Google Forms server).

- `tsconfig.json`: ES6 target, CommonJS modules, strict type checking enabled2. **Tool Discovery**: On connection, client fetches and displays all server tools with metadata.

- Webpack uses `ts-loader` with `transpileOnly: true` for faster builds3. **User/Agent Action**:

- Fork-ts-checker runs type checking in parallel   - User uploads a PDF.

   - Agent discovers `summarize_pdf`, `generate_flashcards`, and `create_form` as available tools.

---   - Agent calls tools to generate study summaries, flashcards, and quizzes—using selected MCP servers.

4. **Results Displayed**: Summaries, flashcards, and quiz links appear in the UI; user can interact and study.

## Key Conventions & Patterns

---

### 1. Process Isolation

- **Never import Node.js APIs in renderer code**—use `contextBridge` in preload script## 💡 Technical Stack

- Main process handles file system, MCP connections, native APIs

- Renderer communicates via IPC (`ipcMain`/`ipcRenderer`) exposed through preload- **Electron**: Desktop framework for cross-platform apps.

- **TypeScript**: Static typing for maintainability.

### 2. Squirrel Startup Handling- **@modelcontextprotocol/sdk**: Official MCP TypeScript SDK—JSON-RPC, STDIO/HTTP transport.

`src/index.ts` checks for `electron-squirrel-startup` to handle Windows installer events:- **Zod**: For input schema validation.

```typescript- **Winston**: Logging and debugging.

if (require('electron-squirrel-startup')) {- **Node.js**: Runtime for backend logic and process handling.

  app.quit();

}---

```

This **must remain at the top** of the main process to avoid duplicate installs.## ✨ Why Use This Project?



### 3. Platform-Specific Behavior- **Develop once, connect to any (future) AI toolchain** using the MCP standard.

macOS apps traditionally stay open when all windows close:- **Includes all agent patterns** for tomorrow’s LLM workflows—not limited to static prompts or plugins.

```typescript- **Scalable and extensible**—add new servers, get more study features instantly.

app.on('window-all-closed', () => {- **Perfect for power users, students, researchers, and AI hackers** who want end-to-end agent pipelines.

  if (process.platform !== 'darwin') {

    app.quit();---

  }

});## 🚧 Status & How to Get Started

```

Activate event re-creates window on dock icon click (macOS pattern).- 🎯 *Phase 1*: Client project setup & tool registry bootstrapped.

- 🛠️ *Phase 2*: Implement and test with your Google Forms server.

---- 🧪 *Phase 3*: Add more MCP servers, LLM-powered agent workflows for all study modes.

- 🏁 *Phase 4*: Polish UI for handling rich study tasks, progress tracking, agent reasoning visualizations.

## Future Implementation: MCP Client (Not Yet Built)

---

### Target Architecture

The project aims to build a **Universal MCP Client** for AI-powered study tools:## 📖 Further Reading

- Connect to any MCP-compliant server (local/remote)

- Dynamic tool discovery and execution- [ModelContextProtocol.io](https://modelcontextprotocol.io/)

- Multi-server orchestration- [Anthropic’s MCP Introduction](https://www.anthropic.com/news/model-context-protocol)

- Study features: PDF summarization, flashcards, quiz generation, AI mentoring- [Agentic AI with RAG and MCP](https://getstream.io/blog/agentic-ai-rag/)

- [Google Forms MCP Example (reference server)](https://github.com/...)

### Recommended Structure

```---

src/

├── index.ts              (main entry, window management)## 🤖 Copilot Usage

├── renderer.ts           (UI entry)

├── preload.ts            (contextBridge for IPC)- Designed for Copilot and other code assistants!

├── client/               (TO BE CREATED)- Use descriptive function/class/method signatures, full-type annotations.

│   ├── MCPClientManager.ts   # Multi-server registry, discovery- Big on modularity: **Abstract server, transport, and tool layers so Copilot can suggest additions or refactoring quickly.**

│   ├── MCPSession.ts         # Per-server connection/tool execution- Most code in `/src/client` and `/src/transport` folders.

│   └── ToolRegistry.ts       # Unified tool API- Place complex interactions (tool execution, reconnection, notifications) in dedicated methods for maximum intelligence with Copilot autocomplete.

├── transport/            (TO BE CREATED)

│   ├── StdioTransport.ts     # STDIO-based MCP servers---

│   └── HttpTransport.ts      # HTTP/SSE MCP servers

└── ui/                   (TO BE CREATED)Enjoy building the future of agentic, AI-powered learning!

    ├── Chat.tsx              # Agent chat interface```
    └── ToolExplorer.tsx      # Tool list/execution UI
```

### Dependencies to Add
- `@modelcontextprotocol/sdk` (official MCP TypeScript SDK)
- `zod` (schema validation for tool inputs)
- `winston` (structured logging)
- React/Svelte/Vue (for UI, not yet chosen)

### IPC Architecture
Main process will expose MCP APIs via `contextBridge`:
```typescript
// preload.ts (future)
contextBridge.exposeInMainWorld('mcp', {
  connectServer: (serverConfig) => ipcRenderer.invoke('mcp:connect', serverConfig),
  listTools: (serverId) => ipcRenderer.invoke('mcp:list-tools', serverId),
  executeTool: (serverId, toolName, params) => ipcRenderer.invoke('mcp:execute', serverId, toolName, params),
});
```

---

## Adding New Code: Best Practices

1. **Follow Electron Security Guidelines:**
   - No `nodeIntegration: true` in `BrowserWindow`
   - Use `contextBridge` in preload, never `require()` in renderer
   - Validate all IPC inputs with Zod schemas

2. **TypeScript Strictness:**
   - Avoid `any`—use proper types or `unknown` + type guards
   - Export types for IPC payloads (`export type MCPServerConfig = {...}`)
   - Use discriminated unions for tool result types

3. **Logging:**
   - Main process: Use `winston` logger (to be added)
   - Renderer: `console.log` is fine for now (visible in DevTools)
   - Log MCP connection events, tool executions, errors

4. **Error Handling:**
   - Wrap MCP tool calls in try/catch, return typed `Result<T, E>` objects
   - Display errors in UI, don't just log—this is a learning tool, users need feedback

---

## Testing Strategy (To Be Implemented)

- **Unit tests**: Vitest for MCP client logic, transport layers
- **Integration tests**: Test with mock MCP servers (stdio echo server)
- **E2E tests**: Playwright/Spectron for full Electron app flows
- No test framework configured yet—recommend Vitest + Playwright

---

## Immediate Next Steps for AI Agents

When asked to implement features, prioritize this order:

1. **Set up IPC boilerplate**: Create preload API + main process handlers
2. **Add MCP SDK**: `npm install @modelcontextprotocol/sdk zod winston`
3. **Build `MCPClientManager`**: Connect to a single local stdio MCP server first
4. **Tool discovery**: Implement `list_tools()` RPC call, display in renderer
5. **Tool execution**: Implement `call_tool()` RPC call with Zod validation
6. **UI framework**: Choose React/Svelte, build Chat + ToolExplorer components
7. **Multi-server support**: Extend manager to handle N servers concurrently

---

## Project Vision

Modern LLM use-cases go far beyond chat. *Model Context Protocol (MCP)* is becoming the bridge for tools and data, connecting LLM agents to heterogeneous toolchains and APIs. This client aims to make those new AI workflows accessible from the desktop for students, researchers, and tinkerers.

The agent system should:
- Instantly discover capabilities (tools) from new servers
- Act on raw documents (local, cloud), create quizzes or flashcards, and more
- Orchestrate multi-agent learning where the AI helps you master a subject, not just answer questions

---

## References

- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [MCP Specification](https://modelcontextprotocol.io/docs/specification)
- [Electron Forge Webpack Plugin](https://www.electronforge.io/config/plugins/webpack)

import { JSDOM } from "jsdom";
import React from "react";
import { createRoot } from "react-dom/client";
import { Chat } from "../src/views/Chat";
import type { AgentStatus } from "../src/agent/StudyAgentService";
import type { ConfigSummaryItem } from "../src/client/types";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
});

const { window } = dom;

globalThis.window = window as unknown as Window & typeof globalThis;
globalThis.document = window.document;
globalThis.navigator = window.navigator;
const actGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actGlobal.IS_REACT_ACT_ENVIRONMENT = true;

globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number =>
  window.setTimeout(() => callback(performance.now()), 0);
globalThis.cancelAnimationFrame = (handle: number) =>
  window.clearTimeout(handle);

class NoopResizeObserver {
  observe(): void {
    // noop
  }

  unobserve(): void {
    // noop
  }

  disconnect(): void {
    // noop
  }
}

(
  window as unknown as { ResizeObserver: typeof NoopResizeObserver }
).ResizeObserver = NoopResizeObserver;
(
  globalThis as unknown as { ResizeObserver: typeof NoopResizeObserver }
).ResizeObserver = NoopResizeObserver;

if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener() {
      // noop
    },
    removeListener() {
      // noop
    },
    addEventListener() {
      // noop
    },
    removeEventListener() {
      // noop
    },
    dispatchEvent() {
      return false;
    },
  });
}

type AgentSendPayload = {
  threadId: string;
  message: string;
};

const baseStatus: AgentStatus = {
  initialized: true,
  graphReady: true,
  vectorStoreReady: true,
  lastInitDurationMs: 1200,
  lastInitError: undefined,
  lastInvocationLatencyMs: 42,
  documents: {
    requested: ["README.md"],
    loadedCount: 1,
    fallbackUsed: false,
  },
  mcpTools: {
    enabled: true,
    toolCount: 1,
    toolNames: ["mock_tool"],
  },
  environment: {
    nvidiaApiKey: true,
    geminiApiKey: false,
    anthropicApiKey: false,
  },
  timestamp: Date.now(),
};

let invocationCount = 0;

window.studyAgent = {
  async sendMessage(payload: AgentSendPayload) {
    invocationCount += 1;
    return {
      success: true,
      finalMessage: `Echo: ${payload.message}`,
      latencyMs: 50,
      messages: [
        { role: "user", content: payload.message },
        { role: "assistant", content: `Echo: ${payload.message}` },
      ],
    };
  },
  async getStatus() {
    return baseStatus;
  },
  async reloadDocuments() {
    return baseStatus;
  },
};

const mockSummary: ConfigSummaryItem[] = [];

window.appConfig = {
  async getSummary() {
    return mockSummary;
  },
  async update() {
    return mockSummary;
  },
};

window.mcpClient = {
  async addServer() {
    return { success: true };
  },
  async removeServer() {
    return { success: true };
  },
  async getServerInfo() {
    return undefined;
  },
  async getAllServers() {
    return [];
  },
  async getAllTools() {
    return [
      {
        name: "mock_tool",
        description: "Mock tool",
        serverId: "mock",
      },
    ];
  },
  async executeTool() {
    return { success: true };
  },
  async findToolServer() {
    return undefined;
  },
  async getConnectedCount() {
    return 0;
  },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForText(target: string, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (document.body.textContent?.includes(target)) {
      return;
    }
    await wait(25);
  }
  throw new Error(`Timed out waiting for text: ${target}`);
}

async function main() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(<Chat />);
  await wait(50);

  const textarea = container.querySelector("textarea");
  if (!textarea) {
    throw new Error("Failed to locate chat input");
  }

  const prompt = "Test prompt from UI";
  textarea.value = prompt;
  textarea.dispatchEvent(new window.Event("input", { bubbles: true }));

  const buttons = Array.from(container.querySelectorAll("button"));
  const sendButton = buttons.find((btn) => btn.textContent?.trim() === "Send");
  if (!sendButton) {
    throw new Error("Failed to locate Send button");
  }
  sendButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

  await waitForText(`Echo: ${prompt}`);

  if (invocationCount !== 1) {
    throw new Error("Study agent was not invoked exactly once");
  }

  console.log(
    "✅ Frontend Chat view successfully invoked StudyAgentService mock"
  );
  root.unmount();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Frontend-Agent bridge test failed", error);
  process.exit(1);
});

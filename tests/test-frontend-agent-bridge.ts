import { JSDOM } from "jsdom";
import React, { act } from "react";
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

if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {
    // noop for tests
  };
}

if (
  !(window.HTMLElement.prototype as { attachEvent?: () => void }).attachEvent
) {
  (window.HTMLElement.prototype as { attachEvent?: () => void }).attachEvent =
    () => {
      // noop for legacy React event polyfills
    };
}

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

type AgentSendPayload = {
  threadId: string;
  message: string;
};

let invocationCount = 0;
let lastPayload: AgentSendPayload | null = null;

window.studyAgent = {
  async sendMessage(payload: AgentSendPayload) {
    invocationCount += 1;
    lastPayload = payload;
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
    await act(async () => {
      await wait(25);
    });
  }
  throw new Error(`Timed out waiting for text: ${target}`);
}

async function main() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(Chat));
    await wait(50);
  });

  const textarea = container.querySelector(
    "textarea"
  ) as HTMLTextAreaElement | null;
  if (!textarea) {
    throw new Error("Failed to locate chat input");
  }

  const quickActionButton = Array.from(
    container.querySelectorAll("button")
  ).find((btn) => btn.textContent?.includes("Summarize"));
  if (!quickActionButton) {
    throw new Error("Failed to locate Summarize quick action");
  }

  await act(async () => {
    quickActionButton.dispatchEvent(
      new window.MouseEvent("click", { bubbles: true })
    );
    await wait(0);
  });

  const prompt = textarea.value.trim();
  const expectedPrompt =
    "I need help summarizing a document. What should I do?";
  if (prompt !== expectedPrompt) {
    throw new Error("Quick action did not populate the expected prompt");
  }

  const buttons = Array.from(container.querySelectorAll("button"));
  const sendButton = buttons.find((btn) => btn.textContent?.trim() === "Send");
  if (!sendButton) {
    throw new Error("Failed to locate Send button");
  }
  if ((sendButton as HTMLButtonElement).disabled) {
    throw new Error("Send button is disabled; input change did not register");
  }

  await act(async () => {
    sendButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });

  await act(async () => {
    await wait(50);
  });

  if (invocationCount !== 1) {
    throw new Error("Study agent was not invoked exactly once");
  }
  if (!lastPayload || lastPayload.message !== prompt) {
    throw new Error("Study agent did not receive the expected prompt");
  }

  await waitForText(`Echo: ${prompt}`);

  console.log(
    "✅ Frontend Chat view successfully invoked StudyAgentService mock"
  );
  await act(async () => {
    root.unmount();
  });
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Frontend-Agent bridge test failed", error);
  process.exit(1);
});

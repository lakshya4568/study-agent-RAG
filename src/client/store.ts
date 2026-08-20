import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./types";

interface AuthState {
  user: User;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: {
        id: "local-user",
        username: "Scholar",
        email: "scholar@study.local",
        created_at: new Date().toISOString(),
      },
      isAuthenticated: true,
      setUser: (user) => set({ user }),
    }),
    {
      name: "auth-storage",
    }
  )
);

export interface ModelOption {
  id: string;
  name: string;
  provider: "groq" | "nvidia";
  description: string;
  tag: string;
  badge: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // Groq Models
  {
    id: "qwen/qwen3.6-27b",
    name: "Qwen 3.6 27B",
    provider: "groq",
    description: "Multimodal fast reasoning with thinking modes & tool use",
    tag: "⚡ Ultra-Fast",
    badge: "Groq",
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "groq",
    description: "High capacity open-weight model with strong comprehension",
    tag: "⚡ High Capacity",
    badge: "Groq",
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "groq",
    description: "Lightweight, highly responsive everyday assistant",
    tag: "⚡ Instant",
    badge: "Groq",
  },
  {
    id: "groq/compound",
    name: "Groq Compound",
    provider: "groq",
    description: "Advanced compound routing and MoE synthesis",
    tag: "⚡ Agentic MoE",
    badge: "Groq",
  },
  // NVIDIA NIM Models
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "nvidia",
    description: "State-of-the-art instruction following and problem solving",
    tag: "🟢 Flagship",
    badge: "NVIDIA",
  },
  {
    id: "deepseek-ai/deepseek-r1",
    name: "DeepSeek R1",
    provider: "nvidia",
    description: "Deep mathematical and algorithmic chain-of-thought reasoning",
    tag: "🟢 Deep Reasoning",
    badge: "NVIDIA",
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "Nemotron 70B",
    provider: "nvidia",
    description: "NVIDIA-tuned enterprise precision and structured output",
    tag: "🟢 Enterprise",
    badge: "NVIDIA",
  },
  {
    id: "meta/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B",
    provider: "nvidia",
    description: "Solid, reliable general tutoring and study synthesis",
    tag: "🟢 Balanced",
    badge: "NVIDIA",
  },
];

interface ChatState {
  activeThreadId: string | null;
  selectedDocument: string | null;
  theme: "dark" | "light" | "vibrant";
  isSidebarExpanded: boolean;
  selectedModel: string;
  selectedProvider: "groq" | "nvidia" | "auto";
  setActiveThreadId: (id: string | null) => void;
  setSelectedDocument: (doc: string | null) => void;
  setTheme: (theme: "dark" | "light" | "vibrant") => void;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setSelectedModel: (model: string, provider?: "groq" | "nvidia" | "auto") => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      activeThreadId: null,
      selectedDocument: null,
      theme: "dark",
      isSidebarExpanded: true,
      selectedModel: "qwen/qwen3.6-27b",
      selectedProvider: "groq",
      setActiveThreadId: (id) => set({ activeThreadId: id }),
      setSelectedDocument: (doc) => set({ selectedDocument: doc }),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
      setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),
      setSelectedModel: (model, provider) => {
        const found = AVAILABLE_MODELS.find((m) => m.id === model);
        const resolvedProvider = provider || found?.provider || "auto";
        set({ selectedModel: model, selectedProvider: resolvedProvider });
      },
    }),
    {
      name: "chat-storage",
    }
  )
);



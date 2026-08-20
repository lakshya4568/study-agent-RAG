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

interface ChatState {
  activeThreadId: string | null;
  selectedDocument: string | null;
  theme: "dark" | "light" | "vibrant";
  setActiveThreadId: (id: string | null) => void;
  setSelectedDocument: (doc: string | null) => void;
  setTheme: (theme: "dark" | "light" | "vibrant") => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      activeThreadId: null,
      selectedDocument: null,
      theme: "dark",
      setActiveThreadId: (id) => set({ activeThreadId: id }),
      setSelectedDocument: (doc) => set({ selectedDocument: doc }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "chat-storage",
    }
  )
);


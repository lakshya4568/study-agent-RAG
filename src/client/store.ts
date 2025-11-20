import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./DatabaseManager";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "auth-storage",
    }
  )
);

interface ChatState {
  activeThreadId: string | null;
  selectedDocument: string | null;
  setActiveThreadId: (id: string | null) => void;
  setSelectedDocument: (doc: string | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      activeThreadId: null,
      selectedDocument: null,
      setActiveThreadId: (id) => set({ activeThreadId: id }),
      setSelectedDocument: (doc) => set({ selectedDocument: doc }),
    }),
    {
      name: "chat-storage",
    }
  )
);

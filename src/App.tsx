import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Blocks,
  Settings2,
} from "lucide-react";
import { MainLayout, Sidebar } from "./components/layout";
import { Chat } from "./views/Chat";
import { ServerManager } from "./views/ServerManager";
import { Settings } from "./views/Settings";
import { useChatStore } from "./client/store";

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<
    "chat" | "servers" | "settings"
  >("chat");

  const { theme } = useChatStore();

  // Sync theme to root html element
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("theme-light", "light");
    } else {
      document.documentElement.classList.remove("theme-light", "light");
      document.documentElement.classList.add("dark");
    }
  }, [theme]);

  const chatActionsRef = useRef<{
    createNewThread: () => void;
  }>({
    createNewThread: () => {
      /* default no-op */
    },
  });

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveView("chat");
        } else if (e.key === "2") {
          e.preventDefault();
          setActiveView("servers");
        } else if (e.key === "3") {
          e.preventDefault();
          setActiveView("settings");
        } else if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          chatActionsRef.current.createNewThread();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sidebarItems = [
    {
      id: "chat",
      icon: MessageSquare,
      label: "Study Chat",
      description: "Cognitive Partner",
      shortcut: "⌘1",
      onClick: () => setActiveView("chat"),
      active: activeView === "chat",
    },
    {
      id: "servers",
      icon: Blocks,
      label: "MCP Tools",
      description: "Agent Skills",
      shortcut: "⌘2",
      onClick: () => setActiveView("servers"),
      active: activeView === "servers",
    },
    {
      id: "settings",
      icon: Settings2,
      label: "Settings",
      description: "Keys, Memory & Vectors",
      shortcut: "⌘3",
      onClick: () => setActiveView("settings"),
      active: activeView === "settings",
    },
  ];

  return (
    <MainLayout
      sidebar={
        <Sidebar
          items={sidebarItems}
          onNewSession={() => {
            setActiveView("chat");
            chatActionsRef.current.createNewThread();
          }}
          onSelectThread={() => {
            setActiveView("chat");
          }}
        />
      }
    >
      {activeView === "chat" && (
        <Chat
          onRegisterActions={(actions) => {
            chatActionsRef.current = actions;
          }}
        />
      )}
      {activeView === "servers" && <ServerManager />}
      {activeView === "settings" && <Settings />}
    </MainLayout>
  );
};

export default App;


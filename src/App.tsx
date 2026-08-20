import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  FlaskConical,
  Blocks,
  Settings2,
} from "lucide-react";
import { MainLayout, Sidebar } from "./components/layout";
import { Chat } from "./views/Chat";
import { ServerManager } from "./views/ServerManager";
import { Settings } from "./views/Settings";
import { RAGDashboard } from "./views/RAGDashboard";

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<
    "chat" | "rag-dashboard" | "servers" | "settings"
  >("chat");

  const chatActionsRef = useRef<{
    createNewThread: () => void;
  }>({
    createNewThread: () => {},
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
          setActiveView("rag-dashboard");
        } else if (e.key === "3") {
          e.preventDefault();
          setActiveView("servers");
        } else if (e.key === "4") {
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
      id: "rag-dashboard",
      icon: FlaskConical,
      label: "Vector Studio",
      description: "RAG & Embeddings",
      shortcut: "⌘2",
      onClick: () => setActiveView("rag-dashboard"),
      active: activeView === "rag-dashboard",
    },
    {
      id: "servers",
      icon: Blocks,
      label: "MCP Tools",
      description: "Agent Skills",
      shortcut: "⌘3",
      onClick: () => setActiveView("servers"),
      active: activeView === "servers",
    },
    {
      id: "settings",
      icon: Settings2,
      label: "Control Studio",
      description: "Keys & Memory",
      shortcut: "⌘4",
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
      {activeView === "rag-dashboard" && <RAGDashboard />}
      {activeView === "servers" && <ServerManager />}
      {activeView === "settings" && <Settings />}
    </MainLayout>
  );
};

export default App;

import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Brain,
  FlaskConical,
  Blocks,
  Settings2,
  Plus,
  History as HistoryIcon,
  Sparkles,
} from "lucide-react";
import { MainLayout, Sidebar, TopBar } from "./components/layout";
import { Badge, Button } from "./components/ui";
import { Chat } from "./views/Chat";
import { FlashcardsView } from "./views/FlashcardsView";
import { ServerManager } from "./views/ServerManager";
import { Settings } from "./views/Settings";
import { RAGDashboard } from "./views/RAGDashboard";

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<
    "chat" | "rag-dashboard" | "servers" | "settings"
  >("chat");

  const chatActionsRef = useRef<{
    createNewThread: () => void;
    openHistory: () => void;
  }>({
    createNewThread: () => {},
    openHistory: () => {},
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

  const topBarActions = (
    <div className="flex items-center gap-2">
      {activeView === "chat" && (
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => chatActionsRef.current.createNewThread()}
            className="rounded-full text-xs font-semibold px-3.5 bg-secondary hover:bg-secondary/80 border border-border shadow-xs cursor-pointer"
          >
            New Session
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<HistoryIcon className="w-3.5 h-3.5" />}
            onClick={() => chatActionsRef.current.openHistory()}
            className="rounded-full text-xs font-medium px-3 bg-secondary hover:bg-secondary/80 border border-border shadow-xs cursor-pointer"
          >
            History
          </Button>
        </>
      )}

      <Badge
        variant="outline"
        size="sm"
        className="hidden sm:inline-flex gap-1 rounded-full text-primary border-primary/30 bg-primary/10 text-[11px] font-semibold"
      >
        <Sparkles className="w-3 h-3" /> Grounded Agent
      </Badge>
    </div>
  );

  return (
    <MainLayout
      sidebar={
        <Sidebar
          items={sidebarItems}
          onNewSession={() => {
            setActiveView("chat");
            chatActionsRef.current.createNewThread();
          }}
        />
      }
      topBar={
        <TopBar
          title={
            activeView === "chat"
              ? "Study Session"
              : activeView === "rag-dashboard"
                ? "Vector Knowledge Studio"
                : activeView === "servers"
                  ? "MCP Tool Integrations"
                  : "Control Studio"
          }
          subtitle={
            activeView === "chat"
              ? "Autonomous AI Tutor"
              : activeView === "rag-dashboard"
                ? "ChromaDB & NVIDIA NIM"
                : activeView === "servers"
                  ? "Local Protocol Servers"
                  : "Configurations & Long-Term Memory"
          }
          actions={topBarActions}
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

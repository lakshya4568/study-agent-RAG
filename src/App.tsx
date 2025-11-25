import React, { useState, useRef } from "react";
import {
  MessageSquare,
  Blocks,
  Settings2,
  Zap,
  Plus,
  History as HistoryIcon,
} from "lucide-react";
import { MainLayout, Sidebar, TopBar } from "./components/layout";
import { Badge, Button } from "./components/ui";
import { Chat } from "./views/Chat";
import { ServerManager } from "./views/ServerManager";
import { Settings } from "./views/Settings";
import { Login } from "./views/Login";
import { Signup } from "./views/Signup";
import { useAuthStore } from "./client/store";

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<"chat" | "servers" | "settings">(
    "chat"
  );
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const { isAuthenticated, logout } = useAuthStore();

  const chatActionsRef = useRef<{
    createNewThread: () => void;
    openHistory: () => void;
  }>({
    createNewThread: () => { },
    openHistory: () => { },
  });

  if (!isAuthenticated) {
    return authView === "login" ? (
      <Login onNavigateToSignup={() => setAuthView("signup")} />
    ) : (
      <Signup onNavigateToLogin={() => setAuthView("login")} />
    );
  }

  const sidebarItems = [
    {
      id: "chat",
      icon: MessageSquare,
      label: "Study Chat",
      description: "AI Assistant",
      onClick: () => setActiveView("chat"),
      active: activeView === "chat",
    },
    {
      id: "servers",
      icon: Blocks,
      label: "Tools",
      description: "Integrations",
      onClick: () => setActiveView("servers"),
      active: activeView === "servers",
    },
    {
      id: "settings",
      icon: Settings2,
      label: "Settings",
      description: "Configuration",
      onClick: () => setActiveView("settings"),
      active: activeView === "settings",
    },
  ];

  const topBarActions = (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<Plus className="w-4 h-4" />}
        onClick={() => chatActionsRef.current.createNewThread()}
        className="rounded-full bg-background/50 backdrop-blur-sm border border-border/50 shadow-sm hover:bg-background hover:shadow-md transition-all duration-200"
      >
        New Chat
      </Button>
      <Button
        variant="ghost"
        size="sm"
        icon={<HistoryIcon className="w-4 h-4" />}
        onClick={() => chatActionsRef.current.openHistory()}
        className="rounded-full bg-background/50 backdrop-blur-sm border border-border/50 shadow-sm hover:bg-background hover:shadow-md transition-all duration-200"
      >
        History
      </Button>
      <Badge variant="outline" size="sm" className="gap-1.5 bg-background/50 backdrop-blur-sm rounded-full">
        <Zap className="w-3 h-3 text-yellow-500" />
        Pro Plan
      </Badge>
    </>
  );

  return (
    <MainLayout
      sidebar={
        <Sidebar
          items={sidebarItems}
          onLogout={logout}
        />
      }
      topBar={
        <TopBar
          title="StudyBuddy"
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
      {activeView === "servers" && <ServerManager />}
      {activeView === "settings" && <Settings />}
    </MainLayout>
  );
};

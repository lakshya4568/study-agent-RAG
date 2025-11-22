import React, { useState } from "react";
import {
  MessageSquare,
  Blocks,
  Sparkles,
  LogOut,
  Zap,
} from "lucide-react";
import { MainLayout, Sidebar, TopBar } from "./components/layout";
import { Badge } from "./components/ui";
import { Chat } from "./views/Chat";
import { ServerManager } from "./views/ServerManager";
import { AgentConsole } from "./views/AgentConsole";
import { Login } from "./views/Login";
import { Signup } from "./views/Signup";
import { ChatSidebar } from "./views/ChatSidebar";
import { useAuthStore } from "./client/store";

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<"chat" | "servers" | "agent">(
    "chat"
  );
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const { isAuthenticated, logout } = useAuthStore();

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
      id: "agent",
      icon: Sparkles,
      label: "My Buddy",
      description: "Settings",
      onClick: () => setActiveView("agent"),
      active: activeView === "agent",
    },
  ];

  const topBarActions = (
    <>
      <Badge variant="outline" size="sm" className="gap-1.5 bg-background/50 backdrop-blur-sm rounded-full">
        <Zap className="w-3 h-3 text-yellow-500" />
        Pro Plan
      </Badge>
    </>
  );

  return (
    <MainLayout
      sidebar={
        <div className="flex h-full">
          <Sidebar
            items={sidebarItems}
            onLogout={logout}
          />
          {activeView === "chat" && <ChatSidebar />}
        </div>
      }
      topBar={
        <TopBar
          title={
            activeView === "chat"
              ? "Study Chat"
              : activeView === "servers"
                ? "Tools & Integrations"
                : "My Study Buddy"
          }
          actions={topBarActions}
        />
      }
    >
      {activeView === "chat" && <Chat />}
      {activeView === "servers" && <ServerManager />}
      {activeView === "agent" && <AgentConsole />}
    </MainLayout>
  );
};

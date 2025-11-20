import React, { useState } from "react";
import {
  MessageSquare,
  Server,
  Activity,
  Settings,
  LogOut,
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
  const { isAuthenticated, user, logout } = useAuthStore();

  if (!isAuthenticated) {
    return authView === "login" ? (
      <Login onNavigateToSignup={() => setAuthView("signup")} />
    ) : (
      <Signup onNavigateToLogin={() => setAuthView("login")} />
    );
  }

  const sidebarHeader = (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-500 to-green-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/30">
        🎓
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Study Agent</h1>
        <p className="text-xs text-emerald-600 font-medium">
          {user?.username || "AI-Powered Learning"}
        </p>
      </div>
    </div>
  );

  const sidebarFooter = (
    <div className="space-y-2">
      <div className="px-4 py-3 rounded-xl bg-linear-to-r from-emerald-50 to-green-50 border border-emerald-200">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
          <span className="text-emerald-700 font-medium">System Online</span>
        </div>
      </div>
      <button
        onClick={logout}
        className="w-full px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors flex items-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );

  const sidebarItems = [
    {
      id: "chat",
      icon: MessageSquare,
      label: "Chat",
      description: "AI Study Assistant",
      onClick: () => setActiveView("chat"),
      active: activeView === "chat",
    },
    {
      id: "servers",
      icon: Server,
      label: "Servers",
      description: "Manage MCP Servers",
      onClick: () => setActiveView("servers"),
      active: activeView === "servers",
    },
    {
      id: "agent",
      icon: Settings,
      label: "Agent Console",
      description: "Status & configuration",
      onClick: () => setActiveView("agent"),
      active: activeView === "agent",
    },
  ];

  const topBarActions = (
    <>
      <Badge variant="info" size="md" animate>
        <Activity className="w-3 h-3 mr-1" />
        Active
      </Badge>
    </>
  );

  return (
    <MainLayout
      sidebar={
        <div className="flex h-full">
          <Sidebar
            items={sidebarItems}
            header={sidebarHeader}
            footer={sidebarFooter}
          />
          {activeView === "chat" && <ChatSidebar />}
        </div>
      }
      topBar={
        <TopBar
          title={
            activeView === "chat"
              ? "Study Assistant"
              : activeView === "servers"
                ? "MCP Servers"
                : "Agent Console"
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

import React, { useState } from "react";
import { MessageSquare, Server, Activity, Settings } from "lucide-react";
import { MainLayout, Sidebar, TopBar } from "./components/layout";
import { Badge } from "./components/ui";
import { Chat } from "./views/Chat";
import { ServerManager } from "./views/ServerManager";
import { AgentConsole } from "./views/AgentConsole";

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<"chat" | "servers" | "agent">(
    "chat"
  );

  const sidebarHeader = (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-500 to-green-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/30">
        🎓
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Study Agent</h1>
        <p className="text-xs text-emerald-600 font-medium">
          AI-Powered Learning
        </p>
      </div>
    </div>
  );

  const sidebarFooter = (
    <div className="px-4 py-3 rounded-xl bg-linear-to-r from-emerald-50 to-green-50 border border-emerald-200">
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
        <span className="text-emerald-700 font-medium">System Online</span>
      </div>
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
        <Sidebar
          items={sidebarItems}
          header={sidebarHeader}
          footer={sidebarFooter}
        />
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

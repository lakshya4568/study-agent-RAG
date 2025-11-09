import React, { useState } from 'react';
import { MessageSquare, Server, Activity } from 'lucide-react';
import { MainLayout, Sidebar, TopBar } from './components/layout';
import { Badge } from './components/ui';
import { Chat } from './views/Chat';
import { ServerManager } from './views/ServerManager';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'chat' | 'servers'>('chat');

  const sidebarHeader = (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg">
        🎓
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900">Study Agent</h1>
        <p className="text-xs text-purple-600">AI-Powered Learning</p>
      </div>
    </div>
  );

  const sidebarFooter = (
    <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
        <span className="text-green-700 font-medium">System Online</span>
      </div>
    </div>
  );

  const sidebarItems = [
    {
      id: 'chat',
      icon: MessageSquare,
      label: 'Chat',
      description: 'AI Study Assistant',
      onClick: () => setActiveView('chat'),
      active: activeView === 'chat',
    },
    {
      id: 'servers',
      icon: Server,
      label: 'Servers',
      description: 'Manage MCP Servers',
      onClick: () => setActiveView('servers'),
      active: activeView === 'servers',
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
          title={activeView === 'chat' ? 'Study Assistant' : 'MCP Servers'}
          actions={topBarActions}
        />
      }
    >
      {activeView === 'chat' ? <Chat /> : <ServerManager />}
    </MainLayout>
  );
};

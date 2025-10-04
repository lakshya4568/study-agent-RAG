import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Server } from 'lucide-react';
import { Chat } from './ChatNew';
import { ServerManager } from './ServerManager';
import { cn } from '../lib/utils';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'chat' | 'servers'>('chat');

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Top Navigation */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 z-50 flex items-center gap-2 px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-gray-200"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveView('chat')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg",
            activeView === 'chat'
              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
              : "bg-white text-gray-600 hover:text-gray-900 hover:shadow-xl"
          )}
        >
          <MessageSquare className="w-5 h-5" />
          Chat
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveView('servers')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg",
            activeView === 'servers'
              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
              : "bg-white text-gray-600 hover:text-gray-900 hover:shadow-xl"
          )}
        >
          <Server className="w-5 h-5" />
          Servers
        </motion.button>
      </motion.div>

      {/* Main Content */}
      <div className="h-full w-full pt-20">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="h-full w-full"
        >
          {activeView === 'chat' ? <Chat /> : <ServerManager />}
        </motion.div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from "react";
import { useChatStore, useAuthStore } from "../client/store";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { ConversationThread } from "../client/DatabaseManager";

export const ChatSidebar: React.FC = () => {
  const { activeThreadId, setActiveThreadId } = useChatStore();
  const { user } = useAuthStore();
  const [threads, setThreads] = useState<ConversationThread[]>([]);

  useEffect(() => {
    if (user) {
      loadThreads();
    }
  }, [user]);

  const loadThreads = async () => {
    if (!user) return;
    const result = await window.db.getThreads(user.id);
    if (result.success && result.threads) {
      setThreads(result.threads);
    }
  };

  const createNewThread = async () => {
    if (!user) return;
    const id = crypto.randomUUID();
    const title = "New Chat";
    await window.db.createThread(id, title, user.id);
    setActiveThreadId(id);
    loadThreads();
  };

  const deleteThread = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await window.db.deleteThread(id);
    if (activeThreadId === id) {
      setActiveThreadId(null);
    }
    loadThreads();
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      <div className="p-4">
        <button
          onClick={createNewThread}
          className="w-full flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => setActiveThreadId(thread.id)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition-colors group ${
              activeThreadId === thread.id ? "bg-gray-800" : ""
            }`}
          >
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <div className="flex-1 truncate">
              <div className="text-sm font-medium text-gray-200 truncate">
                {thread.title}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(thread.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div
              onClick={(e) => deleteThread(e, thread.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

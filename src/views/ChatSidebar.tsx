import React, { useEffect, useState } from "react";
import { useChatStore, useAuthStore } from "../client/store";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { ConversationThread } from "../client/types";
import { cn } from "../lib/utils";

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
    <div className="w-64 bg-muted/30 border-r border-border flex flex-col h-full">
      <div className="p-4">
        <button
          onClick={createNewThread}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl transition-all shadow-md shadow-primary/20 font-medium"
        >
          <Plus className="w-5 h-5" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3">
        <div className="space-y-1">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => setActiveThreadId(thread.id)}
              className={cn(
                "w-full text-left px-4 py-3 flex items-center gap-3 rounded-xl transition-all group relative overflow-hidden",
                activeThreadId === thread.id
                  ? "bg-background shadow-sm border border-border/50"
                  : "hover:bg-background/50 hover:shadow-sm"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
                activeThreadId === thread.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <MessageSquare className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "text-sm font-medium truncate transition-colors",
                  activeThreadId === thread.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}>
                  {thread.title}
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {new Date(thread.created_at).toLocaleDateString()}
                </div>
              </div>
              
              <div
                onClick={(e) => deleteThread(e, thread.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-all"
                title="Delete Chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

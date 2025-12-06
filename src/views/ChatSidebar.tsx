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
    await window.db.createThread(id, "New Chat", user.id);
    setActiveThreadId(id);
    loadThreads();
  };
  const generateTitleFromMessages = (
    messages: Array<{ role: string; content: string }>
  ): string => {
    const firstUserMessage = messages.find((m) => m.role === "user");
    if (firstUserMessage && firstUserMessage.content.trim()) {
      const text = firstUserMessage.content.trim().replace(/\s+/g, " ");
      return text.length > 40 ? `${text.slice(0, 40)}...` : text;
    }
    return "New Chat";
  };

  const hydrateTitles = async () => {
    if (!user) return;
    // Fetch threads and their first message to derive titles
    const result = await window.db.getThreads(user.id);
    if (!(result.success && result.threads)) return;

    const updatedThreads: ConversationThread[] = [];

    for (const thread of result.threads) {
      const messages = await window.db.getMessages(thread.id);
      if (
        messages.success &&
        messages.messages &&
        messages.messages.length > 0
      ) {
        const derivedTitle = generateTitleFromMessages(
          messages.messages.map((m) => ({ role: m.role, content: m.content }))
        );
        if (derivedTitle !== thread.title) {
          await window.db.updateThreadTitle(thread.id, derivedTitle);
          updatedThreads.push({ ...thread, title: derivedTitle });
          continue;
        }
      }
      updatedThreads.push(thread);
    }

    setThreads(updatedThreads);
        </button>
      const hydrateTitles = async () => {
        if (!user) return;
        const result = await window.db.getThreads(user.id);
        if (!(result.success && result.threads)) return;

        const updatedThreads: ConversationThread[] = [];

        for (const thread of result.threads) {
          const messages = await window.db.getMessages(thread.id);
          if (messages.success && messages.messages && messages.messages.length > 0) {
            const derivedTitle = generateTitleFromMessages(messages.messages.map((m) => ({ role: m.role, content: m.content })));
            if (derivedTitle !== thread.title) {
              await window.db.updateThreadTitle(thread.id, derivedTitle);
              updatedThreads.push({ ...thread, title: derivedTitle });
              continue;
            }
          }
          updatedThreads.push(thread);
        }

        setThreads(updatedThreads);
      };

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
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  activeThreadId === thread.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <MessageSquare className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-sm font-medium truncate transition-colors",
                    activeThreadId === thread.id
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
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

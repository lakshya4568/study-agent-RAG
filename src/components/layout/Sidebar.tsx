import React, { useState, useEffect, useCallback } from "react";
import { cn } from "../../lib/utils";
import {
  LucideIcon,
  Plus,
  History,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Trash2,
  Search,
} from "lucide-react";
import { useChatStore, useAuthStore } from "../../client/store";

interface SidebarProps {
  items: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    description?: string;
    shortcut?: string;
    onClick: () => void;
    active?: boolean;
  }>;
  onNewSession?: () => void;
  onOpenHistory?: () => void;
  onSelectThread?: (threadId: string) => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  onNewSession,
  onOpenHistory,
  onSelectThread,
  className,
}) => {
  const { isSidebarExpanded, toggleSidebar, activeThreadId, setActiveThreadId } = useChatStore();
  const { user } = useAuthStore();
  const [threads, setThreads] = useState<Array<{ id: string; title: string; created_at: number }>>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const loadThreads = useCallback(async () => {
    try {
      if (window.db?.getThreads) {
        const res = await window.db.getThreads(user?.id || "local-user");
        if (res.success && res.threads) {
          setThreads(res.threads);
        }
      }
    } catch (err) {
      console.error("Failed to load threads in sidebar:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadThreads();
    const interval = setInterval(loadThreads, 3000);
    return () => clearInterval(interval);
  }, [loadThreads, activeThreadId]);

  const handleDeleteThread = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    try {
      if (window.db?.deleteThread) {
        await window.db.deleteThread(threadId);
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (activeThreadId === threadId) {
          setActiveThreadId(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete thread:", err);
    }
  };

  const filteredThreads = threads.filter((t) =>
    (t.title || "Untitled Session").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      className={cn(
        "h-full flex flex-col py-3 bg-background border-r border-border select-none shrink-0 justify-between z-40 relative transition-[width] duration-200 ease-in-out",
        isSidebarExpanded ? "w-64 px-3" : "w-[60px] px-2 items-center",
        className
      )}
    >
      {/* Top Section: Brand Header & + New Session */}
      <div className="flex flex-col gap-2.5 w-full min-h-0 flex-1 overflow-hidden">
        {/* Brand Header */}
        <div
          className={cn(
            "flex items-center gap-2.5 px-1 py-1 shrink-0",
            isSidebarExpanded ? "justify-between" : "justify-center"
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            {/* 8-pointed geometric emblem */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-pointer shrink-0"
              title="Study Agent PRO"
              onClick={toggleSidebar}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-foreground"
              >
                <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
                <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.15" />
              </svg>
            </div>

            {isSidebarExpanded && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold tracking-tight text-foreground truncate">
                  Study Agent
                </span>
                <span className="text-[10px] text-muted-foreground truncate font-mono">
                  Autonomous Tutor
                </span>
              </div>
            )}
          </div>

          {isSidebarExpanded && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* + New Button */}
        {isSidebarExpanded ? (
          <button
            type="button"
            onClick={onNewSession}
            className="w-full h-9 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-between transition-all border border-border/80 shadow-xs active:scale-[0.98] cursor-pointer group shrink-0"
            title="New Study Session (⌘N)"
          >
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
              <span>New Session</span>
            </div>
            <span className="text-[10px] text-muted-foreground/80 font-mono bg-background/50 px-1.5 py-0.5 rounded border border-border/40">
              ⌘N
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onNewSession}
            className="w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center transition-all border border-border shadow-xs hover:scale-105 active:scale-95 cursor-pointer group shrink-0"
            title="New Study Session (⌘N)"
          >
            <Plus className="w-4 h-4 text-foreground group-hover:rotate-90 transition-transform duration-200" />
          </button>
        )}

        <div className="w-full h-[1px] bg-border/50 my-0.5 shrink-0" />

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 w-full shrink-0">
          {items.map((item) => {
            const Icon = item.icon;
            if (isSidebarExpanded) {
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    "w-full h-8 px-2.5 rounded-xl flex items-center justify-between transition-all duration-150 relative cursor-pointer text-left",
                    item.active
                      ? "bg-secondary text-foreground font-semibold shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                  title={item.label}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={cn("w-4 h-4 shrink-0", item.active ? "text-primary" : "")} />
                    <span className="text-xs truncate">{item.label}</span>
                  </div>
                  {item.shortcut && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              );
            }

            return (
              <button
                type="button"
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 relative group cursor-pointer",
                  item.active
                    ? "bg-secondary text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
                title={`${item.label} ${item.shortcut ? `(${item.shortcut})` : ""}`}
              >
                {item.active && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
                )}
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </nav>

        {/* Recent Session History Section (Expanded View) */}
        {isSidebarExpanded && (
          <div className="flex flex-col min-h-0 flex-1 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between px-1.5 pb-1.5 shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Recent Sessions
              </span>
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                {threads.length}
              </span>
            </div>

            {/* Scrollable Session List */}
            <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
              {filteredThreads.length === 0 ? (
                <div className="text-center py-6 px-2 text-muted-foreground/50 text-[11px]">
                  No past sessions yet. Start a conversation above!
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isActive = activeThreadId === thread.id;
                  return (
                    <div
                      key={thread.id}
                      onClick={() => {
                        setActiveThreadId(thread.id);
                        if (onSelectThread) onSelectThread(thread.id);
                      }}
                      className={cn(
                        "group w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer text-left",
                        isActive
                          ? "bg-secondary text-foreground font-medium border border-border/60"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                      )}
                      title={thread.title}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare
                          className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground/60"
                          )}
                        />
                        <span className="truncate text-xs">
                          {thread.title || "Untitled Session"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteThread(e, thread.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded transition-opacity shrink-0 ml-1 cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Telemetry / Status Indicator & Expand Toggle */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/40 w-full shrink-0">
        {isSidebarExpanded ? (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-secondary/50 border border-border/40">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ring-2 ring-emerald-400/20 animate-pulse" />
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-semibold text-foreground truncate">
                  Groq & NVIDIA
                </span>
                <span className="text-[9px] text-muted-foreground font-mono truncate">
                  Engines Active
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer relative"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-background" />
          </button>
        )}
      </div>
    </aside>
  );
};

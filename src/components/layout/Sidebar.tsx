import React, { useState, useEffect, useCallback } from "react";
import { cn } from "../../lib/utils";
import {
  LucideIcon,
  Plus,
  PanelLeftClose,
  MessageSquare,
  Trash2,
  Sun,
  Moon,
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
  onSelectThread?: (threadId: string) => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  onNewSession,
  onSelectThread,
  className,
}) => {
  const {
    isSidebarExpanded,
    toggleSidebar,
    activeThreadId,
    setActiveThreadId,
    threads,
    loadThreads,
    deleteSession,
    theme,
    setTheme,
  } = useChatStore();
  const [searchQuery] = useState("");

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("theme-light", "light");
    } else {
      setTheme("dark");
      document.documentElement.classList.remove("theme-light", "light");
      document.documentElement.classList.add("dark");
    }
  };

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleDeleteThread = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    await deleteSession(threadId);
  };

  const filteredThreads = threads.filter((t) =>
    (t.title || "Untitled Session").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      className={cn(
        "h-full flex flex-col py-3 bg-card border-r border-border/40 select-none shrink-0 justify-between z-40 relative transition-[width] duration-200 ease-in-out shadow-sm",
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
            {/* Tactile 8-pointed geometric emblem */}
            <div
              className="w-9 h-9 rounded-xl neu-raised-sm flex items-center justify-center text-foreground hover:brightness-105 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Study Agent"
              onClick={toggleSidebar}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4.5 h-4.5 text-primary"
              >
                <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
                <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
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
              className="w-7 h-7 rounded-lg neu-raised-sm flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* + New Session Button */}
        {isSidebarExpanded ? (
          <button
            type="button"
            onClick={onNewSession}
            className="w-full h-9 px-3 rounded-xl neu-convex text-foreground flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer group shrink-0 border border-border/40"
            title="New Study Session (⌘N)"
          >
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <Plus className="w-3.5 h-3.5 text-primary group-hover:rotate-90 transition-transform duration-200" />
              <span>New Session</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono neu-inset-sm px-1.5 py-0.5 rounded">
              ⌘N
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onNewSession}
            className="w-9 h-9 rounded-full neu-convex text-foreground flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer group shrink-0 border border-border/40"
            title="New Study Session (⌘N)"
          >
            <Plus className="w-4 h-4 text-primary group-hover:rotate-90 transition-transform duration-200" />
          </button>
        )}

        <div className="w-full h-[1px] bg-border/40 my-0.5 shrink-0" />

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5 w-full shrink-0">
          {items.map((item) => {
            const Icon = item.icon;
            if (isSidebarExpanded) {
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    "w-full h-8.5 px-3 rounded-xl flex items-center justify-between transition-all duration-150 relative cursor-pointer text-left select-none",
                    item.active
                      ? "neu-convex text-foreground font-semibold border border-border/60 shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                  title={item.label}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={cn("w-4 h-4 shrink-0", item.active ? "text-primary" : "text-muted-foreground/70")} />
                    <span className="text-xs truncate">{item.label}</span>
                  </div>
                  {item.shortcut && (
                    <span className="text-[10px] text-muted-foreground/50 font-mono">
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
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 relative group cursor-pointer select-none",
                  item.active
                    ? "neu-convex text-primary font-semibold border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
                title={`${item.label} ${item.shortcut ? `(${item.shortcut})` : ""}`}
              >
                <Icon className={cn("w-4 h-4", item.active ? "text-primary" : "")} />
              </button>
            );
          })}
        </nav>

        {/* Recent Session History Section (Expanded View) */}
        {isSidebarExpanded && (
          <div className="flex flex-col min-h-0 flex-1 pt-2.5 border-t border-border/40">
            <div className="flex items-center justify-between px-1.5 pb-1.5 shrink-0">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                Recent Sessions
              </span>
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                {threads.length}
              </span>
            </div>

            {/* Scrollable Session List */}
            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
              {filteredThreads.length === 0 ? (
                <div className="text-center py-6 px-2 text-muted-foreground/45 text-[11px]">
                  No past sessions yet.
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
                        "group w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer text-left select-none",
                        isActive
                          ? "neu-inset-sm text-foreground font-semibold border border-border/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      )}
                      title={thread.title}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare
                          className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground/50"
                          )}
                        />
                        <span className="truncate text-xs">
                          {thread.title || "Untitled Session"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteThread(e, thread.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-400 rounded transition-opacity shrink-0 ml-1 cursor-pointer"
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

      {/* Bottom Section: Theme Toggle Button */}
      <div className="pt-2 border-t border-border/40 w-full shrink-0">
        {isSidebarExpanded ? (
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full h-8.5 px-3 rounded-xl flex items-center gap-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all cursor-pointer text-xs font-medium"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span className="truncate">
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all cursor-pointer"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-emerald-500" />
            )}
          </button>
        )}
      </div>
    </aside>
  );
};



import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import {
  LucideIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";

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
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  onNewSession,
  className,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside
      initial={{ width: 240 }}
      animate={{ width: isCollapsed ? 76 : 240 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "flex flex-col h-full bg-card border-r border-border shadow-md z-40 relative select-none",
        className
      )}
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3.5 top-6 bg-card border border-border rounded-full p-1 shadow-md hover:bg-secondary transition-all z-50 text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Header / Brand */}
      <div
        className={cn(
          "p-4 pb-3 flex items-center",
          isCollapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/25 shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>

        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-foreground">
                  Lumina Study
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-normal">
                Cognitive Study OS
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* + New Button (Claude style) */}
      <div className="px-3 pt-1 pb-2">
        <button
          onClick={onNewSession}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/70 text-foreground font-medium text-xs transition-all border border-border shadow-sm active:scale-98 group cursor-pointer",
            isCollapsed ? "justify-center px-0" : ""
          )}
          title="New Study Session (⌘N)"
        >
          <Plus className="w-4 h-4 text-primary group-hover:rotate-90 transition-transform duration-200 shrink-0" />
          {!isCollapsed && (
            <div className="flex-1 flex items-center justify-between">
              <span>New Session</span>
              <kbd className="text-[10px] font-mono text-muted-foreground/60 px-1 py-0.5 rounded bg-background/50 border border-border/40">
                ⌘N
              </kbd>
            </div>
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-150 group text-left cursor-pointer",
                item.active
                  ? "bg-primary text-primary-foreground font-medium shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 font-normal",
                isCollapsed ? "justify-center px-0" : ""
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  item.active
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <span className="text-xs truncate">{item.label}</span>
                  {item.shortcut && (
                    <span
                      className={cn(
                        "text-[9px] font-mono ml-1 px-1.5 py-0.5 rounded",
                        item.active
                          ? "text-primary-foreground/80 bg-white/20"
                          : "text-muted-foreground/50 bg-secondary/50 border border-border/30"
                      )}
                    >
                      {item.shortcut}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Telemetry */}
      <div className="p-3 border-t border-border/60">
        <div
          className={cn(
            "p-2.5 rounded-xl bg-secondary/40 border border-border/40 flex items-center gap-2.5",
            isCollapsed ? "justify-center" : ""
          )}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-400/20 shrink-0" />
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-foreground truncate">
                  NVIDIA NIM
                </span>
                <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                RAG Engine Connected
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};



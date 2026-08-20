import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import {
  LucideIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Layers,
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
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ items, className }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside
      initial={{ width: 250 }}
      animate={{ width: isCollapsed ? 76 : 250 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex flex-col h-full bg-card/60 backdrop-blur-xl border-r border-border/40 shadow-2xl z-40 relative select-none",
        className
      )}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3.5 top-7 bg-card border border-border/80 rounded-full p-1.5 shadow-lg hover:bg-muted transition-all z-50 text-muted-foreground hover:text-foreground active:scale-95"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Header Brand */}
      <div className={cn("p-5 pb-4 flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-emerald-400 to-teal-500 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 ring-1 ring-white/20 shrink-0">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
        </div>

        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-base tracking-tight text-foreground">
                  Study OS
                </h1>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/80 font-medium">
                Cognitive AI Workspace
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto custom-scrollbar">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 group relative text-left",
                item.active
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium",
                isCollapsed ? "justify-center px-0" : ""
              )}
              title={isCollapsed ? item.label : undefined}
            >
              {/* Active Indicator Bar */}
              {item.active && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  item.active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "bg-muted/50 text-muted-foreground group-hover:text-foreground group-hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div className="truncate">
                    <span className="text-sm block truncate">{item.label}</span>
                    {item.description && (
                      <span className="text-[11px] text-muted-foreground/70 block truncate">
                        {item.description}
                      </span>
                    )}
                  </div>
                  {item.shortcut && (
                    <span className="text-[10px] font-mono text-muted-foreground/50 ml-1 px-1.5 py-0.5 rounded bg-muted/40 border border-border/30">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Telemetry */}
      <div className="p-3 border-t border-border/40 space-y-2">
        <div
          className={cn(
            "p-3 rounded-2xl bg-muted/30 border border-border/30 flex items-center gap-2.5",
            isCollapsed ? "justify-center" : ""
          )}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-400/20 shrink-0" />
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground truncate">
                  NVIDIA AI Engine
                </span>
                <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                RAG Pipeline Active
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};


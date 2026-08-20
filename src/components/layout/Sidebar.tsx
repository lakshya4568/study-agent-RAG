import React from "react";
import { cn } from "../../lib/utils";
import {
  LucideIcon,
  Plus,
  History,
  Bell,
  Sparkles,
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
  onOpenHistory?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  onNewSession,
  onOpenHistory,
  className,
}) => {
  return (
    <aside
      className={cn(
        "w-[60px] h-full flex flex-col items-center py-3 bg-background border-r border-border select-none shrink-0 justify-between z-40 relative",
        className
      )}
    >
      {/* Top Section: Asterisk Logo & + New Button */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        {/* Brand Asterisk / Emblem Logo (Image 2) */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-foreground hover:bg-secondary transition-colors cursor-pointer"
          title="Study Agent PRO"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6 text-foreground"
          >
            {/* 8-pointed geometric emblem matching Image 2 */}
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
            <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.15" />
          </svg>
        </div>

        {/* + New Button (Image 2) */}
        <button
          onClick={onNewSession}
          className="w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center transition-all border border-border shadow-xs hover:scale-105 active:scale-95 cursor-pointer group"
          title="New Study Session (⌘N)"
        >
          <Plus className="w-4 h-4 text-foreground group-hover:rotate-90 transition-transform duration-200" />
        </button>

        <div className="w-6 h-[1px] bg-border/60 my-0.5" />

        {/* Navigation Icon Rail (Image 2) */}
        <nav className="flex flex-col items-center gap-1.5 w-full">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
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
                {/* Active Left Pill Indicator */}
                {item.active && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
                )}
                <Icon className="w-4 h-4" />
              </button>
            );
          })}

          {/* History Icon Button */}
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all cursor-pointer relative"
              title="Chat History"
            >
              <History className="w-4 h-4" />
            </button>
          )}
        </nav>
      </div>

      {/* Bottom Section: Telemetry / Status Indicator (Image 2) */}
      <div className="flex flex-col items-center gap-2 pb-1">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer relative"
          title="NVIDIA NIM RAG Engine Active"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-background" />
        </div>
      </div>
    </aside>
  );
};



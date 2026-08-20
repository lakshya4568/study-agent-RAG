import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { Sun, Moon, Sparkles, Cpu } from "lucide-react";
import { useChatStore } from "../../client/store";
import { ModelSelector } from "../ui/ModelSelector";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className,
}) => {
  const { theme, setTheme } = useChatStore();

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("theme-light");
    } else {
      setTheme("dark");
      document.documentElement.classList.remove("theme-light");
      document.documentElement.classList.add("dark");
    }
  };

  return (
    <header
      className={cn(
        "flex items-center justify-between px-6 py-2.5 bg-background border-b border-border select-none z-30",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {breadcrumbs && (
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            {breadcrumbs}
          </div>
        )}
        {title && (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-bold text-foreground tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline truncate">
                · {subtitle}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {/* Interactive Model Selector */}
        <div className="hidden md:block">
          <ModelSelector dropUp={false} align="right" />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-full bg-card border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95 shadow-sm"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          )}
        </button>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};


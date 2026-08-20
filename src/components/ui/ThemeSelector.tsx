import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./Button";
import { useChatStore } from "../../client/store";

interface ThemeSelectorProps {
  isCollapsed?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isCollapsed }) => {
  const { theme, setTheme } = useChatStore();

  const toggleDarkMode = () => {
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

  const isDark = theme === "dark";

  if (isCollapsed) {
    return (
      <button
        onClick={toggleDarkMode}
        className="w-8.5 h-8.5 rounded-xl neu-raised-sm flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
        title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      >
        {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
      </button>
    );
  }

  return (
    <div className="neu-inset-sm p-3 rounded-2xl">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Appearance
        </span>
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full neu-convex text-xs font-semibold text-foreground active:scale-95 transition-all cursor-pointer"
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Dark</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Light</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};


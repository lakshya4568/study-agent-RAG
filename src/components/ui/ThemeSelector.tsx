import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './Button';

interface ThemeSelectorProps {
  isCollapsed?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isCollapsed }) => {
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from localStorage or default
  useEffect(() => {
    const savedDark = localStorage.getItem('darkMode') === 'true';
    setIsDark(savedDark);

    if (savedDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(newDark));
  };

  if (isCollapsed) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleDarkMode}
        className="rounded-full hover:bg-muted text-muted-foreground"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </Button>
    );
  }

  return (
    <div className="bg-muted/30 p-3 rounded-2xl border border-border/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appearance</span>
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border shadow-sm hover:bg-muted transition-colors"
        >
          {isDark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-orange-500" />}
          <span className="text-xs font-medium">{isDark ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </div>
  );
};

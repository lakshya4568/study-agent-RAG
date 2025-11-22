import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Palette, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface ThemeSelectorProps {
  isCollapsed?: boolean;
}

type Theme = 'ocean' | 'forest' | 'sunset' | 'lavender';

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isCollapsed }) => {
  const [theme, setTheme] = useState<Theme>('ocean');
  const [isDark, setIsDark] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Initialize theme from localStorage or default
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme || 'ocean';
    const savedDark = localStorage.getItem('darkMode') === 'true';
    
    setTheme(savedTheme);
    setIsDark(savedDark);
    
    // Apply initial classes
    document.documentElement.classList.remove('theme-ocean', 'theme-forest', 'theme-sunset', 'theme-lavender');
    document.documentElement.classList.add(`theme-${savedTheme}`);
    
    if (savedDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    document.documentElement.classList.remove(`theme-${theme}`);
    document.documentElement.classList.add(`theme-${newTheme}`);
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

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

  const themes: { id: Theme; color: string; label: string }[] = [
    { id: 'ocean', color: 'bg-blue-500', label: 'Ocean' },
    { id: 'forest', color: 'bg-emerald-500', label: 'Forest' },
    { id: 'sunset', color: 'bg-orange-500', label: 'Sunset' },
    { id: 'lavender', color: 'bg-purple-500', label: 'Lavender' },
  ];

  return (
    <div className="relative">
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-2">
           <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-full hover:bg-muted relative"
          >
            <Palette className="w-5 h-5 text-muted-foreground" />
            <div className={cn("absolute top-0 right-0 w-2 h-2 rounded-full border border-card", themes.find(t => t.id === theme)?.color)} />
          </Button>
          
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, x: 10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.95 }}
                className="absolute left-full bottom-0 ml-2 p-3 bg-card border border-border rounded-2xl shadow-xl min-w-[160px] z-50"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Theme</span>
                    <button onClick={toggleDarkMode} className="p-1 hover:bg-muted rounded-full transition-colors">
                      {isDark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-orange-500" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleThemeChange(t.id)}
                        className={cn(
                          "w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none ring-2 ring-offset-2 ring-offset-card",
                          t.color,
                          theme === t.id ? "ring-primary scale-110" : "ring-transparent"
                        )}
                        title={t.label}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-3 bg-muted/30 p-3 rounded-2xl border border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appearance</span>
            <button
              onClick={toggleDarkMode}
              className="flex items-center gap-2 px-2 py-1 rounded-full bg-background border border-border shadow-sm hover:bg-muted transition-colors"
            >
              {isDark ? <Moon className="w-3 h-3 text-primary" /> : <Sun className="w-3 h-3 text-orange-500" />}
              <span className="text-[10px] font-medium">{isDark ? 'Dark' : 'Light'}</span>
            </button>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 focus:outline-none ring-2 ring-offset-2 ring-offset-card",
                  t.color,
                  theme === t.id ? "ring-primary scale-110 shadow-md" : "ring-transparent opacity-70 hover:opacity-100"
                )}
                title={t.label}
              >
                {theme === t.id && <Check className="w-4 h-4 text-white drop-shadow-md" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

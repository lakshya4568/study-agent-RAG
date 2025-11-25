import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { LucideIcon, ChevronLeft, ChevronRight, GraduationCap, LogOut } from 'lucide-react';


interface SidebarProps {
  items: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    description?: string;
    onClick: () => void;
    active?: boolean;
  }>;
  onLogout?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  onLogout,
  className,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside
      initial={{ width: 260 }}
      animate={{ width: isCollapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        'flex flex-col h-full backdrop-blur-md border-r border-border/50 shadow-sm z-50 relative transition-all',
        'bg-gradient-to-b from-emerald-50/40 via-orange-50/30 to-rose-100/50 dark:from-emerald-950/20 dark:via-orange-950/10 dark:to-rose-950/20',
        className
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-card border border-border rounded-full p-1.5 shadow-md hover:bg-muted transition-colors z-50 text-muted-foreground hover:text-primary"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Header */}
      <div className={cn("p-6 flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
        <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
          <GraduationCap className="w-6 h-6" />
        </div>

        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="font-bold text-lg tracking-tight text-foreground">StudyBuddy</h1>
              <p className="text-xs text-muted-foreground">AI Companion</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode='wait'>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                layout
                onClick={item.onClick}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 group relative overflow-hidden',
                  item.active
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  isCollapsed ? 'justify-center' : ''
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", item.active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />

                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 text-left overflow-hidden whitespace-nowrap"
                  >
                    <span className={cn("text-sm font-medium", item.active ? "font-semibold" : "")}>{item.label}</span>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </nav>

      {/* Footer / Theme Switcher */}
      <div className="mt-auto p-4 border-t border-border/50 space-y-2">


        {onLogout && (
          <button
            onClick={onLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group",
              isCollapsed ? "justify-center" : ""
            )}
            title="Sign Out"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            {!isCollapsed && <span className="text-sm font-medium">Sign Out</span>}
          </button>
        )}
      </div>
    </motion.aside>
  );
};

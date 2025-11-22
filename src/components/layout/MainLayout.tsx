import React from "react";
import { cn } from "../../lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  topBar?: React.ReactNode;
  className?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  sidebar,
  topBar,
  className,
}) => {
  return (
    <div
      className={cn(
        "h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground selection:bg-primary/20",
        className
      )}
    >
      {/* Top Bar */}
      {topBar && <div className="shrink-0 z-20">{topBar}</div>}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        {sidebar && <div className="shrink-0 z-10">{sidebar}</div>}

        {/* Content */}
        <main className="flex-1 overflow-hidden relative z-0">
          {children}
        </main>
      </div>
    </div>
  );
};

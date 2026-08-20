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
        "h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground selection:bg-primary/30 relative",
        className
      )}
    >
      {/* Top Bar */}
      {topBar && <div className="shrink-0 z-30">{topBar}</div>}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar */}
        {sidebar && <div className="shrink-0 z-20">{sidebar}</div>}

        {/* Dynamic View Canvas */}
        <main className="flex-1 overflow-hidden relative z-10 flex flex-col bg-background">
          {children}
        </main>
      </div>
    </div>
  );
};




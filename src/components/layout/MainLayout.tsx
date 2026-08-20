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
        "h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground selection:bg-primary/25 relative",
        className
      )}
    >
      {/* High-Performance Ambient Radial Accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-48 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      {/* Top Bar */}
      {topBar && <div className="shrink-0 z-30">{topBar}</div>}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar */}
        {sidebar && <div className="shrink-0 z-20">{sidebar}</div>}

        {/* Dynamic View Canvas */}
        <main className="flex-1 overflow-hidden relative z-10 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
};


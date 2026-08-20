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
        "h-screen w-screen overflow-hidden flex bg-background text-foreground selection:bg-primary/30 relative",
        className
      )}
    >
      {/* Full-Height Sidebar on the Left (Matching Image 2) */}
      {sidebar && <div className="shrink-0 h-full z-30">{sidebar}</div>}

      {/* Main Workspace Area on the Right */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Top Bar */}
        {topBar && <div className="shrink-0 z-20">{topBar}</div>}

        {/* Dynamic View Canvas */}
        <main className="flex-1 overflow-hidden relative flex flex-col bg-background">
          {children}
        </main>
      </div>
    </div>
  );
};




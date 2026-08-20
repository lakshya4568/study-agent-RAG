import React from "react";
import { cn } from "../../lib/utils";
import studyBackground from "../../assets/study_background.png";

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
      {/* Background Image Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src={studyBackground}
          alt=""
          className="w-full h-full object-cover object-center opacity-20 dark:opacity-15 brightness-90 contrast-125"
        />
        <div className="absolute inset-0 bg-background/85 dark:bg-background/90 backdrop-blur-[2px]" />
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



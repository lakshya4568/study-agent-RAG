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
        "h-screen w-screen overflow-hidden flex flex-col bg-background/80 text-foreground selection:bg-primary/20 relative",
        className
      )}
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-[-1]">
        <img
          src={studyBackground}
          alt=""
          className="w-full h-full object-cover object-center opacity-90"
        />
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px]" />
      </div>

      {/* Top Bar */}
      {topBar && <div className="shrink-0 z-20">{topBar}</div>}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar */}
        {sidebar && <div className="shrink-0 z-20">{sidebar}</div>}

        {/* Content */}
        <main className="flex-1 overflow-hidden relative z-0">
          {children}
        </main>
      </div>
    </div>
  );
};

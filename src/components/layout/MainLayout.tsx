import React from 'react';
import { cn } from '../../lib/utils';

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
    <div className={cn('h-screen w-screen overflow-hidden flex flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50', className)}>
      {/* Top Bar */}
      {topBar && <div className="flex-shrink-0">{topBar}</div>}
      
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebar && <div className="flex-shrink-0">{sidebar}</div>}
        
        {/* Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

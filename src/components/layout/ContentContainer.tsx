import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ContentContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export const ContentContainer: React.FC<ContentContainerProps> = ({
  children,
  className,
  maxWidth = 'full',
  padding = 'md',
}) => {
  const maxWidths = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'h-full w-full overflow-y-auto',
        paddings[padding],
        className
      )}
    >
      <div className={cn('mx-auto', maxWidths[maxWidth])}>
        {children}
      </div>
    </motion.div>
  );
};

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TopBarProps {
  title?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  actions,
  breadcrumbs,
  className,
}) => {
  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-4">
        {breadcrumbs && (
          <div className="text-sm text-gray-600">
            {breadcrumbs}
          </div>
        )}
        {title && (
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
          >
            {title}
          </motion.h1>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </motion.header>
  );
};

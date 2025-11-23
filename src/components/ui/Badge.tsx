import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  animate = false,
}) => {
  const variants = {
    success: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    outline: 'bg-transparent border-border text-foreground',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const Component = animate ? motion.span : 'span';

  return (
    <Component
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        variants[variant],
        sizes[size],
        className
      )}
      {...(animate && {
        initial: { scale: 0 },
        animate: { scale: 1 },
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      })}
    >
      {children}
    </Component>
  );
};

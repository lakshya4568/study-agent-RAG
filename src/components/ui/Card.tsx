import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
  gradient?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  hoverable = false,
  onClick,
  gradient = false,
}) => {
  const baseStyles = 'rounded-2xl p-6 backdrop-blur-xl border transition-all duration-300';
  const interactiveStyles = hoverable ? 'cursor-pointer hover:scale-105 hover:shadow-2xl' : '';
  const backgroundStyles = gradient
    ? 'bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20'
    : 'bg-white/80 border-gray-200';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverable ? { scale: 1.02 } : {}}
      className={cn(baseStyles, interactiveStyles, backgroundStyles, className)}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};

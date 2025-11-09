import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface IconButtonProps {
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  tooltip,
  className,
  onClick,
  disabled,
  type = 'button',
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20',
    ghost: 'text-gray-600 hover:bg-gray-100',
  };

  const sizes = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={cn(
        'rounded-xl transition-all duration-200 flex items-center justify-center',
        variants[variant],
        sizes[size],
        className
      )}
      title={tooltip}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      <span className={iconSizes[size]}>{icon}</span>
    </motion.button>
  );
};

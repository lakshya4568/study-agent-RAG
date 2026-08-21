import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface IconButtonProps {
  icon: React.ReactNode;
  variant?: "primary" | "secondary" | "raised" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  shape?: "squircle" | "circle";
  tooltip?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = "ghost",
  size = "md",
  shape = "squircle",
  tooltip,
  className,
  onClick,
  disabled,
  type = "button",
}) => {
  const variants = {
    primary: "neu-convex-primary text-white active:scale-95",
    secondary: "neu-convex text-foreground/90 hover:text-foreground active:scale-95",
    raised: "neu-raised-sm text-foreground/90 hover:text-foreground active:scale-95",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:scale-95",
    danger: "neu-raised-sm text-rose-400 hover:bg-rose-500/10 border-rose-500/20 active:scale-95",
  };

  const sizes = {
    sm: "w-7 h-7 p-1 text-xs",
    md: "w-8.5 h-8.5 p-1.5 text-sm",
    lg: "w-10 h-10 p-2 text-base",
  };

  const shapes = {
    squircle: "rounded-xl",
    circle: "rounded-full",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.04 }}
      whileTap={{ scale: disabled ? 1 : 0.94 }}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
      className={cn(
        "transition-all duration-150 flex items-center justify-center cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        shapes[shape],
        className
      )}
      title={tooltip}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      <span className="flex items-center justify-center w-full h-full">{icon}</span>
    </motion.button>
  );
};


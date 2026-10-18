import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "emerald";
  size?: "sm" | "md" | "lg" | "icon";
  children?: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  icon,
  iconPosition = "left",
  loading = false,
  className,
  disabled,
  onClick,
  type = "button",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 font-semibold select-none transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

  const variants = {
    primary:
      "neu-convex-primary text-white active:scale-[0.98]",
    secondary:
      "neu-convex text-foreground/95 hover:text-foreground active:scale-[0.98]",
    outline:
      "neu-raised-sm text-foreground/90 hover:text-foreground border border-border/80 hover:border-primary/50 active:scale-[0.98]",
    ghost:
      "text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:scale-[0.98]",
    danger:
      "neu-raised-sm text-rose-400 border border-rose-500/30 hover:bg-rose-500/15 active:scale-[0.98]",
    emerald:
      "neu-convex-emerald text-white active:scale-[0.98]",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-xl",
    md: "px-4.5 py-2 text-sm rounded-xl",
    lg: "px-6 py-2.5 text-base rounded-2xl",
    icon: "h-9 w-9 p-1.5 rounded-xl",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.015 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      {...props as any}
    >
      {loading ? (
        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : icon && iconPosition === "left" ? (
        <span className={cn("shrink-0 flex items-center justify-center", !children ? "w-full h-full" : "w-4 h-4")}>
          {icon}
        </span>
      ) : null}
      {children}
      {!loading && icon && iconPosition === "right" ? (
        <span className="shrink-0 flex items-center justify-center w-4 h-4 ml-0.5">{icon}</span>
      ) : null}
    </motion.button>
  );
};


import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "error" | "info" | "primary" | "default" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
  pip?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className,
  animate = false,
  pip = false,
}) => {
  const variants = {
    success: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/25",
    warning: "bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25",
    error: "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/25",
    info: "bg-sky-500/10 text-sky-500 dark:text-sky-400 border-sky-500/25",
    primary: "bg-primary/10 text-primary border-primary/25",
    default: "bg-secondary text-foreground/85 border-border/40",
    outline: "bg-transparent border-border/80 text-muted-foreground",
  };

  const pipColors = {
    success: "bg-emerald-500 dark:bg-emerald-400",
    warning: "bg-amber-500 dark:bg-amber-400",
    error: "bg-rose-500 dark:bg-rose-400",
    info: "bg-sky-500 dark:bg-sky-400",
    primary: "bg-primary",
    default: "bg-muted-foreground",
    outline: "bg-muted-foreground",
  };

  const sizes = {
    sm: "text-[10.5px] px-2 py-0.5 font-medium",
    md: "text-xs px-2.5 py-1 font-semibold",
    lg: "text-sm px-3.5 py-1.5 font-bold",
  };

  const Component = animate ? motion.span : "span";

  return (
    <Component
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full select-none border neu-raised-sm tracking-tight",
        variants[variant],
        sizes[size],
        className
      )}
      {...(animate && {
        initial: { scale: 0.9, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { type: "spring", stiffness: 400, damping: 25 },
      })}
    >
      {pip && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 shadow-xs", pipColors[variant])} />
      )}
      {children}
    </Component>
  );
};


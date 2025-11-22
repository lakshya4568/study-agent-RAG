import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
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
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 hover:brightness-110",
    secondary:
      "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border-2 border-primary text-primary hover:bg-primary/10",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
    icon: "h-10 w-10 p-2",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      {...props as any}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon && iconPosition === "left" ? (
        <span className={cn("w-5 h-5", !children && "w-full h-full")}>{icon}</span>
      ) : null}
      {children}
      {!loading && icon && iconPosition === "right" ? (
        <span className="w-5 h-5 ml-1">{icon}</span>
      ) : null}
    </motion.button>
  );
};

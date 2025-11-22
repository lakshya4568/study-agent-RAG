import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
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
      "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg hover:shadow-xl hover:scale-105 shadow-emerald-500/30",
    secondary:
      "bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20",
    outline: "border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50",
    ghost: "text-gray-600 hover:bg-emerald-50",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-lg",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
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
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : icon && iconPosition === "left" ? (
        <span className="w-5 h-5">{icon}</span>
      ) : null}
      {children}
      {!loading && icon && iconPosition === "right" ? (
        <span className="w-5 h-5 ml-1">{icon}</span>
      ) : null}
    </motion.button>
  );
};

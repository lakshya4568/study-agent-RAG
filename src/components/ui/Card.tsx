import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  hoverable?: boolean;
  onClick?: () => void;
  bezel?: boolean;
  variant?: "raised" | "floating" | "inset" | "flat";
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  innerClassName,
  hoverable = false,
  onClick,
  bezel = false,
  variant = "raised",
}) => {
  const variantStyles = {
    raised: "neu-raised",
    floating: "neu-floating",
    inset: "neu-inset",
    flat: "bg-card border border-border/80",
  };

  if (bezel) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={hoverable ? { scale: 1.01 } : {}}
        whileTap={hoverable && onClick ? { scale: 0.99 } : {}}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className={cn(
          "neu-bezel",
          hoverable && "cursor-pointer transition-shadow",
          className
        )}
        onClick={onClick}
      >
        <div className={cn("neu-bezel-inner p-5", innerClassName)}>
          {children}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hoverable ? { scale: 1.01 } : {}}
      whileTap={hoverable && onClick ? { scale: 0.99 } : {}}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={cn(
        "rounded-2xl p-5 select-none transition-all duration-200",
        variantStyles[variant],
        hoverable && "cursor-pointer hover:brightness-105",
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
};


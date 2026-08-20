import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  className,
}) => {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-7 h-7 border-2.5",
    lg: "w-10 h-10 border-3",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("flex items-center justify-center", className)}
    >
      <div
        className={cn(
          "border-primary/20 border-t-primary rounded-full animate-spin",
          sizes[size]
        )}
      />
    </motion.div>
  );
};


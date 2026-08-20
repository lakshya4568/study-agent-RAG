import React from "react";
import { motion } from "framer-motion";
import { LucideIcon, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  accentColor?: string;
  delay?: number;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon: Icon,
  title,
  description,
  onClick,
  accentColor = "text-primary",
  delay = 0,
}) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 350, damping: 25 }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative neu-raised rounded-2xl p-5 text-left transition-all duration-200 cursor-pointer select-none flex flex-col justify-between overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Sunken Icon Well */}
        <div className="w-10 h-10 rounded-xl neu-inset-sm flex items-center justify-center text-foreground shrink-0 group-hover:scale-105 transition-transform duration-200">
          <Icon className={cn("w-5 h-5", accentColor)} />
        </div>

        {/* Button-in-Button Trailing Arrow */}
        <div className="w-7 h-7 rounded-full neu-convex flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:scale-105 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0">
          <ArrowUpRight className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </motion.button>
  );
};


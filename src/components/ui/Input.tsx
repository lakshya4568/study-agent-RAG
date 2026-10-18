import React from "react";
import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className,
  ...props
}) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none w-4 h-4 flex items-center justify-center">
            {icon}
          </div>
        )}
        <input
          className={cn(
            "w-full px-4 py-2.5 rounded-xl neu-inset text-foreground placeholder:text-muted-foreground/45",
            "focus:outline-none focus:ring-1 focus:ring-primary/80 focus:border-primary/60",
            "transition-all duration-150 text-xs sm:text-sm font-medium",
            icon && "pl-10",
            error && "border-destructive/80 focus:ring-destructive",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-[11px] text-destructive font-medium pl-1">{error}</p>}
    </div>
  );
};



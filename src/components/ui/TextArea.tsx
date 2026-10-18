import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full px-4 py-3 rounded-xl neu-inset text-foreground placeholder:text-muted-foreground/45",
            "focus:outline-none focus:ring-1 focus:ring-primary/80 focus:border-primary/60",
            "transition-all duration-150 text-xs sm:text-sm font-medium resize-y custom-scrollbar",
            error && "border-destructive/80 focus:ring-destructive",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-destructive font-medium pl-1">{error}</p>}
      </div>
    );
  }
);

TextArea.displayName = "TextArea";


import React, { useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import {
  ChevronDown,
  Check,
  Zap,
  Cpu,
} from "lucide-react";
import { useChatStore, AVAILABLE_MODELS } from "../../client/store";

interface ModelSelectorProps {
  className?: string;
  align?: "left" | "right";
  dropUp?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  className,
  align = "right",
  dropUp = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedModel, setSelectedModel } = useChatStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModel =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const groqModels = AVAILABLE_MODELS.filter((m) => m.provider === "groq");
  const nvidiaModels = AVAILABLE_MODELS.filter((m) => m.provider === "nvidia");

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      {/* Tactile Neumorphic Trigger Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none text-foreground",
          "neu-convex hover:brightness-105 active:scale-95",
          isOpen && "ring-1 ring-primary/60 border-primary/50"
        )}
        title="Select AI Model"
      >
        {activeModel.provider === "groq" ? (
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20 shrink-0" />
        ) : (
          <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
        <span className="truncate max-w-[120px] sm:max-w-none text-xs">
          {activeModel.name}
        </span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-muted-foreground transition-transform duration-200 ml-0.5",
            isOpen && "rotate-180 text-foreground"
          )}
        />
      </button>

      {/* Solid Opaque Neumorphic Floating Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 w-68 rounded-2xl bg-popover neu-floating p-2 animate-in fade-in zoom-in-95 duration-150 text-xs border border-border shadow-2xl",
            align === "right" ? "right-0" : "left-0",
            dropUp ? "bottom-full mb-2.5" : "top-full mt-2.5"
          )}
        >
          {/* Groq section */}
          <div className="px-2.5 py-1 text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3 h-3" /> Groq LPU (Ultra-Fast)
          </div>
          <div className="space-y-1 mt-0.5">
            {groqModels.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  setSelectedModel(model.id, model.provider);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer text-left select-none",
                  selectedModel === model.id
                    ? "neu-convex-primary text-white font-semibold shadow-xs"
                    : "text-foreground hover:bg-secondary/70"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{model.name}</span>
                </div>
                {selectedModel === model.id && (
                  <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />
                )}
              </button>
            ))}
          </div>

          <div className="my-1.5 border-t border-border" />

          {/* NVIDIA NIM section */}
          <div className="px-2.5 py-1 text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3 h-3" /> NVIDIA NIM (Enterprise)
          </div>
          <div className="space-y-1 mt-0.5">
            {nvidiaModels.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  setSelectedModel(model.id, model.provider);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer text-left select-none",
                  selectedModel === model.id
                    ? "neu-convex-primary text-white font-semibold shadow-xs"
                    : "text-foreground hover:bg-secondary/70"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{model.name}</span>
                </div>
                {selectedModel === model.id && (
                  <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


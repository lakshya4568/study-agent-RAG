import React, { useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import {
  ChevronDown,
  Check,
  Zap,
  Cpu,
  Sparkles,
} from "lucide-react";
import { useChatStore, AVAILABLE_MODELS, ModelOption } from "../../client/store";

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
      {/* ChatGPT-style Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer select-none text-foreground/90 hover:text-foreground",
          "bg-secondary/60 hover:bg-secondary/90 dark:bg-[#282828] dark:hover:bg-[#323232] border border-border/50 dark:border-[#383838]",
          isOpen && "ring-1 ring-border border-border"
        )}
        title="Select AI Model"
      >
        {activeModel.provider === "groq" ? (
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400/20" />
        ) : (
          <Cpu className="w-3 h-3 text-emerald-400" />
        )}
        <span className="font-semibold truncate max-w-[110px] sm:max-w-none">
          {activeModel.name}
        </span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-muted-foreground transition-transform duration-150 ml-0.5",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* ChatGPT-style Popup Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 w-64 rounded-2xl bg-[#1e1e1e] border border-[#333333] shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl text-xs",
            align === "right" ? "right-0" : "left-0",
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {/* Groq section */}
          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
            Groq LPU (Ultra-Fast)
          </div>
          <div className="space-y-0.5">
            {groqModels.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  setSelectedModel(model.id, model.provider);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer text-left",
                  selectedModel === model.id
                    ? "bg-[#2c2c2c] text-white font-medium"
                    : "text-[#cccccc] hover:bg-[#282828] hover:text-white"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{model.name}</span>
                </div>
                {selectedModel === model.id && (
                  <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />
                )}
              </button>
            ))}
          </div>

          <div className="my-1 border-t border-[#2e2e2e]" />

          {/* NVIDIA NIM section */}
          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
            NVIDIA NIM (Enterprise)
          </div>
          <div className="space-y-0.5">
            {nvidiaModels.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  setSelectedModel(model.id, model.provider);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer text-left",
                  selectedModel === model.id
                    ? "bg-[#2c2c2c] text-white font-medium"
                    : "text-[#cccccc] hover:bg-[#282828] hover:text-white"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">{model.name}</span>
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

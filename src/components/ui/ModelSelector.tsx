import React, { useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import {
  ChevronDown,
  Check,
  Zap,
  Sparkles,
  Cpu,
  Layers,
  BrainCircuit,
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
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border select-none",
          activeModel.provider === "groq"
            ? "bg-secondary/90 hover:bg-secondary text-foreground border-border/70 hover:border-amber-500/40"
            : "bg-secondary/90 hover:bg-secondary text-foreground border-border/70 hover:border-emerald-500/40",
          isOpen && "ring-1 ring-primary/40 border-primary/50"
        )}
        title="Switch AI Reasoning Engine"
      >
        {activeModel.provider === "groq" ? (
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400/20" />
        ) : (
          <Cpu className="w-3 h-3 text-emerald-400" />
        )}
        <span className="font-semibold">{activeModel.name}</span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-muted-foreground transition-transform duration-150",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 w-80 rounded-2xl bg-card border border-border/80 shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl",
            align === "right" ? "right-0" : "left-0",
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Select AI Engine
            </span>
            <span className="text-[10px] text-muted-foreground/80 bg-secondary px-2 py-0.5 rounded-md font-mono">
              Live Switch
            </span>
          </div>

          <div className="max-h-[380px] overflow-y-auto py-1 space-y-3 custom-scrollbar">
            {/* Groq Models Section */}
            <div>
              <div className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <Zap className="w-3.5 h-3.5 fill-amber-400/30" />
                <span>Groq LPU Inference</span>
                <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                  Ultra-Fast
                </span>
              </div>
              <div className="space-y-0.5 px-1">
                {groqModels.map((model) => (
                  <ModelItem
                    key={model.id}
                    model={model}
                    isActive={selectedModel === model.id}
                    onSelect={() => {
                      setSelectedModel(model.id, model.provider);
                      setIsOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* NVIDIA Models Section */}
            <div className="pt-1 border-t border-border/40">
              <div className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
                <span>NVIDIA NIM Acceleration</span>
                <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                  Enterprise
                </span>
              </div>
              <div className="space-y-0.5 px-1">
                {nvidiaModels.map((model) => (
                  <ModelItem
                    key={model.id}
                    model={model}
                    isActive={selectedModel === model.id}
                    onSelect={() => {
                      setSelectedModel(model.id, model.provider);
                      setIsOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ModelItemProps {
  model: ModelOption;
  isActive: boolean;
  onSelect: () => void;
}

const ModelItem: React.FC<ModelItemProps> = ({ model, isActive, onSelect }) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer group",
        isActive
          ? "bg-secondary border border-border text-foreground font-medium shadow-xs"
          : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isActive ? (
          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full border border-border/80 group-hover:border-primary/50" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold text-foreground truncate">
            {model.name}
          </span>
          <span
            className={cn(
              "text-[9px] px-1.5 py-0.5 rounded font-mono font-medium shrink-0",
              model.provider === "groq"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            )}
          >
            {model.tag}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
          {model.description}
        </p>
      </div>
    </button>
  );
};

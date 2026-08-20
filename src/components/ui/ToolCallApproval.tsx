import React from "react";
import { motion } from "framer-motion";
import { Wrench, CheckCircle, XCircle, ShieldAlert, Cpu } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

export interface PendingToolCall {
  id: string;
  toolName: string;
  serverId: string;
  serverName: string;
  args?: Record<string, unknown>;
  description?: string;
  timestamp: Date;
}

interface ToolCallApprovalProps {
  toolCall: PendingToolCall;
  onApprove: (toolCallId: string) => void;
  onDeny: (toolCallId: string) => void;
}

export const ToolCallApproval: React.FC<ToolCallApprovalProps> = ({
  toolCall,
  onApprove,
  onDeny,
}) => {
  const formatArgs = (args?: Record<string, unknown>) => {
    if (!args || Object.keys(args).length === 0) return "No parameters (default)";
    return JSON.stringify(args, null, 2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="my-3 w-full max-w-2xl"
    >
      <div className="rounded-2xl bg-card border border-amber-500/30 p-4.5 shadow-md relative overflow-hidden backdrop-blur-md">
        {/* Subtle accent glow */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />

        <div className="flex items-start gap-3.5">
          {/* Icon */}
          <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Tool Permission Request
                </h3>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Approval Required
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {new Date(toolCall.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-secondary/60 px-2.5 py-1.5 rounded-lg border border-border/50">
                <span className="text-muted-foreground font-medium">Tool:</span>
                <span className="font-mono font-bold text-primary truncate">
                  {toolCall.toolName}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-secondary/60 px-2.5 py-1.5 rounded-lg border border-border/50">
                <span className="text-muted-foreground font-medium">Server:</span>
                <span className="font-medium text-foreground truncate">
                  {toolCall.serverName || toolCall.serverId}
                </span>
              </div>
            </div>

            {toolCall.description && (
              <p className="text-xs text-muted-foreground leading-relaxed bg-background/50 p-2 rounded-lg border border-border/30">
                {toolCall.description}
              </p>
            )}

            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Arguments Payload:
              </span>
              <pre className="text-[11px] text-foreground/90 bg-background/80 p-2.5 rounded-xl border border-border/60 overflow-x-auto font-mono whitespace-pre-wrap max-h-32 custom-scrollbar">
                {formatArgs(toolCall.args)}
              </pre>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onApprove(toolCall.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve & Execute</span>
              </button>

              <button
                type="button"
                onClick={() => onDeny(toolCall.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 border border-border hover:border-rose-500/30 text-xs font-medium active:scale-95 transition-all cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Deny</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

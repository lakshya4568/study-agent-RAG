import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, ShieldAlert } from "lucide-react";

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
      className="my-4 w-full max-w-2xl"
    >
      <div className="neu-bezel p-1">
        <div className="neu-bezel-inner p-5 space-y-4">
          <div className="flex items-start gap-3.5">
            {/* Tactile Warning Icon Well */}
            <div className="shrink-0 w-10 h-10 rounded-xl neu-inset-sm flex items-center justify-center text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    Tool Permission Request
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 neu-raised-sm">
                    Approval Required
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(toolCall.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 neu-inset-sm px-3 py-2 rounded-xl">
                  <span className="text-muted-foreground font-medium">Tool:</span>
                  <span className="font-mono font-bold text-primary truncate">
                    {toolCall.toolName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 neu-inset-sm px-3 py-2 rounded-xl">
                  <span className="text-muted-foreground font-medium">Server:</span>
                  <span className="font-medium text-foreground truncate">
                    {toolCall.serverName || toolCall.serverId}
                  </span>
                </div>
              </div>

              {toolCall.description && (
                <p className="text-xs text-muted-foreground leading-relaxed neu-inset-sm p-3 rounded-xl">
                  {toolCall.description}
                </p>
              )}

              <div>
                <span className="text-[11px] font-bold text-muted-foreground block mb-1 uppercase tracking-wider">
                  Arguments Payload:
                </span>
                <pre className="text-[11px] text-foreground/90 p-3 rounded-xl border border-border neu-inset-sm overflow-x-auto font-mono whitespace-pre-wrap max-h-32 custom-scrollbar">
                  {formatArgs(toolCall.args)}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onApprove(toolCall.id)}
                  className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl neu-convex-emerald text-white text-xs font-semibold shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve & Execute</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeny(toolCall.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl neu-raised-sm hover:bg-rose-500/15 text-muted-foreground hover:text-rose-400 border border-rose-500/20 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Deny</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};


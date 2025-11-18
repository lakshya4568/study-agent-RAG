import React from "react";
import { motion } from "framer-motion";
import { Wrench, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button, Card } from "./";

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
    if (!args || Object.keys(args).length === 0) return "No arguments";
    return Object.entries(args)
      .map(([key, value]) => {
        const displayValue =
          typeof value === "string" && value.length > 100
            ? value.substring(0, 100) + "..."
            : JSON.stringify(value);
        return `${key}: ${displayValue}`;
      })
      .join("\n");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mb-4"
    >
      <Card className="border-2 border-amber-300 bg-linear-to-r from-amber-50 to-yellow-50">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="shrink-0 w-12 h-12 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Wrench className="w-6 h-6 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-gray-900">
                Tool Execution Request
              </h3>
            </div>

            <div className="space-y-2 mb-4">
              <div>
                <span className="text-sm font-semibold text-gray-700">
                  Tool:
                </span>
                <span className="ml-2 text-sm text-gray-900 font-mono bg-amber-100 px-2 py-1 rounded">
                  {toolCall.toolName}
                </span>
              </div>

              <div>
                <span className="text-sm font-semibold text-gray-700">
                  Server:
                </span>
                <span className="ml-2 text-sm text-gray-900">
                  {toolCall.serverName} ({toolCall.serverId})
                </span>
              </div>

              {toolCall.description && (
                <div>
                  <span className="text-sm font-semibold text-gray-700">
                    Description:
                  </span>
                  <p className="text-sm text-gray-600 mt-1">
                    {toolCall.description}
                  </p>
                </div>
              )}

              <div>
                <span className="text-sm font-semibold text-gray-700 block mb-1">
                  Arguments:
                </span>
                <pre className="text-xs text-gray-700 bg-white p-3 rounded-lg border border-amber-200 overflow-x-auto font-mono whitespace-pre-wrap">
                  {formatArgs(toolCall.args)}
                </pre>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => onApprove(toolCall.id)}
                icon={<CheckCircle className="w-4 h-4" />}
                className="bg-linear-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md"
              >
                Approve & Execute
              </Button>
              <Button
                onClick={() => onDeny(toolCall.id)}
                variant="outline"
                icon={<XCircle className="w-4 h-4" />}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                Deny
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

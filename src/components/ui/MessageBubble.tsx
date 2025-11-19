import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { User, Sparkles, Info } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  delay?: number;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  timestamp,
  delay = 0,
}) => {
  const isUser = role === "user";
  const isSystem = role === "system";

  const icons = {
    user: User,
    assistant: Sparkles,
    system: Info,
  };

  const Icon = icons[role];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 30 }}
      className={cn("flex gap-3 mb-4", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: delay + 0.1, type: "spring", stiffness: 400 }}
        className={cn(
          "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
          isUser
            ? "bg-linear-to-br from-blue-500 to-cyan-500"
            : isSystem
              ? "bg-linear-to-br from-gray-400 to-gray-600"
              : "bg-linear-to-br from-purple-500 to-pink-500"
        )}
      >
        <Icon className="w-5 h-5 text-white" />
      </motion.div>

      {/* Message content */}
      <div className={cn("flex flex-col max-w-[70%]", isUser && "items-end")}>
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className={cn(
            "rounded-2xl px-4 py-3 shadow-lg backdrop-blur-xl",
            isUser
              ? "bg-linear-to-br from-blue-500 to-cyan-500 text-white"
              : isSystem
                ? "bg-gray-100 text-gray-800 border border-gray-200"
                : "bg-white/90 text-gray-800 border border-gray-200"
          )}
        >
          {/* Render markdown for assistant and system messages, plain text for user */}
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {content}
            </p>
          ) : (
            <MarkdownRenderer content={content} className="text-sm" />
          )}
        </motion.div>
        {timestamp && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
            className="text-xs text-gray-500 mt-1 px-2"
          >
            {timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
};

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { User, Copy, Check, Info, Bot } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { FlashcardViewer } from "./FlashcardViewer";
import { Flashcard } from "../../client/types";
import mentorAvatar from "../../assets/study_mentor_avatar.jpg";

interface MessageBubbleProps {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  delay?: number;
}

export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
  id,
  role,
  content,
  timestamp,
  delay = 0,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";
  const isSystem = role === "system";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Try to detect flashcard JSON content
  let flashcards: Flashcard[] | null = null;
  if (!isUser && !isSystem) {
    let jsonContent = content.trim();
    const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
    const match = jsonContent.match(codeBlockRegex);
    if (match) {
      jsonContent = match[1].trim();
    }

    if (jsonContent.startsWith("{")) {
      try {
        const parsed = JSON.parse(jsonContent);
        if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
          flashcards = parsed.flashcards;
        }
      } catch {
        // Not valid JSON
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(delay, 0.2), duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-3.5 mb-5 group", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 ring-1 ring-white/10">
            <User className="w-4 h-4" />
          </div>
        ) : isSystem ? (
          <div className="w-9 h-9 rounded-2xl bg-muted/80 text-muted-foreground flex items-center justify-center border border-border/50">
            <Info className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-2xl overflow-hidden ring-1 ring-primary/30 shadow-lg shadow-primary/10 relative group-hover:ring-primary/60 transition-all">
            <img
              src={mentorAvatar}
              alt="AI Mentor"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to bot icon if image fails
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Message Container */}
      <div className={cn("flex flex-col max-w-[85%] min-w-0", isUser && "items-end")}>
        {isUser ? (
          <div className="rounded-3xl rounded-tr-sm px-5 py-3.5 bg-primary text-primary-foreground shadow-md shadow-primary/15 border border-primary/20 text-sm font-medium leading-relaxed">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
        ) : isSystem ? (
          <div className="rounded-2xl px-4 py-2.5 bg-muted/40 text-muted-foreground border border-border/40 text-xs font-medium leading-relaxed">
            <MarkdownRenderer content={content} />
          </div>
        ) : (
          <div className="double-bezel w-full">
            <div className="double-bezel-inner p-5 text-foreground">
              {flashcards && id ? (
                <FlashcardViewer flashcards={flashcards} messageId={id} />
              ) : (
                <MarkdownRenderer content={content} />
              )}
            </div>
          </div>
        )}

        {/* Footer Meta & Actions */}
        <div
          className={cn(
            "flex items-center gap-2 mt-1.5 px-2 text-[11px] text-muted-foreground/60 transition-opacity",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          {timestamp && (
            <span>
              {timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {!isSystem && !flashcards && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity p-0.5"
              title="Copy message"
            >
              {copied ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check className="w-3 h-3" /> Copied
                </span>
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});


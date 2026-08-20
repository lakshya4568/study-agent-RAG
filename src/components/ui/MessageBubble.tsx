import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { User, Copy, Check, Info, Bot, ChevronRight, Brain } from "lucide-react";
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

  // Try to extract <think> or thinking blocks
  let thinkingContent: string | null = null;
  let mainContent = content;

  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    thinkingContent = thinkMatch[1].trim();
    mainContent = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();
  }

  // Try to detect flashcard JSON content
  let flashcards: Flashcard[] | null = null;
  if (!isUser && !isSystem) {
    let jsonContent = mainContent.trim();
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(delay, 0.15), duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("flex gap-3 mb-4 group", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border shadow-sm">
            <User className="w-4 h-4" />
          </div>
        ) : isSystem ? (
          <div className="w-8 h-8 rounded-xl bg-secondary/80 text-muted-foreground flex items-center justify-center border border-border">
            <Info className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-border shadow-md relative group-hover:ring-primary/50 transition-all">
            <img
              src={mentorAvatar}
              alt="AI Mentor"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className={cn("flex flex-col max-w-[88%] min-w-0 space-y-2", isUser && "items-end")}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-xs px-4 py-2.5 bg-primary text-primary-foreground text-sm font-normal leading-relaxed shadow-sm">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
        ) : isSystem ? (
          <div className="rounded-xl px-3.5 py-2 bg-secondary/60 text-muted-foreground border border-border text-xs font-normal leading-relaxed">
            <MarkdownRenderer content={content} />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 w-full">
            {/* Thinking Accordion (Stitch Spec) */}
            {thinkingContent && (
              <details className="group bg-indigo-500/10 rounded-xl border border-indigo-500/20 overflow-hidden transition-all">
                <summary className="flex items-center gap-2 p-2.5 cursor-pointer text-indigo-400 font-medium text-xs select-none outline-none">
                  <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                  <Brain className="w-3.5 h-3.5" />
                  <span>Cognitive Reasoning & Retrieval Path</span>
                </summary>
                <div className="px-3.5 pb-2.5 pt-1 border-t border-indigo-500/10 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
                  {thinkingContent}
                </div>
              </details>
            )}

            {/* Main AI Content (ChatGPT / Gemini style: direct in window without card box) */}
            <div className="w-full text-foreground text-sm leading-relaxed py-0.5">
              {flashcards && id ? (
                <FlashcardViewer flashcards={flashcards} messageId={id} />
              ) : (
                <MarkdownRenderer content={mainContent} />
              )}
            </div>
          </div>
        )}

        {/* Timestamp and Copy Action */}
        <div
          className={cn(
            "flex items-center gap-2 px-1 text-[10px] text-muted-foreground/60 transition-opacity",
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
              className="opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity p-0.5 cursor-pointer"
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



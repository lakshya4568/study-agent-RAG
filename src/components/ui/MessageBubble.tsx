import React, { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Share2, RotateCw, MoreHorizontal, Brain, ChevronRight } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { FlashcardViewer } from "./FlashcardViewer";
import { Flashcard } from "../../client/types";

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
    jsonContent = jsonContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
    const match = jsonContent.match(codeBlockRegex);
    if (match) {
      jsonContent = match[1].trim();
    }

    const firstBrace = jsonContent.indexOf("{");
    const lastBrace = jsonContent.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const candidate = jsonContent.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(candidate);
        if (parsed.flashcards && Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
          flashcards = parsed.flashcards;
        }
      } catch {
        // Not valid JSON
      }
    }
  }

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex justify-end mb-6 w-full group select-text"
      >
        <div className="rounded-[20px] px-5 py-3 bg-primary text-primary-foreground text-[14.5px] font-normal leading-relaxed neu-raised-sm border border-primary/40 shadow-sm max-w-[82%] sm:max-w-[72%] wrap-break-word">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </motion.div>
    );
  }

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start mb-4 max-w-2xl text-xs text-muted-foreground neu-inset-sm px-4 py-2.5 rounded-xl border border-border"
      >
        <MarkdownRenderer content={content} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(delay, 0.1), duration: 0.2, ease: "easeOut" }}
      className="flex flex-col mb-8 w-full group text-left"
    >
      {/* Thinking Accordion (Stitch Spec) */}
      {thinkingContent && (
        <details className="mb-3 group neu-inset-sm rounded-xl border border-primary/25 overflow-hidden transition-all max-w-2xl">
          <summary className="flex items-center gap-2 p-2.5 cursor-pointer text-primary font-semibold text-xs select-none outline-none hover:brightness-110">
            <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform duration-200" />
            <Brain className="w-3.5 h-3.5" />
            <span>Reasoning & Thought Process</span>
          </summary>
          <div className="px-3.5 pb-2.5 pt-1 border-t border-primary/15 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
            {thinkingContent}
          </div>
        </details>
      )}

      {/* Main AI Content */}
      <div className="w-full text-foreground/95 text-[15px] leading-relaxed py-0.5 space-y-3 select-text">
        {flashcards && id ? (
          <FlashcardViewer flashcards={flashcards} messageId={id} />
        ) : (
          <MarkdownRenderer content={mainContent} />
        )}
      </div>

      {/* Tactile Action Bar (Copy, Share, Retry, More) */}
      {!flashcards && (
        <div className="flex items-center gap-1.5 pt-2 text-muted-foreground text-xs">
          <button
            onClick={handleCopy}
            className="w-7 h-7 rounded-lg neu-raised-sm flex items-center justify-center hover:text-foreground active:scale-95 transition-all cursor-pointer border border-border"
            title="Copy response"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleCopy}
            className="w-7 h-7 rounded-lg neu-raised-sm flex items-center justify-center hover:text-foreground active:scale-95 transition-all cursor-pointer border border-border"
            title="Share"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              /* retry handler placeholder */
            }}
            className="w-7 h-7 rounded-lg neu-raised-sm flex items-center justify-center hover:text-foreground active:scale-95 transition-all cursor-pointer border border-border"
            title="Retry"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              /* more options placeholder */
            }}
            className="w-7 h-7 rounded-lg neu-raised-sm flex items-center justify-center hover:text-foreground active:scale-95 transition-all cursor-pointer border border-border"
            title="More"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
});


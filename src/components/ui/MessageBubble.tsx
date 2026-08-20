import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
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

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex justify-end mb-6 w-full group"
      >
        <div className="rounded-[22px] px-5 py-3 bg-[#244f2c] dark:bg-[#1e4624] text-[#f0fdf4] text-[15px] font-normal leading-relaxed shadow-sm max-w-[82%] sm:max-w-[72%] break-words">
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
        className="flex justify-start mb-4 max-w-2xl text-xs text-muted-foreground bg-secondary/40 border border-border/50 px-3.5 py-2 rounded-xl"
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
        <details className="mb-3 group bg-indigo-500/10 rounded-xl border border-indigo-500/20 overflow-hidden transition-all max-w-2xl">
          <summary className="flex items-center gap-2 p-2.5 cursor-pointer text-indigo-400 font-medium text-xs select-none outline-none">
            <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
            <Brain className="w-3.5 h-3.5" />
            <span>Reasoning & Thought Process</span>
          </summary>
          <div className="px-3.5 pb-2.5 pt-1 border-t border-indigo-500/10 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
            {thinkingContent}
          </div>
        </details>
      )}

      {/* Main AI Content (ChatGPT style: direct canvas layout without card borders) */}
      <div className="w-full text-foreground/95 text-[15px] leading-relaxed py-0.5 space-y-3">
        {flashcards && id ? (
          <FlashcardViewer flashcards={flashcards} messageId={id} />
        ) : (
          <MarkdownRenderer content={mainContent} />
        )}
      </div>

      {/* ChatGPT-style Action Bar (Copy, Share, Retry, More) */}
      {!flashcards && (
        <div className="flex items-center gap-2 pt-2 text-muted-foreground/60 text-xs">
          <button
            onClick={handleCopy}
            className="p-1 rounded-md hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            title="Copy response"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleCopy}
            className="p-1 rounded-md hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            title="Share"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {}}
            className="p-1 rounded-md hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            title="Retry"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {}}
            className="p-1 rounded-md hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            title="More"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
});

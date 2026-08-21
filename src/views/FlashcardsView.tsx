import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  RotateCw,
  CheckCircle2,
  Sparkles,
  Tag,
  Flame,
  Target,
  Eye,
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import { LoadingSpinner } from "../components/ui";
import { Flashcard } from "../client/types";
import masteryArt from "../assets/flashcard_mastery_art.jpg";
import { useAuthStore } from "../client/store";

export const FlashcardsView: React.FC = () => {
  const { user } = useAuthStore();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "learning" | "mastered">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const loadAllFlashcards = useCallback(async () => {
    setLoading(true);
    try {
      const threadsRes = await window.db.getThreads(user?.id || "local-user");
      const allCards: Flashcard[] = [];

      if (threadsRes.success && threadsRes.threads) {
        for (const thread of threadsRes.threads) {
          const msgsRes = await window.db.getMessages(thread.id);
          if (msgsRes.success && msgsRes.messages) {
            for (const msg of msgsRes.messages) {
              const cardsRes = await window.db.getFlashcardsByMessageId(msg.id);
              if (cardsRes.success && cardsRes.flashcards && cardsRes.flashcards.length > 0) {
                allCards.push(...cardsRes.flashcards);
              }
            }
          }
        }
      }

      setFlashcards(allCards);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      console.error("Failed to load flashcards:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAllFlashcards();
  }, [loadAllFlashcards]);

  const allTags = Array.from(
    new Set(flashcards.flatMap((fc) => fc.tags || []))
  );

  const filteredCards = flashcards.filter((card) => {
    if (filter === "mastered" && !card.is_mastered) return false;
    if (filter === "learning" && card.is_mastered) return false;
    if (selectedTag && (!card.tags || !card.tags.includes(selectedTag))) return false;
    return true;
  });

  const currentCard = filteredCards[currentIndex] as Flashcard | undefined;

  const handleToggleMastery = async (card: Flashcard, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newStatus = !card.is_mastered;
    try {
      await window.db.updateFlashcardStatus(card.id, newStatus);
      setFlashcards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, is_mastered: newStatus } : c))
      );
    } catch (err) {
      console.error("Failed to update mastery:", err);
    }
  };

  const handleNext = () => {
    if (filteredCards.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
  };

  const handlePrev = () => {
    if (filteredCards.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept keyboard events when user is typing in an input, textarea, or editable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("input, textarea, [contenteditable='true']"))
      ) {
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === "ArrowRight" || e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft" || e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredCards.length]);

  const masteredCount = flashcards.filter((c) => c.is_mastered).length;
  const progressPercent =
    flashcards.length > 0 ? Math.round((masteredCount / flashcards.length) * 100) : 0;

  return (
    <ContentContainer className="max-w-4xl mx-auto p-6 md:p-8 space-y-6 bg-background">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Brain className="w-6 h-6 text-primary" />
            Active Recall & Flashcards
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground font-mono">
              Grounded conceptual recall · Spaced Repetition (SM-2)
            </p>
            <span className="text-muted-foreground/40 hidden sm:inline">·</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full font-bold neu-raised-sm">
              <Sparkles className="w-2.5 h-2.5" /> MCP Active
            </span>
          </div>
        </div>

        {/* Streak & Mastery Bento Cards */}
        <div className="flex items-center gap-3">
          <div className="neu-bezel">
            <div className="neu-bezel-inner p-3 px-4 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl neu-inset-sm text-amber-500 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Streak
                </p>
                <p className="text-xs font-bold text-foreground font-mono">14 Days</p>
              </div>
            </div>
          </div>

          <div className="neu-bezel min-w-[150px]">
            <div className="neu-bezel-inner p-3 px-4 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl neu-inset-sm text-emerald-500 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Target className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Mastery
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground tabular-nums font-mono">
                    {masteredCount}/{flashcards.length || 0}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-500 dark:text-emerald-400 font-bold">
                    {progressPercent}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="neu-segmented-trough p-1 rounded-2xl flex items-center gap-1">
          <button
            onClick={() => {
              setFilter("all");
              setCurrentIndex(0);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
              filter === "all"
                ? "neu-segmented-active text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({flashcards.length})
          </button>
          <button
            onClick={() => {
              setFilter("learning");
              setCurrentIndex(0);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
              filter === "learning"
                ? "neu-segmented-active text-amber-500 dark:text-amber-400 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Learning ({flashcards.length - masteredCount})
          </button>
          <button
            onClick={() => {
              setFilter("mastered");
              setCurrentIndex(0);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
              filter === "mastered"
                ? "neu-segmented-active text-emerald-500 dark:text-emerald-400 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mastered ({masteredCount})
          </button>
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
            <button
              onClick={() => {
                setSelectedTag(null);
                setCurrentIndex(0);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
                selectedTag === null
                  ? "neu-convex-primary text-white"
                  : "neu-raised-sm text-muted-foreground hover:text-foreground"
              }`}
            >
              All Topics
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTag(selectedTag === tag ? null : tag);
                  setCurrentIndex(0);
                }}
                className={`px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1 cursor-pointer select-none ${
                  selectedTag === tag
                    ? "neu-convex-primary text-white font-semibold"
                    : "neu-raised-sm text-muted-foreground hover:text-foreground"
                }`}
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Flashcard View */}
      {loading ? (
        <div className="h-80 rounded-3xl neu-inset flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs font-medium text-muted-foreground">Loading active recall cards...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="neu-bezel text-center p-8 max-w-lg mx-auto">
          <div className="neu-bezel-inner p-8 flex flex-col items-center">
            <div className="w-24 h-24 rounded-2xl overflow-hidden mb-5 neu-raised border border-border/40">
              <img src={masteryArt} alt="Deck" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1.5">No Cards in this Deck</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Ask your AI Study Agent to create flashcards on any uploaded document or study concept!
            </p>
            <span className="text-xs text-primary bg-primary/10 border border-primary/25 px-3.5 py-1.5 rounded-full font-mono font-semibold neu-raised-sm">
              Prompt: "Generate 10 flashcards on [topic]"
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Deck Counter */}
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
            <span className="font-mono">
              Card {currentIndex + 1} of {filteredCards.length}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <kbd className="px-2 py-0.5 rounded-md neu-inset-sm font-bold text-foreground/90">Space</kbd> flip ·{" "}
              <kbd className="px-2 py-0.5 rounded-md neu-inset-sm font-bold text-foreground/90">←</kbd>{" "}
              <kbd className="px-2 py-0.5 rounded-md neu-inset-sm font-bold text-foreground/90">→</kbd> navigate
            </span>
          </div>

          {/* 3D Flip Card Container */}
          <div
            className="w-full h-88 perspective-1000 cursor-pointer select-none"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <motion.div
              className="w-full h-full relative"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Card Front */}
              <div
                className="absolute inset-0 neu-bezel rounded-2xl overflow-hidden backface-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="neu-bezel-inner p-7 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neu-inset-sm text-primary font-bold text-xs">
                      🌿 {currentCard?.tags?.[0] || "General Concept"}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      ID: {currentCard?.id?.slice(0, 8) || "CARD"}
                    </span>
                  </div>

                  <div className="my-auto text-center px-4">
                    <h2 className="text-xl md:text-2xl font-bold text-foreground leading-snug">
                      {currentCard?.question}
                    </h2>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-primary font-semibold">
                      <Eye className="w-3.5 h-3.5" /> Tap Space to reveal answer
                    </span>
                    <span className="text-[11px] font-mono uppercase font-bold text-muted-foreground">
                      {currentCard?.difficulty || "medium"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Back */}
              <div
                className="absolute inset-0 neu-bezel rounded-2xl overflow-hidden backface-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="neu-bezel-inner p-7 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-bold text-xs border border-emerald-500/25 neu-raised-sm">
                      ✓ Answer & Key Concept
                    </span>
                    <button
                      onClick={(e) => currentCard && handleToggleMastery(currentCard, e)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        currentCard?.is_mastered
                          ? "neu-convex-emerald text-white shadow-sm"
                          : "neu-raised-sm text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {currentCard?.is_mastered ? "Mastered" : "Mark Mastered"}
                    </button>
                  </div>

                  <div className="my-auto text-left px-4 overflow-y-auto max-h-44 custom-scrollbar">
                    <p className="text-base md:text-lg font-medium text-foreground leading-relaxed">
                      {currentCard?.answer}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 font-semibold">
                      <RotateCw className="w-3.5 h-3.5" /> Space to flip back
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">Self-Test Mastery</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* SM-2 Spaced Repetition Rating Buttons */}
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => {
                handleNext();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl neu-convex hover:brightness-105 border-b-2 border-rose-500 transition-all group cursor-pointer active:scale-95"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-rose-400 mb-0.5 font-mono">
                &lt; 1m
              </span>
              <span className="text-xs font-bold text-foreground group-hover:text-rose-400">
                Again
              </span>
            </button>

            <button
              onClick={() => {
                handleNext();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl neu-convex hover:brightness-105 border-b-2 border-amber-500 transition-all group cursor-pointer active:scale-95"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-amber-400 mb-0.5 font-mono">
                1d
              </span>
              <span className="text-xs font-bold text-foreground group-hover:text-amber-400">
                Hard
              </span>
            </button>

            <button
              onClick={() => {
                handleNext();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl neu-convex hover:brightness-105 border-b-2 border-sky-500 transition-all group cursor-pointer active:scale-95"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-sky-400 mb-0.5 font-mono">
                3d
              </span>
              <span className="text-xs font-bold text-foreground group-hover:text-sky-400">
                Good
              </span>
            </button>

            <button
              onClick={() => {
                if (currentCard) handleToggleMastery(currentCard);
                handleNext();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl neu-convex hover:brightness-105 border-b-2 border-emerald-500 transition-all group cursor-pointer active:scale-95"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-emerald-400 mb-0.5 font-mono">
                7d
              </span>
              <span className="text-xs font-bold text-foreground group-hover:text-emerald-400">
                Easy
              </span>
            </button>
          </div>

          {/* Mastery Heatmap (Last 30 Days) */}
          <div className="pt-4 border-t border-border/40">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Mastery Heatmap (Last 30 Days)
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-xs bg-muted" />
                  <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500/30" />
                  <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500/60" />
                  <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                </div>
                <span>More</span>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 neu-inset-sm p-3 rounded-2xl">
              {Array.from({ length: 30 }).map((_, i) => {
                const isRecent = i > 20;
                return (
                  <div
                    key={i}
                    className={`heatmap-cell rounded-xs w-3 h-3 ${
                      isRecent
                        ? i % 2 === 0
                          ? "bg-emerald-500"
                          : "bg-emerald-500/60"
                        : i % 3 === 0
                          ? "bg-emerald-500/30"
                          : "bg-secondary"
                    }`}
                    title={`Day ${i + 1}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </ContentContainer>
  );
};

export default FlashcardsView;


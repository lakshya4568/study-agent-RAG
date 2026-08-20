import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  Layers,
  BookOpen,
  Tag,
  Flame,
  Target,
  Eye,
  BookMarked,
  Edit3,
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import { Button, Card, Badge, LoadingSpinner } from "../components/ui";
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
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
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
    <ContentContainer className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      {/* Header Section (Stitch Spec) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Brain className="w-7 h-7 text-primary" />
            Active Recall & Flashcards
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              Grounded conceptual recall powered by spaced repetition
            </p>
            <span className="text-muted-foreground/40 hidden sm:inline">·</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.2 rounded-full font-semibold">
              <Sparkles className="w-2.5 h-2.5" /> MCP Skills Active (16 Tools)
            </span>
          </div>
        </div>

        {/* Streak & Daily Goal Bento Cards */}
        <div className="flex items-center gap-3">
          <div className="doppelrand bg-card rounded-2xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Streak
              </p>
              <p className="text-xs font-bold text-foreground">14 Days</p>
            </div>
          </div>

          <div className="doppelrand bg-card rounded-2xl p-3 flex items-center gap-2.5 min-w-[140px]">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Mastery
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground tabular-nums">
                  {masteredCount}/{flashcards.length || 0}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {progressPercent}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary border border-border">
          <button
            onClick={() => {
              setFilter("all");
              setCurrentIndex(0);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filter === "all"
                ? "bg-card text-foreground font-semibold shadow-sm"
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
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filter === "learning"
                ? "bg-card text-amber-400 font-semibold shadow-sm"
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
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filter === "mastered"
                ? "bg-card text-emerald-400 font-semibold shadow-sm"
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
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                selectedTag === null
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
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
                className={`px-2.5 py-1 rounded-full text-xs transition-all flex items-center gap-1 cursor-pointer ${
                  selectedTag === tag
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
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
        <div className="h-80 rounded-3xl bg-card/40 border border-border/40 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-muted-foreground">Loading active recall cards...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="doppelrand bg-card/80 rounded-3xl p-10 text-center flex flex-col items-center max-w-lg mx-auto">
          <div className="w-24 h-24 rounded-2xl overflow-hidden mb-5 ring-1 ring-border shadow-xl">
            <img src={masteryArt} alt="Deck" className="w-full h-full object-cover" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1.5">No Cards in this Deck</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Ask your AI Study Agent to create flashcards on any uploaded document or study concept!
          </p>
          <span className="text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full font-medium">
            Prompt: "Generate 10 flashcards on [topic]"
          </span>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Deck Counter */}
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
            <span>
              Card {currentIndex + 1} of {filteredCards.length}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border">Space</kbd> flip ·{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border">←</kbd>{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border">→</kbd> navigate
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
                className="absolute inset-0 doppelrand bg-card rounded-2xl p-7 flex flex-col justify-between backface-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-primary font-medium text-xs border border-border">
                    🌿 {currentCard?.tags?.[0] || "General Concept"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    ID: {currentCard?.id?.slice(0, 8) || "CARD"}
                  </span>
                </div>

                <div className="my-auto text-center px-4">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground leading-snug">
                    {currentCard?.question}
                  </h2>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-primary">
                    <Eye className="w-3.5 h-3.5" /> Click or press Space to reveal answer
                  </span>
                  <span className="text-[11px] font-mono uppercase text-muted-foreground">
                    {currentCard?.difficulty || "medium"}
                  </span>
                </div>
              </div>

              {/* Card Back */}
              <div
                className="absolute inset-0 doppelrand bg-card rounded-2xl p-7 flex flex-col justify-between backface-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-medium text-xs border border-emerald-500/20">
                    ✓ Answer & Breakdown
                  </span>
                  <button
                    onClick={(e) => currentCard && handleToggleMastery(currentCard, e)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      currentCard?.is_mastered
                        ? "bg-emerald-500 text-white shadow-md"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {currentCard?.is_mastered ? "Mastered" : "Mark Mastered"}
                  </button>
                </div>

                <div className="my-auto text-center px-4 overflow-y-auto max-h-44 custom-scrollbar">
                  <p className="text-base md:text-lg font-medium text-foreground leading-relaxed">
                    {currentCard?.answer}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <RotateCw className="w-3.5 h-3.5" /> Space to flip back
                  </span>
                  <span className="text-xs text-muted-foreground">Self-Test Mastery</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* SM-2 Spaced Repetition Rating Buttons (Stitch Spec) */}
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => {
                handleNext();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl doppelrand bg-card hover:bg-rose-500/10 border-b-3 border-rose-500 transition-all group cursor-pointer"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-rose-400 mb-0.5">
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
              className="flex flex-col items-center justify-center p-3 rounded-2xl doppelrand bg-card hover:bg-amber-500/10 border-b-3 border-amber-500 transition-all group cursor-pointer"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-amber-400 mb-0.5">
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
              className="flex flex-col items-center justify-center p-3 rounded-2xl doppelrand bg-card hover:bg-sky-500/10 border-b-3 border-sky-500 transition-all group cursor-pointer"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-sky-400 mb-0.5">
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
              className="flex flex-col items-center justify-center p-3 rounded-2xl doppelrand bg-card hover:bg-emerald-500/10 border-b-3 border-emerald-500 transition-all group cursor-pointer"
            >
              <span className="text-[10px] text-muted-foreground group-hover:text-emerald-400 mb-0.5">
                7d
              </span>
              <span className="text-xs font-bold text-foreground group-hover:text-emerald-400">
                Easy
              </span>
            </button>
          </div>

          {/* Mastery Heatmap (Last 30 Days) */}
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Mastery Heatmap (Last 30 Days)
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-xs bg-secondary" />
                  <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500/30" />
                  <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500/60" />
                  <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                </div>
                <span>More</span>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {Array.from({ length: 30 }).map((_, i) => {
                const isRecent = i > 20;
                return (
                  <div
                    key={i}
                    className={`heatmap-cell ${
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

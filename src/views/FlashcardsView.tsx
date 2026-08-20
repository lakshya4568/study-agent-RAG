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
      // Fetch threads to collect messages and flashcards
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

  // Extract unique tags
  const allTags = Array.from(
    new Set(flashcards.flatMap((fc) => fc.tags || []))
  );

  // Filter flashcards
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
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/40">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Brain className="w-7 h-7 text-primary" />
            Active Recall Studio
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Master your study topics through spaced repetition and self-testing.
          </p>
        </div>

        {/* Global Progress Pill */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-card/60 border border-border/40 shadow-sm">
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-medium">Mastery</p>
            <p className="text-sm font-bold text-emerald-400 tabular-nums">
              {masteredCount} / {flashcards.length} ({progressPercent}%)
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
            {progressPercent}%
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/40 border border-border/30">
          <button
            onClick={() => {
              setFilter("all");
              setCurrentIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              filter === "all"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Cards ({flashcards.length})
          </button>
          <button
            onClick={() => {
              setFilter("learning");
              setCurrentIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              filter === "learning"
                ? "bg-card text-amber-400 shadow-sm font-semibold"
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
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              filter === "mastered"
                ? "bg-card text-emerald-400 shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mastered ({masteredCount})
          </button>
        </div>

        {/* Tags filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
            <button
              onClick={() => {
                setSelectedTag(null);
                setCurrentIndex(0);
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                selectedTag === null
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
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
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  selectedTag === tag
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Flashcard Studio */}
      {loading ? (
        <div className="h-80 rounded-3xl bg-card/30 border border-border/40 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-muted-foreground">Loading active recall cards...</p>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="double-bezel p-12 text-center">
          <div className="double-bezel-inner p-10 flex flex-col items-center max-w-lg mx-auto">
            <div className="w-28 h-28 rounded-3xl overflow-hidden mb-6 ring-1 ring-white/10 shadow-2xl">
              <img src={masteryArt} alt="Mastery Deck" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No Study Cards in Deck</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Ask your AI Study Agent to create flashcards on any concept or study document in the
              Chat view!
            </p>
            <Badge variant="outline" size="md" className="rounded-full gap-1.5 text-primary border-primary/30">
              <Sparkles className="w-3.5 h-3.5" /> Prompt: "Generate 10 flashcards for [topic]"
            </Badge>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Deck Counter & Flip Hint */}
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-2">
            <span>
              Card {currentIndex + 1} of {filteredCards.length}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <kbd className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/40">Space</kbd>{" "}
              flip ·{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/40">←</kbd>{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/40">→</kbd>{" "}
              navigate
            </span>
          </div>

          {/* 3D Flip Card Container */}
          <div
            className="w-full h-96 perspective-1000 cursor-pointer select-none"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <motion.div
              className="w-full h-full relative"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Front Side (Question) */}
              <div
                className="absolute inset-0 double-bezel backface-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="double-bezel-inner h-full p-8 flex flex-col justify-between bg-gradient-to-br from-card via-card to-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                      Question
                    </span>
                    {currentCard?.difficulty && (
                      <Badge
                        variant={
                          currentCard.difficulty === "hard"
                            ? "error"
                            : currentCard.difficulty === "medium"
                              ? "warning"
                              : "success"
                        }
                        size="sm"
                        className="rounded-full uppercase"
                      >
                        {currentCard.difficulty}
                      </Badge>
                    )}
                  </div>

                  <div className="my-auto text-center px-4">
                    <p className="text-xl md:text-2xl font-bold text-foreground leading-snug">
                      {currentCard?.question}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border/30 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 text-primary">
                      <RotateCw className="w-3.5 h-3.5" /> Click or press Space to reveal answer
                    </span>
                    {currentCard?.tags && (
                      <div className="flex gap-1.5">
                        {currentCard.tags.slice(0, 2).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-md bg-muted/60 text-[10px]">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Back Side (Answer) */}
              <div
                className="absolute inset-0 double-bezel backface-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="double-bezel-inner h-full p-8 flex flex-col justify-between bg-gradient-to-br from-card via-card to-emerald-950/10">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Answer & Explanation
                    </span>
                    <button
                      onClick={(e) => currentCard && handleToggleMastery(currentCard, e)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        currentCard?.is_mastered
                          ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {currentCard?.is_mastered ? "Mastered" : "Mark as Mastered"}
                    </button>
                  </div>

                  <div className="my-auto text-center px-4 overflow-y-auto max-h-48 custom-scrollbar">
                    <p className="text-lg md:text-xl font-medium text-foreground leading-relaxed">
                      {currentCard?.answer}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border/30 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <RotateCw className="w-3.5 h-3.5" /> Click or press Space to flip back
                    </span>
                    <span>Self-Grade: Honest recall</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="secondary"
              onClick={handlePrev}
              icon={<ChevronLeft className="w-4 h-4" />}
              className="rounded-full px-5"
            >
              Previous
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCw className="w-4 h-4" />}
                onClick={() => setIsFlipped(!isFlipped)}
                className="rounded-full text-xs font-medium"
              >
                Flip Card
              </Button>
            </div>

            <Button
              variant="primary"
              onClick={handleNext}
              icon={<ChevronRight className="w-4 h-4" />}
              iconPosition="right"
              className="rounded-full px-6"
            >
              Next Card
            </Button>
          </div>
        </div>
      )}
    </ContentContainer>
  );
};

export default FlashcardsView;

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle,
  Download,
  Shuffle,
  X,
  Brain,
  Trophy,
  Sparkles,
} from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import type { Flashcard } from "../../client/types";

interface FlashcardViewerProps {
  flashcards: Flashcard[];
  onClose?: () => void;
  messageId: string; // Used to persist changes
}

export const FlashcardViewer: React.FC<FlashcardViewerProps> = ({
  flashcards: initialFlashcards,
  onClose,
  messageId,
}) => {
  const [cards, setCards] = useState<Flashcard[]>(initialFlashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right

  // Sync state with DB on mount and when messageId changes
  useEffect(() => {
    const loadCardStates = async () => {
      try {
        const savedCards = await window.db.getFlashcardsByMessageId(messageId);
        if (savedCards.success && savedCards.flashcards && savedCards.flashcards.length > 0) {
          setCards(savedCards.flashcards);
        } else {
          setCards(initialFlashcards);
        }
      } catch (error) {
        console.error("Failed to load flashcard states:", error);
        setCards(initialFlashcards);
      }
    };

    loadCardStates();
  }, [messageId, initialFlashcards]);

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    if (!cards.length) return;
    setDirection(1);
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    if (!cards.length) return;
    setDirection(-1);
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
  };

  const handleToggleMastered = async () => {
    if (!currentCard) return;

    const newStatus = !currentCard.is_mastered;

    // Optimistic update
    const updatedCards = [...cards];
    updatedCards[currentIndex] = { ...currentCard, is_mastered: newStatus };
    setCards(updatedCards);

    // Persist
    try {
      await window.db.updateFlashcardStatus(currentCard.id, newStatus);
    } catch (error) {
      console.error("Failed to update flashcard status:", error);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(cards, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flashcards-${messageId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const masteredCount = cards.length > 0 ? cards.filter((c) => c.is_mastered).length : 0;
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

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

      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handleFlip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cards.length, currentIndex]);

  if (!currentCard) return null;

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 50 : -50,
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <div className="neu-bezel max-w-2xl mx-auto my-6 overflow-hidden flex flex-col h-[560px]">
      <div className="neu-bezel-inner flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-4 px-5 border-b border-border/40 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl neu-inset-sm flex items-center justify-center text-primary">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground tracking-tight flex items-center gap-2">
                Active Recall Deck
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                <span>Card {currentIndex + 1} of {cards.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/25 text-xs text-emerald-500 dark:text-emerald-400 font-bold neu-inset-sm">
              <Trophy className="w-3.5 h-3.5" />
              {masteredCount} Mastered
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShuffle}
              title="Shuffle"
              className="w-8 h-8 rounded-full"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExport}
              title="Export JSON"
              className="w-8 h-8 rounded-full"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="w-8 h-8 rounded-full text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Tactile Progress Bar */}
        <div className="w-full bg-secondary h-1.5 neu-inset-sm">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          />
        </div>

        {/* Card Canvas Area */}
        <div className="flex-1 relative p-6 md:p-8 flex items-center justify-center perspective-1000 bg-background overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 350, damping: 30 },
                opacity: { duration: 0.15 },
                scale: { duration: 0.15 },
              }}
              className="relative w-full h-full max-h-[380px] cursor-pointer group perspective-1000 select-none"
              onClick={handleFlip}
            >
              <motion.div
                className="w-full h-full relative preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Front (Question) */}
                <div className="absolute inset-0 backface-hidden neu-raised rounded-2xl p-7 flex flex-col items-center justify-between text-center overflow-y-auto custom-scrollbar">
                  <div className="w-full flex items-center justify-between border-b border-border/40 pb-3">
                    <Badge
                      variant={currentCard.difficulty === "hard" ? "error" : currentCard.difficulty === "medium" ? "warning" : "success"}
                      size="sm"
                      pip
                    >
                      {currentCard.difficulty.toUpperCase()}
                    </Badge>
                    <span className="text-[10px] font-mono text-muted-foreground">Tap Space to Flip</span>
                  </div>

                  <h3 className="text-lg md:text-xl font-bold text-foreground leading-snug my-auto px-2">
                    {currentCard.question}
                  </h3>

                  <div className="w-full pt-3 border-t border-border/40 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    <RotateCw className="w-3 h-3 text-primary" /> Reveal Answer
                  </div>

                  {currentCard.is_mastered && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-4 right-4 text-emerald-500 dark:text-emerald-400 bg-emerald-500/15 p-1 rounded-full border border-emerald-500/30"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </motion.div>
                  )}
                </div>

                {/* Back (Answer) */}
                <div
                  className="absolute inset-0 backface-hidden neu-raised rounded-2xl p-7 flex flex-col items-center justify-between text-center rotate-y-180 overflow-y-auto custom-scrollbar"
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <div className="w-full flex items-center justify-between border-b border-border/40 pb-3">
                    <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Answer & Key Concept
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">Self-Test</span>
                  </div>

                  <div className="my-auto text-left w-full px-2">
                    <p className="text-sm md:text-base text-foreground leading-relaxed font-normal">
                      {currentCard.answer}
                    </p>
                  </div>

                  <div className="w-full pt-3 border-t border-border/40 flex gap-1.5 flex-wrap justify-center">
                    {currentCard.tags?.map((tag) => (
                      <span key={tag} className="text-[10px] font-medium neu-inset-sm px-2.5 py-1 rounded-full text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls Bottom Bar */}
        <div className="p-4 px-5 border-t border-border/40 flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="text-xs font-medium"
            icon={<ChevronLeft className="w-4 h-4" />}
          >
            Previous
          </Button>

          <Button
            variant={currentCard.is_mastered ? "emerald" : "primary"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleMastered();
            }}
            icon={<CheckCircle className="w-4 h-4" />}
          >
            {currentCard.is_mastered ? "Mastered!" : "Mark as Mastered"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="text-xs font-medium"
            icon={<ChevronRight className="w-4 h-4" />}
            iconPosition="right"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};


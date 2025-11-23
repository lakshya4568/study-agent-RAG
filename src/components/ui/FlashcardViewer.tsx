import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
           // If DB has records, use them as they contain the mastery status
           setCards(savedCards.flashcards);
        } else {
           // Fallback: If DB is empty (e.g., delay in saving), use props
           // This ensures the component isn't empty
           setCards(initialFlashcards);
        }
      } catch (error) {
        console.error("Failed to load flashcard states:", error);
        setCards(initialFlashcards);
      }
    };

    // Load immediately
    loadCardStates();
  }, [messageId, initialFlashcards]); // Depend on initialFlashcards too in case it updates

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
      // Revert on error (optional, maybe too jarring for user?)
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
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === " " || e.key === "Enter") {
         e.preventDefault();
         handleFlip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cards.length, currentIndex]); // Add currentIndex to dependency if handlers depended on it, but they use setState callback so it's fine.

  if (!currentCard) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-emerald-100 dark:border-emerald-900 overflow-hidden flex flex-col max-w-2xl mx-auto my-4 h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
          <Brain className="w-5 h-5" />
          <span className="font-bold">Flashcards</span>
          <Badge variant="success" size="sm" className="ml-2">
            {currentIndex + 1} / {cards.length}
          </Badge>
        </div>
        <div className="flex gap-2">
           <div className="flex items-center gap-1 text-xs text-emerald-600 mr-2 font-medium">
             <Trophy className="w-3 h-3" />
             {masteredCount} Mastered
           </div>
          <Button variant="ghost" size="sm" onClick={handleShuffle} title="Shuffle">
            <Shuffle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport} title="Export JSON">
            <Download className="w-4 h-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 dark:bg-gray-700 h-1">
        <div
          className="bg-emerald-500 h-1 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card Area */}
      <div className="flex-1 relative p-8 flex items-center justify-center perspective-1000 overflow-y-auto">
        <div
          className="relative w-full h-full cursor-pointer group perspective-1000"
          onClick={handleFlip}
        >
          <motion.div
            className="w-full h-full relative preserve-3d transition-all duration-500"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Front (Question) */}
            <div className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-emerald-100 dark:border-emerald-800 flex flex-col items-center justify-center p-6 text-center hover:border-emerald-300 transition-colors overflow-y-auto custom-scrollbar">
              <div className="mb-4">
                <Badge variant={currentCard.difficulty === 'hard' ? 'error' : currentCard.difficulty === 'medium' ? 'warning' : 'success'}>
                  {currentCard.difficulty}
                </Badge>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100">
                {currentCard.question}
              </h3>
              <p className="mt-8 text-sm text-gray-400 flex items-center gap-1">
                <RotateCw className="w-3 h-3" /> Click or Space to flip
              </p>
              {currentCard.is_mastered && (
                 <div className="absolute top-4 right-4 text-emerald-500">
                    <CheckCircle className="w-6 h-6" />
                 </div>
              )}
            </div>

            {/* Back (Answer) */}
            <div
              className="absolute inset-0 backface-hidden bg-linear-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-2xl shadow-sm border-2 border-emerald-200 dark:border-emerald-700 flex flex-col items-center justify-center p-6 text-center rotate-y-180 overflow-y-auto custom-scrollbar"
              style={{ transform: "rotateY(180deg)" }}
            >
              <div className="prose dark:prose-invert max-w-none w-full">
                <p className="text-lg text-gray-800 dark:text-gray-100 leading-relaxed">
                  {currentCard.answer}
                </p>
              </div>

              <div className="mt-8 flex gap-2 flex-wrap justify-center">
                  {currentCard.tags.map(tag => (
                      <span key={tag} className="text-xs bg-white/50 dark:bg-black/20 px-2 py-1 rounded-full text-emerald-700 dark:text-emerald-300">
                          #{tag}
                      </span>
                  ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
        <Button
          variant="outline"
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          icon={<ChevronLeft className="w-4 h-4" />}
        >
          Prev
        </Button>

        <Button
          variant={currentCard.is_mastered ? "primary" : "outline"}
          onClick={(e) => {
              e.stopPropagation();
              handleToggleMastered();
          }}
          className={currentCard.is_mastered ? "bg-emerald-600 hover:bg-emerald-700" : ""}
        >
          {currentCard.is_mastered ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" /> Mastered
            </>
          ) : (
            "Mark as Mastered"
          )}
        </Button>

        <Button
          variant="outline"
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          icon={<ChevronRight className="w-4 h-4" />}
          iconPosition="right"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

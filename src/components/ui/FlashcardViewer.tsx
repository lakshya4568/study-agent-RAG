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
          // If DB has records, use them as they contain the mastery status
          setCards(savedCards.flashcards);
        } else {
          // Fallback: If DB is empty (e.g., delay in saving), use props
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
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cards.length, currentIndex]);

  if (!currentCard) return null;

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0,
      scale: 0.9,
    }),
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border-4 border-transparent bg-clip-padding relative overflow-hidden flex flex-col max-w-2xl mx-auto my-6 h-[600px] ring-4 ring-pink-100/50">
      {/* Colorful Gradient Border Effect */}
      <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-pink-400 via-purple-400 to-cyan-400 -z-10 m-[-4px]" />

      {/* Header */}
      <div className="p-5 border-b border-pink-100 flex justify-between items-center bg-linear-to-r from-pink-50 via-white to-cyan-50">
        <div className="flex items-center gap-3 text-gray-800">
          <div className="p-2 bg-white rounded-xl shadow-sm text-pink-500">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg bg-clip-text text-transparent bg-linear-to-r from-pink-500 to-violet-600">
              Study Time
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <span>Card {currentIndex + 1} of {cards.length}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow-sm border border-pink-100 text-xs text-pink-600 font-bold mr-2">
            <Trophy className="w-3.5 h-3.5" />
            {masteredCount} Mastered
          </div>
          <Button variant="ghost" size="sm" onClick={handleShuffle} title="Shuffle" className="text-gray-500 hover:text-pink-500 hover:bg-pink-50 rounded-full w-9 h-9 p-0">
            <Shuffle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport} title="Export JSON" className="text-gray-500 hover:text-cyan-500 hover:bg-cyan-50 rounded-full w-9 h-9 p-0">
            <Download className="w-4 h-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full w-9 h-9 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-pink-50 h-1.5">
        <motion.div
          className="h-full bg-linear-to-r from-pink-400 via-purple-400 to-cyan-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>

      {/* Card Area */}
      <div className="flex-1 relative p-6 md:p-10 flex items-center justify-center perspective-1000 bg-linear-to-b from-white to-pink-50/30 overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
              scale: { duration: 0.2 },
            }}
            className="relative w-full h-full max-h-[400px] cursor-pointer group perspective-1000"
            onClick={handleFlip}
          >
            <motion.div
              className="w-full h-full relative preserve-3d transition-all duration-500"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Front (Question) */}
              <div className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-xl border border-pink-100 flex flex-col items-center justify-center p-8 text-center hover:shadow-2xl hover:border-pink-200 transition-all duration-300 overflow-y-auto custom-scrollbar">
                <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-pink-300 to-purple-300 rounded-t-3xl opacity-50" />

                <div className="mb-6">
                  <Badge
                    variant={currentCard.difficulty === 'hard' ? 'error' : currentCard.difficulty === 'medium' ? 'warning' : 'success'}
                    className="shadow-sm border-0 ring-1 ring-inset ring-black/5"
                  >
                    {currentCard.difficulty.toUpperCase()}
                  </Badge>
                </div>

                <h3 className="text-xl md:text-2xl font-bold text-gray-800 leading-tight">
                  {currentCard.question}
                </h3>

                <div className="mt-auto pt-8 flex flex-col items-center gap-2">
                  <div className="w-12 h-1 bg-gray-100 rounded-full mb-2" />
                  <p className="text-sm text-gray-400 font-medium flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                    <RotateCw className="w-3 h-3" /> Tap to flip
                  </p>
                </div>

                {currentCard.is_mastered && (
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute top-6 right-6 text-green-500 bg-green-50 rounded-full p-1"
                  >
                    <CheckCircle className="w-8 h-8 fill-green-500 text-white" />
                  </motion.div>
                )}
              </div>

              {/* Back (Answer) */}
              <div
                className="absolute inset-0 backface-hidden bg-linear-to-br from-cyan-50 via-white to-blue-50 rounded-3xl shadow-xl border border-cyan-100 flex flex-col items-center justify-center p-8 text-center rotate-y-180 overflow-y-auto custom-scrollbar"
                style={{ transform: "rotateY(180deg)" }}
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-cyan-300 to-blue-300 rounded-t-3xl opacity-50" />

                <div className="prose prose-lg max-w-none w-full mb-auto mt-4">
                  <p className="text-lg md:text-xl text-gray-700 leading-relaxed font-medium">
                    {currentCard.answer}
                  </p>
                </div>

                <div className="mt-8 flex gap-2 flex-wrap justify-center w-full">
                  {currentCard.tags.map(tag => (
                    <span key={tag} className="text-xs font-bold bg-white px-3 py-1.5 rounded-full text-cyan-600 shadow-sm border border-cyan-100 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="p-6 border-t border-pink-50 flex justify-between items-center bg-white">
        <Button
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          className="text-gray-500 hover:text-pink-600 hover:bg-pink-50 pl-2 pr-4"
        >
          <ChevronLeft className="w-5 h-5 mr-1" /> Previous
        </Button>

        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleMastered();
          }}
          className={`
            transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl
            ${currentCard.is_mastered
              ? "bg-green-500 hover:bg-green-600 text-white ring-4 ring-green-100"
              : "bg-linear-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white ring-4 ring-pink-100"}
          `}
        >
          {currentCard.is_mastered ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" /> Mastered!
            </>
          ) : (
            <>
              Mark as Mastered
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          className="text-gray-500 hover:text-pink-600 hover:bg-pink-50 pr-2 pl-4"
        >
          Next <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
      </div>
    </div>
  );
};

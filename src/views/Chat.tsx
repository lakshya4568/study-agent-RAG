import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  FileText,
  Brain,
  BookOpen,
  Lightbulb,
  Calendar,
  PenTool,
  Trash2,
  Paperclip,
  Sparkles,
  X,
  History,
  MessageSquare,
  Search,
  CheckCircle2,
  AlertCircle,
  Cpu,
} from "lucide-react";
import { Drawer } from "../components/ui/Drawer";
import { cn } from "../lib/utils";
import {
  Button,
  TextArea,
  MessageBubble,
  LoadingSpinner,
  Badge,
  ToolCallApproval,
  PendingToolCall,
} from "../components/ui";
import { useChatStore, useAuthStore } from "../client/store";
import heroBackdrop from "../assets/study_hero_backdrop.jpg";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolCalls?: unknown[];
}

const studyAccelerators = [
  {
    id: "summarize",
    Icon: FileText,
    title: "Executive Synthesis",
    description: "Distill key principles from active study documents",
    prompt: "Please provide an executive summary of the main arguments in our study documents.",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    id: "flashcards",
    Icon: Brain,
    title: "Active Recall Deck",
    description: "Generate 10 structured conceptual flashcards",
    prompt: "Create 10 high-yield study flashcards based on the uploaded material.",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    id: "feynman",
    Icon: Lightbulb,
    title: "Feynman Breakdown",
    description: "Explain difficult mechanisms using intuitive mental models",
    prompt: "Break down the most complex concept from the documents using the Feynman technique.",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "quiz",
    Icon: BookOpen,
    title: "Practice Exam",
    description: "Test mastery with multiple-choice and short-answer prompts",
    prompt: "Generate a rigorous 5-question test with step-by-step solutions to assess my understanding.",
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  },
  {
    id: "schedule",
    Icon: Calendar,
    title: "Mastery Roadmap",
    description: "Build an optimized multi-day revision schedule",
    prompt: "Help me design a spaced repetition study schedule to master this topic in 7 days.",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  {
    id: "practice",
    Icon: PenTool,
    title: "Problem Solver",
    description: "Walk through step-by-step problem sets",
    prompt: "Give me an applied problem related to our topic and guide me through the solution.",
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
];

interface ChatProps {
  onRegisterActions?: (actions: {
    createNewThread: () => void;
    openHistory: () => void;
  }) => void;
}

export const Chat: React.FC<ChatProps> = ({ onRegisterActions }) => {
  const { activeThreadId, setActiveThreadId, selectedDocument, setSelectedDocument } =
    useChatStore();
  const { user } = useAuthStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCall[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: string;
    message: string;
    fileName?: string;
  } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [threads, setThreads] = useState<
    Array<{ id: string; title: string; created_at: number }>
  >([]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUp = useRef(false);

  // Load threads and messages
  const loadThreads = useCallback(async () => {
    try {
      const result = await window.db.getThreads(user?.id || "local-user");
      if (result.success && result.threads) {
        setThreads(result.threads);
      }
    } catch (err) {
      console.error("Failed to load threads:", err);
    }
  }, [user?.id]);

  const loadMessages = useCallback(async (threadId: string) => {
    try {
      const result = await window.db.getMessages(threadId);
      if (result.success && result.messages) {
        setMessages(
          result.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  const checkPendingTools = useCallback(async () => {
    try {
      const pending = await window.mcpClient.getPendingToolRequests();
      setPendingToolCalls((pending || []) as PendingToolCall[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadThreads();
    checkPendingTools();
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId, loadThreads, loadMessages, checkPendingTools]);

  // Register parent actions
  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        createNewThread,
        openHistory: () => setShowHistory(true),
      });
    }
  }, [onRegisterActions]);

  // Smart Auto-Scroll: only scroll if user hasn't scrolled up
  useEffect(() => {
    if (!isUserScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    // If distance from bottom is greater than 150px, mark as scrolled up
    isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 150;
  };

  const createNewThread = async () => {
    const id = crypto.randomUUID();
    const title = "New Study Session";
    await window.db.createThread(id, title, user.id);
    setActiveThreadId(id);
    setMessages([]);
    await loadThreads();
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    let currentThreadId = activeThreadId;
    if (!currentThreadId) {
      currentThreadId = crypto.randomUUID();
      await window.db.createThread(currentThreadId, "New Study Session", user.id);
      setActiveThreadId(currentThreadId);
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    isUserScrolledUp.current = false;

    await window.db.saveMessage({
      id: userMessage.id,
      threadId: currentThreadId,
      role: userMessage.role,
      content: userMessage.content,
      timestamp: userMessage.timestamp.getTime(),
    });

    // Derive a clean thread title from first message
    const candidateTitle = userMessage.content.trim().replace(/\s+/g, " ");
    const newTitle =
      candidateTitle.length > 35 ? `${candidateTitle.slice(0, 35)}...` : candidateTitle;
    await window.db.updateThreadTitle(currentThreadId, newTitle);

    try {
      if (!window.studyAgent) throw new Error("Study agent runtime is offline.");

      const result = await window.studyAgent.sendMessage({
        threadId: currentThreadId,
        message: userMessage.content,
        messageId: userMessage.id,
      });

      if (!result.success) {
        throw new Error(result.error ?? "Unknown error during response generation");
      }

      if (result.messages) {
        const toolMessages = result.messages
          .filter((msg) => msg.role === "tool")
          .map((msg, idx) => ({
            id: `tool-${Date.now()}-${idx}`,
            role: "system" as const,
            content: `⚡ **${msg.name ?? "Tool"}**: ${msg.content}`,
            timestamp: new Date(),
          }));
        if (toolMessages.length) {
          setMessages((prev) => [...prev, ...toolMessages]);
        }
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: result.finalMessage ?? "I am ready to assist with your studies.",
        timestamp: new Date(),
      };

      // Check for flashcards JSON format
      let potentialJson = assistantMessage.content.trim();
      const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
      const match = potentialJson.match(codeBlockRegex);
      if (match) {
        potentialJson = match[1].trim();
      }

      if (potentialJson.startsWith("{")) {
        try {
          const parsed = JSON.parse(potentialJson);
          if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
            const enrichedFlashcards = parsed.flashcards.map((card: any, idx: number) => ({
              ...card,
              id: `fc-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 6)}`,
              set_id: `set-${Date.now()}`,
              is_mastered: false,
              created_at: Date.now(),
              message_id: assistantMessage.id,
            }));

            parsed.flashcards = enrichedFlashcards;
            assistantMessage.content = JSON.stringify(parsed);

            await window.db.saveMessage({
              id: assistantMessage.id,
              threadId: currentThreadId,
              role: assistantMessage.role,
              content: assistantMessage.content,
              timestamp: assistantMessage.timestamp.getTime(),
            });

            for (const card of enrichedFlashcards) {
              await window.db.saveFlashcard(card);
            }

            setMessages((prev) => [...prev, assistantMessage]);
            await loadThreads();
            return;
          }
        } catch {
          // Not flashcard JSON, continue standard save
        }
      }

      setMessages((prev) => [...prev, assistantMessage]);

      await window.db.saveMessage({
        id: assistantMessage.id,
        threadId: currentThreadId,
        role: assistantMessage.role,
        content: assistantMessage.content,
        timestamp: assistantMessage.timestamp.getTime(),
      });

      await loadThreads();
    } catch (err) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "system",
        content: `⚠️ Encountered an issue: ${err instanceof Error ? err.message : "Service timeout"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      checkPendingTools();
    }
  };

  const handleToolApprove = async (toolCallId: string) => {
    if (!activeThreadId) return;
    try {
      await window.mcpClient.approveToolExecution(toolCallId);
      setPendingToolCalls((prev) => prev.filter((t) => t.id !== toolCallId));
    } catch (err) {
      console.error("Failed to approve tool:", err);
    }
  };

  const handleToolDeny = async (toolCallId: string) => {
    if (!activeThreadId) return;
    try {
      await window.mcpClient.denyToolExecution(toolCallId);
      setPendingToolCalls((prev) => prev.filter((t) => t.id !== toolCallId));
    } catch (err) {
      console.error("Failed to deny tool:", err);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      await window.db.deleteThread(threadId);
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
      await loadThreads();
    } catch (err) {
      console.error("Failed to delete thread:", err);
    }
  };

  const handleFileUpload = async () => {
    if (uploading) return;

    let currentThreadId = activeThreadId;
    if (!currentThreadId) {
      currentThreadId = crypto.randomUUID();
      await window.db.createThread(currentThreadId, "New Study Session", user.id);
      setActiveThreadId(currentThreadId);
    }

    try {
      setUploading(true);
      setUploadStatus(null);
      setUploadProgress({
        stage: "selecting",
        message: "Selecting document...",
      });

      const dialogResult = await window.studyAgent.openFileDialog();
      if (!dialogResult.success || dialogResult.filePaths.length === 0) {
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      const filePaths = dialogResult.filePaths;
      const fileName = filePaths[0].split("/").pop() || "Document.pdf";

      setUploadProgress({
        stage: "chunking",
        message: `Tokenizing and indexing ${fileName}...`,
        fileName,
      });

      const result = await window.studyAgent.addDocuments(filePaths);

      if (result.success) {
        setUploadProgress({
          stage: "complete",
          message: `Indexed ${fileName}`,
          fileName,
        });

        setSelectedDocument(filePaths[0]);

        const successMsg: Message = {
          id: `msg-${Date.now()}`,
          role: "system",
          content: `📄 **${fileName}** is indexed in the vector database with semantic chunking. You can now ask questions, extract concepts, or generate flashcards from it.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMsg]);

        await window.db.saveMessage({
          id: successMsg.id,
          threadId: currentThreadId,
          role: successMsg.role,
          content: successMsg.content,
          timestamp: successMsg.timestamp.getTime(),
        });
      } else {
        throw new Error(result.errors.join(", ") || "Failed to parse document");
      }
    } catch (err) {
      setUploadStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Document upload failed",
      });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 2500);
    }
  };

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex flex-col h-full p-0 flex-1 min-w-0 relative">
        {/* Message Viewport */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar"
        >
          {messages.length === 0 ? (
            /* High-End Hero Empty State */
            <div className="max-w-4xl mx-auto py-6 space-y-8">
              {/* Hero Banner with Generated 3D Asset */}
              <div className="double-bezel overflow-hidden">
                <div className="double-bezel-inner p-8 md:p-10 relative overflow-hidden bg-card/60">
                  {/* Subtle Background Art */}
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-25 pointer-events-none overflow-hidden">
                    <img
                      src={heroBackdrop}
                      alt="Study Hero"
                      className="w-full h-full object-cover object-left"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent" />
                  </div>

                  <div className="relative z-10 max-w-lg space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                      <Sparkles className="w-3.5 h-3.5" /> Autonomous Study Partner
                    </div>
                    <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
                      Master Any Topic with Grounded AI
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Upload textbook PDFs, lecture notes, or syllabus docs. Your agent indexes
                      chunks into a local vector store to generate explanations, flashcards, and
                      practice quizzes.
                    </p>
                    <div className="pt-2 flex items-center gap-3">
                      <Button
                        onClick={handleFileUpload}
                        icon={<Paperclip className="w-4 h-4" />}
                        className="rounded-full px-5 shadow-lg shadow-primary/20"
                      >
                        Upload Study PDF
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setInput("Explain the most important principles of our subject.");
                          inputRef.current?.focus();
                        }}
                        className="rounded-full px-4"
                      >
                        Quick Start
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Study Accelerators Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Study Accelerators
                  </span>
                  <span className="text-xs text-muted-foreground/60">Click to run prompt</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {studyAccelerators.map((action) => {
                    const Icon = action.Icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => {
                          setInput(action.prompt);
                          inputRef.current?.focus();
                        }}
                        className="p-4 rounded-2xl bg-card/40 hover:bg-card/80 border border-border/40 hover:border-primary/40 text-left transition-all duration-200 group flex items-start gap-3.5 shadow-sm hover:shadow-md active:scale-[0.99]"
                      >
                        <div
                          className={`p-2.5 rounded-xl border ${action.color} shrink-0 group-hover:scale-105 transition-transform`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {action.title}
                          </h3>
                          <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed line-clamp-2">
                            {action.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Active Message Timeline */
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  id={msg.id}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                />
              ))}

              {/* Pending Tool Execution Approval Cards */}
              {pendingToolCalls.map((toolCall) => (
                <ToolCallApproval
                  key={toolCall.id}
                  toolCall={toolCall}
                  onApprove={handleToolApprove}
                  onDeny={handleToolDeny}
                />
              ))}

              {/* Thinking / Streaming Indicator */}
              {loading && (
                <div className="flex gap-3.5 items-center">
                  <div className="w-9 h-9 rounded-2xl bg-muted/60 border border-border/50 flex items-center justify-center text-primary">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="double-bezel">
                    <div className="double-bezel-inner px-4 py-3 flex items-center gap-2.5 text-xs text-muted-foreground">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                      </div>
                      <span className="font-medium">Synthesizing response...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating Input Dock */}
        <div className="shrink-0 p-4 pt-2 z-20 flex justify-center bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="w-full max-w-4xl space-y-2">
            {/* Upload Feedback Banner */}
            <AnimatePresence>
              {(uploadProgress || uploadStatus) && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="px-2"
                >
                  {uploadProgress && (
                    <div className="p-3 rounded-2xl bg-card border border-border/60 shadow-lg flex items-center gap-3">
                      <LoadingSpinner size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {uploadProgress.message}
                        </p>
                      </div>
                    </div>
                  )}
                  {uploadStatus && !uploadProgress && (
                    <div
                      className={cn(
                        "p-3 rounded-2xl text-xs font-medium flex items-center gap-2 shadow-lg border",
                        uploadStatus.type === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      )}
                    >
                      {uploadStatus.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      <span>{uploadStatus.message}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active Document Attachment Chip */}
            {selectedDocument && (
              <div className="px-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium shadow-sm">
                  <Paperclip className="w-3 h-3" />
                  <span className="truncate max-w-[200px]">
                    {selectedDocument.split("/").pop()}
                  </span>
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="hover:bg-primary/20 rounded-full p-0.5 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            )}

            {/* Input Capsule with Nested CTA */}
            <div className="double-bezel">
              <div className="double-bezel-inner p-2 pl-3 flex items-center gap-2 bg-card/90">
                <button
                  onClick={handleFileUpload}
                  disabled={uploading}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors active:scale-95"
                  title="Attach study document"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <TextArea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask a question, request flashcards, or synthesize document..."
                  className="flex-1 min-h-[38px] max-h-[120px] bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground/50 resize-none py-1.5 px-2 text-sm leading-relaxed"
                  disabled={loading}
                />

                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  size="sm"
                  className="rounded-full h-9 px-4 font-semibold shadow-md"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Slide-Over Drawer */}
      <Drawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="Session History"
        position="left"
        width="340px"
      >
        <div className="p-4 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search chat history..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted/40 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            {filteredThreads.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No chat history matching search</p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={cn(
                    "p-3 rounded-2xl flex items-center justify-between group transition-colors cursor-pointer",
                    activeThreadId === thread.id
                      ? "bg-primary/15 border border-primary/30"
                      : "hover:bg-muted/40 border border-transparent"
                  )}
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setShowHistory(false);
                  }}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p
                      className={cn(
                        "text-xs font-semibold truncate",
                        activeThreadId === thread.id ? "text-primary" : "text-foreground"
                      )}
                    >
                      {thread.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {new Date(thread.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteThread(thread.id);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default Chat;

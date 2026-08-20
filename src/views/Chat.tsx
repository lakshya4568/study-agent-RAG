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
            /* Claude + Lumina Empty State Hero */
            <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-8 stagger-enter">
              {/* Warm Sun Asterisk & Greeting (Claude Aesthetic) */}
              <div className="space-y-3">
                <div className="inline-flex items-center justify-center gap-3 text-foreground">
                  <span className="text-3xl text-amber-500 animate-spin-slow">✹</span>
                  <h1 className="text-3xl md:text-4xl font-serif tracking-tight font-medium">
                    {(() => {
                      const hour = new Date().getHours();
                      if (hour < 12) return "Good morning, how can I help you study?";
                      if (hour < 17) return "Good afternoon, what are we mastering today?";
                      return "Evening, ready to dive into your notes?";
                    })()}
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Your cognitive study partner. Upload documents to search vector indices, generate active recall decks, or break down complex mechanisms.
                </p>
              </div>

              {/* Study Accelerators Bento */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
                {studyAccelerators.slice(0, 3).map((action) => {
                  const Icon = action.Icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        setInput(action.prompt);
                        inputRef.current?.focus();
                      }}
                      className="p-4 rounded-2xl bg-card hover:bg-secondary border border-border text-left transition-all duration-150 group shadow-sm hover:shadow-md active:scale-98 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className={`p-1.5 rounded-lg border ${action.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {action.title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                        {action.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Active Message Timeline */
            <div className="max-w-3xl mx-auto space-y-5 pb-6">
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
                <div className="flex gap-3.5 items-start stagger-enter">
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col gap-2 min-w-[240px]">
                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                      </div>
                      <span>Thinking & Synthesizing...</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Searching vector embeddings and reasoning through study context.
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating Adaptive Prompt Dock (Claude + Stitch Spec) */}
        <div className="shrink-0 p-4 pt-2 z-20 flex justify-center bg-background border-t border-border/40">
          <div className="w-full max-w-3xl space-y-2">
            {/* Context Pills & Attachment Preview Above Dock */}
            <div className="flex items-center gap-2 px-1">
              {selectedDocument ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-medium shadow-sm">
                  <Paperclip className="w-3 h-3" />
                  <span className="truncate max-w-[220px]">
                    @{selectedDocument.split("/").pop()}
                  </span>
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="hover:bg-primary/20 rounded-full p-0.5 ml-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : (
                <button
                  onClick={handleFileUpload}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary hover:bg-secondary/70 border border-border text-foreground text-xs font-medium transition-colors cursor-pointer"
                >
                  <Paperclip className="w-3 h-3 text-primary" />
                  <span>Attach PDF Notes</span>
                </button>
              )}

              <button
                onClick={() => {
                  setInput("Create 5 practice exam questions with detailed answers based on my notes.");
                  inputRef.current?.focus();
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary hover:bg-secondary/70 border border-border text-foreground text-xs font-medium transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Quiz Me</span>
              </button>
            </div>

            {/* Upload Feedback */}
            <AnimatePresence>
              {(uploadProgress || uploadStatus) && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="px-1"
                >
                  {uploadProgress && (
                    <div className="p-2.5 rounded-xl bg-card border border-border flex items-center gap-2.5 text-xs text-foreground">
                      <LoadingSpinner size="sm" />
                      <span className="truncate">{uploadProgress.message}</span>
                    </div>
                  )}
                  {uploadStatus && !uploadProgress && (
                    <div
                      className={cn(
                        "p-2.5 rounded-xl text-xs flex items-center gap-2 border",
                        uploadStatus.type === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      )}
                    >
                      {uploadStatus.type === "success" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      <span>{uploadStatus.message}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Dock Input Box (Claude-Style) */}
            <div className="bg-card rounded-2xl p-2.5 border border-border shadow-lg focus-within:border-primary/70 transition-all">
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
                placeholder="Type / for skills, ask anything about your study notes, or generate flashcards..."
                className="w-full min-h-[48px] max-h-[160px] bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground/60 resize-none px-2 py-1 text-sm leading-relaxed"
                disabled={loading}
              />

              {/* Bottom Actions inside Dock */}
              <div className="flex items-center justify-between pt-2 px-1 border-t border-border/40 mt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFileUpload}
                    disabled={uploading}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg transition-colors cursor-pointer"
                    title="Upload study document"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <div className="h-4 w-[1px] bg-border/60 mx-0.5" />

                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary text-muted-foreground">
                    Cognitive Tutor
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground/70 hidden sm:inline">
                    NVIDIA Llama 3.3
                  </span>

                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="w-8 h-8 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 transition-all flex items-center justify-center shadow-md active:scale-95 cursor-pointer"
                    title="Send message"
                  >
                    {loading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
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

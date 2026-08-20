import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp,
  Plus,
  Paperclip,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Bot,
  Brain,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  MessageBubble,
  LoadingSpinner,
  ToolCallApproval,
  PendingToolCall,
  ModelSelector,
} from "../components/ui";
import { useChatStore, useAuthStore } from "../client/store";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolCalls?: unknown[];
}

interface ChatProps {
  onRegisterActions?: (actions: {
    createNewThread: () => void;
    openHistory?: () => void;
  }) => void;
}

export const Chat: React.FC<ChatProps> = ({ onRegisterActions }) => {
  const { user } = useAuthStore();
  const {
    activeThreadId,
    setActiveThreadId,
    selectedDocument,
    setSelectedDocument,
  } = useChatStore();

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

  const [threads, setThreads] = useState<
    Array<{ id: string; title: string; created_at: number }>
  >([]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Listen for real-time tool approval requests from main process
  useEffect(() => {
    if (window.mcpClient?.onToolApprovalRequest) {
      const unsubscribe = window.mcpClient.onToolApprovalRequest((request) => {
        const req = request as PendingToolCall;
        setPendingToolCalls((prev) => {
          if (prev.some((p) => p.id === req.id)) return prev;
          return [...prev, req];
        });
      });
      return unsubscribe;
    }
  }, []);

  // Poll for pending tool approvals while loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(checkPendingTools, 500);
    return () => clearInterval(interval);
  }, [loading, checkPendingTools]);

  useEffect(() => {
    loadThreads();
    checkPendingTools();
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId, loadThreads, loadMessages, checkPendingTools]);

  const createNewThread = useCallback(async () => {
    const id = crypto.randomUUID();
    const title = "New Study Session";
    await window.db.createThread(id, title, user?.id || "local-user");
    setActiveThreadId(id);
    setMessages([]);
    await loadThreads();
  }, [user?.id, setActiveThreadId, loadThreads]);

  // Register parent actions
  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        createNewThread,
        openHistory: () => {},
      });
    }
  }, [onRegisterActions, createNewThread]);

  // Smart Auto-Scroll: only scroll if user hasn't scrolled up
  useEffect(() => {
    if (!isUserScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 150;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    let currentThreadId = activeThreadId;
    if (!currentThreadId) {
      currentThreadId = crypto.randomUUID();
      await window.db.createThread(currentThreadId, "New Study Session", user?.id || "local-user");
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

      const { selectedModel, selectedProvider } = useChatStore.getState();

      const result = await window.studyAgent.sendMessage({
        threadId: currentThreadId,
        message: userMessage.content,
        messageId: userMessage.id,
        model: selectedModel,
        provider: selectedProvider,
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
    try {
      await window.mcpClient.approveToolExecution(toolCallId);
      setPendingToolCalls((prev) => prev.filter((t) => t.id !== toolCallId));
    } catch (err) {
      console.error("Failed to approve tool:", err);
    }
  };

  const handleToolDeny = async (toolCallId: string) => {
    try {
      await window.mcpClient.denyToolExecution(toolCallId);
      setPendingToolCalls((prev) => prev.filter((t) => t.id !== toolCallId));
    } catch (err) {
      console.error("Failed to deny tool:", err);
    }
  };

  const handleFileUpload = async () => {
    if (!window.studyAgent?.openFileDialog) return;

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
        message: `Indexing ${fileName}...`,
        fileName,
      });

      const result = await window.studyAgent.addDocuments(filePaths);

      if (result.success) {
        setUploadProgress({
          stage: "complete",
          message: `Indexed ${fileName}`,
        });

        setSelectedDocument(filePaths[0]);

        let currentThreadId = activeThreadId;
        if (!currentThreadId) {
          currentThreadId = crypto.randomUUID();
          await window.db.createThread(
            currentThreadId,
            `Study Notes: ${fileName}`,
            user?.id || "local-user"
          );
          setActiveThreadId(currentThreadId);
        }

        const successMsg: Message = {
          id: `msg-${Date.now()}`,
          role: "system",
          content: `📄 **${fileName}** loaded into vector knowledge base (${result.addedCount} chunks indexed). You can now ask questions about this material!`,
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

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <div className="flex flex-col h-full p-0 flex-1 min-w-0 relative">
        {/* Message Viewport */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 md:px-16 lg:px-24 py-6 space-y-4 custom-scrollbar"
        >
          {messages.length === 0 ? (
            /* ChatGPT Minimalist Empty State */
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-6">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground/90">
                What can I help you study today?
              </h1>

              {/* Minimal Suggestion Chips */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
                {[
                  "Explain dynamic programming intuitively",
                  "Generate 5 practice flashcards on Machine Learning",
                  "What is the current time in Tokyo and London?",
                  "Summarize key algorithms in search and sorting",
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(prompt);
                      inputRef.current?.focus();
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-secondary/80 hover:bg-secondary text-xs text-foreground/80 border border-border/60 hover:border-border transition-all cursor-pointer text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Message Timeline */
            <div className="max-w-2xl mx-auto space-y-4 pb-6">
              {/* Top Timestamp */}
              <div className="text-center py-2">
                <span className="text-xs text-muted-foreground/60 font-medium">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

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
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground py-2 animate-pulse">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                  </div>
                  <span>Thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating ChatGPT-Style Prompt Dock */}
        <div className="shrink-0 px-4 pb-3 pt-1 z-20 flex justify-center bg-background">
          <div className="w-full max-w-2xl space-y-2">
            {/* Attachment preview if active */}
            {selectedDocument && (
              <div className="flex items-center gap-2 px-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-foreground text-xs font-medium border border-border">
                  <Paperclip className="w-3 h-3 text-primary" />
                  <span className="truncate max-w-[220px]">
                    @{selectedDocument.split("/").pop()}
                  </span>
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="hover:bg-background rounded-full p-0.5 ml-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            )}

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
                    <div className="p-2 rounded-xl bg-card border border-border flex items-center gap-2 text-xs text-foreground">
                      <LoadingSpinner size="sm" />
                      <span className="truncate">{uploadProgress.message}</span>
                    </div>
                  )}
                  {uploadStatus && !uploadProgress && (
                    <div
                      className={cn(
                        "p-2 rounded-xl text-xs flex items-center gap-2 border",
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

            {/* Rounded Full Floating Pill Dock (ChatGPT Authentic Design) */}
            <div className="w-full rounded-full bg-secondary/80 dark:bg-[#212121] border border-border dark:border-[#333333] px-3 py-1.5 flex items-center gap-2.5 shadow-lg focus-within:border-border/90 transition-all">
              {/* + Attachment Button */}
              <button
                onClick={handleFileUpload}
                disabled={uploading}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer shrink-0"
                title="Attach PDF notes"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Text Input */}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything..."
                className="flex-1 bg-transparent border-none outline-none text-[14.5px] text-foreground placeholder:text-muted-foreground/50 py-1"
                disabled={loading}
              />

              {/* Right Side: Model Switcher + Send Button */}
              <div className="flex items-center gap-2 shrink-0">
                <ModelSelector dropUp align="right" />

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0",
                    input.trim()
                      ? "bg-foreground text-background dark:bg-white dark:text-black hover:opacity-90 active:scale-95 shadow-xs"
                      : "bg-muted/60 text-muted-foreground/40 cursor-not-allowed"
                  )}
                  title="Send query"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  )}
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-[11px] text-muted-foreground/50 text-center select-none pt-0.5">
              Study Agent can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;

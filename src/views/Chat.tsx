import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowUp,
  Plus,
  Paperclip,
  Layers,
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
    loadThreads,
  } = useChatStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCall[]>([]);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  // Close action menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setIsActionMenuOpen(false);
      }
    };
    if (isActionMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isActionMenuOpen]);

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

  const createNewThread = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  }, [setActiveThreadId]);

  // Register parent actions
  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        createNewThread,
        openHistory: () => {
          /* open history placeholder */
        },
      });
    }
  }, [onRegisterActions, createNewThread]);

  // Smart Auto-Scroll
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
    const isNewThread = !currentThreadId;

    if (!currentThreadId) {
      currentThreadId = crypto.randomUUID();
      const candidateTitle = input.trim().replace(/\s+/g, " ");
      const newTitle =
        candidateTitle.length > 35 ? `${candidateTitle.slice(0, 35)}...` : candidateTitle;
      await window.db.createThread(currentThreadId, newTitle || "Study Session", user?.id || "local-user");
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

    if (isNewThread) {
      await loadThreads();
    }

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
      potentialJson = potentialJson.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
      const match = potentialJson.match(codeBlockRegex);
      if (match) {
        potentialJson = match[1].trim();
      }

      const firstBrace = potentialJson.indexOf("{");
      const lastBrace = potentialJson.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const candidate = potentialJson.substring(firstBrace, lastBrace + 1);
          const parsed = JSON.parse(candidate);
          if (parsed.flashcards && Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
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
      const dialogResult = await window.studyAgent.openFileDialog();
      if (!dialogResult.success || dialogResult.filePaths.length === 0) {
        return;
      }

      const filePaths = dialogResult.filePaths;
      const fileName = filePaths[0].split("/").pop() || "Document.pdf";

      const result = await window.studyAgent.addDocuments(filePaths);

      if (result.success) {
        let currentThreadId = activeThreadId;
        if (!currentThreadId) {
          currentThreadId = crypto.randomUUID();
          await window.db.createThread(
            currentThreadId,
            `Study: ${fileName}`,
            user?.id || "local-user"
          );
          setActiveThreadId(currentThreadId);
        }

        const successMsg: Message = {
          id: `msg-${Date.now()}`,
          role: "system",
          content: `📎 Attached **${fileName}** to this study session. What would you like to explore or analyze in it?`,
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

        await loadThreads();
      }
    } catch (err) {
      console.error("File upload error:", err);
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
            /* Apple / Minimalist Neumorphic Empty State */
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-6">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/95">
                What can I help you study today?
              </h1>

              {/* Tactile Suggestion Chips */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-lg">
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
                    className="px-4 py-2 rounded-full neu-raised-sm text-xs text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer text-left border border-border select-none"
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
                <span className="text-[11px] text-muted-foreground/70 font-mono">
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
                  <span>Reasoning and formulating answer...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Floating Tactile Prompt Dock */}
        <div className="shrink-0 px-4 pb-3 pt-1 z-20 flex justify-center bg-transparent">
          <div className="w-full max-w-2xl space-y-2">
            {/* Rounded Full Floating Pill Dock */}
            <div className="w-full rounded-full neu-floating border border-border px-3.5 py-1.5 flex items-center gap-2.5 focus-within:border-primary/60 transition-all relative">
              {/* + Action Menu Button */}
              <div className="relative" ref={actionMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center neu-convex text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer shrink-0 border border-border",
                    isActionMenuOpen && "text-primary rotate-45"
                  )}
                  title="Add attachments or create flashcards"
                >
                  <Plus className="w-4 h-4 transition-transform duration-200" />
                </button>

                {/* Dropdown Menu on + Click */}
                {isActionMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2.5 w-60 rounded-2xl neu-floating bg-popover border border-border shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setInput("Create 10 high-yield study flashcards for: ");
                        inputRef.current?.focus();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-secondary/70 transition-all cursor-pointer text-left"
                    >
                      <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="font-medium">Create flashcard deck</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        handleFileUpload();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-secondary/70 transition-all cursor-pointer text-left"
                    >
                      <Paperclip className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-medium">Attach PDF or notes</span>
                    </button>
                  </div>
                )}
              </div>

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
                placeholder="Ask anything or request study analysis..."
                className="flex-1 bg-transparent border-none outline-none text-[14px] text-foreground placeholder:text-muted-foreground/60 py-1 font-medium"
                disabled={loading}
              />

              {/* Right Side: Model Switcher + Tactile Send Button */}
              <div className="flex items-center gap-2 shrink-0">
                <ModelSelector dropUp align="right" />

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className={cn(
                    "w-8.5 h-8.5 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0",
                    input.trim()
                      ? "neu-convex-primary text-white shadow-sm active:scale-95"
                      : "bg-secondary text-muted-foreground/30 border border-border cursor-not-allowed"
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;


import React, { useState, useEffect, useRef } from "react";
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
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  History,
  MessageSquare,
  Smile,
  Paperclip,
  Sparkles,
  Plus
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Drawer } from "../components/ui/Drawer";
import { cn } from "../lib/utils";
import { ContentContainer } from "../components/layout";
import {
  Button,
  TextArea,
  QuickActionCard,
  MessageBubble,
  LoadingSpinner,
  Badge,
  ToolCallApproval,
  PendingToolCall,
  FlashcardViewer,
} from "../components/ui";
import { useChatStore, useAuthStore } from "../client/store";
import { ThemeSelector } from "../components/ui/ThemeSelector";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

interface ToolCall {
  toolName: string;
  serverId: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

interface Tool {
  name: string;
  description?: string;
  serverId: string;
}

const quickActions = [
  {
    id: "summarize",
    Icon: FileText,
    title: "Summarize",
    description: "Create a summary of your document",
    prompt: "I need help summarizing a document. What should I do?",
    gradient: "from-blue-400 to-blue-600",
  },
  {
    id: "flashcards",
    Icon: Brain,
    title: "Flashcards",
    description: "Generate study flashcards",
    prompt: "Can you help me create flashcards for studying?",
    gradient: "from-purple-400 to-purple-600",
  },
  {
    id: "quiz",
    Icon: BookOpen,
    title: "Create Quiz",
    description: "Generate a quiz to test knowledge",
    prompt: "I want to create a quiz to test my knowledge.",
    gradient: "from-pink-400 to-pink-600",
  },
  {
    id: "explain",
    Icon: Lightbulb,
    title: "Explain",
    description: "Get explanations for complex topics",
    prompt: "Can you explain a concept to me in simple terms?",
    gradient: "from-yellow-400 to-orange-500",
  },
  {
    id: "schedule",
    Icon: Calendar,
    title: "Study Plan",
    description: "Create a study schedule",
    prompt: "Help me create an effective study schedule.",
    gradient: "from-green-400 to-emerald-600",
  },
  {
    id: "practice",
    Icon: PenTool,
    title: "Practice",
    description: "Practice with exercises",
    prompt: "I want to practice with some exercises.",
    gradient: "from-indigo-400 to-violet-600",
  },
];

interface ChatProps {
  onRegisterActions?: (actions: {
    createNewThread: () => void;
    openHistory: () => void;
  }) => void;
}

export const Chat: React.FC<ChatProps> = ({ onRegisterActions }) => {
  const {
    activeThreadId,
    setActiveThreadId,
    selectedDocument,
    setSelectedDocument,
  } = useChatStore();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCall[]>(
    []
  );
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
  const [threads, setThreads] = useState<Array<{
    id: string;
    title: string;
    created_at: number;
  }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadTools();
    loadThreads();
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }

    const pollInterval = setInterval(loadPendingToolCalls, 2000);
    return () => clearInterval(pollInterval);
  }, [activeThreadId]);

  const loadThreads = async () => {
    if (!user) return;
    const result = await window.db.getThreads(user.id);
    if (result.success && result.threads) {
      setThreads(result.threads);
    }
  };

  // Register functions with parent
  React.useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        createNewThread,
        openHistory: () => setShowHistory(true),
      });
    }
  }, [onRegisterActions]);

  const loadMessages = async (threadId: string) => {
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
  };

  const loadTools = async () => {
    try {
      const availableTools = await window.mcpClient.getAllTools();
      setTools(availableTools);
    } catch (err) {
      console.error("Failed to load tools:", err);
    }
  };

  const loadPendingToolCalls = async () => {
    try {
      const pending = await window.mcpClient.getPendingToolRequests();
      setPendingToolCalls(pending as PendingToolCall[]);
    } catch (err) {
      console.error("Failed to load pending tool calls:", err);
    }
  };

  const handleToolApprove = async (toolCallId: string) => {
    if (!activeThreadId) return;
    try {
      await window.mcpClient.approveToolExecution(toolCallId);
      setPendingToolCalls((prev) => prev.filter((t) => t.id !== toolCallId));

      const systemMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "system",
        content: `✅ Tool approved`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, systemMsg]);

      await window.db.saveMessage({
        id: systemMsg.id,
        threadId: activeThreadId,
        role: systemMsg.role,
        content: systemMsg.content,
        timestamp: systemMsg.timestamp.getTime(),
      });
    } catch (err) {
      console.error("Failed to approve tool:", err);
    }
  };

  const handleToolDeny = async (toolCallId: string) => {
    if (!activeThreadId) return;
    try {
      await window.mcpClient.denyToolExecution(toolCallId);
      setPendingToolCalls((prev) => prev.filter((t) => t.id !== toolCallId));

      const systemMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "system",
        content: `🚫 Tool denied`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, systemMsg]);

      await window.db.saveMessage({
        id: systemMsg.id,
        threadId: activeThreadId,
        role: systemMsg.role,
        content: systemMsg.content,
        timestamp: systemMsg.timestamp.getTime(),
      });
    } catch (err) {
      console.error("Failed to deny tool:", err);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    let currentThreadId = activeThreadId;
    if (!currentThreadId) {
      if (!user) {
        alert("Please log in to start a chat.");
        return;
      }
      currentThreadId = crypto.randomUUID();
      await window.db.createThread(
        currentThreadId,
        "New Conversation",
        user.id
      );
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

    await window.db.saveMessage({
      id: userMessage.id,
      threadId: currentThreadId,
      role: userMessage.role,
      content: userMessage.content,
      timestamp: userMessage.timestamp.getTime(),
    });

    try {
      if (!window.studyAgent) throw new Error("Study agent runtime is unavailable.");

      const result = await window.studyAgent.sendMessage({
        threadId: currentThreadId,
        message: userMessage.content,
        messageId: userMessage.id,
      });

      if (!result.success) {
        throw new Error(result.error ?? "Unknown issue");
      }

      if (result.messages) {
        const toolMessages = result.messages
          .filter((msg) => msg.role === "tool")
          .map((msg, idx) => ({
            id: `tool-${Date.now()}-${idx}`,
            role: "system" as const,
            content: `🔧 ${msg.name ?? "Tool"}: ${msg.content}`,
            timestamp: new Date(),
          }));
        if (toolMessages.length) {
          setMessages((prev) => [...prev, ...toolMessages]);
        }
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: result.finalMessage ?? "I'm not sure how to respond to that.",
        timestamp: new Date(),
      };

      // Check for flashcards content and save them BEFORE updating state
      let potentialJson = assistantMessage.content.trim();
      // Remove markdown code blocks if present
      const codeBlockRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/;
      const match = potentialJson.match(codeBlockRegex);
      if (match) {
        potentialJson = match[1].trim();
      }

      if (potentialJson.startsWith("{")) {
        try {
          const parsed = JSON.parse(potentialJson);
          if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
            // Assign new UUIDs and ensure structure matches Flashcard type
            const enrichedFlashcards = parsed.flashcards.map((card: any) => ({
              ...card,
              id: `fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              set_id: `set-${Date.now()}`,
              is_mastered: false,
              created_at: Date.now(),
              message_id: assistantMessage.id,
            }));

            // Update content with enriched flashcards so UI uses the correct IDs immediately
            // We need to reconstruct the JSON with the new IDs
            parsed.flashcards = enrichedFlashcards;
            assistantMessage.content = JSON.stringify(parsed);

            // Save assistant message to database FIRST (to satisfy FK constraints)
            await window.db.saveMessage({
              id: assistantMessage.id,
              threadId: currentThreadId,
              role: assistantMessage.role,
              content: assistantMessage.content,
              timestamp: assistantMessage.timestamp.getTime(),
            });

            // Save each flashcard
            for (const card of enrichedFlashcards) {
              await window.db.saveFlashcard(card);
            }

            // Update UI state
            setMessages((prev) => [...prev, assistantMessage]);
            return; // Exit after successful flashcard processing
          }
        } catch (e) {
          console.error("Failed to parse/save flashcards:", e);
          // Continue to standard message saving if flashcard processing fails
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
    } catch (err) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "system",
        content: `Oops! Something went wrong: ${err instanceof Error ? err.message : "Unknown error"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const createNewThread = async () => {
    if (!user) return;
    const id = crypto.randomUUID();
    const title = "New Chat";
    await window.db.createThread(id, title, user.id);
    setActiveThreadId(id);
    loadThreads();
  };

  const handleClearChat = async () => {
    if (!activeThreadId) return;
    if (confirm("Start a fresh conversation?")) {
      await window.db.clearMessages(activeThreadId);
      setMessages([
        {
          id: "welcome",
          role: "system",
          content: "👋 Chat cleared! Ready for a fresh start.",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async () => {
    if (uploading) return;

    let currentThreadId = activeThreadId;
    if (!currentThreadId) {
      if (!user) {
        alert("Please log in to upload documents.");
        return;
      }
      currentThreadId = crypto.randomUUID();
      await window.db.createThread(
        currentThreadId,
        "New Conversation",
        user.id
      );
      setActiveThreadId(currentThreadId);
    }

    try {
      setUploading(true);
      setUploadStatus(null);
      setUploadProgress({
        stage: "selecting",
        message: "Picking a file...",
      });

      const dialogResult = await window.studyAgent.openFileDialog();

      if (!dialogResult.success || dialogResult.filePaths.length === 0) {
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      const filePaths = dialogResult.filePaths;
      const fileName = filePaths[0].split("/").pop() || "document";

      setUploadProgress({
        stage: "loading",
        message: `Reading ${fileName}...`,
        fileName,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await window.studyAgent.addDocuments(filePaths);

      if (result.success) {
        setUploadProgress({
          stage: "complete",
          message: "✅ Done!",
          fileName,
        });

        setUploadStatus({
          type: "success",
          message: `Added ${fileName} to your library!`,
        });

        if (filePaths.length > 0) {
          setSelectedDocument(filePaths[0]);
        }

        const successMsg: Message = {
          id: `msg-${Date.now()}`,
          role: "system",
          content: `📄 I've read **${fileName}**. Ask me anything about it!`,
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
        throw new Error(result.errors.join(", ") || "Upload failed");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setUploadStatus({
        type: "error",
        message: `Couldn't upload: ${errorMsg}`,
      });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 2000);
      setTimeout(() => setUploadStatus(null), 5000);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background/50">
      <ContentContainer className="flex flex-col h-full p-0 flex-1 min-w-0 relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8 mt-10">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-4 mx-auto shadow-xl rotate-3">
                  <Bot className="w-12 h-12 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-2">
                  Hello there! 👋
                </h2>
                <p className="text-muted-foreground max-w-md text-lg">
                  I'm your study buddy. What are we learning today?
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-4xl px-4">
                {quickActions.map((action, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 + 0.2 }}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="flex flex-col items-center p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-primary/50 hover:shadow-md transition-all duration-200 text-center group"
                  >
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${action.gradient} text-white mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
                      <action.Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-foreground">{action.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {action.description}
                    </p>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-white dark:bg-zinc-800 border border-border text-primary"
                    )}
                  >
                    {msg.role === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-5 h-5" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "max-w-[85%] shadow-sm text-sm leading-relaxed relative group",
                      msg.role === "user"
                        ? "p-4 bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                        : "bg-card/70 backdrop-blur-md border border-border/50 text-foreground rounded-2xl rounded-tl-sm"
                    )}
                  >
                    {(() => {
                      // Check if content is flashcard JSON
                      try {
                        const parsed = JSON.parse(msg.content);
                        if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
                          return <FlashcardViewer flashcards={parsed.flashcards} messageId={msg.id} />;
                        }
                      } catch (e) {
                        // Not JSON, render as markdown
                      }
                      return (
                        <div className="p-4">
                          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                                li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                a: ({ node, ...props }) => <a className="text-primary hover:underline" {...props} />,
                                code: ({ node, ...props }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                                pre: ({ node, ...props }) => <pre className="bg-muted p-2 rounded-lg overflow-x-auto my-2 text-xs" {...props} />,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      );
                    })()}
                    <div
                      className={cn(
                        "text-[10px] mt-1 opacity-0 group-hover:opacity-50 transition-opacity absolute -bottom-5",
                        msg.role === "user" ? "right-0" : "left-0"
                      )}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-border flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                    <div className="flex gap-1">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                        className="w-2 h-2 bg-primary/40 rounded-full"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                        className="w-2 h-2 bg-primary/40 rounded-full"
                      />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                        className="w-2 h-2 bg-primary/40 rounded-full"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium ml-2">Thinking...</span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 px-4 py-4 z-20 flex justify-center bg-gradient-to-t from-background via-background/80 to-transparent">
          <div className="w-full max-w-5xl">
            {/* Upload Progress & Status */}
            <AnimatePresence>
              {(uploadProgress || uploadStatus) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-3 mx-2"
                >
                  {uploadProgress && (
                    <div className="bg-card border border-border p-3 rounded-xl shadow-lg flex items-center gap-3">
                      <LoadingSpinner size="sm" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{uploadProgress.message}</p>
                        <div className="h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
                          <motion.div
                            className="h-full bg-primary"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }} // Simplified for demo
                            transition={{ duration: 2 }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {uploadStatus && !uploadProgress && (
                    <div className={cn(
                      "p-3 rounded-xl flex items-center gap-2 text-sm font-medium shadow-lg",
                      uploadStatus.type === "success" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
                    )}>
                      {uploadStatus.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {uploadStatus.message}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected File Chip */}
            {selectedDocument && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mx-2 mb-2 inline-flex items-center gap-2 px-3 py-1.5 bg-card/80 backdrop-blur-sm text-primary rounded-full text-xs font-medium border border-primary/20 shadow-sm"
              >
                <Paperclip className="w-3 h-3" />
                <span className="max-w-[150px] truncate">{selectedDocument.split('/').pop()}</span>
                <button onClick={() => setSelectedDocument(null)} className="hover:bg-primary/20 rounded-full p-0.5 ml-1">
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            )}

            <div className="relative flex items-center gap-2 bg-brown-200/40 backdrop-blur-2xl border-2 border-brown-300/30 shadow-[0_8px_32px_0_rgba(139,69,19,0.15)] rounded-[2rem] p-2 pl-4 transition-all hover:bg-brown-200/50 hover:shadow-[0_8px_40px_0_rgba(139,69,19,0.2)] hover:border-brown-300/40">
              <button
                onClick={handleFileUpload}
                disabled={uploading}
                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                title="Upload file"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <TextArea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 min-h-[44px] max-h-[120px] bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground/60 resize-none py-3 px-2 font-medium text-base"
                disabled={loading}
              />

              <div className="flex items-center gap-1 pr-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full w-9 h-9"
                >
                  <Sparkles className="w-5 h-5" />
                </Button>

                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 transition-all duration-200 shadow-sm",
                    input.trim()
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {loading ? <LoadingSpinner size="sm" className="text-current" /> : <Send className="w-5 h-5 ml-0.5" />}
                </Button>
              </div>
            </div>

            <div className="mt-2 text-center">
              <p className="text-[10px] text-muted-foreground/60 font-medium">
                AI make mistakes. Check important info.
              </p>
            </div>
          </div>
        </div>
      </ContentContainer>

      <Drawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="Your History"
        position="left"
        width="300px"
      >
        <div className="space-y-4 p-2">
          {activeThreadId && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Active Session</h3>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>Current Chat</span>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2">Recent Chats</h3>
            <div className="space-y-1">
              {threads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No chat history yet</p>
                </div>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setActiveThreadId(thread.id);
                      setShowHistory(false);
                    }}
                    className={cn(
                      "w-full text-left p-3 rounded-xl hover:bg-muted transition-colors group",
                      activeThreadId === thread.id ? "bg-primary/10 border border-primary/20" : ""
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className={cn(
                        "w-4 h-4 mt-0.5 transition-colors",
                        activeThreadId === thread.id ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium transition-colors truncate",
                          activeThreadId === thread.id ? "text-primary" : "text-foreground group-hover:text-primary"
                        )}>
                          {thread.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(thread.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

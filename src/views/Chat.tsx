import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  FileText,
  Brain,
  BookOpen,
  Lightbulb,
  Calendar,
  PenTool,
  Trash2,
  Upload,
  File,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { ContentContainer } from "../components/layout";
import {
  Button,
  TextArea,
  QuickActionCard,
  MessageBubble,
  LoadingSpinner,
  Badge,
} from "../components/ui";

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
    gradient: "from-emerald-400 to-green-500",
  },
  {
    id: "flashcards",
    Icon: Brain,
    title: "Flashcards",
    description: "Generate study flashcards",
    prompt: "Can you help me create flashcards for studying?",
    gradient: "from-green-500 to-teal-500",
  },
  {
    id: "quiz",
    Icon: BookOpen,
    title: "Create Quiz",
    description: "Generate a quiz to test knowledge",
    prompt: "I want to create a quiz to test my knowledge.",
    gradient: "from-teal-500 to-cyan-500",
  },
  {
    id: "explain",
    Icon: Lightbulb,
    title: "Explain",
    description: "Get explanations for complex topics",
    prompt: "Can you explain a concept to me in simple terms?",
    gradient: "from-lime-500 to-green-500",
  },
  {
    id: "schedule",
    Icon: Calendar,
    title: "Study Plan",
    description: "Create a study schedule",
    prompt: "Help me create an effective study schedule.",
    gradient: "from-green-600 to-emerald-600",
  },
  {
    id: "practice",
    Icon: PenTool,
    title: "Practice",
    description: "Practice with exercises",
    prompt: "I want to practice with some exercises.",
    gradient: "from-emerald-500 to-green-600",
  },
];

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadIdRef = useRef<string>(`thread-${Date.now()}`);

  useEffect(() => {
    loadTools();
    loadMessagesFromDb();
  }, []);

  const loadMessagesFromDb = async () => {
    try {
      const dbMessages = await window.database.getMessages(threadIdRef.current);
      if (dbMessages.length > 0) {
        const loadedMessages: Message[] = dbMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(loadedMessages);
      } else {
        // Create thread and show welcome message
        await window.database.createThread(
          threadIdRef.current,
          "New Conversation"
        );
        const welcomeMsg: Message = {
          id: "welcome",
          role: "system",
          content:
            "👋 Hey there! I'm Alex, your AI Study Mentor! 🎓\n\n✨ I'm here to help you:\n\n📚 **Study Smart** - Upload documents, create summaries, flashcards & quizzes\n💬 **Learn Better** - Ask questions, explore concepts, get explanations\n🎯 **Stay Organized** - Build study plans and track progress\n\n**Quick tip:** You can upload PDFs, text files, or markdown docs to add to my knowledge base!\n\nWhat would you like to learn today?",
          timestamp: new Date(),
        };
        setMessages([welcomeMsg]);
        await window.database.saveMessage({
          id: welcomeMsg.id,
          threadId: threadIdRef.current,
          role: welcomeMsg.role,
          content: welcomeMsg.content,
          timestamp: welcomeMsg.timestamp.getTime(),
        });
      }
    } catch (error) {
      console.error("Failed to load messages from database:", error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadTools = async () => {
    try {
      const allTools = await window.mcpClient.getAllTools();
      setTools(allTools);
    } catch (err) {
      console.error("Failed to load tools:", err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Save user message to database
    await window.database.saveMessage({
      id: userMessage.id,
      threadId: threadIdRef.current,
      role: userMessage.role,
      content: userMessage.content,
      timestamp: userMessage.timestamp.getTime(),
    });

    try {
      if (!window.studyAgent) {
        throw new Error("Study agent runtime is unavailable.");
      }

      const result = await window.studyAgent.sendMessage({
        threadId: threadIdRef.current,
        message: userMessage.content,
      });

      if (!result.success) {
        const errorMessage: Message = {
          id: `msg-${Date.now()}`,
          role: "system",
          content: `❌ Agent error: ${result.error ?? "Unknown issue"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
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
        content:
          result.finalMessage ??
          "I could not formulate a response. Please provide more context.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to database
      await window.database.saveMessage({
        id: assistantMessage.id,
        threadId: threadIdRef.current,
        role: assistantMessage.role,
        content: assistantMessage.content,
        timestamp: assistantMessage.timestamp.getTime(),
      });
    } catch (err) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "system",
        content: `❌ Error: ${err instanceof Error ? err.message : "Unknown error"}`,
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

  const handleClearChat = async () => {
    if (confirm("Are you sure you want to clear the chat?")) {
      await window.database.clearMessages(threadIdRef.current);
      setMessages([
        {
          id: "welcome",
          role: "system",
          content: "👋 Chat cleared! How can I help you today?",
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
    setUploading(true);
    setUploadStatus(null);

    try {
      // Open native file dialog
      const dialogResult = await window.studyAgent.openFileDialog();

      if (!dialogResult.success || dialogResult.filePaths.length === 0) {
        setUploading(false);
        return;
      }

      const filePaths = dialogResult.filePaths;

      if (!window.studyAgent) {
        throw new Error("Study agent runtime is unavailable.");
      }

      const result = await window.studyAgent.addDocuments(filePaths);

      if (result.success) {
        setUploadStatus({
          type: "success",
          message: `✅ Successfully uploaded ${result.addedCount} document${result.addedCount > 1 ? "s" : ""}!`,
        });

        // Add success message to chat
        const successMsg: Message = {
          id: `msg-${Date.now()}`,
          role: "system",
          content: `📄 Documents uploaded successfully! I've added ${result.addedCount} new document${result.addedCount > 1 ? "s" : ""} to my knowledge base. Feel free to ask me questions about the content!`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMsg]);

        // Save success message to database
        await window.database.saveMessage({
          id: successMsg.id,
          threadId: threadIdRef.current,
          role: successMsg.role,
          content: successMsg.content,
          timestamp: successMsg.timestamp.getTime(),
        });

        if (result.errors.length) {
          const warningMsg: Message = {
            id: `msg-${Date.now()}-warn`,
            role: "system",
            content: `⚠️ Some files could not be indexed: ${result.errors.join(" ")}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, warningMsg]);
          await window.database.saveMessage({
            id: warningMsg.id,
            threadId: threadIdRef.current,
            role: warningMsg.role,
            content: warningMsg.content,
            timestamp: warningMsg.timestamp.getTime(),
          });
        }
      } else {
        throw new Error(result.errors.join(", ") || "Upload failed");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setUploadStatus({
        type: "error",
        message: `❌ Upload failed: ${errorMsg}`,
      });

      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "system",
        content: `❌ Failed to upload documents: ${errorMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      // Save error message to database
      await window.database.saveMessage({
        id: errorMessage.id,
        threadId: threadIdRef.current,
        role: errorMessage.role,
        content: errorMessage.content,
        timestamp: errorMessage.timestamp.getTime(),
      });
    } finally {
      setUploading(false);
      // Clear status after 5 seconds
      setTimeout(() => setUploadStatus(null), 5000);
    }
  };

  return (
    <ContentContainer className="flex flex-col h-full p-0">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Quick Actions - Show only when no messages (except welcome) */}
        {messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-emerald-500" />
                Quick Actions
              </h2>
              <p className="text-gray-600">
                Choose an action to get started with AI-powered learning
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action, index) => (
                <QuickActionCard
                  key={action.id}
                  icon={action.Icon}
                  title={action.title}
                  description={action.description}
                  onClick={() => handleQuickAction(action.prompt)}
                  gradient={action.gradient}
                  delay={index * 0.05}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Messages */}
        <AnimatePresence>
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              delay={index * 0.02}
            />
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <LoadingSpinner size="sm" />
            <span className="text-gray-600 text-sm">Alex is thinking...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-6 bg-gradient-to-r from-emerald-50/50 to-green-50/50 backdrop-blur-xl border-t border-emerald-200">
        <div className="max-w-4xl mx-auto">
          {/* Upload Status */}
          {uploadStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-3 px-4 py-2 rounded-lg flex items-center gap-2 ${
                uploadStatus.type === "success"
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : "bg-red-100 text-red-700 border border-red-300"
              }`}
            >
              {uploadStatus.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {uploadStatus.message}
              </span>
            </motion.div>
          )}

          <div className="flex items-center gap-3 mb-3">
            <Badge
              variant="info"
              size="sm"
              className="bg-emerald-100 text-emerald-700 border-emerald-300"
            >
              {tools.length} tools available
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              icon={<Upload className="w-4 h-4" />}
              onClick={handleFileUpload}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload Docs"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={handleClearChat}
            >
              Clear Chat
            </Button>
          </div>
          <div className="flex gap-3">
            <TextArea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything... (Press Enter to send, Shift+Enter for new line)"
              className="flex-1 min-h-[60px] max-h-[200px] border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400"
              rows={2}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              icon={<Send className="w-5 h-5" />}
              size="lg"
              className="self-end bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/30"
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </ContentContainer>
  );
};

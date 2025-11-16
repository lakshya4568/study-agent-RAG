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
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: "flashcards",
    Icon: Brain,
    title: "Flashcards",
    description: "Generate study flashcards",
    prompt: "Can you help me create flashcards for studying?",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    id: "quiz",
    Icon: BookOpen,
    title: "Create Quiz",
    description: "Generate a quiz to test knowledge",
    prompt: "I want to create a quiz to test my knowledge.",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    id: "explain",
    Icon: Lightbulb,
    title: "Explain",
    description: "Get explanations for complex topics",
    prompt: "Can you explain a concept to me in simple terms?",
    gradient: "from-yellow-500 to-orange-500",
  },
  {
    id: "schedule",
    Icon: Calendar,
    title: "Study Plan",
    description: "Create a study schedule",
    prompt: "Help me create an effective study schedule.",
    gradient: "from-red-500 to-pink-500",
  },
  {
    id: "practice",
    Icon: PenTool,
    title: "Practice",
    description: "Practice with exercises",
    prompt: "I want to practice with some exercises.",
    gradient: "from-indigo-500 to-purple-500",
  },
];

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadIdRef = useRef<string>(`thread-${Date.now()}`);

  useEffect(() => {
    loadTools();
    setMessages([
      {
        id: "welcome",
        role: "system",
        content:
          "👋 Welcome to Study Agent! I can help you with:\n\n📚 Study Mode: Summarize documents, create flashcards, generate quizzes\n💬 Chat Mode: General conversation and assistance\n\nWhat would you like to work on today?",
        timestamp: new Date(),
      },
    ]);
  }, []);

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

  const handleClearChat = () => {
    if (confirm("Are you sure you want to clear the chat?")) {
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
                <Sparkles className="w-6 h-6 text-purple-500" />
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <LoadingSpinner size="sm" />
            <span className="text-gray-600 text-sm">Thinking...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Badge variant="info" size="sm">
              {tools.length} tools available
            </Badge>
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
              className="flex-1 min-h-[60px] max-h-[200px]"
              rows={2}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              icon={<Send className="w-5 h-5" />}
              size="lg"
              className="self-end"
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </ContentContainer>
  );
};

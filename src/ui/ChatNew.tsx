import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Sparkles, 
  BookOpen, 
  MessageSquare, 
  Trash2, 
  Wrench, 
  FileText,
  Brain,
  Calendar,
  Lightbulb,
  PenTool,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
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
  { id: 'summarize', icon: FileText, title: 'Summarize', description: 'Create a summary of your document', prompt: 'I need help summarizing a document. What should I do?' },
  { id: 'flashcards', icon: Brain, title: 'Flashcards', description: 'Generate study flashcards', prompt: 'Can you help me create flashcards for studying?' },
  { id: 'quiz', icon: BookOpen, title: 'Create Quiz', description: 'Generate a quiz to test knowledge', prompt: 'I want to create a quiz to test my knowledge.' },
  { id: 'explain', icon: Lightbulb, title: 'Explain', description: 'Get explanations for complex topics', prompt: 'Can you explain a concept to me in simple terms?' },
  { id: 'schedule', icon: Calendar, title: 'Study Plan', description: 'Create a study schedule', prompt: 'Help me create an effective study schedule.' },
  { id: 'practice', icon: PenTool, title: 'Practice', description: 'Practice with exercises', prompt: 'I want to practice with some exercises.' },
];

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedMode, setSelectedMode] = useState<'chat' | 'study'>('study');
  const [showTools, setShowTools] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadTools();
    setMessages([
      {
        id: 'welcome',
        role: 'system',
        content: '👋 Welcome to Study Agent! I can help you with:\n\n' +
          '📚 Study Mode: Summarize documents, create flashcards, generate quizzes\n' +
          '💬 Chat Mode: General conversation and assistance\n\n' +
          'What would you like to work on today?',
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadTools = async () => {
    try {
      const allTools = await window.mcpClient.getAllTools();
      setTools(allTools);
    } catch (err) {
      console.error('Failed to load tools:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      if (selectedMode === 'study') {
        await handleStudyMode(userMessage.content);
      } else {
        await handleChatMode(userMessage.content);
      }
    } catch (err) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleStudyMode = async (userInput: string) => {
    const lowerInput = userInput.toLowerCase();
    let response = '';

    if (lowerInput.includes('summarize') || lowerInput.includes('summary')) {
      response = '📝 I can help you summarize documents. To use this feature:\n\n' +
        '1. Make sure you have a PDF or document processing MCP server connected\n' +
        '2. Upload your document\n' +
        '3. I\'ll create a concise summary for you\n\n' +
        'Connected tools: ' + tools.filter(t => t.name.includes('summarize')).map(t => t.name).join(', ');
    } else if (lowerInput.includes('flashcard')) {
      response = '🃏 Flashcards are a great way to study! I can:\n\n' +
        '• Generate flashcards from your documents\n' +
        '• Create spaced repetition schedules\n' +
        '• Track your learning progress\n\n' +
        'Connected tools: ' + tools.filter(t => t.name.includes('flashcard')).map(t => t.name).join(', ');
    } else if (lowerInput.includes('quiz') || lowerInput.includes('test')) {
      response = '📋 I can help you create quizzes! Options:\n\n' +
        '• Multiple choice questions\n' +
        '• Short answer questions\n' +
        '• Google Forms integration\n' +
        '• Custom difficulty levels\n\n' +
        'Connected tools: ' + tools.filter(t => t.name.includes('quiz') || t.name.includes('form')).map(t => t.name).join(', ');
    } else {
      response = await generateAIResponse(userInput, 'study');
    }

    const assistantMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
  };

  const handleChatMode = async (userInput: string) => {
    const response = await generateAIResponse(userInput, 'chat');
    const assistantMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const generateAIResponse = async (input: string, mode: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const responses = {
      study: [
        'That\'s a great topic to study! Let me help you break it down into manageable pieces.',
        'I can help you create study materials for that. Would you like flashcards, a summary, or a quiz?',
        'Excellent choice! Let\'s dive into that subject. What specific aspect would you like to focus on?',
      ],
      chat: [
        'I understand. How can I assist you with that?',
        'That\'s interesting! Tell me more about what you\'re thinking.',
        'I\'m here to help. What would you like to know?',
      ],
    };
    const modeResponses = mode === 'study' ? responses.study : responses.chat;
    return modeResponses[Math.floor(Math.random() * modeResponses.length)];
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'system',
        content: '👋 Chat cleared. How can I help you today?',
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between px-8 py-6 bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-sm"
      >
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg"
          >
            <Sparkles className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Study Agent Chat
            </h1>
            <p className="text-sm text-gray-600">Your AI-powered study companion</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setSelectedMode('study')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                selectedMode === 'study'
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <BookOpen className="w-4 h-4" />
              Study Mode
            </button>
            <button
              onClick={() => setSelectedMode('chat')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
                selectedMode === 'chat'
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Chat Mode
            </button>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={clearChat}
            className="p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowTools(!showTools)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors font-medium"
          >
            <Wrench className="w-5 h-5" />
            {tools.length} Tools
          </motion.button>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <AnimatePresence>
        {messages.length <= 1 && selectedMode === 'study' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-8 py-6 bg-white/60 backdrop-blur-sm border-b border-gray-200"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="flex flex-col items-center gap-3 p-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <action.icon className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 text-sm">{action.title}</div>
                    <div className="text-xs text-gray-600 mt-1">{action.description}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <AnimatePresence mode="popLayout">
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex gap-4",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role !== 'user' && (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                    {msg.role === 'assistant' ? (
                      <Sparkles className="w-5 h-5 text-white" />
                    ) : (
                      <Zap className="w-5 h-5 text-white" />
                    )}
                  </div>
                )}

                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className={cn(
                    "max-w-2xl px-6 py-4 rounded-2xl shadow-lg",
                    msg.role === 'user'
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : msg.role === 'assistant'
                      ? "bg-white border-2 border-gray-200"
                      : "bg-amber-50 border-2 border-amber-200"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-xs font-semibold",
                      msg.role === 'user' ? "text-purple-100" : "text-gray-600"
                    )}>
                      {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Assistant' : 'System'}
                    </span>
                    <span className={cn(
                      "text-xs",
                      msg.role === 'user' ? "text-purple-100" : "text-gray-500"
                    )}>
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className={cn(
                    "whitespace-pre-wrap",
                    msg.role === 'user' ? "text-white" : "text-gray-800"
                  )}>
                    {msg.content}
                  </div>
                </motion.div>

                {msg.role === 'user' && (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <span className="text-white font-bold">U</span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white border-2 border-gray-200 px-6 py-4 rounded-2xl shadow-lg">
                <div className="flex gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                    className="w-2 h-2 bg-purple-500 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-purple-500 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-purple-500 rounded-full"
                  />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="px-8 py-6 bg-white/80 backdrop-blur-xl border-t border-gray-200"
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end gap-4">
            <div className="flex-1 bg-white rounded-2xl border-2 border-gray-200 focus-within:border-purple-400 shadow-lg transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  selectedMode === 'study'
                    ? "Ask me to summarize, create flashcards, or generate a quiz..."
                    : "Type your message here..."
                }
                disabled={loading}
                rows={3}
                className="w-full px-6 py-4 bg-transparent resize-none focus:outline-none text-gray-900 placeholder-gray-400"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className={cn(
                "p-4 rounded-2xl font-semibold shadow-lg transition-all",
                loading || !input.trim()
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-xl"
              )}
            >
              <Send className="w-6 h-6" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Tools Panel */}
      <AnimatePresence>
        {showTools && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTools(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Available Tools</h2>
                <p className="text-gray-600 mt-1">{tools.length} tools connected</p>
              </div>
              <div className="p-8 overflow-y-auto max-h-[60vh]">
                {tools.length > 0 ? (
                  <div className="space-y-3">
                    {tools.map((tool, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200"
                      >
                        <div className="flex items-start gap-3">
                          <Wrench className="w-5 h-5 text-purple-600 mt-1" />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{tool.name}</div>
                            <div className="text-sm text-gray-600 mt-1">{tool.description || 'No description'}</div>
                            <div className="text-xs text-purple-600 mt-2">Server: {tool.serverId}</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Wrench className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No tools available. Connect MCP servers to add tools.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

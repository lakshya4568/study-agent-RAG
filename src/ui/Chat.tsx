import React, { useState, useEffect, useRef } from 'react';
import { QuickActions } from './QuickActions';
import './Chat.css';

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
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedMode, setSelectedMode] = useState<'chat' | 'study'>('study');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTools();
    // Add welcome message
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
      // Process the message based on selected mode
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

    // Detect intent from user input
    let response = '';
    const toolCalls: ToolCall[] = [];

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
    } else if (lowerInput.includes('learn') || lowerInput.includes('study')) {
      response = '🎓 Study Agent can help you learn more effectively!\n\n' +
        'Available features:\n' +
        '• Document summarization\n' +
        '• Flashcard generation\n' +
        '• Quiz creation\n' +
        '• Progress tracking\n' +
        '• Spaced repetition\n\n' +
        `Currently connected tools: ${tools.length}\n` +
        'Tell me what you\'d like to study and I\'ll guide you!';
    } else {
      // General AI response for study-related queries
      response = await generateAIResponse(userInput, 'study');
    }

    const assistantMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
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
    // This is a placeholder for AI response generation
    // In a real implementation, you would call an LLM API here
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

  // Tool execution function - reserved for future LLM integration
  // This will be used when AI needs to call tools automatically
  const handleExecuteTool = async (toolName: string, serverId: string, args?: Record<string, unknown>) => {
    try {
      const result = await window.mcpClient.executeTool(serverId, toolName, args);
      
      const toolMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `✅ Tool executed: ${toolName}\n\nResult: ${JSON.stringify(result.content, null, 2)}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, toolMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `❌ Tool execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  // Expose handleExecuteTool for future use
  console.log('Tool executor ready:', handleExecuteTool ? 'Yes' : 'No');

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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

  const handleQuickAction = (_actionId: string, prompt: string) => {
    setInput(prompt);
    // Optionally auto-send
    // handleSend() would be called with the prompt
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>🤖 Study Agent Chat</h2>
        <div className="chat-controls">
          <div className="mode-selector">
            <button
              className={selectedMode === 'study' ? 'active' : ''}
              onClick={() => setSelectedMode('study')}
            >
              📚 Study Mode
            </button>
            <button
              className={selectedMode === 'chat' ? 'active' : ''}
              onClick={() => setSelectedMode('chat')}
            >
              💬 Chat Mode
            </button>
          </div>
          <button onClick={clearChat} className="clear-btn">
            🗑️ Clear
          </button>
        </div>
      </div>

      {messages.length <= 1 && selectedMode === 'study' && (
        <div className="quick-actions-wrapper">
          <QuickActions onActionSelect={handleQuickAction} />
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-header">
              <span className="message-role">
                {msg.role === 'user' ? '👤 You' : msg.role === 'assistant' ? '🤖 Assistant' : '⚙️ System'}
              </span>
              <span className="message-time">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">
              {msg.content.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < msg.content.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="tool-calls">
                <h4>🔧 Tool Calls:</h4>
                {msg.toolCalls.map((call, idx) => (
                  <div key={idx} className="tool-call">
                    <strong>{call.toolName}</strong> on {call.serverId}
                    {call.result && <pre>{JSON.stringify(call.result, null, 2)}</pre>}
                    {call.error && <span className="error">{call.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="message assistant loading">
            <div className="message-content">
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="available-tools">
          <span>🔧 {tools.length} tools available</span>
          {tools.length > 0 && (
            <button 
              className="tools-btn"
              onClick={() => {
                const toolsList = tools.map(t => `• ${t.name} (${t.serverId}): ${t.description || 'No description'}`).join('\n');
                const toolMessage: Message = {
                  id: `msg-${Date.now()}`,
                  role: 'system',
                  content: `🔧 Available Tools:\n\n${toolsList}\n\nYou can ask me to use any of these tools!`,
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, toolMessage]);
              }}
            >
              View Tools
            </button>
          )}
        </div>
        <div className="chat-input">
          <textarea
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
          />
          <button onClick={handleSend} disabled={loading || !input.trim()}>
            {loading ? '⏳' : '📤'} Send
          </button>
        </div>
      </div>
    </div>
  );
};

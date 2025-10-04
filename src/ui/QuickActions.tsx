import React from 'react';
import './QuickActions.css';

interface QuickActionsProps {
  onActionSelect: (action: string, prompt: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onActionSelect }) => {
  const actions = [
    {
      id: 'summarize',
      icon: '📝',
      title: 'Summarize',
      description: 'Create a summary of your document',
      prompt: 'I need help summarizing a document. What should I do?',
    },
    {
      id: 'flashcards',
      icon: '🃏',
      title: 'Flashcards',
      description: 'Generate study flashcards',
      prompt: 'Can you help me create flashcards for studying?',
    },
    {
      id: 'quiz',
      icon: '📋',
      title: 'Create Quiz',
      description: 'Generate a quiz to test knowledge',
      prompt: 'I want to create a quiz to test my knowledge.',
    },
    {
      id: 'explain',
      icon: '💡',
      title: 'Explain',
      description: 'Get explanations for complex topics',
      prompt: 'Can you explain a concept to me in simple terms?',
    },
    {
      id: 'schedule',
      icon: '📅',
      title: 'Study Plan',
      description: 'Create a study schedule',
      prompt: 'Help me create an effective study schedule.',
    },
    {
      id: 'practice',
      icon: '✏️',
      title: 'Practice',
      description: 'Practice with exercises',
      prompt: 'I want to practice with some exercises.',
    },
  ];

  return (
    <div className="quick-actions">
      <h3>⚡ Quick Actions</h3>
      <div className="actions-grid">
        {actions.map((action) => (
          <button
            key={action.id}
            className="action-card"
            onClick={() => onActionSelect(action.id, action.prompt)}
          >
            <div className="action-icon">{action.icon}</div>
            <div className="action-title">{action.title}</div>
            <div className="action-description">{action.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

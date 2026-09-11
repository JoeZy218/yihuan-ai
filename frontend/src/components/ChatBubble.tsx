import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content, timestamp }) => {
  const isUser = role === 'user';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const bubbleMaxWidth = isMobile ? '88%' : '75%';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16,
      padding: '0 16px',
    }}>
      <div style={{
        maxWidth: bubbleMaxWidth,
        padding: '12px 16px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : '#f0f0f5',
        color: isUser ? '#fff' : '#1a1a2e',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        wordBreak: 'break-word',
        lineHeight: 1.6,
      }}>
        {isUser ? (
          <div>{content}</div>
        ) : (
          <div className="markdown-body" style={{ fontSize: 14 }}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
        {timestamp && (
          <div style={{
            fontSize: 11,
            marginTop: 4,
            opacity: 0.6,
            textAlign: 'right',
          }}>
            {timestamp}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MessageList } from '../MessageList';
import { UserMessage } from '../UserMessage';
import { AIMessage } from '../AIMessage';
import { ThemeProvider } from '../ThemeProvider';
import { Message } from '@/types/message';

// Wrapper component for theme context
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('MessageList', () => {
  it('renders messages using children render prop', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
    ];

    render(
      <TestWrapper>
        <MessageList messages={messages}>
          {(message) => <div data-testid="message">{message.content}</div>}
        </MessageList>
      </TestWrapper>
    );

    expect(screen.getByTestId('message')).toHaveTextContent('Hello');
  });

  it('renders multiple messages', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'First message',
        timestamp: new Date(),
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Second message',
        timestamp: new Date(),
      },
    ];

    render(
      <TestWrapper>
        <MessageList messages={messages}>
          {(message) => (
            <div data-testid={`message-${message.id}`}>{message.content}</div>
          )}
        </MessageList>
      </TestWrapper>
    );

    expect(screen.getByTestId('message-1')).toHaveTextContent('First message');
    expect(screen.getByTestId('message-2')).toHaveTextContent('Second message');
  });
});

describe('UserMessage', () => {
  it('renders user message with content', () => {
    const message: Message = {
      id: '1',
      role: 'user',
      content: 'Test user message',
      timestamp: new Date(),
    };

    render(
      <TestWrapper>
        <UserMessage message={message} />
      </TestWrapper>
    );

    expect(screen.getByText('Test user message')).toBeInTheDocument();
  });

  it('displays timestamp', () => {
    const message: Message = {
      id: '1',
      role: 'user',
      content: 'Test message',
      timestamp: new Date(),
    };

    render(
      <TestWrapper>
        <UserMessage message={message} />
      </TestWrapper>
    );

    // Should display "Just now" for recent messages
    expect(screen.getByText('Just now')).toBeInTheDocument();
  });
});

describe('AIMessage', () => {
  it('renders AI message with content', () => {
    const message: Message = {
      id: '1',
      role: 'assistant',
      content: 'Test AI response',
      timestamp: new Date(),
    };

    render(
      <TestWrapper>
        <AIMessage message={message} />
      </TestWrapper>
    );

    expect(screen.getByText('Test AI response')).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    const message: Message = {
      id: '1',
      role: 'assistant',
      content: '# Heading\n\nThis is **bold** text.',
      timestamp: new Date(),
    };

    render(
      <TestWrapper>
        <AIMessage message={message} />
      </TestWrapper>
    );

    // In tests, markdown is mocked and renders as plain text
    expect(screen.getByText(/Heading/)).toBeInTheDocument();
    expect(screen.getByText(/bold/)).toBeInTheDocument();
  });

  it('displays metadata when provided', () => {
    const message: Message = {
      id: '1',
      role: 'assistant',
      content: 'Test message',
      timestamp: new Date(),
      metadata: {
        processingTime: 1500,
        confidence: 0.95,
      },
    };

    render(
      <TestWrapper>
        <AIMessage message={message} />
      </TestWrapper>
    );

    expect(screen.getByText('1.5s')).toBeInTheDocument();
    expect(screen.getByText('95% confidence')).toBeInTheDocument();
  });

  it('displays citation count when citations are present', () => {
    const message: Message = {
      id: '1',
      role: 'assistant',
      content: 'Test message',
      timestamp: new Date(),
      citations: [
        {
          id: 'c1',
          mdnUrl: 'https://developer.mozilla.org/test',
          articleTitle: 'Test Article',
          excerpt: 'Test excerpt',
          lastUpdated: new Date(),
          trustLevel: 'direct',
          relevanceScore: 0.9,
        },
      ],
    };

    render(
      <TestWrapper>
        <AIMessage message={message} />
      </TestWrapper>
    );

    expect(screen.getByText('1 source')).toBeInTheDocument();
  });

  it('displays plural sources for multiple citations', () => {
    const message: Message = {
      id: '1',
      role: 'assistant',
      content: 'Test message',
      timestamp: new Date(),
      citations: [
        {
          id: 'c1',
          mdnUrl: 'https://developer.mozilla.org/test1',
          articleTitle: 'Test Article 1',
          excerpt: 'Test excerpt 1',
          lastUpdated: new Date(),
          trustLevel: 'direct',
          relevanceScore: 0.9,
        },
        {
          id: 'c2',
          mdnUrl: 'https://developer.mozilla.org/test2',
          articleTitle: 'Test Article 2',
          excerpt: 'Test excerpt 2',
          lastUpdated: new Date(),
          trustLevel: 'direct',
          relevanceScore: 0.8,
        },
      ],
    };

    render(
      <TestWrapper>
        <AIMessage message={message} />
      </TestWrapper>
    );

    expect(screen.getByText('2 sources')).toBeInTheDocument();
  });
});

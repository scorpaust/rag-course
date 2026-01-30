'use client';

import React, { useState } from 'react';
import { ChatLayout } from '@/components/ChatLayout';
import { useTheme } from '@/components/ThemeProvider';
import { Message } from '@/types/message';
import { MessageList } from '@/components/MessageList';
import { UserMessage } from '@/components/UserMessage';
import { AIMessage } from '@/components/AIMessage';
import { InputComposer } from '@/components/InputComposer';
import styles from './page.module.css';

type ChatApiResponse = {
  message: {
    id: string;
    role: 'assistant';
    content: string;
    timestamp: string;
    citations?: {
      id: string;
      mdnUrl: string;
      articleTitle: string;
      sectionAnchor?: string;
      excerpt: string;
      lastUpdated: string;
      trustLevel: 'direct' | 'inferred' | 'related';
      relevanceScore: number;
    }[];
    metadata?: {
      model?: string;
      tokensUsed?: number;
      processingTime?: number;
      confidence?: number;
    };
  };
  citations: {
    id: string;
    mdnUrl: string;
    articleTitle: string;
    sectionAnchor?: string;
    excerpt: string;
    lastUpdated: string;
    trustLevel: 'direct' | 'inferred' | 'related';
    relevanceScore: number;
  }[];
};

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (content: string) => {
    const now = new Date();

    const userMessage: Message = {
      id: `user-${now.getTime()}`,
      role: 'user',
      content,
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: content }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage: Message = {
          id: `error-${now.getTime()}`,
          role: 'assistant',
          content:
            'Sorry, something went wrong while contacting the chat service. Please try again.',
          timestamp: now,
          metadata: {
            model: 'mdn-rag-mock',
            confidence: 0.0,
          },
        };
        console.error('Chat API error:', response.status, errorText);
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      const data = (await response.json()) as ChatApiResponse;

      const assistantMessage: Message = {
        id: data.message.id,
        role: 'assistant',
        content: data.message.content,
        timestamp: new Date(data.message.timestamp),
        metadata: data.message.metadata,
        citations: (data.message.citations ?? data.citations)?.map((c) => ({
          ...c,
          lastUpdated: new Date(c.lastUpdated),
        })),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat API network error:', error);
      const errorMessage: Message = {
        id: `error-${now.getTime()}`,
        role: 'assistant',
        content:
          'Network error while contacting the chat service. Please check your connection and try again.',
        timestamp: now,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChatLayout
      navigationRail={
        <div
          className={styles.panelContainer}
          {...({
            style: {
              '--color-text-secondary': theme.colors.textSecondary,
            },
          } as React.HTMLAttributes<HTMLDivElement>)}
        >
          <h2 className={styles.panelTitle}>Navigation</h2>
          <p className={styles.panelText}>Chat history will appear here</p>
        </div>
      }
      citationPanel={
        <div
          className={styles.panelContainer}
          {...({
            style: {
              '--color-text-secondary': theme.colors.textSecondary,
            },
          } as React.HTMLAttributes<HTMLDivElement>)}
        >
          <h2 className={styles.panelTitle}>Citations</h2>
          <p className={styles.panelText}>Source citations will appear here</p>
        </div>
      }
    >
      <div
        className={styles.mainContainer}
        {...({
          style: {
            '--color-text-secondary': theme.colors.textSecondary,
            '--color-primary': theme.colors.primary,
            '--color-surface': theme.colors.surface,
            '--color-border': theme.colors.border,
          },
        } as React.HTMLAttributes<HTMLDivElement>)}
      >
        <h1 className={styles.title}>MDN RAG Chatbot</h1>
        <p className={styles.description}>
          Ask questions about web technologies and get answers backed by MDN Web
          Docs
        </p>
        <button
          type="button"
          onClick={toggleTheme}
          className={styles.themeButton}
        >
          Toggle Theme (Current: {theme.mode})
        </button>

        <div className={styles.chatContainer}
          {...({
            style: {
              '--color-surface': theme.colors.surface,
              '--color-border': theme.colors.border,
            },
          } as React.HTMLAttributes<HTMLDivElement>)}
        >
          <div className={styles.chatMessagesWrapper}>
            <MessageList messages={messages} isLoading={isLoading}>
              {(message) =>
                message.role === 'user' ? (
                  <UserMessage message={message} />
                ) : (
                  <AIMessage message={message} />
                )
              }
            </MessageList>
          </div>
          <InputComposer onSubmit={handleSubmit} isDisabled={isLoading} />
        </div>
      </div>
    </ChatLayout>
  );
}

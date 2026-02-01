'use client';

import React, { useState, useEffect } from 'react';
import { ChatLayout } from '@/components/ChatLayout';
import { useTheme } from '@/components/ThemeProvider';
import { Message } from '@/types/message';
import { Citation } from '@/types/citation';
import { MessageList } from '@/components/MessageList';
import { UserMessage } from '@/components/UserMessage';
import { AIMessage } from '@/components/AIMessage';
import { InputComposer } from '@/components/InputComposer';
import styles from './page.module.css';

type ChatApiResponse = {
  sessionId: string;
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

type SessionApiResponse = {
  session: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
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
  }[];
};

type SessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const loadSession = async (id: string) => {
    try {
      const res = await fetch(`/api/session?sessionId=${id}`);
      if (!res.ok) {
        console.error('Failed to load session history:', await res.text());
        return;
      }

      const data = (await res.json()) as SessionApiResponse;
      setSessionId(data.session.id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('currentSessionId', data.session.id);
      }

      const hydratedMessages: Message[] = data.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.createdAt),
        citations: m.citations?.map((c) => ({
          ...c,
          lastUpdated: new Date(c.lastUpdated),
        })),
      }));

      setMessages(hydratedMessages);

      const lastAssistant = hydratedMessages
        .filter((m) => m.role === 'assistant')
        .at(-1);
      setActiveCitations(lastAssistant?.citations ?? []);
    } catch (error) {
      console.error('Error loading session history:', error);
    }
  };

  const refreshSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) {
        console.error('Failed to load sessions:', await res.text());
        return [] as SessionSummary[];
      }
      const data = (await res.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions);
      return data.sessions;
    } catch (error) {
      console.error('Error loading sessions:', error);
      return [] as SessionSummary[];
    }
  };

  // On first mount, load session list and hydrate the last active (or most recent) session
  useEffect(() => {
    if (typeof window === 'undefined') return;

    (async () => {
      const allSessions = await refreshSessions();
      if (!allSessions.length) return;

      const storedSessionId = window.localStorage.getItem('currentSessionId');
      const initialSession =
        allSessions.find((s) => s.id === storedSessionId) ?? allSessions[0];

      if (initialSession) {
        await loadSession(initialSession.id);
      }
    })();
  }, []);

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
        body: JSON.stringify({
          question: content,
          sessionId: sessionId ?? undefined,
        }),
      });

      if (!response.ok) {
        let errorBody: any = null;
        let errorMessageText =
          'Sorry, something went wrong while contacting the chat service. Please try again.';

        try {
          errorBody = await response.json();
          if (errorBody && typeof errorBody.error === 'string') {
            errorMessageText = errorBody.error;
          }
        } catch {
          const errorText = await response.text();
          if (errorText) {
            errorMessageText = errorText;
          }
        }

        const errorMessage: Message = {
          id: `error-${now.getTime()}`,
          role: 'assistant',
          content: errorMessageText,
          timestamp: now,
          metadata: {
            model: 'mdn-rag-backend',
            confidence: 0.0,
          },
        };
        console.error('Chat API error:', response.status, errorBody);
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      const data = (await response.json()) as ChatApiResponse;

      if (!sessionId || sessionId !== data.sessionId) {
        setSessionId(data.sessionId);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('currentSessionId', data.sessionId);
        }
      }

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
      setActiveCitations(assistantMessage.citations ?? []);
      // Update session list ordering / timestamps
      void refreshSessions();
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

  const handleDeleteSession = async (id: string) => {
    try {
      await fetch(`/api/sessions?sessionId=${id}`, { method: 'DELETE' });
      const updated = await refreshSessions();

      if (sessionId === id) {
        if (updated.length > 0) {
          await loadSession(updated[0].id);
        } else {
          setSessionId(null);
          setMessages([]);
          setActiveCitations([]);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('currentSessionId');
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleDeleteAllSessions = async () => {
    try {
      await fetch('/api/sessions', { method: 'DELETE' });
      setSessions([]);
      setMessages([]);
      setActiveCitations([]);
      setSessionId(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('currentSessionId');
      }
    } catch (error) {
      console.error('Failed to delete all sessions:', error);
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
          {sessions.length === 0 ? (
            <p className={styles.panelText}>
              No chat sessions yet. Ask a question to start a new chat.
            </p>
          ) : (
            <ul className={styles.navList}>
              {sessions.map((s) => (
                <li key={s.id} className={styles.navListItem}>
                  <button
                    type="button"
                    className={styles.navSessionButton}
                    onClick={() => loadSession(s.id)}
                  >
                    <div className={styles.navMessageTitle}>{s.title}</div>
                    <div className={styles.navMessageMeta}>
                      {new Date(s.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </button>
                  <button
                    type="button"
                    className={styles.navDeleteButton}
                    onClick={() => handleDeleteSession(s.id)}
                    aria-label="Delete chat session"
                  >
                    ×
                  </button>
                </li>
              ))}
              <li className={styles.navListItem}>
                <button
                  type="button"
                  className={styles.navDeleteAllButton}
                  onClick={handleDeleteAllSessions}
                >
                  Clear all sessions
                </button>
              </li>
            </ul>
          )}
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
          {activeCitations.length === 0 ? (
            <p className={styles.panelText}>
              Source citations for the latest answer will appear here.
            </p>
          ) : (
            <ul className={styles.citationList}>
              {activeCitations.map((c) => (
                <li key={c.id} className={styles.citationListItem}>
                  <a
                    href={c.mdnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.citationLink}
                  >
                    {c.articleTitle}
                  </a>
                  <div className={styles.citationExcerpt}>{c.excerpt}</div>
                  <div className={styles.citationMeta}>
                    <span>
                      Relevance: {Math.round(c.relevanceScore * 100)}%
                    </span>
                    <span>
                      Updated:{' '}
                      {c.lastUpdated instanceof Date
                        ? c.lastUpdated.toLocaleDateString()
                        : new Date(c.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={toggleTheme}
            className={styles.themeButton}
          >
            Toggle Theme (Current: {theme.mode})
          </button>
          <button
            type="button"
            onClick={() => {
              // Start a completely new session locally; backend will detect missing
              // sessionId and create a new chat_sessions row.
              setMessages([]);
              setActiveCitations([]);
              setSessionId(null);
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('currentSessionId');
              }
            }}
            className={styles.themeButton}
          >
            New Chat
          </button>
        </div>

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

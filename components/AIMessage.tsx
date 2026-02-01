/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types/message';
import { useTheme } from './ThemeProvider';
import styles from './AIMessage.module.css';

interface AIMessageProps {
  message: Message;
  onCitationClick?: (citationId: string) => void;
}

export function AIMessage({ message, onCitationClick }: AIMessageProps) {
  const { theme } = useTheme();

  const formatTimestamp = (date: Date) => {
    const messageDate = new Date(date);
    return messageDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.aiMessageContainer}>
      <div
        className={styles.aiMessageBubble}
        {...({
          style: {
            '--color-ai-message': theme.colors.aiMessage,
            '--color-text': theme.colors.text,
            '--color-text-secondary': theme.colors.textSecondary,
            '--color-border': theme.colors.border,
            '--color-code': theme.colors.code,
            '--color-primary': theme.colors.primary,
            '--font-family': theme.typography.fontFamily,
            '--code-font-family': theme.typography.codeFontFamily,
          },
        } as React.HTMLAttributes<HTMLDivElement>)}
      >
        <div className={styles.messageContent}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom block-level paragraph renderer
              // Use a <div> instead of <p> so that block elements like <pre>
              // from fenced code blocks never end up nested inside a <p>,
              // which would be invalid HTML and cause React hydration errors.
              p: ({ children }) => (
                <div className={styles.paragraph}>{children}</div>
              ),

              // Custom code block renderer
              code: ({ inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';

                if (inline) {
                  return (
                    <code className={styles.inlineCode} {...props}>
                      {children}
                    </code>
                  );
                }

                return (
                  <div className={styles.codeBlockWrapper}>
                    {language && (
                      <div className={styles.codeBlockHeader}>
                        <span className={styles.codeLanguage}>{language}</span>
                      </div>
                    )}
                    <pre className={styles.codeBlock}>
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                );
              },

              // Custom list renderers
              ul: ({ children }) => (
                <ul className={styles.unorderedList}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className={styles.orderedList}>{children}</ol>
              ),
              li: ({ children }) => (
                <li className={styles.listItem}>{children}</li>
              ),

              // Custom blockquote renderer (for notes)
              blockquote: ({ children }) => (
                <blockquote className={styles.blockquote}>
                  {children}
                </blockquote>
              ),

              // Custom heading renderers
              h1: ({ children }) => (
                <h1 className={styles.heading1}>{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className={styles.heading2}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className={styles.heading3}>{children}</h3>
              ),

              // Custom link renderer
              a: ({ href, children }) => (
                <a
                  href={href}
                  className={styles.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Message metadata */}
        <div className={styles.messageFooter}>
          <div className={styles.messageTimestamp}>
            {formatTimestamp(message.timestamp)}
          </div>

          {message.metadata && (
            <div className={styles.messageMetadata}>
              {message.metadata.processingTime && (
                <span className={styles.metadataItem}>
                  {(message.metadata.processingTime / 1000).toFixed(1)}s
                </span>
              )}
              {message.metadata.confidence && (
                <span className={styles.metadataItem}>
                  {Math.round(message.metadata.confidence * 100)}% confidence
                </span>
              )}
            </div>
          )}
        </div>

        {/* Citations count */}
        {message.citations && message.citations.length > 0 && (
          <div className={styles.citationsInfo}>
            <span className={styles.citationsCount}>
              {message.citations.length} source
              {message.citations.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Message } from '@/types/message';
import { useTheme } from './ThemeProvider';
import styles from './UserMessage.module.css';

interface UserMessageProps {
  message: Message;
}

export function UserMessage({ message }: UserMessageProps) {
  const { theme } = useTheme();

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInSeconds = Math.floor(
      (now.getTime() - messageDate.getTime()) / 1000
    );

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      return messageDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  return (
    <div className={styles.userMessageContainer}>
      <div
        className={styles.userMessageBubble}
        {...({
          style: {
            '--color-user-message': theme.colors.userMessage,
            '--color-text': theme.colors.text,
            '--color-text-secondary': theme.colors.textSecondary,
            '--color-border': theme.colors.border,
          },
        } as React.HTMLAttributes<HTMLDivElement>)}
      >
        <div className={styles.messageContent}>{message.content}</div>
        <div className={styles.messageTimestamp}>
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

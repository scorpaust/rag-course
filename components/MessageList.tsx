'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Message } from '@/types/message';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
  children: (message: Message) => React.ReactNode;
  isLoading?: boolean;
}

export function MessageList({
  messages,
  children,
  isLoading = false,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const previousMessageCountRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if a new message was added
    const hasNewMessage = messages.length > previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    // Only auto-scroll if user hasn't manually scrolled up
    if (hasNewMessage && !userHasScrolledUp) {
      scrollToBottom();
    }
  }, [messages, userHasScrolledUp]);

  // Scroll to bottom when loading state changes (new message starts generating)
  useEffect(() => {
    if (isLoading && !userHasScrolledUp) {
      scrollToBottom();
    }
  }, [isLoading, userHasScrolledUp]);

  const scrollToBottom = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  // Detect when user scrolls up manually
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Consider user has scrolled up if they're more than 100px from bottom
    const threshold = 100;
    setUserHasScrolledUp(distanceFromBottom > threshold);
  };

  return (
    <div
      ref={containerRef}
      className={styles.messageList}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      <div className={styles.messageListInner}>
        {messages.map((message) => (
          <div key={message.id} className={styles.messageWrapper}>
            {children(message)}
          </div>
        ))}
      </div>
    </div>
  );
}

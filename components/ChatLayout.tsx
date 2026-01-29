'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import styles from './ChatLayout.module.css';

interface ChatLayoutProps {
  children: React.ReactNode;
  citationPanel?: React.ReactNode;
  navigationRail?: React.ReactNode;
}

export function ChatLayout({
  children,
  citationPanel,
  navigationRail,
}: ChatLayoutProps) {
  const { theme } = useTheme();

  return (
    <div
      className={`${styles.chatLayout} ${navigationRail ? styles.chatLayoutWithNav : styles.chatLayoutNoNav}`}
      {...({
        style: {
          '--color-border': theme.colors.border,
          '--color-surface': theme.colors.surface,
          '--color-background': theme.colors.background,
        },
      } as React.HTMLAttributes<HTMLDivElement>)}
    >
      {/* Navigation Rail - Desktop only */}
      {navigationRail && (
        <aside className={styles.navigationRail}>{navigationRail}</aside>
      )}

      {/* Main Chat Area */}
      <main className={styles.chatMain}>{children}</main>

      {/* Citation Panel - Responsive */}
      {citationPanel && (
        <aside className={styles.citationPanel}>{citationPanel}</aside>
      )}
    </div>
  );
}

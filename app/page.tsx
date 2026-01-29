'use client';

import { ChatLayout } from '@/components/ChatLayout';
import { useTheme } from '@/components/ThemeProvider';
import styles from './page.module.css';

export default function Home() {
  const { theme, toggleTheme } = useTheme();

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
        <div className={styles.infoCard}>
          <h3 className={styles.infoTitle}>Theme System Active</h3>
          <p className={styles.infoText}>
            Background: {theme.colors.background}
          </p>
          <p className={styles.infoText}>Text: {theme.colors.text}</p>
        </div>
      </div>
    </ChatLayout>
  );
}

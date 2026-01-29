'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme, ThemeMode } from '@/types/theme';
import styles from './ThemeProvider.module.css';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'mdn-chatbot-theme';

// Light theme color palette
const lightTheme: Theme = {
  mode: 'light',
  colors: {
    background: '#ffffff',
    surface: '#f8f9fa',
    primary: '#0066cc',
    secondary: '#5e5e5e',
    text: '#1a1a1a',
    textSecondary: '#5e5e5e',
    border: '#e1e4e8',
    code: '#f6f8fa',
    userMessage: '#e3f2fd',
    aiMessage: '#f5f5f5',
    citation: '#fff3cd',
    warning: '#ff9800',
    error: '#d32f2f',
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    codeFontFamily:
      '"Fira Code", "Consolas", "Monaco", "Courier New", monospace',
    baseFontSize: '16px',
    lineHeight: 1.6,
  },
};

// Dark theme color palette
const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    primary: '#4da6ff',
    secondary: '#b0b0b0',
    text: '#e8e8e8',
    textSecondary: '#b0b0b0',
    border: '#404040',
    code: '#2d2d2d',
    userMessage: '#1e3a5f',
    aiMessage: '#2d2d2d',
    citation: '#4a4a2d',
    warning: '#ff9800',
    error: '#f44336',
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    codeFontFamily:
      '"Fira Code", "Consolas", "Monaco", "Courier New", monospace',
    baseFontSize: '16px',
    lineHeight: 1.6,
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [isMounted, setIsMounted] = useState(false);

  // After mount, read the stored theme on the client only
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setThemeModeState(storedTheme);
    }
    setIsMounted(true);
  }, []);

  // Persist theme to localStorage when it changes (client only)
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode, isMounted]);

  const theme = themeMode === 'light' ? lightTheme : darkTheme;

  const toggleTheme = () => {
    setThemeModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeMode }}>
      <div
        className={styles.themeRoot}
        data-theme={themeMode}
        {...({
          style: {
            '--color-background': theme.colors.background,
            '--color-text': theme.colors.text,
            '--font-family': theme.typography.fontFamily,
            '--font-size-base': theme.typography.baseFontSize,
            '--line-height': theme.typography.lineHeight,
          },
        } as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

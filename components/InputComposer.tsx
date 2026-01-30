'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from './ThemeProvider';
import styles from './InputComposer.module.css';

interface InputComposerProps {
  /** Called when the user submits a non-empty message */
  onSubmit: (content: string) => void;
  /** Disable input while a request is in flight */
  isDisabled?: boolean;
  /** Placeholder text with example questions */
  placeholder?: string;
  /** Optional max length for user input (UI only, not hard validation) */
  maxLength?: number;
}

const AUTO_RESIZE_MAX_HEIGHT = 200; // px
const CHARACTER_COUNT_THRESHOLD = 200; // show counter after this many characters

export function InputComposer({
  onSubmit,
  isDisabled = false,
  placeholder = 'Ask a question about web technologies (e.g. "How does flexbox work?" )',
  maxLength,
}: InputComposerProps) {
  const { theme } = useTheme();
  const [value, setValue] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize the textarea based on content, up to a max height
  const autoResize = () => {
    const el = textAreaRef.current;
    if (!el) return;

    // Reset height so scrollHeight is measured correctly
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, AUTO_RESIZE_MAX_HEIGHT);
    el.style.height = `${nextHeight}px`;
  };

  useEffect(() => {
    autoResize();
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    let next = event.target.value;
    if (maxLength !== undefined && next.length > maxLength) {
      next = next.slice(0, maxLength);
    }
    setValue(next);
  };

  const handleSubmit = () => {
    if (isDisabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter => submit
      event.preventDefault();
      handleSubmit();
    }
  };

  const showCharacterCount = value.length >= CHARACTER_COUNT_THRESHOLD;

  return (
    <div
      className={styles.composerContainer}
      {...({
        style: {
          '--color-surface': theme.colors.surface,
          '--color-border': theme.colors.border,
          '--color-text': theme.colors.text,
          '--color-text-secondary': theme.colors.textSecondary,
          '--color-primary': theme.colors.primary,
          '--font-family': theme.typography.fontFamily,
        },
      } as React.HTMLAttributes<HTMLDivElement>)}
    >
      <div className={styles.composerInner}>
        <textarea
          ref={textAreaRef}
          className={styles.textArea}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isDisabled}
          aria-label="Chat input"
        />
        <button
          type="button"
          className={styles.submitButton}
          onClick={handleSubmit}
          disabled={isDisabled || !value.trim()}
        >
          Send
        </button>
      </div>
      <div className={styles.composerFooter}>
        <span className={styles.hintText}>Press Enter to send, Shift+Enter for a new line</span>
        {showCharacterCount && (
          <span className={styles.charCount}>
            {value.length}
            {maxLength ? ` / ${maxLength}` : null}
          </span>
        )}
      </div>
    </div>
  );
}

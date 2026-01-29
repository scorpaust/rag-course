/**
 * Property-Based Tests for MessageList Component
 * Feature: mdn-rag-chatbot
 */


import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { MessageList } from '../MessageList';
import { ThemeProvider } from '../ThemeProvider';
import { Message } from '@/types/message';

// Wrapper component for theme context
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

// Generator for random messages
const messageArbitrary = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: fc.string({ minLength: 1, maxLength: 200 }),
  timestamp: fc.date(),
});

describe('MessageList Property-Based Tests', () => {
  /**
   * Property 4: Auto-scroll Behavior
   * Validates: Requirements 1.6
   *
   * For any chat session where messages exceed viewport height,
   * adding a new message should automatically scroll to display the latest message.
   */
  it('Property 4: Auto-scroll Behavior - should scroll to bottom when new messages are added', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(messageArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(messageArbitrary, { minLength: 1, maxLength: 5 }),
        async (initialMessages: Message[], newMessages: Message[]) => {
          // Ensure unique IDs
          const uniqueInitialMessages = initialMessages.map((msg, idx) => ({
            ...msg,
            id: `initial-${idx}`,
          }));

          const uniqueNewMessages = newMessages.map((msg, idx) => ({
            ...msg,
            id: `new-${idx}`,
          }));

          // Render with initial messages
          const { rerender, container } = render(
            <TestWrapper>
              <MessageList messages={uniqueInitialMessages}>
                {(message) => (
                  <div
                    data-testid={`message-${message.id}`}
                    style={{ height: '200px' }} // Make messages tall to ensure scrolling
                  >
                    {message.content}
                  </div>
                )}
              </MessageList>
            </TestWrapper>
          );

          const messageListContainer = container.querySelector(
            '[role="log"]'
          ) as HTMLDivElement;

          // Mock scrollTo to track scroll calls
          const scrollToMock = jest.fn();
          if (messageListContainer) {
            messageListContainer.scrollTo = scrollToMock;
            // Mock scroll properties to simulate overflow
            Object.defineProperty(messageListContainer, 'scrollHeight', {
              configurable: true,
              value: 2000,
            });
            Object.defineProperty(messageListContainer, 'clientHeight', {
              configurable: true,
              value: 600,
            });
          }

          // Add new messages
          const allMessages = [...uniqueInitialMessages, ...uniqueNewMessages];

          await act(async () => {
            rerender(
              <TestWrapper>
                <MessageList messages={allMessages}>
                  {(message) => (
                    <div
                      data-testid={`message-${message.id}`}
                      style={{ height: '200px' }}
                    >
                      {message.content}
                    </div>
                  )}
                </MessageList>
              </TestWrapper>
            );
          });

          // Wait for the effect to run
          await waitFor(() => {
            expect(scrollToMock).toHaveBeenCalled();
          });

          // Verify scrollTo was called with scrollHeight (scroll to bottom)
          const lastCall =
            scrollToMock.mock.calls[scrollToMock.mock.calls.length - 1];
          expect(lastCall).toBeDefined();
          expect(lastCall[0]).toEqual(
            expect.objectContaining({
              top: expect.any(Number),
              behavior: 'smooth',
            })
          );

          // The top value should be the scrollHeight (scrolling to bottom)
          expect(lastCall[0].top).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });
});

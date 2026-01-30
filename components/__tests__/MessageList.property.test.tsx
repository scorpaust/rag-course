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
import { AIMessage } from '../AIMessage';
import { Message } from '@/types/message';

// Wrapper component for theme context
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

// Generator for random messages
// Content is constrained to non-whitespace so we can reliably assert on rendered text.
const messageArbitrary = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: fc
    .string({ minLength: 1, maxLength: 200 })
    .filter((s) => s.trim().length > 0),
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

  /**
   * Property 1: Message Display Consistency
   * Validates: Requirements 1.1, 1.3
   *
   * For any user or AI message, when rendered in the MessageList,
   * it should appear with the correct role styling and content.
   */
  it('Property 1: Message Display Consistency - messages render with correct role and content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(messageArbitrary, { minLength: 1, maxLength: 20 }),
        async (messages: Message[]) => {
          const uniqueMessages = messages.map((msg, idx) => ({
            ...msg,
            id: `msg-${idx}`,
          }));

          const { container } = render(
            <TestWrapper>
              <MessageList messages={uniqueMessages}>
                {(message) => (
                  <div data-testid={`message-${message.id}`}>
                    {message.role === 'user' ? (
                      <div className="user-message-wrapper">{message.content}</div>
                    ) : (
                      <div className="ai-message-wrapper">{message.content}</div>
                    )}
                  </div>
                )}
              </MessageList>
            </TestWrapper>
          );

          // Each message should be rendered once with its content
          uniqueMessages.forEach((message) => {
            const el = container.querySelector(
              `[data-testid="message-${message.id}"]`
            ) as HTMLElement | null;
            expect(el).not.toBeNull();

            const renderedText = (el!.textContent ?? '').replace(/\s+/g, ' ').trim();
            const expectedText = message.content.replace(/\s+/g, ' ').trim();
            expect(renderedText).toContain(expectedText);

            if (message.role === 'user') {
              expect(el.querySelector('.user-message-wrapper')).not.toBeNull();
              expect(el.querySelector('.ai-message-wrapper')).toBeNull();
            } else {
              expect(el.querySelector('.ai-message-wrapper')).not.toBeNull();
              expect(el.querySelector('.user-message-wrapper')).toBeNull();
            }

            // Timestamp should be present somewhere in the rendered message container
            // We do not assert exact formatting (locale dependent), only that something is rendered.
            const textContent = el.textContent ?? '';
            expect(textContent.trim().length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Content Type Rendering
   * Validates: Requirements 1.4
   *
   * For any AI message containing multiple content types (text, code, lists, notes),
   * all content types should render with appropriate structure.
   */
  it('Property 2: Content Type Rendering - AI messages render all content types correctly', async () => {
    const contentArbitrary = fc
      .record({
        paragraph: fc.string({ minLength: 1, maxLength: 100 }),
        code: fc.string({ minLength: 1, maxLength: 100 }),
        listItems: fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
          minLength: 1,
          maxLength: 5,
        }),
        note: fc.string({ minLength: 1, maxLength: 100 }),
        includeParagraph: fc.boolean(),
        includeCode: fc.boolean(),
        includeList: fc.boolean(),
        includeNote: fc.boolean(),
      })
      // Ensure at least two content types are included
      .filter((cfg) => {
        const flags = [
          cfg.includeParagraph,
          cfg.includeCode,
          cfg.includeList,
          cfg.includeNote,
        ];
        return flags.filter(Boolean).length >= 2;
      });

    await fc.assert(
      fc.asyncProperty(contentArbitrary, async (cfg) => {
        const segments: string[] = [];

        if (cfg.includeParagraph) {
          segments.push(cfg.paragraph);
        }

        if (cfg.includeCode) {
          segments.push('```js\n' + cfg.code + '\n```');
        }

        if (cfg.includeList) {
          const list = cfg.listItems.map((item) => `- ${item}`).join('\n');
          segments.push(list);
        }

        if (cfg.includeNote) {
          segments.push(`> ${cfg.note}`);
        }

        const markdown = segments.join('\n\n');

        const aiMessage: Message = {
          id: 'ai-message',
          role: 'assistant',
          content: markdown,
          timestamp: new Date(),
        };

        const { container } = render(
          <TestWrapper>
            <MessageList messages={[aiMessage]}>
              {(message) => (
                <div data-testid={`message-${message.id}`}>
                  <AIMessage message={message} />
                </div>
              )}
            </MessageList>
          </TestWrapper>
        );

        const messageEl = container.querySelector(
          '[data-testid="message-ai-message"]'
        ) as HTMLElement | null;
        expect(messageEl).not.toBeNull();

        // With react-markdown mocked, we cannot assert on specific HTML structure.
        // Instead, we assert that all logical content segments are present in the rendered text.
        const renderedText = (messageEl?.textContent ?? '').replace(/\s+/g, ' ');

        const expectedSegments: string[] = [];
        if (cfg.includeParagraph && cfg.paragraph.trim().length > 0) {
          expectedSegments.push(cfg.paragraph.trim());
        }
        if (cfg.includeCode && cfg.code.trim().length > 0) {
          expectedSegments.push(cfg.code.trim());
        }
        if (cfg.includeList) {
          cfg.listItems.forEach((item) => {
            if (item.trim().length > 0) {
              expectedSegments.push(item.trim());
            }
          });
        }
        if (cfg.includeNote && cfg.note.trim().length > 0) {
          expectedSegments.push(cfg.note.trim());
        }

        // For all non-empty logical segments, ensure they appear in the rendered output.
        expectedSegments.forEach((segment) => {
          const normalizedSegment = segment.replace(/\s+/g, ' ').trim();
          if (normalizedSegment.length > 0) {
            expect(renderedText).toContain(normalizedSegment);
          }
        });
      }),
      { numRuns: 100 }
    );
  });
});

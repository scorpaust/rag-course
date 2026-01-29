'use client';

import React from 'react';
import { MessageList } from './MessageList';
import { UserMessage } from './UserMessage';
import { AIMessage } from './AIMessage';
import { Message } from '@/types/message';

/**
 * Example component demonstrating how to use MessageList with UserMessage and AIMessage
 * This is for demonstration purposes only
 */
export function ChatExample() {
  const exampleMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'What is the difference between let and const in JavaScript?',
      timestamp: new Date(Date.now() - 60000), // 1 minute ago
    },
    {
      id: '2',
      role: 'assistant',
      content: `# Variable Declarations in JavaScript

Both \`let\` and \`const\` are used to declare variables in JavaScript, but they have important differences:

## const
- Creates a **constant** reference that cannot be reassigned
- Must be initialized when declared
- The value itself can be mutable (for objects and arrays)

## let
- Creates a variable that can be reassigned
- Can be declared without initialization
- Block-scoped like const

### Example

\`\`\`javascript
const PI = 3.14159;
// PI = 3.14; // Error: Cannot reassign

let count = 0;
count = 1; // OK: Can reassign
\`\`\`

> **Note:** Use \`const\` by default, and only use \`let\` when you need to reassign the variable.`,
      timestamp: new Date(Date.now() - 30000), // 30 seconds ago
      metadata: {
        processingTime: 1200,
        confidence: 0.95,
      },
      citations: [
        {
          id: 'c1',
          mdnUrl:
            'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const',
          articleTitle: 'const - JavaScript | MDN',
          excerpt:
            'The const declaration creates a read-only reference to a value.',
          lastUpdated: new Date('2024-01-01'),
          trustLevel: 'direct',
          relevanceScore: 0.95,
        },
        {
          id: 'c2',
          mdnUrl:
            'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let',
          articleTitle: 'let - JavaScript | MDN',
          excerpt: 'The let statement declares a block-scoped local variable.',
          lastUpdated: new Date('2024-01-01'),
          trustLevel: 'direct',
          relevanceScore: 0.92,
        },
      ],
    },
  ];

  return (
    <div style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
      <MessageList messages={exampleMessages}>
        {(message) =>
          message.role === 'user' ? (
            <UserMessage message={message} />
          ) : (
            <AIMessage message={message} />
          )
        }
      </MessageList>
    </div>
  );
}

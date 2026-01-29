# Design Document: MDN RAG Chatbot

## Overview

The MDN RAG Chatbot is a Next.js-based web application that combines Retrieval-Augmented Generation (RAG) with MDN Web Docs to provide developers with accurate, citation-backed answers to web technology questions. The application prioritizes transparency, trust, and developer experience through a modern chat interface with comprehensive citation tracking.

### Core Design Principles

1. **Documentation-First**: Every answer must be traceable to authoritative MDN sources
2. **Developer-Centric**: Optimized for code display, technical accuracy, and power-user workflows
3. **Transparency**: Clear provenance and confidence indicators for all generated content
4. **Performance**: Fast initial load, progressive streaming, and responsive interactions
5. **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation and screen reader support

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Application                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Chat UI    │  │  Citation    │  │   Navigation    │  │
│  │  Component   │  │    Panel     │  │      Rail       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                  │                    │            │
│  ┌──────┴──────────────────┴────────────────────┴────────┐ │
│  │              State Management Layer                    │ │
│  │         (React Context + Local State)                  │ │
│  └──────┬──────────────────────────────────────────┬─────┘ │
│         │                                           │        │
│  ┌──────┴───────────┐                    ┌─────────┴─────┐ │
│  │   API Routes     │                    │  Client Utils │ │
│  │  /api/chat       │                    │  - Formatting │ │
│  │  /api/search     │                    │  - Validation │ │
│  └──────┬───────────┘                    └───────────────┘ │
└─────────┼──────────────────────────────────────────────────┘
          │
┌─────────┴──────────────────────────────────────────────────┐
│                    Backend Services                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   RAG Engine │  │   Vector DB  │  │   LLM Service   │  │
│  │              │  │  (Embeddings)│  │   (OpenAI/etc)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                  │                    │            │
│         └──────────────────┴────────────────────┘            │
│                            │                                 │
│                   ┌────────┴────────┐                       │
│                   │  MDN Docs Index │                       │
│                   │  (Pre-processed) │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: Next.js 14+ (App Router), React 18+, TypeScript
- **Styling**: Tailwind CSS for utility-first styling
- **State Management**: React Context API for global state, local state for component-specific data
- **Code Highlighting**: Prism.js or Shiki for syntax highlighting
- **Markdown Rendering**: react-markdown with custom renderers
- **Backend**: Next.js API Routes
- **RAG Pipeline**: LangChain or custom implementation
- **Vector Database**: Pinecone, Weaviate, or local vector store
- **LLM**: OpenAI GPT-4 or similar with streaming support

## Components and Interfaces

### Component Hierarchy

```
App
├── ThemeProvider
├── ChatLayout
│   ├── NavigationRail (optional, desktop only)
│   ├── ChatContainer
│   │   ├── ChatHeader
│   │   ├── MessageList
│   │   │   ├── UserMessage
│   │   │   └── AIMessage
│   │   │       ├── MessageContent
│   │   │       │   ├── TextBlock
│   │   │       │   ├── CodeBlock
│   │   │       │   │   └── CodeActions
│   │   │       │   ├── ListBlock
│   │   │       │   └── NoteBlock
│   │   │       ├── InlineCitation
│   │   │       └── MessageActions
│   │   ├── LoadingIndicator
│   │   └── InputComposer
│   │       ├── TextArea
│   │       └── ActionButtons
│   └── CitationPanel
│       ├── CitationHeader
│       ├── CitationList
│       │   └── CitationCard
│       │       ├── ArticleTitle
│       │       ├── SectionAnchor
│       │       ├── Excerpt
│       │       ├── Metadata
│       │       └── TrustIndicator
│       └── PinnedCitations
└── FollowUpSuggestions
    └── TopicChips
```

### Core Component Specifications

#### ChatContainer

**Purpose**: Main container for the chat interface, manages message flow and scrolling.

**Props**:

- `messages: Message[]` - Array of chat messages
- `isLoading: boolean` - Whether AI is generating response
- `onSendMessage: (content: string) => void` - Callback for sending messages

**Behavior**:

- Auto-scrolls to bottom when new messages arrive
- Maintains scroll position when user scrolls up
- Handles keyboard shortcuts (Cmd/Ctrl+K for focus)

#### AIMessage

**Purpose**: Displays AI-generated responses with structured content and citations.

**Props**:

- `message: AIMessageData` - Message content and metadata
- `citations: Citation[]` - Associated source citations
- `onCitationClick: (citationId: string) => void` - Citation interaction handler

**Behavior**:

- Renders markdown content with custom components
- Injects inline citation indicators at appropriate positions
- Supports progressive streaming of content
- Displays trust indicators and metadata

#### CodeBlock

**Purpose**: Displays syntax-highlighted code with interactive actions.

**Props**:

- `code: string` - Code content
- `language: string` - Programming language for highlighting
- `citations?: Citation[]` - Line-level citations if available
- `filename?: string` - Optional filename display

**Behavior**:

- Applies syntax highlighting based on language
- Shows copy/explain/playground actions on hover
- Displays line numbers for multi-line code
- Supports line-level citation anchors

#### CitationPanel

**Purpose**: Displays all source documents and provenance information for current answer.

**Props**:

- `citations: Citation[]` - List of citations to display
- `activeCitationId?: string` - Currently highlighted citation
- `pinnedCitations: Citation[]` - User-pinned citations
- `onPinCitation: (citationId: string) => void` - Pin handler

**Behavior**:

- Responsive: sidebar on desktop, slide-over on mobile
- Highlights active citation when clicked from message
- Allows pinning citations for cross-question reference
- Displays trust indicators and metadata for each source

#### InputComposer

**Purpose**: Multi-line input field with advanced composition features.

**Props**:

- `onSubmit: (content: string) => void` - Submit handler
- `isDisabled: boolean` - Whether input is disabled during loading
- `placeholder?: string` - Placeholder text

**Behavior**:

- Auto-expands height based on content (max 200px)
- Enter to submit, Shift+Enter for line break
- Displays character count for long inputs
- Shows example questions when empty

#### InlineCitation

**Purpose**: Small indicator within text linking to source document.

**Props**:

- `citation: Citation` - Citation data
- `index: number` - Citation number for display
- `onClick: () => void` - Click handler

**Behavior**:

- Displays as superscript number or small badge
- Shows tooltip preview on hover
- Highlights corresponding citation in panel on click
- Accessible via keyboard navigation

## Data Models

### Message

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  metadata?: MessageMetadata;
}

interface MessageMetadata {
  model?: string;
  tokensUsed?: number;
  processingTime?: number;
  confidence?: number;
}
```

### Citation

```typescript
interface Citation {
  id: string;
  mdnUrl: string;
  articleTitle: string;
  sectionAnchor?: string;
  excerpt: string;
  lastUpdated: Date;
  trustLevel: 'direct' | 'inferred' | 'related';
  relevanceScore: number;
  browserCompatibility?: BrowserCompatibility;
}

interface BrowserCompatibility {
  chrome?: string;
  firefox?: string;
  safari?: string;
  edge?: string;
}
```

### ChatSession

```typescript
interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  title?: string;
  topicScope?: TopicScope;
  pinnedCitations: Citation[];
}

type TopicScope = 'html' | 'css' | 'javascript' | 'web-apis' | 'http' | 'all';
```

### RAGContext

```typescript
interface RAGContext {
  query: string;
  retrievedDocuments: RetrievedDocument[];
  rerankedDocuments: RetrievedDocument[];
  generationPrompt: string;
  topicScope?: TopicScope;
}

interface RetrievedDocument {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  score: number;
}

interface DocumentMetadata {
  url: string;
  title: string;
  section?: string;
  lastModified: Date;
  tags: string[];
}
```

### Theme

```typescript
interface Theme {
  mode: 'light' | 'dark';
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
    border: string;
    code: string;
    userMessage: string;
    aiMessage: string;
    citation: string;
    warning: string;
    error: string;
  };
  typography: {
    fontFamily: string;
    codeFontFamily: string;
    baseFontSize: string;
    lineHeight: number;
  };
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Message Display Consistency

_For any_ user or AI message, when submitted or generated, the message should appear in the message list with correct role, content, and timestamp.

**Validates: Requirements 1.1, 1.3**

### Property 2: Content Type Rendering

_For any_ AI message containing multiple content types (text, code, lists, notes), all content types should render with appropriate formatting and structure.

**Validates: Requirements 1.4**

### Property 3: Multi-line Input Support

_For any_ multi-line text input, the input area should accept the content and support Enter for submission and Shift+Enter for line breaks.

**Validates: Requirements 1.5, 8.1, 8.2, 8.3**

### Property 4: Auto-scroll Behavior

_For any_ chat session where messages exceed viewport height, adding a new message should automatically scroll to display the latest message.

**Validates: Requirements 1.6**

### Property 5: Citation Presence

_For any_ AI answer generated from MDN sources, inline citation indicators and trust indicators should be present for each referenced source.

**Validates: Requirements 2.1, 2.5, 6.5**

### Property 6: Citation Interaction Synchronization

_For any_ citation indicator clicked in a message, the corresponding citation in the Citation_Panel should be highlighted and scrolled into view.

**Validates: Requirements 2.3**

### Property 7: Citation Completeness

_For any_ citation displayed in the Citation_Panel, it should include article title, excerpt, last updated date, and trust level indicator.

**Validates: Requirements 2.4**

### Property 8: Source Count Accuracy

_For any_ AI answer with citations, the displayed source count should equal the number of unique MDN documents referenced.

**Validates: Requirements 2.6**

### Property 9: Code Syntax Highlighting

_For any_ code block with a specified language, syntax highlighting classes or styles appropriate to that language should be applied.

**Validates: Requirements 3.1**

### Property 10: Clipboard Copy Accuracy

_For any_ code block, clicking the copy button should copy the exact code content to the clipboard and display confirmation feedback.

**Validates: Requirements 3.3**

### Property 11: Hover Interaction Tooltips

_For any_ hoverable element (citation indicator, inline code term, code block), hovering should display a tooltip with relevant information.

**Validates: Requirements 2.2, 3.2, 3.4**

### Property 12: Responsive Layout Adaptation

_For any_ viewport width, the layout should adapt appropriately with side-by-side panels on desktop (≥1024px) and stacked/slide-over on mobile (<768px).

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 13: Follow-up Suggestion Generation

_For any_ AI answer generated, the system should display at least one contextually relevant follow-up suggestion.

**Validates: Requirements 5.1**

### Property 14: Follow-up Submission

_For any_ follow-up suggestion clicked, it should be submitted as a new user question and appear in the message list.

**Validates: Requirements 5.3**

### Property 15: Topic Scope Persistence

_For any_ topic chip clicked, subsequent questions should be scoped to that topic until the scope is cleared or changed.

**Validates: Requirements 5.4**

### Property 16: Deprecated API Warnings

_For any_ AI answer referencing deprecated APIs, prominent warning indicators should be displayed alongside the deprecated content.

**Validates: Requirements 6.2**

### Property 17: Browser Compatibility Display

_For any_ citation with browser compatibility data, the compatibility information should be displayed in the citation card.

**Validates: Requirements 6.3**

### Property 18: Answer Regeneration

_For any_ answer with a regenerate action triggered, a new answer should be generated and replace the previous answer while maintaining citation history.

**Validates: Requirements 6.4**

### Property 19: Theme Persistence Round-trip

_For any_ theme selection (light or dark), switching themes and reloading the application should preserve the selected theme.

**Validates: Requirements 7.3, 7.4**

### Property 20: Keyboard Shortcut Functionality

_For any_ defined keyboard shortcut, triggering it should execute the corresponding action (submit, focus input, navigate, etc.).

**Validates: Requirements 8.4, 9.5**

### Property 21: Citation Pinning Persistence

_For any_ citation pinned by the user, it should remain visible in the pinned section across subsequent questions until explicitly unpinned.

**Validates: Requirements 9.3**

### Property 22: Loading State Display

_For any_ question processing operation, a loading indicator should appear within 100ms and remain visible until processing completes.

**Validates: Requirements 1.2, 10.1**

### Property 23: Progress Information Display

_For any_ document retrieval operation exceeding 2 seconds, progress information should be displayed to the user.

**Validates: Requirements 10.2**

### Property 24: Response Streaming

_For any_ AI answer generation that supports streaming, the response should appear progressively rather than all at once.

**Validates: Requirements 10.3**

### Property 25: Error Handling with Retry

_For any_ network error during question processing, an error message and retry option should be displayed to the user.

**Validates: Requirements 10.5**

## Error Handling

### Error Categories

1. **Network Errors**
   - Connection failures during API calls
   - Timeout errors for long-running operations
   - Rate limiting from LLM provider

2. **RAG Pipeline Errors**
   - Vector database connection failures
   - Document retrieval failures
   - Empty or insufficient context for generation

3. **User Input Errors**
   - Empty or whitespace-only questions
   - Excessively long input (>2000 characters)
   - Invalid characters or formatting

4. **Rendering Errors**
   - Malformed markdown in AI responses
   - Invalid code language specifications
   - Missing or broken citation references

### Error Handling Strategies

**Network Errors**:

- Display user-friendly error messages with specific guidance
- Provide retry button with exponential backoff
- Cache last successful state for recovery
- Log errors to monitoring service

**RAG Pipeline Errors**:

- Fallback to broader search if specific retrieval fails
- Display partial results if some documents retrieved
- Provide option to rephrase question
- Show system status indicator

**User Input Errors**:

- Validate input before submission
- Display inline validation messages
- Provide character count and limits
- Suggest corrections for common issues

**Rendering Errors**:

- Gracefully degrade to plain text if markdown fails
- Use fallback syntax highlighting for unknown languages
- Display placeholder for broken citations
- Log rendering errors for debugging

### Error Recovery

All errors should:

- Preserve user's input and chat history
- Allow immediate retry without data loss
- Provide clear next steps
- Never crash the application

## Testing Strategy

### Overview

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage. Unit tests verify specific examples and edge cases, while property-based tests validate universal properties across many generated inputs.

### Property-Based Testing

**Framework**: fast-check (TypeScript property-based testing library)

**Configuration**:

- Minimum 100 iterations per property test
- Each test tagged with format: `Feature: mdn-rag-chatbot, Property {N}: {property_text}`
- Tests run in CI/CD pipeline on every commit

**Property Test Implementation**:

Each correctness property from the design document should be implemented as a property-based test. For example:

- **Property 8 (Source Count Accuracy)**: Generate random AI messages with varying numbers of citations, verify count matches unique sources
- **Property 10 (Clipboard Copy)**: Generate random code blocks, simulate copy action, verify clipboard content matches
- **Property 19 (Theme Persistence)**: Generate random theme selections, simulate reload, verify persistence

**Generators**:

Custom generators should be created for:

- Random messages (user and AI)
- Random citations with varying trust levels
- Random code blocks with different languages
- Random viewport dimensions
- Random user interactions (clicks, hovers, keyboard events)

### Unit Testing

**Framework**: Jest + React Testing Library

**Test Categories**:

1. **Component Tests**
   - Render tests for all components
   - Interaction tests (clicks, hovers, keyboard)
   - Accessibility tests (ARIA labels, keyboard navigation)
   - Snapshot tests for visual regression

2. **Integration Tests**
   - Message flow from input to display
   - Citation synchronization between message and panel
   - Theme switching and persistence
   - Error handling and recovery

3. **API Route Tests**
   - Request validation
   - Response formatting
   - Error handling
   - Rate limiting

4. **Utility Function Tests**
   - Markdown parsing and rendering
   - Citation extraction and formatting
   - Code highlighting
   - Responsive breakpoint logic

### Edge Cases and Examples

**Specific test cases**:

- Empty chat state (no messages)
- Single message vs. many messages
- Very long messages (>10,000 characters)
- Messages with no citations
- Messages with many citations (>20)
- Code blocks with no language specified
- Malformed markdown in AI responses
- Rapid successive message submissions
- Theme switching during message generation
- Citation panel interactions during loading

### Test Coverage Goals

- **Line Coverage**: >80%
- **Branch Coverage**: >75%
- **Component Coverage**: 100% of UI components tested
- **Property Coverage**: All 25 correctness properties implemented as tests

### Continuous Integration

- Tests run on every pull request
- Property tests run with 100 iterations in CI
- Performance benchmarks for key operations
- Accessibility audits using axe-core
- Visual regression tests using Percy or Chromatic

## Implementation Notes

### Performance Considerations

1. **Code Splitting**: Lazy load citation panel and advanced features
2. **Virtualization**: Use virtual scrolling for long message lists
3. **Debouncing**: Debounce input events and resize handlers
4. **Memoization**: Memoize expensive rendering operations
5. **Streaming**: Implement streaming for AI responses to improve perceived performance

### Accessibility Requirements

1. **Keyboard Navigation**: All interactive elements accessible via keyboard
2. **Screen Readers**: Proper ARIA labels and live regions for dynamic content
3. **Focus Management**: Logical focus order and visible focus indicators
4. **Color Contrast**: WCAG AA compliance for all text and interactive elements
5. **Reduced Motion**: Respect prefers-reduced-motion for animations

### Security Considerations

1. **Input Sanitization**: Sanitize all user input before processing
2. **XSS Prevention**: Use React's built-in XSS protection, sanitize markdown
3. **API Key Protection**: Never expose API keys in client code
4. **Rate Limiting**: Implement rate limiting on API routes
5. **Content Security Policy**: Configure CSP headers appropriately

### Future Enhancements

1. **Voice Input**: Speech-to-text for question input
2. **Export Functionality**: Export chat sessions as markdown or PDF
3. **Collaborative Features**: Share chat sessions with team members
4. **Custom MDN Indexes**: Allow users to index custom documentation
5. **Offline Mode**: Cache responses for offline access
6. **Multi-language Support**: Support for non-English MDN content

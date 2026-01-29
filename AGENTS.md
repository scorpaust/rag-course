# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Core npm commands

All commands should be run from the repository root.

- Install dependencies: `npm install`
- Run the dev server (Next.js App Router on port 3000): `npm run dev`
- Create a production build: `npm run build`
- Start the production server (after `npm run build`): `npm start`
- Lint the codebase (ESLint): `npm run lint`
- Format the code with Prettier: `npm run format`
- Check formatting only (no writes): `npm run format:check`
- Run the Jest test suite once: `npm test`
- Run Jest tests in watch mode: `npm run test:watch`
- Run Jest tests with coverage: `npm run test:coverage`

Running a single test file or pattern (Jest):

- Single test file by path: `npm test -- components/__tests__/ChatLayout.test.tsx`
- Pattern match by name: `npm test -- MessageList.property.test`

## Project overview

This project is the **MDN RAG Chatbot** UI: a Next.js + TypeScript application that provides a documentation-first chat experience backed by MDN Web Docs.

The current codebase focuses on the frontend chat shell, theming system, message rendering, and test scaffolding. The full RAG pipeline (vector DB, LLM calls, MDN indexing) is described in the design/spec documents under `.kiro/` and `.claude/`, but is not implemented in this repository yet.

Key technologies (see `README.md` and `package.json`):

- Next.js App Router (`app/` directory)
- React with TypeScript
- Tailwind CSS via `globals.css` and CSS Modules for layout/component styling
- Jest + React Testing Library for unit tests
- `fast-check` for property-based tests
- `react-markdown` + `remark-gfm` for rendering AI Markdown responses

## High-level architecture

### App entrypoints

- `app/layout.tsx`
  - Sets up the HTML shell and global fonts (Geist) via `next/font`.
  - Wraps the entire app in `ThemeProvider` so all pages/components can access the theme context.

- `app/page.tsx`
  - The main chat page (`Home`), marked as `'use client'`.
  - Uses `useTheme` to read the current theme and expose a **Toggle Theme** button.
  - Composes the top-level UI by passing three regions into `ChatLayout`:
    - `navigationRail`: placeholder "Navigation" panel where chat history/navigation will live.
    - `citationPanel`: placeholder "Citations" panel where MDN citations will be surfaced later.
    - `children`: main content area showing title, description, theme controls, and an info card reflecting the active theme.
  - Uses CSS Modules (`page.module.css`) and CSS variables wired to the current `theme.colors`.

### Layout and theming

- `components/ThemeProvider.tsx`
  - Provides the `ThemeContext` (`theme`, `toggleTheme`, `setThemeMode`).
  - Implements two full theme definitions (`lightTheme`, `darkTheme`) using the `Theme`/`ThemeColors`/`ThemeTypography` types from `types/theme.ts`.
  - Persists the theme mode to `localStorage` under the key `mdn-chatbot-theme` and restores it on load.
  - Renders a root `<div>` with `data-theme` and CSS custom properties (background, text, font family, etc.) used by CSS Modules.
  - `useTheme` throws if called outside a `ThemeProvider`, and this is enforced by tests in `components/__tests__/ThemeProvider.test.tsx`.

- `components/ChatLayout.tsx`
  - Shell layout component responsible for the overall page frame.
  - Accepts `navigationRail` and `citationPanel` slots plus `children` for the main chat area.
  - Uses `useTheme` to inject `--color-border`, `--color-surface`, and `--color-background` CSS variables into `ChatLayout.module.css`.
  - Handles responsive layout: when a navigation rail and/or citation panel are present, corresponding CSS classes adjust the grid.

### Messaging components and flow

Types underpinning the chat domain live in `types/` and are shared between UI components and tests:

- `types/message.ts`
  - `Message`: `{ id, role: 'user' | 'assistant', content, timestamp, citations?, metadata? }`.
  - `MessageMetadata`: optional metadata such as `model`, `tokensUsed`, `processingTime`, `confidence`.

- `types/citation.ts`
  - `Citation`: MDN citation model including `mdnUrl`, `articleTitle`, `excerpt`, `lastUpdated`, `trustLevel`, `relevanceScore`, and optional `browserCompatibility` fields.
  - `TrustLevel`: `'direct' | 'inferred' | 'related'`.

- `types/chat-session.ts`
  - `ChatSession`: represents a chat tab/session with `messages`, timestamps, optional `title` and `topicScope`, plus `pinnedCitations`.
  - `TopicScope`: enum of MDN topic domains (`'html' | 'css' | 'javascript' | 'web-apis' | 'http' | 'all'`).

- `types/theme.ts`
  - Typed definition of `ThemeMode`, `ThemeColors`, `ThemeTypography`, and `Theme`, used throughout the theming system.

The primary message UI components are:

- `components/MessageList.tsx`
  - Scroll container for chat messages.
  - Accepts `messages: Message[]`, a `children` render prop (`(message: Message) => ReactNode`), and optional `isLoading`.
  - Maintains `userHasScrolledUp` to avoid fighting the user's manual scroll position.
  - Auto-scrolls to bottom when:
    - New messages are appended and the user has not scrolled up, or
    - `isLoading` toggles true (simulating a streaming/typing state).
  - Uses `role="log"` with `aria-live="polite"` so screen readers announce new messages.

- `components/UserMessage.tsx`
  - Renders a user message bubble using `Message` and `useTheme`.
  - Formats timestamps into relative "Just now", "Xm ago", "Xh ago", or clock time if older than 24h.

- `components/AIMessage.tsx`
  - Renders assistant messages with Markdown support via `react-markdown` and `remark-gfm`.
  - Defines custom renderers for paragraphs, headings, lists, blockquotes, links, inline code, and fenced code blocks.
  - For code blocks, extracts the language from `className` (e.g. `language-js`) and shows a language header plus styled `<pre><code>` section.
  - Uses `Message.metadata` to show processing time and confidence, and `Message.citations` to show a simple source-count pill (`"1 source"` vs `"N sources"`).
  - Currently exposes an optional `onCitationClick` prop but does not yet wire inline citation UI; that should align with the spec documents when implemented.

These components are re-exported from `components/index.ts` for ergonomic imports.

### Testing layout

- Component tests under `components/__tests__/` use Jest + React Testing Library.
  - `ChatLayout.test.tsx`: verifies that navigation rail, main content, and citation panel render correctly in different combinations.
  - `MessageComponents.test.tsx`: covers basic behaviors of `MessageList`, `UserMessage`, and `AIMessage` (rendering messages, timestamps, metadata, and citation counts).
  - `ThemeProvider.test.tsx`: asserts default theme, toggling, and `useTheme` error behavior when used without a provider.

- Domain type tests under `types/__tests__/types.test.ts` create concrete `Message`, `Citation`, `ChatSession`, and `Theme` objects to ensure type definitions are coherent and usable.

- Property-based tests under `components/__tests__/MessageList.property.test.tsx` use `fast-check` to validate **Property 4: Auto-scroll Behavior** from the design doc, by generating random message sequences and ensuring `scrollTo` is invoked appropriately when messages overflow the viewport.

When adding new UI behavior, prefer encoding key invariants as additional property-based tests that correspond to properties in the design document (see below).

## Spec documents and sources of truth

### `.kiro/specs/mdn-rag-chatbot/*`

This directory contains the primary functional specification for the MDN RAG Chatbot and should be treated as a source of truth when extending the system:

- `requirements.md`
  - EARS-style requirements for the chat interface, citation display, responsive layout, navigation, trust features, theming, power-user features, and performance.
  - Requirements are grouped (Requirement 1–10) with user stories and acceptance criteria; tie implementation and tests back to these requirement IDs where practical.

- `design.md`
  - High-level architecture for the full RAG chatbot, including component hierarchy, data models, RAG pipeline, correctness properties, and testing strategy.
  - Defines 25 named **correctness properties** (e.g. Message Display Consistency, Citation Presence, Responsive Layout Adaptation, Theme Persistence Round-trip, etc.) that are intended to be implemented as property-based tests using `fast-check`.
  - Describes how components like `ChatContainer`, `AIMessage`, `CodeBlock`, `CitationPanel`, and `InputComposer` should behave; the current codebase implements a subset of this design, so future work should follow these contracts.

- `tasks.md`
  - Implementation plan expressed as a checkbox list (with some tasks already marked `[x]`).
  - Tasks cover project setup, theme system, layout, chat interface components, InputComposer, CodeBlock, citation system, and numerous property-based tests.
  - When implementing new work, either:
    - Complete existing unchecked tasks (especially those marked with `*` for property tests), or
    - Add new tasks that reference the corresponding requirements and properties, keeping the same structure.

### `.claude/system-prompts` and `.claude/agents`

The `.claude/` directory defines a multi-step **spec-driven workflow** used by Claude-based agents. These files are system prompts and workflow instructions; they should generally not be modified unless you are intentionally evolving the spec workflow itself.

Important concepts for this repo:

- The workflow is split into three main document phases: **requirements**, **design**, and **tasks**, plus optional judge/implementation agents.
- Each phase is iterative and requires explicit user approval before advancing (e.g. requirements must be approved before design, design before tasks).
- Parallel spec agents can be used, and their outputs are reconciled via a judge agent into a single canonical document (renamed to `requirements.md`, `design.md`, or `tasks.md`).
- The MDN RAG Chatbot specs under `.kiro/specs/mdn-rag-chatbot/` mirror this structure and are the artifacts produced/maintained by that workflow.

When working in this repository as Warp:

- Treat `.claude/*` as configuration for the external spec workflow; avoid editing these unless explicitly asked to change the workflow behavior.
- Align implementation and tests with the living spec under `.kiro/specs/mdn-rag-chatbot/` rather than re-deriving requirements from scratch.

## How to extend the system safely

- When adding new UI features (e.g. InputComposer, CodeBlock, citation panel, follow-up suggestions), base behavior and props on the contracts in `design.md` and the requirements in `requirements.md`.
- When wiring up real RAG/MDN integration, keep the domain models (`Message`, `Citation`, `ChatSession`, `RAGContext` in the design doc) consistent and prefer extending existing types in `types/` rather than inventing parallel shapes.
- For any non-trivial behavior (scrolling, theming persistence, keyboard shortcuts, citation interactions), consider:
  - Adding or updating unit tests under `components/__tests__/`, and
  - Implementing a corresponding `fast-check` property test matching one of the documented correctness properties or a new property added to `design.md`.

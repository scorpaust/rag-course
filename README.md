# MDN RAG Chatbot

A Retrieval-Augmented Generation (RAG) chatbot that answers developer questions using **MDN Web Docs** as the primary knowledge source. It combines a modern chat UI with a Postgres + pgvector backend, Voyage embeddings, and optional LLM generation.

---

## Features

### Chat experience
- Documentation-first AI chat UI, designed for MDN-style answers
- Production-ready `/api/chat` route backed by MDN-grounded RAG
- Inline citations and citation side panel wired to real MDN chunks
- Message metadata (model, latency, confidence) returned from the API
- Chat sessions persisted in Postgres so conversations can be revisited

### RAG / retrieval backend
- Postgres with **pgvector** for semantic search over MDN chunks
- `documents` + `chunks` tables managed via Drizzle ORM
- Embeddings created from `chunks.json` and stored in the `embedding` vector column
- Semantic search using pgvector `<->` distance on the `embedding` column
- Hybrid ranking that combines BM25 keyword relevance with vector similarity
- Optional LLM-based re-ranking on the top hybrid candidates for better grounding

### Embeddings
- Uses **Voyage** embeddings by default (e.g. `voyage-3-large`)
- Seed script calls Voyage's `/embeddings` API in batches
- Automatic fallback to deterministic local embeddings when:
  - Voyage returns 429 (rate-limited)
  - Voyage returns 402 / payment-method required
- Embedding dimensionality is configurable (default `1536`) and must match the pgvector column

### CLI tools
- `npm run ask` – semantic search only
  - Embeds a question with the same Voyage pipeline
  - Retrieves the top matching chunks from Postgres
  - Prints scores, snippets, and a naive answer from the best chunk
- `npm run ask:llm` – full RAG (retrieval + LLM)
  - Same retrieval as `ask`
  - Builds a context prompt from the top chunks
  - Calls an LLM via the `ai` SDK (if `OPENAI_API_KEY` is set)
  - Falls back to returning the best chunk content if no LLM key is configured

### Developer experience
- Next.js App Router, TypeScript, Tailwind CSS
- Property-based tests (fast-check) for key UI properties
- Jest + React Testing Library test suite
- ESLint + Prettier for linting and formatting
- Light and dark theme support via a `ThemeProvider`
- Responsive layout for desktop, tablet, and mobile

---

## Getting Started

### Prerequisites

- Node.js **20+** and npm
- Docker (for running the Postgres + pgvector database)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

---

## Environment Configuration

Create a `.env` file in the project root. Common variables:

```bash
# Database
DATABASE_URL=postgres://example:example@localhost:5455/example

# Voyage embeddings
VOYAGE_API_KEY=your_voyage_api_key
VOYAGE_BASE_URL=https://api.voyageai.com/v1        # optional, default shown
VOYAGE_EMBEDDING_MODEL=voyage-3-large             # optional, default
EMBEDDING_DIMENSIONS=1536                         # must match pgvector column

# Optional: LLM for generation (used by ask-llm and future /api/chat RAG backend)
OPENAI_API_KEY=sk-...                             # optional; if absent, ask-llm skips LLM call
OPENAI_MODEL=gpt-4o-mini                          # optional, has a default
```

> **Note:** The app will throw clear errors on startup if required variables like `DATABASE_URL` or `VOYAGE_API_KEY` are missing.

---

## Database & Migrations

This project uses **Postgres with pgvector**. A ready-to-use Docker image is provided in `docker-compose.yml`.

### Start the database

```bash
npm run db:up
```

This brings up a Postgres instance with pgvector on port `5455` and default credentials (`example/example`).

### Stop the database

```bash
npm run db:down
```

### Migrations (Drizzle)

Typical workflow (if you modify the schema):

```bash
npm run db:generate   # generate migration files from schema
npm run db:migrate    # apply migrations
```

The schema lives in:

- `lib/db/schema.ts` – `documents`, `chunks`, `chatSessions`, `messages`, `messageCitations`
- `lib/db/client.ts` – Drizzle client + connection pooling

---

## Seeding MDN Documents & Embeddings

The app expects a `chunks.json` file at the project root containing preprocessed MDN chunks.

### Seed the database

```bash
npm run db:seed
```

`db:seed` does the following:

1. Loads `chunks.json`
2. Connects to Postgres using `DATABASE_URL`
3. Clears derived tables:
   - `DELETE FROM chunks`
   - `DELETE FROM documents`
4. Groups chunks by `source` (e.g. `closures/index.md`)
5. Inserts one `documents` row per source with title/slug/frontmatter
6. Embeds all chunks for each document using Voyage (with fallback to local deterministic embeddings)
7. Inserts each chunk into the `chunks` table, including the `embedding` vector column

> If Voyage rate-limits your account or requires a payment method, the seed script automatically falls back to deterministic local embeddings so the pipeline still works for development.

---

## Semantic Search CLI (Retrieval Only)

### `npm run ask`

Embed a question, run a semantic search over `chunks`, and print the top matches:

```bash
npm run ask -- "What is a JavaScript closure?"
```

This script (`scripts/ask.js`) will:

1. Generate an embedding for your question using Voyage (or the local fallback)
2. Query Postgres with pgvector:
   - `ORDER BY c.embedding <-> $1::vector LIMIT 5`
3. Print the top matching chunks with:
   - Distance score
   - Source file and chunk index
   - Optional heading
   - Snippet from the content
4. Print a naive answer consisting of the full content of the best chunk

This is useful for debugging the retrieval layer independently of any LLM.

---

## Full RAG CLI (Retrieval + LLM)

### `npm run ask:llm`

Run the full RAG pipeline from the command line:

```bash
npm run ask:llm -- "What is a JavaScript closure?"
```

The script (`scripts/ask-llm.js`) performs:

1. **Embed question** with Voyage (or local fallback)
2. **Retrieve relevant chunks** from `chunks` using pgvector (<-> distance)
3. **Build a context prompt** from the top chunks
4. **Ask the LLM** using the `ai` SDK and OpenAI (if `OPENAI_API_KEY` is set)
5. Print the final answer

If `OPENAI_API_KEY` is **not** set:

- The script logs that the LLM call is skipped
- It returns the best chunk content directly as the answer (still MDN-sourced)

---

## Web Application (Next.js)

### Development server

Start the Next.js dev server:

```bash
npm run dev
```

Then visit:

- `http://localhost:3000` – main chat UI

### Current backend behavior

- The `app/api/chat/route.ts` endpoint now runs the **full RAG pipeline**.
- It validates the question (non-empty, length limits) and then:
  - Embeds the question using Voyage (with a deterministic local fallback on rate limits / billing issues)
  - Retrieves candidate chunks from Postgres using pgvector `<->` distance
  - Applies hybrid BM25 + vector ranking (see `lib/search/hybrid.ts`)
  - Optionally re-ranks the top candidates with an LLM if `OPENAI_API_KEY` is configured
  - Builds an MDN-grounded answer using the Vercel AI SDK (or falls back to the top chunk content)
  - Persists the user and assistant messages, plus their citations, in `chatSessions`, `messages`, and `messageCitations`
- The response includes the assistant message, its MDN citations, and the `sessionId` so the UI can continue the conversation.

The CLI scripts (`ask` and `ask:llm`) remain useful for debugging retrieval and end-to-end RAG behavior from the command line.

---

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

Property-based tests (using fast-check) cover key correctness properties such as message display, auto-scroll behavior, and more.

---

## Code Quality

Format code with Prettier:

```bash
npm run format
```

Check formatting:

```bash
npm run format:check
```

Lint code:

```bash
npm run lint
```

---

## Project Structure

```text
.
├── app/              # Next.js app directory (layouts, pages, API routes)
├── components/       # React UI components (ChatLayout, MessageList, etc.)
├── lib/
│   ├── db/           # Drizzle schema and Postgres client
│   └── embeddings/   # Embedding provider configuration (Voyage)
├── scripts/          # Node.js scripts (seed, ask, ask-llm)
├── types/            # Shared TypeScript types (Message, Citation, Theme, etc.)
└── public/           # Static assets
```

---

## Technology Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Postgres + pgvector
- **ORM**: Drizzle ORM
- **Embeddings**: Voyage embeddings (with local fallback)
- **LLM (optional)**: OpenAI via `@ai-sdk/openai` and `ai`
- **Testing**: Jest, React Testing Library, fast-check
- **Code Quality**: ESLint, Prettier

---

## Type Definitions

Core types are defined in the `types/` directory, including:

- `Message` – chat messages from user or assistant
- `Citation` – references to MDN documents
- `ChatSession` – chat session with message history
- `Theme` – theme configuration (colors, typography)

---

## Further Reading

To learn more about the main technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [fast-check Documentation](https://fast-check.dev/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Voyage AI Docs](https://docs.voyageai.com/)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/)

---

## License

This project is for educational purposes.

import {
  pgEnum,
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uuid,
  jsonb,
  vector,
} from 'drizzle-orm/pg-core';

// --- Core MDN document & chunk storage ---

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  // e.g. "closures/index.md"
  source: text('source').notNull(),
  // e.g. frontmatter.title
  title: text('title').notNull(),
  // e.g. frontmatter.slug ("Web/JavaScript/Guide/Closures")
  slug: text('slug').notNull(),
  pageType: text('page_type'),
  sidebar: text('sidebar'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const chunks = pgTable('chunks', {
  // Use the chunk id from chunks.json directly, e.g. "closures/index.md::0"
  id: text('id').primaryKey(),
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  startLine: integer('start_line'),
  endLine: integer('end_line'),
  heading: text('heading'),
  // Raw MDN frontmatter JSON for this chunk's page
  frontmatter: jsonb('frontmatter'),
  // The text content of the chunk
  content: text('content').notNull(),
  // Vector embedding for retrieval (set dimensions to match your model)
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- Chat sessions & messages ---

export const messageRoleEnum = pgEnum('message_role', ['assistant', 'user']);

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Citations linking messages back to source chunks ---

export const messageCitations = pgTable('message_citations', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  chunkId: text('chunk_id')
    .notNull()
    .references(() => chunks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

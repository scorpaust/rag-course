import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  chatSessions,
  messages,
  messageCitations,
  chunks,
  documents,
} from '@/lib/db/schema';
import type { Citation } from '@/types/citation';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  // Verify the session exists
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId));

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Load messages and their citations by joining message_citations -> chunks -> documents
  const rows = await db
    .select({
      messageId: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
      chunkId: messageCitations.chunkId,
      chunkContent: chunks.content,
      chunkHeading: chunks.heading,
      chunkIndex: chunks.chunkIndex,
      slug: documents.slug,
      title: documents.title,
    })
    .from(messages)
    .leftJoin(messageCitations, eq(messages.id, messageCitations.messageId))
    .leftJoin(chunks, eq(messageCitations.chunkId, chunks.id))
    .leftJoin(documents, eq(chunks.documentId, documents.id))
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));

  type MessageAccumulator = {
    id: string;
    role: 'assistant' | 'user';
    content: string;
    createdAt: string;
    citations: Citation[];
  };

  const byMessage = new Map<string, MessageAccumulator>();

  for (const row of rows) {
    let acc = byMessage.get(row.messageId);
    if (!acc) {
      acc = {
        id: row.messageId,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        citations: [],
      };
      byMessage.set(row.messageId, acc);
    }

    if (row.chunkId && row.slug && row.title) {
      const snippet = (row.chunkContent ?? '').replace(/\s+/g, ' ').slice(0, 280);
      const mdnUrl = `https://developer.mozilla.org/en-US/docs/${row.slug}`;

      const citation: Citation = {
        id: row.chunkId,
        mdnUrl,
        articleTitle: row.title,
        sectionAnchor: undefined,
        excerpt: snippet,
        lastUpdated: new Date(),
        trustLevel: 'direct',
        relevanceScore: 0.9,
      };

      acc.citations.push(citation);
    }
  }

  const messagesOut = Array.from(byMessage.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
    messages: messagesOut,
  });
}

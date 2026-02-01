import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { chatSessions } from '@/lib/db/schema';

export const runtime = 'nodejs';

// List all chat sessions, most recent first
export async function GET() {
  const rows = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .orderBy(desc(chatSessions.updatedAt));

  const sessions = rows.map((s) => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return NextResponse.json({ sessions });
}

// Delete a single session (by ?sessionId=) or all sessions if no id is provided
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  if (sessionId) {
    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
  } else {
    await db.delete(chatSessions);
  }

  return NextResponse.json({ ok: true });
}

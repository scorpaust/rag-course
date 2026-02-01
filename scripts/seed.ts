import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

import { db } from '../lib/db/client';
import { chunks, documents } from '../lib/db/schema';

type Frontmatter = {
  title: string;
  slug: string;
  'page-type'?: string;
  sidebar?: string;
  // allow additional keys without caring about them in TypeScript
  [key: string]: unknown;
};

type ChunkRecord = {
  id: string;
  source: string;
  startLine?: number | null;
  endLine?: number | null;
  heading?: string | null;
  frontmatter: Frontmatter;
  text: string;
};

async function loadChunks(): Promise<ChunkRecord[]> {
  const chunksPath = path.join(process.cwd(), 'chunks.json');
  const raw = await fs.readFile(chunksPath, 'utf8');
  const parsed = JSON.parse(raw) as ChunkRecord[];
  return parsed;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const allChunks = await loadChunks();

  // Start from a clean slate for documents/chunks so the seed is idempotent.
  // This is safe because these tables are derived from chunks.json.
  await db.delete(chunks);
  await db.delete(documents);

  // Group chunks by their source document (e.g. "closures/index.md").
  const chunksBySource = new Map<string, ChunkRecord[]>();
  for (const chunk of allChunks) {
    const list = chunksBySource.get(chunk.source) ?? [];
    list.push(chunk);
    chunksBySource.set(chunk.source, list);
  }

  for (const [source, sourceChunks] of chunksBySource) {
    if (sourceChunks.length === 0) continue;

    const first = sourceChunks[0];
    const fm = first.frontmatter ?? ({} as Frontmatter);

    const [insertedDoc] = await db
      .insert(documents)
      .values({
        source,
        title: (fm.title as string | undefined) ?? source,
        slug: (fm.slug as string | undefined) ?? source,
        pageType: (fm['page-type'] as string | undefined) ?? null,
        sidebar: (fm.sidebar as string | undefined) ?? null,
      })
      .returning();

    // Determine a stable chunk index from the chunk id suffix (e.g. "::0").
    const orderedChunks = [...sourceChunks]
      .map((chunk) => {
        const match = /::(\d+)$/.exec(chunk.id);
        const chunkIndex = match ? Number(match[1]) : 0;
        return { chunk, chunkIndex };
      })
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    if (!insertedDoc) {
      throw new Error(`Failed to insert document for source ${source}`);
    }

    await db.insert(chunks).values(
      orderedChunks.map(({ chunk, chunkIndex }) => ({
        id: chunk.id,
        documentId: insertedDoc.id,
        chunkIndex,
        startLine: chunk.startLine ?? null,
        endLine: chunk.endLine ?? null,
        heading: chunk.heading ?? null,
        frontmatter: chunk.frontmatter ?? null,
        content: chunk.text,
      })),
    );
  }

  console.log('Database seeded with documents and chunks from chunks.json');
}

main().catch((err) => {
  console.error('Error seeding database:', err);
  process.exit(1);
});

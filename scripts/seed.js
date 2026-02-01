require('dotenv/config');

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

// Voyage embedding model ID and expected vector dimensions (must match pgvector schema).
const voyageEmbeddingModel = process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-3-large';
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS) || 1536;

if (!process.env.VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY is not set');
}

function generateLocalEmbedding(text) {
  const hash = crypto.createHash('sha256').update(text || '').digest();
  const vector = new Array(EMBEDDING_DIMENSIONS);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const byte = hash[i % hash.length];
    // Map byte [0,255] into approximately [-1,1].
    vector[i] = (byte / 255) * 2 - 1;
  }
  return vector;
}

async function embedWithVoyage(texts) {
  const res = await fetch(
    (process.env.VOYAGE_BASE_URL || 'https://api.voyageai.com/v1') + '/embeddings',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: voyageEmbeddingModel,
        input: texts,
      }),
    },
  );

  if (!res.ok) {
    const bodyText = await res.text();

    // If the Voyage account is rate-limited or requires a payment method,
    // fall back to deterministic local embeddings so seeding can still proceed.
    if (res.status === 429 || res.status === 402) {
      console.warn(
        `Voyage embeddings request failed with ${res.status} ${res.statusText}. ` +
          'Falling back to local deterministic embeddings for seeding. Full response: ' +
          bodyText,
      );
      return texts.map((text) => generateLocalEmbedding(text));
    }

    throw new Error(
      `Voyage embeddings request failed: ${res.status} ${res.statusText} - ${bodyText}`,
    );
  }

  const json = await res.json();
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error('Voyage embeddings response missing data array');
  }

  const rawEmbeddings = json.data.map((item) => item.embedding);

  return rawEmbeddings.map((embedding, index) => {
    if (!Array.isArray(embedding)) {
      throw new Error(`Voyage embedding at index ${index} is missing or invalid`);
    }

    if (embedding.length === EMBEDDING_DIMENSIONS) {
      return embedding;
    }

    if (embedding.length > EMBEDDING_DIMENSIONS) {
      // Truncate extra dimensions to fit the pgvector column size.
      return embedding.slice(0, EMBEDDING_DIMENSIONS);
    }

    // Pad with zeros if the embedding is shorter than expected.
    return embedding.concat(new Array(EMBEDDING_DIMENSIONS - embedding.length).fill(0));
  });
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function loadChunks() {
  const chunksPath = path.join(process.cwd(), 'chunks.json');
  const raw = await fs.readFile(chunksPath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const allChunks = await loadChunks();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clear derived tables so seeding is idempotent.
    await client.query('DELETE FROM chunks');
    await client.query('DELETE FROM documents');

    // Group chunks by source document.
    const chunksBySource = new Map();
    for (const chunk of allChunks) {
      const list = chunksBySource.get(chunk.source) ?? [];
      list.push(chunk);
      chunksBySource.set(chunk.source, list);
    }

    for (const [source, sourceChunks] of chunksBySource.entries()) {
      if (!sourceChunks.length) continue;

      const first = sourceChunks[0];
      const fm = first.frontmatter || {};

      const docRes = await client.query(
        'INSERT INTO documents (source, title, slug, page_type, sidebar) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [
          source,
          fm.title || source,
          fm.slug || source,
          fm['page-type'] || null,
          fm.sidebar || null,
        ],
      );

      const documentId = docRes.rows[0].id;

      const orderedChunks = [...sourceChunks]
        .map((chunk) => {
          const match = /::(\\d+)$/.exec(chunk.id);
          const chunkIndex = match ? Number(match[1]) : 0;
          return { chunk, chunkIndex };
        })
        .sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Create embeddings for all chunks in this document in a single batch using Voyage directly,
      // bypassing the Vercel AI Gateway so no credit card is required there.
      const embeddings = await embedWithVoyage(
        orderedChunks.map(({ chunk }) => chunk.text || ''),
      );

      for (const [index, { chunk, chunkIndex }] of orderedChunks.entries()) {
        const embedding = embeddings[index];
        if (!embedding) {
          throw new Error(`Missing embedding for chunk ${chunk.id}`);
        }

        // pgvector accepts a string representation like [0.1,0.2,...].
        const embeddingAsVectorLiteral = `[${embedding.join(',')}]`;

        await client.query(
          'INSERT INTO chunks (id, document_id, chunk_index, start_line, end_line, heading, frontmatter, content, embedding) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)',
          [
            chunk.id,
            documentId,
            chunkIndex,
            chunk.startLine ?? null,
            chunk.endLine ?? null,
            chunk.heading ?? null,
            chunk.frontmatter ?? null,
            chunk.text,
            embeddingAsVectorLiteral,
          ],
        );
      }
    }

    await client.query('COMMIT');
    console.log('Database seeded with documents and chunks from chunks.json');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

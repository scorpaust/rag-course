require('dotenv/config');

const crypto = require('node:crypto');
const { Pool } = require('pg');

// Voyage embedding model ID and expected vector dimensions (must match pgvector schema).
const voyageEmbeddingModel = process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-3-large';
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS) || 1536;

if (!process.env.VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY is not set');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
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
    // fall back to deterministic local embeddings so querying can still proceed.
    if (res.status === 429 || res.status === 402) {
      console.warn(
        `Voyage embeddings request failed with ${res.status} ${res.statusText}. ` +
          'Falling back to local deterministic embeddings for query. Full response: ' +
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

async function main() {
  const question = process.argv.slice(2).join(' ').trim();

  if (!question) {
    console.error('Usage: node scripts/ask.js "<your question>"');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log(`Question: ${question}`);
    console.log('Generating embedding with Voyage (with local fallback if needed)...');

    const [questionEmbedding] = await embedWithVoyage([question]);
    if (!questionEmbedding) {
      throw new Error('Failed to generate embedding for question');
    }

    const embeddingAsVectorLiteral = `[${questionEmbedding.join(',')}]`;

    const { rows } = await client.query(
      `
      SELECT
        c.id,
        c.content,
        c.heading,
        c.chunk_index,
        d.title,
        d.slug,
        d.source,
        c.embedding <-> $1::vector AS distance
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      ORDER BY c.embedding <-> $1::vector
      LIMIT 5
    `,
      [embeddingAsVectorLiteral],
    );

    if (!rows.length) {
      console.log('No matching chunks found.');
      return;
    }

    console.log('\nTop matching chunks:');
    for (const row of rows) {
      const snippet = row.content.replace(/\s+/g, ' ').slice(0, 300);
      console.log('\n----------------------------------------');
      console.log(`Score: ${row.distance.toFixed(4)}`);
      console.log(`Source: ${row.source} (chunk #${row.chunk_index})`);
      if (row.heading) {
        console.log(`Heading: ${row.heading}`);
      }
      console.log(`Title: ${row.title}`);
      console.log(`Snippet: ${snippet}${row.content.length > 300 ? '…' : ''}`);
    }

    const best = rows[0];
    console.log('\n=== Naive answer (top chunk content) ===');
    console.log(best.content);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error running ask script:', err);
  process.exit(1);
});

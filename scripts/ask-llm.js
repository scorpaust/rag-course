require('dotenv/config');

const crypto = require('node:crypto');
const { Pool } = require('pg');
const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');

// Voyage embedding model ID and expected vector dimensions (must match pgvector schema).
const voyageEmbeddingModel = process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-3-large';
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS) || 1536;

if (!process.env.VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY is not set');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const openaiApiKey = process.env.OPENAI_API_KEY || '';
const openaiModelId = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let openai = null;
if (openaiApiKey) {
  openai = createOpenAI({
    apiKey: openaiApiKey,
  });
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

async function retrieveRelevantChunks(client, questionEmbedding, limit = 5) {
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
    LIMIT $2
  `,
    [embeddingAsVectorLiteral, limit],
  );

  return rows;
}

function buildContextFromChunks(rows) {
  return rows
    .map((row, idx) => {
      const snippet = row.content.replace(/\s+/g, ' ').slice(0, 800);
      return [
        `Document ${idx + 1}:`,
        `Title: ${row.title}`,
        `Source: ${row.source} (chunk #${row.chunk_index})`,
        row.heading ? `Heading: ${row.heading}` : null,
        '',
        snippet,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n---\n\n');
}

async function askLlmWithContext(question, rows) {
  if (!openai) {
    console.warn(
      'OPENAI_API_KEY is not set; skipping LLM call and returning top chunk content as the answer.',
    );
    return {
      answer: rows[0]?.content || 'No relevant chunks found to answer this question.',
      usedLlm: false,
    };
  }

  const context = buildContextFromChunks(rows);

  const prompt = [
    'You are an assistant that answers web development questions using MDN Web Docs as the primary source.',
    'You are given several relevant document chunks from MDN. Use ONLY this context to answer the question.',
    'If the answer is not clearly supported by the context, say you are not sure rather than guessing.',
    '',
    'Context:',
    context,
    '',
    `Question: ${question}`,
  ].join('\n');

  const result = await generateText({
    model: openai(openaiModelId),
    prompt,
  });

  return {
    answer: result.text,
    usedLlm: true,
  };
}

async function main() {
  const question = process.argv.slice(2).join(' ').trim();

  if (!question) {
    console.error('Usage: node scripts/ask-llm.js "<your question>"');
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

    const rows = await retrieveRelevantChunks(client, questionEmbedding, 5);

    if (!rows.length) {
      console.log('No matching chunks found.');
      return;
    }

    console.log('\nTop matching chunks (for context):');
    for (const row of rows) {
      const snippet = row.content.replace(/\s+/g, ' ').slice(0, 200);
      console.log('\n----------------------------------------');
      console.log(`Score: ${row.distance.toFixed(4)}`);
      console.log(`Source: ${row.source} (chunk #${row.chunk_index})`);
      if (row.heading) {
        console.log(`Heading: ${row.heading}`);
      }
      console.log(`Title: ${row.title}`);
      console.log(`Snippet: ${snippet}${row.content.length > 200 ? '…' : ''}`);
    }

    console.log('\nAsking LLM with retrieved context...');
    const { answer, usedLlm } = await askLlmWithContext(question, rows);

    console.log('\n=== Answer ===');
    console.log(answer);

    if (!usedLlm) {
      console.log(
        '\n(Note: LLM call was skipped because OPENAI_API_KEY is not set; output is the top chunk content.)',
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error running ask-llm script:', err);
  process.exit(1);
});

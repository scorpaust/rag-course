import { NextResponse } from 'next/server';
import { TrustLevel, Citation } from '@/types/citation';
import { Pool } from 'pg';
import { and, desc, eq } from 'drizzle-orm';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { db } from '@/lib/db/client';
import { chatSessions, messages, messageCitations } from '@/lib/db/schema';
import { hybridRank, type CandidateChunk } from '@/lib/search/hybrid';

export const runtime = 'nodejs';

const MAX_QUESTION_LENGTH = 2000;

// --- Embeddings configuration ---

const voyageEmbeddingModel = process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-3-large';
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS) || 1536;

if (!process.env.VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY is not set');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Optional LLM for answer generation (OpenAI via Vercel AI SDK)
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const openaiModelId = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const openai = openaiApiKey
  ? createOpenAI({
      apiKey: openaiApiKey,
    })
  : null;

// Shared Postgres connection pool (pgvector is used for semantic search)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type ChatRequestBody = {
  question?: string;
  topicScope?: string;
  sessionId?: string;
  newSession?: boolean;
};

type RetrievedChunkRow = {
  id: string;
  content: string;
  heading: string | null;
  chunk_index: number;
  title: string;
  slug: string;
  source: string;
  distance: number;
};

function generateLocalEmbedding(text: string): number[] {
  const crypto = require('node:crypto') as typeof import('node:crypto');
  const hash = crypto.createHash('sha256').update(text || '').digest();
  const vector = new Array<number>(EMBEDDING_DIMENSIONS);

  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    const byte = hash[i % hash.length];
    // Map byte [0,255] into approximately [-1,1].
    vector[i] = (byte / 255) * 2 - 1;
  }

  return vector;
}

async function embedWithVoyage(texts: string[]): Promise<number[][]> {
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

  const json = (await res.json()) as { data?: { embedding: number[] }[] };
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

async function retrieveRelevantChunks(
  client: import('pg').PoolClient,
  questionEmbedding: number[],
  limit = 5,
): Promise<RetrievedChunkRow[]> {
  const embeddingAsVectorLiteral = `[${questionEmbedding.join(',')}]`;

  const { rows } = await client.query<RetrievedChunkRow>(
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

function buildContextFromChunks(rows: RetrievedChunkRow[]): string {
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

type RerankableChunk = CandidateChunk & {
  hybridScore: number;
};

async function rerankWithLlm(
  question: string,
  candidates: RerankableChunk[],
): Promise<(RerankableChunk & { rerankScore: number })[]> {
  // If no LLM client is configured, fall back to hybrid scores.
  if (!openai) {
    return candidates.map((c) => ({ ...c, rerankScore: c.hybridScore }));
  }

  if (candidates.length === 0) return [];

  const snippets = candidates.map((c, idx) => {
    const contentSnippet = c.content.replace(/\s+/g, ' ').slice(0, 600);
    return [
      `Chunk ${idx + 1} (id: ${c.id}):`,
      `Title: ${c.title}`,
      c.heading ? `Heading: ${c.heading}` : null,
      `Source: ${c.source} (chunk #${c.chunkIndex})`,
      '',
      contentSnippet,
    ]
      .filter(Boolean)
      .join('\n');
  });

  const prompt = [
    'You are a specialized re-ranking model. Your task is to rank document chunks by how useful they are for answering the given question.',
    'Consider semantic relevance, specificity, and how directly each chunk helps answer the question.',
    'Return a JSON array of objects of the form { "id": string, "score": number } where higher score means more relevant.',
    'Only use chunk IDs that are provided. Do not invent new IDs.',
    '',
    `Question: ${question}`,
    '',
    'Chunks:',
    snippets.join('\n\n---\n\n'),
  ].join('\n');

  try {
    const result = await generateText({
      model: openai(openaiModelId),
      prompt,
    });

    const text = result.text.trim();

    // Try to locate a JSON array in the model output.
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;

    const parsed = JSON.parse(jsonText) as { id: string; score: number }[];
    const scoreById = new Map<string, number>();
    for (const item of parsed) {
      if (typeof item?.id === 'string' && typeof item?.score === 'number') {
        scoreById.set(item.id, item.score);
      }
    }

    // If parsing yielded no usable scores, fall back to hybrid.
    if (!scoreById.size) {
      return candidates.map((c) => ({ ...c, rerankScore: c.hybridScore }));
    }

    return candidates.map((c) => ({
      ...c,
      rerankScore: scoreById.get(c.id) ?? c.hybridScore,
    }));
  } catch (error) {
    console.warn('Re-ranking with LLM failed, falling back to hybrid scores:', error);
    return candidates.map((c) => ({ ...c, rerankScore: c.hybridScore }));
  }
}

async function askLlmWithContext(question: string, rows: RetrievedChunkRow[]): Promise<{
  answer: string;
  usedLlm: boolean;
}> {
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
    'You are an assistant that answers web development questions using MDN Web Docs as the primary source when possible.',
    'You are given several relevant document chunks from MDN (the "Context" below). Prefer to ground your answer in this context and cite concepts that clearly appear there.',
    'However, if the context does not fully answer the question, you may rely on your broader web development knowledge to provide a helpful answer. Do not invent specific MDN URLs or quotes that are not present in the context.',
    '',
    'Context:',
    context,
    '',
    `Question: ${question}`,
  ].join('\n');

  const startedAt = Date.now();
  const result = await generateText({
    model: openai(openaiModelId),
    prompt,
  });

  const processingTime = Date.now() - startedAt;

  return {
    answer: result.text,
    usedLlm: true,
  };
}

function buildCitations(
  ranked: (CandidateChunk & { hybridScore: number; rerankScore?: number }),
  allRanked: (CandidateChunk & { hybridScore: number; rerankScore?: number })[],
): Citation[] {
  const now = new Date();

  return allRanked.map((row) => {
    const snippet = row.content.replace(/\s+/g, ' ').slice(0, 280);
    const mdnUrl = `https://developer.mozilla.org/en-US/docs/${row.slug}`;

    const citation: Citation = {
      id: row.id,
      mdnUrl,
      articleTitle: row.title,
      sectionAnchor: undefined,
      excerpt: snippet,
      lastUpdated: now,
      trustLevel: 'direct',
      // Prefer the LLM re-rank score when available, otherwise fall back to hybrid.
      relevanceScore: row.rerankScore ?? row.hybridScore,
    };

    return citation;
  });
}

async function getOrCreateSessionId(body: ChatRequestBody, question: string) {
  // If caller explicitly requests a new session, always create one.
  if (body.newSession || !body.sessionId) {
    const now = new Date();
    const title = question.slice(0, 80) || 'New chat session';

    const [inserted] = await db
      .insert(chatSessions)
      .values({
        title,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return inserted.id;
  }

  // Validate that provided sessionId exists; if not, create a new one.
  const existing = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(eq(chatSessions.id, body.sessionId));

  if (!existing.length) {
    const now = new Date();
    const title = question.slice(0, 80) || 'New chat session';

    const [inserted] = await db
      .insert(chatSessions)
      .values({
        title,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return inserted.id;
  }

  return body.sessionId!;
}

async function persistMessagesAndCitations(options: {
  sessionId: string;
  userQuestion: string;
  answer: string;
  citations: Citation[];
}) {
  const { sessionId, userQuestion, answer, citations } = options;
  const now = new Date();

  // Insert user message
  const [userMessage] = await db
    .insert(messages)
    .values({
      sessionId,
      role: 'user',
      content: userQuestion,
      createdAt: now,
    })
    .returning();

  // Insert assistant message
  const [assistantMessage] = await db
    .insert(messages)
    .values({
      sessionId,
      role: 'assistant',
      content: answer,
      createdAt: now,
    })
    .returning();

  // Link assistant message to source chunks via messageCitations
  if (assistantMessage && citations.length > 0) {
    await db.insert(messageCitations).values(
      citations.map((c) => ({
        messageId: assistantMessage.id,
        chunkId: c.id,
      })),
    );
  }

  // Update session's updatedAt timestamp
  await db
    .update(chatSessions)
    .set({ updatedAt: now })
    .where(eq(chatSessions.id, sessionId));

  return { userMessage, assistantMessage };
}

export async function POST(req: Request) {
  let body: ChatRequestBody | null = null;

  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const rawQuestion = body?.question;
  const question = typeof rawQuestion === 'string' ? rawQuestion.trim() : '';

  if (!question) {
    return NextResponse.json(
      { error: 'Question is required' },
      { status: 400 },
    );
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: 'Question is too long' },
      { status: 400 },
    );
  }

  const now = new Date();
  const startedAt = Date.now();

  const client = await pool.connect();

  try {
    // Determine which session this question belongs to (create one if needed)
    const sessionId = await getOrCreateSessionId(body, question);

    // 1) Embed the question with Voyage (with local fallback on rate-limit / billing issues)
    const [questionEmbedding] = await embedWithVoyage([question]);
    if (!questionEmbedding) {
      throw new Error('Failed to generate embedding for question');
    }

    // 2) Retrieve top chunks from Postgres via pgvector as a coarse filter
    const rows = await retrieveRelevantChunks(client, questionEmbedding, 10);

    if (!rows.length) {
      return NextResponse.json(
        {
          error: 'No relevant MDN content found to answer this question.',
        },
        { status: 404 },
      );
    }

    // 3) Apply BM25 + pgvector hybrid ranking on the retrieved candidates
    const candidates: CandidateChunk[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      heading: row.heading,
      chunkIndex: row.chunk_index,
      title: row.title,
      slug: row.slug,
      source: row.source,
      distance: Number(row.distance ?? 0),
    }));

    const ranked = hybridRank(question, candidates, 0.6); // slightly favor BM25
    const topRankedHybrid = ranked.slice(0, 5);

    // 4) Use a specialized LLM-based re-ranker on the top hybrid candidates
    const reranked = await rerankWithLlm(question, topRankedHybrid);
    const topRanked = reranked
      .slice()
      .sort((a, b) => (b.rerankScore ?? b.hybridScore) - (a.rerankScore ?? a.hybridScore));

    const citations = buildCitations(topRanked[0], topRanked);

    // 5) Ask the LLM with re-ranked context (or fall back to top chunk content)
    const { answer, usedLlm } = await askLlmWithContext(
      question,
      topRanked.map((r) => ({
        id: r.id,
        content: r.content,
        heading: r.heading,
        chunk_index: r.chunkIndex,
        title: r.title,
        slug: r.slug,
        source: r.source,
        distance: r.distance,
      })),
    );

    const processingTime = Date.now() - startedAt;

    // 4) Persist user + assistant messages and their citations in the DB
    await persistMessagesAndCitations({
      sessionId,
      userQuestion: question,
      answer,
      citations,
    });

    const message = {
      id: `assistant-${now.getTime()}`,
      role: 'assistant' as const,
      content: answer,
      timestamp: now,
      citations,
      metadata: {
        model: usedLlm ? openaiModelId : 'mdn-rag-retrieval-only',
        processingTime,
        confidence: citations.length > 0 ? 0.8 : 0.5,
      },
    };

    return NextResponse.json({
      message,
      citations,
      sessionId,
    });
  } catch (error) {
    console.error('Error handling /api/chat request:', error);
    return NextResponse.json(
      {
        error:
          'Unexpected error while processing your question. Please try again or refine your query.',
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

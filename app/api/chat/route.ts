import { NextResponse } from 'next/server';
import { TrustLevel } from '@/types/citation';

const MAX_QUESTION_LENGTH = 2000;

type ChatRequestBody = {
  question?: string;
  topicScope?: string;
  sessionId?: string;
};

export async function POST(req: Request) {
  let body: ChatRequestBody | null = null;

  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const rawQuestion = body?.question;
  const question = typeof rawQuestion === 'string' ? rawQuestion.trim() : '';

  if (!question) {
    return NextResponse.json(
      { error: 'Question is required' },
      { status: 400 }
    );
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: 'Question is too long' },
      { status: 400 }
    );
  }

  const now = new Date();

  // In a real implementation, this is where you would call the RAG backend
  // (vector search + LLM) to generate an answer. For now, we return a
  // deterministic, MDN-themed placeholder answer with mock citations.

  const citations = [
    {
      id: 'mdn-web-docs',
      mdnUrl: 'https://developer.mozilla.org/en-US/docs/Web',
      articleTitle: 'MDN Web Docs',
      excerpt:
        'MDN Web Docs provides information about Open Web technologies including HTML, CSS, and APIs for both websites and progressive web apps.',
      lastUpdated: now,
      trustLevel: 'related' as TrustLevel,
      relevanceScore: 0.8,
    },
  ];

  const answer = `You asked: "${question}". This environment is currently using a mocked RAG backend. In a full implementation, this answer would be generated from MDN documentation with detailed citations.`;

  const message = {
    id: `assistant-${now.getTime()}`,
    role: 'assistant' as const,
    content: answer,
    timestamp: now,
    citations,
    metadata: {
      model: 'mdn-rag-mock',
      processingTime: 50,
      confidence: 0.7,
    },
  };

  return NextResponse.json({
    message,
    citations,
  });
}

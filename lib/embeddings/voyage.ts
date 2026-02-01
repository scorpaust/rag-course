import 'dotenv/config';

import { createOpenAI } from '@ai-sdk/openai';

if (!process.env.VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY is not set');
}

// Configure AISDK OpenAI client to talk to Voyage-compatible endpoint using the Voyage API key.
export const voyage = createOpenAI({
  apiKey: process.env.VOYAGE_API_KEY!,
  baseURL: process.env.VOYAGE_BASE_URL || 'https://api.voyageai.com/v1',
});

export const voyageEmbeddingModel = process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-3-large';

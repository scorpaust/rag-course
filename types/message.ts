import { Citation } from './citation';

/**
 * Metadata associated with a message
 */
export interface MessageMetadata {
  model?: string;
  tokensUsed?: number;
  processingTime?: number;
  confidence?: number;
}

/**
 * Represents a chat message from either user or assistant
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  metadata?: MessageMetadata;
}

import { Message } from './message';
import { Citation } from './citation';

/**
 * Topic scope for filtering or scoping answers
 */
export type TopicScope =
  | 'html'
  | 'css'
  | 'javascript'
  | 'web-apis'
  | 'http'
  | 'all';

/**
 * Represents a chat session with message history
 */
export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  title?: string;
  topicScope?: TopicScope;
  pinnedCitations: Citation[];
}

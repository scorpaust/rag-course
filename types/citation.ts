/**
 * Browser compatibility information for a cited API or feature
 */
export interface BrowserCompatibility {
  chrome?: string;
  firefox?: string;
  safari?: string;
  edge?: string;
}

/**
 * Trust level indicating how the citation relates to the answer
 */
export type TrustLevel = 'direct' | 'inferred' | 'related';

/**
 * Represents a citation to an MDN document
 */
export interface Citation {
  id: string;
  mdnUrl: string;
  articleTitle: string;
  sectionAnchor?: string;
  excerpt: string;
  lastUpdated: Date;
  trustLevel: TrustLevel;
  relevanceScore: number;
  browserCompatibility?: BrowserCompatibility;
}

import type { SearchTarget } from '../domain/search/catalogSearch';

export type GatewayStatus = 'not-configured' | 'checking' | 'available' | 'authentication-required' | 'unavailable' | 'unknown';
export type ExplanationRequest = { explanationId: string; topicId: string; variant: 'brief' };
export type Explanation = {
  explanationId: string; text: string; relatedTopicIds: string[]; referenceIds: string[];
  source: 'static' | 'university';
};
export interface AiProvider { getExplanation(request: ExplanationRequest): Promise<Explanation | null> }
export type SearchIntent = 'all' | 'understand' | 'try' | 'fix' | 'learn';
export type SearchNavigationRequest = { version: '1'; intent: SearchIntent; candidates: SearchTarget[] };
export type SearchNavigationResult = { source: 'local' | 'university'; targets: SearchTarget[] };
export interface AiSearchProvider { selectTargets(request: SearchNavigationRequest): Promise<SearchNavigationResult | null> }
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type GatewayConfig = { enabled: boolean; baseUrl?: string };


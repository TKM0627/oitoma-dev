import { z } from '../domain/security/validation';
import { content } from '../domain/content/contentRepository';
import { createSearchCatalog, searchKinds, targetKey, type SearchHit } from '../domain/search/catalogSearch';
import { referenceIndex } from '../domain/search/referenceSearchIndex';
import { fetchJson, type NetworkChecker } from './networkChecker';
import type { AiSearchProvider, FetchLike, SearchIntent, SearchNavigationRequest, SearchNavigationResult } from './types';

const targetSchema = z.object({ kind: z.enum(searchKinds), id: z.string().regex(/^[a-z][a-z0-9-]*$/).max(80) }).strict();
const requestSchema = z.object({ version: z.literal('1'), intent: z.enum(['all', 'understand', 'try', 'fix', 'learn']), candidates: z.array(targetSchema).min(1).max(20) }).strict();
const responseSchema = z.object({ version: z.literal('1'), targets: z.array(targetSchema).min(1).max(6) }).strict();
const registered = new Set(createSearchCatalog(content, referenceIndex).map(targetKey));

export function createSearchNavigationRequest(hits: SearchHit[], intent: SearchIntent = 'all'): SearchNavigationRequest | null {
  if (!hits.length) return null;
  return { version: '1', intent, candidates: hits.slice(0, 20).map(({ entry }) => ({ kind: entry.kind, id: entry.id })) };
}

/** 契約案。配布版からは呼び出さない。 */
export class UniversitySearchProvider implements AiSearchProvider {
  constructor(private checker: NetworkChecker, private fetcher: FetchLike = (url, init) => fetch(url, init)) {}
  async selectTargets(request: SearchNavigationRequest): Promise<SearchNavigationResult | null> {
    const parsed = requestSchema.safeParse(request);
    if (!parsed.success) return null;
    const keys = parsed.data.candidates.map(targetKey);
    if (new Set(keys).size !== keys.length || keys.some((key) => !registered.has(key))) return null;
    const fallback: SearchNavigationResult = { source: 'local', targets: parsed.data.candidates.slice(0, 6) };
    if (await this.checker.check() !== 'available' || !this.checker.supportsSearchNavigation() || !this.checker.baseUrl) return fallback;
    try {
      const response = await fetchJson(this.fetcher, `${this.checker.baseUrl}/v1/search-navigation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(parsed.data),
      }, 3000);
      const result = responseSchema.safeParse(response.body);
      if (response.status !== 200 || !result.success) return fallback;
      const returnedKeys = result.data.targets.map(targetKey);
      if (new Set(returnedKeys).size !== returnedKeys.length || returnedKeys.some((key) => !keys.includes(key))) return fallback;
      return { source: 'university', targets: result.data.targets };
    } catch { return fallback; }
  }
}

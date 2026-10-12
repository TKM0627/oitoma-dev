import { z } from '../domain/security/validation';
import { content } from '../domain/content/contentRepository';
import { fetchJson, type NetworkChecker } from './networkChecker';
import { allowedRequest, StaticProvider } from './staticProvider';
import type { AiProvider, ExplanationRequest, FetchLike } from './types';
import { textInputError } from '../domain/security/textInput';

const responseSchema = z.object({
  explanationId: z.string().max(80), text: z.string().trim().min(1).max(4000).refine((value) => !textInputError(value, 4000)),
  relatedTopicIds: z.array(z.string().max(80)).max(30), referenceIds: z.array(z.string().max(80)).max(20),
}).strict();

export class UniversityGatewayProvider implements AiProvider {
  private fallback = new StaticProvider();
  constructor(private checker: NetworkChecker, private fetcher: FetchLike = (url, init) => fetch(url, init)) {}
  async getExplanation(request: ExplanationRequest) {
    if (!allowedRequest(request)) return null;
    // 接続待ち中の変更が検証済みIDに混ざるのを防ぐ。
    request = { explanationId: request.explanationId, topicId: request.topicId, variant: request.variant };
    if (await this.checker.check() !== 'available' || !this.checker.supportsExplanations() || !this.checker.baseUrl) return this.fallback.getExplanation(request);
    try {
      const response = await fetchJson(this.fetcher, `${this.checker.baseUrl}/v1/explanations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ explanationId: request.explanationId, topicId: request.topicId, variant: request.variant }),
      }, 3000);
      const result = responseSchema.safeParse(response.body);
      if (response.status !== 200 || !result.success || result.data.explanationId !== request.explanationId
        || new Set(result.data.relatedTopicIds).size !== result.data.relatedTopicIds.length
        || new Set(result.data.referenceIds).size !== result.data.referenceIds.length
        || result.data.relatedTopicIds.some((id) => !content.topics.some((topic) => topic.id === id))
        || result.data.referenceIds.some((id) => !content.references.some((reference) => reference.id === id))) {
        return this.fallback.getExplanation(request);
      }
      return { ...result.data, source: 'university' as const };
    } catch { return this.fallback.getExplanation(request); }
  }
}

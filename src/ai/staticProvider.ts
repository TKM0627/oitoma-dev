import { content } from '../domain/content/contentRepository';
import type { AiProvider, ExplanationRequest } from './types';

export function allowedRequest(request: ExplanationRequest) {
  return request !== null && typeof request === 'object' && !Array.isArray(request)
    && typeof request.explanationId === 'string' && typeof request.topicId === 'string'
    && request.variant === 'brief' && Object.hasOwn(content.explanations, request.explanationId)
    && content.explanations[request.explanationId].reviewed === true
    && content.explanations[request.explanationId].sourceTopicIds.includes(request.topicId);
}

export class StaticProvider implements AiProvider {
  async getExplanation(request: ExplanationRequest) {
    if (!allowedRequest(request)) return null;
    const explanation = content.explanations[request.explanationId];
    return {
      explanationId: request.explanationId, text: explanation.text,
      relatedTopicIds: explanation.sourceTopicIds,
      referenceIds: explanation.referenceIds,
      source: 'static' as const,
    };
  }
}

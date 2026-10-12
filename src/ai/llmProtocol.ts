import { assertTextInput } from '../domain/security/textInput.ts';
import { environments, type Environment } from '../app/environments.ts';
import type { SearchTarget } from '../domain/search/catalogSearch.ts';

export const LLM_API = '/__llm';
export const LLM_HEADER = 'x-latex-navigator-llm';
export const LLM_QUESTION_LIMIT = 2_000;
export const LLM_SOURCE_LIMIT = 10_000;
export const LLM_LOG_LIMIT = 4_000;
export const LLM_RESPONSE_BYTES = 96 * 1024;
export type LlmRequest = { question: string; source: string; log: string; environment: Environment };
export type LlmAnswer = { answer: string; latex: string; cautions: string[]; related: SearchTarget[]; referenceIds: string[] };
export type LlmConnection = 'unverified' | 'available' | 'authentication-required' | 'unavailable';
export type LlmStatus = { configured: boolean; model: string; connection: LlmConnection };

function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error('応答・入力の形式が不正です。');
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string') throw new Error('文字列が必要です。');
  assertTextInput(value, limit);
  return value;
}
function list(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error('項目数が上限を超えています。');
  return value;
}

export function parseLlmRequest(value: unknown): LlmRequest {
  const request = record(value, ['question', 'source', 'log', 'environment']);
  const question = text(request.question, LLM_QUESTION_LIMIT);
  const source = text(request.source, LLM_SOURCE_LIMIT);
  const log = text(request.log, LLM_LOG_LIMIT);
  if (![question, source, log].some((value) => value.trim()) || typeof request.environment !== 'string'
    || !Object.hasOwn(environments, request.environment)) throw new Error('質問・ソース・ログと利用環境を確認してください。');
  return { question, source, log, environment: request.environment as Environment };
}

export function parseLlmAnswer(value: unknown, targets: SearchTarget[], references: string[]): LlmAnswer {
  const result = record(value, ['answer', 'latex', 'cautions', 'related', 'referenceIds']);
  const answer = text(result.answer, 4_000);
  if (!answer.trim()) throw new Error('回答が空です。');
  const latex = text(result.latex, 6_000);
  const cautions = list(result.cautions, 3).map((item) => text(item, 240));
  const related = list(result.related, 6).map((item) => {
    const target = record(item, ['kind', 'id']);
    const known = targets.find((entry) => entry.kind === target.kind && entry.id === target.id);
    if (!known) throw new Error('未登録の案内先です。');
    return { kind: known.kind, id: known.id };
  });
  const referenceIds = list(result.referenceIds, 6).map((id) => {
    if (typeof id !== 'string' || !references.includes(id)) throw new Error('未登録の出典です。');
    return id;
  });
  if (new Set(related.map((target) => `${target.kind}:${target.id}`)).size !== related.length
    || new Set(referenceIds).size !== referenceIds.length) throw new Error('案内先・出典が重複しています。');
  return { answer, latex, cautions, related, referenceIds };
}

export function parseLlmStatus(value: unknown): LlmStatus {
  const status = record(value, ['configured', 'model', 'connection']);
  if (typeof status.configured !== 'boolean' || !['unverified', 'available', 'authentication-required', 'unavailable'].includes(String(status.connection))) throw new Error('接続状態の形式が不正です。');
  return { configured: status.configured, model: text(status.model, 100), connection: status.connection as LlmConnection };
}

export async function readLlmJson(response: Response, maxBytes = LLM_RESPONSE_BYTES): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '') || !response.body) {
    await response.body?.cancel(); throw new Error('JSON応答を取得できませんでした。');
  }
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    await response.body.cancel(); throw new Error('応答が上限を超えています。');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('応答が上限を超えています。');
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

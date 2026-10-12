import { describe, expect, it, vi } from 'vitest';
import { NetworkChecker, MIN_CHECK_INTERVAL_MS } from './networkChecker';
import { UniversityGatewayProvider } from './universityGatewayProvider';
import { StaticProvider } from './staticProvider';
import type { ExplanationRequest } from './types';
import { contentSecurityPolicy } from '../domain/security/contentSecurityPolicy';

const config = { enabled: true, baseUrl: 'https://gateway.example.test/api' };
const capabilities = { service: 'latex-navigator-ai', version: '1', ai: { explanations: true } };
const request: ExplanationRequest = { explanationId: 'outside-math-subscript', topicId: 'math-subscript', variant: 'brief' };
const answer = { explanationId: request.explanationId, text: '補足', relatedTopicIds: ['math-subscript'], referenceIds: ['overleaf-scripts'] };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

describe('GatewayのURL・応答・再試行の境界', () => {
  it.each(['https://gateway.example.test/api;connect-src', 'https://gateway.example.test/a%2fb', 'https://gateway.example.test/a/../api', 'https://gateway.example.test/\napi', 'https://gateway.example.test\\api', 'https://gateway.example.test/#PRIVATE'])('曖昧なURLは通信とCSP許可の両方で拒否する: %j', async (baseUrl) => {
    const fetcher = vi.fn();
    expect(await new NetworkChecker({ enabled: true, baseUrl }, fetcher).check(true)).toBe('not-configured');
    expect(fetcher).not.toHaveBeenCalled();
    expect(contentSecurityPolicy({ enabled: true, baseUrl })).toContain("connect-src 'none'");
  });
  it.each([
    { ...capabilities, url: 'https://evil.example' },
    { ...capabilities, token: 'PRIVATE' },
    { ...capabilities, ai: { explanations: true, tools: true } },
    JSON.parse('{"service":"latex-navigator-ai","version":"1","ai":{"explanations":true},"__proto__":{"polluted":true}}'),
  ])('能力宣言の未知の項目は拒否する', async (body) => {
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(json(body))).check()).toBe('unknown');
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
  it.each([{ redirected: true }, { type: 'opaque' }, { type: 'opaqueredirect' }, { url: 'https://evil.example/v1/capabilities' }])('リダイレクト・応答先の変更を拒否する', async (properties) => {
    const response = json(capabilities);
    for (const [key, value] of Object.entries(properties)) Object.defineProperty(response, key, { value });
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(response)).check()).toBe('unknown');
  });
  it.each([true, false])('成功・失敗後の連打を抑え、期限後は再確認できる: %s', async (success) => {
    let now = 0;
    const fetcher = success ? vi.fn(async () => json(capabilities)) : vi.fn(async () => { throw new Error('failed'); });
    const checker = new NetworkChecker(config, fetcher, () => now);
    await checker.check();
    await Promise.all(Array.from({ length: 20 }, () => checker.check(true)));
    now = MIN_CHECK_INTERVAL_MS - 1; await checker.check(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now++; await checker.check(true); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('非200の応答本文を読まずにキャンセルする', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1)); }, cancel });
    const response = new Response(stream, { status: 401 });
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(response)).check()).toBe('authentication-required');
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe('解説の要求・表示の境界', () => {
  it.each([null, undefined, [], {}, { ...request, explanationId: { toString: () => request.explanationId } }, { ...request, topicId: null }])('型を偽装した要求は疎通確認前に拒否する', async (value) => {
    const fetcher = vi.fn();
    expect(await new StaticProvider().getExplanation(value as ExplanationRequest)).toBeNull();
    expect(await new UniversityGatewayProvider(new NetworkChecker(config, fetcher), fetcher).getExplanation(value as ExplanationRequest)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('接続待ち中に要求が書き換えられても検証済みのIDだけを送る', async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })).mockResolvedValueOnce(json(answer));
    const mutable = { ...request };
    const pending = new UniversityGatewayProvider(new NetworkChecker(config, fetcher), fetcher).getExplanation(mutable);
    mutable.explanationId = 'PRIVATE'; mutable.topicId = 'PRIVATE';
    resolve(json(capabilities));
    expect(await pending).toMatchObject({ source: 'university' });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(request);
  });
  it.each([{ ...answer, text: '説明\u202e偽装' }, { ...answer, text: '説明\u0000' }, { ...answer, referenceIds: ['overleaf-scripts', 'overleaf-scripts'] }, { ...answer, relatedTopicIds: ['math-subscript', 'math-subscript'] }])('不可視制御文字や重複IDを含む回答を採用しない', async (body) => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(capabilities)).mockResolvedValueOnce(json(body));
    expect(await new UniversityGatewayProvider(new NetworkChecker(config, fetcher), fetcher).getExplanation(request)).toMatchObject({ source: 'static' });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkChecker } from './networkChecker';
import { createSearchNavigationRequest, UniversitySearchProvider } from './universitySearchProvider';
import { UniversityGatewayProvider } from './universityGatewayProvider';
import type { SearchNavigationRequest } from './types';
import { content } from '../domain/content/contentRepository';
import { createSearchCatalog, searchCatalog } from '../domain/search/catalogSearch';
import { referenceIndex } from '../domain/search/referenceSearchIndex';

const config = { enabled: true, baseUrl: 'https://gateway.example.test' };
const capabilities = { service: 'latex-navigator-ai', version: '1', ai: { explanations: true, searchNavigation: true } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const request: SearchNavigationRequest = { version: '1', intent: 'try', candidates: [{ kind: 'topic', id: 'math-fraction' }, { kind: 'recipe', id: 'fraction' }, { kind: 'reference', id: 'math' }] };
afterEach(() => vi.useRealTimers());

describe('将来の横断検索補助（実API未接続・すべてモック）', () => {
  it('検索結果から最大20のIDを取り出し、入力語・本文・表示情報を含めない', () => {
    const catalog = createSearchCatalog(content, referenceIndex);
    const hits = searchCatalog(catalog, '分数');
    const value = createSearchNavigationRequest(hits, 'try')!;
    expect(Object.keys(value)).toEqual(['version', 'intent', 'candidates']);
    expect(value.candidates.every((target) => Object.keys(target).join(',') === 'kind,id')).toBe(true);
    expect(JSON.stringify(value)).not.toContain('分数');
    expect(createSearchNavigationRequest(searchCatalog(catalog, ''), 'all')?.candidates).toHaveLength(20);
    expect(createSearchNavigationRequest([], 'all')).toBeNull();
  });
  it('未設定時は通信せず、ローカル候補を使う', async () => {
    const fetcher = vi.fn();
    expect(await new UniversitySearchProvider(new NetworkChecker({ enabled: false }, fetcher), fetcher).selectTargets(request)).toMatchObject({ source: 'local', targets: request.candidates });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { explanations: true }, { explanations: true, searchNavigation: false }, { explanations: true, searchNavigation: 'true' },
  ])('検索補助の能力宣言がない・不正なら検索用APIを呼ばない (%j)', async (ai) => {
    const fetcher = vi.fn().mockResolvedValue(response({ ...capabilities, ai }));
    expect(await new UniversitySearchProvider(new NetworkChecker(config, fetcher), fetcher).selectTargets(request)).toMatchObject({ source: 'local' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('種別を横断するIDだけを送り、返された既知の候補を解決する', async () => {
    const targets = [request.candidates[1], request.candidates[2], request.candidates[0]];
    const fetcher = vi.fn().mockResolvedValueOnce(response(capabilities)).mockResolvedValueOnce(response({ version: '1', targets }));
    expect(await new UniversitySearchProvider(new NetworkChecker(config, fetcher), fetcher).selectTargets(request)).toEqual({ source: 'university', targets });
    expect(fetcher.mock.calls[1][0]).toBe(`${config.baseUrl}/v1/search-navigation`);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(request);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store' });
  });
  it.each([
    { ...request, query: 'PRIVATE_QUERY' }, { ...request, source: 'PRIVATE_SOURCE' },
    { ...request, candidates: [{ kind: 'topic', id: 'missing' }] },
    { ...request, candidates: [request.candidates[0], request.candidates[0]] },
    { ...request, candidates: [] }, { ...request, intent: 'arbitrary-prompt' },
  ])('未登録ID・余分な入力・不正な要求は接続確認も送らない', async (value) => {
    const fetcher = vi.fn();
    expect(await new UniversitySearchProvider(new NetworkChecker(config, fetcher), fetcher).selectTargets(value as SearchNavigationRequest)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { version: '1', targets: [{ kind: 'recipe', id: 'matrix' }] },
    { version: '1', targets: [{ kind: 'topic', id: 'missing' }] },
    { version: '1', targets: [request.candidates[0], request.candidates[0]] },
    { version: '1', targets: [{ ...request.candidates[0], url: 'https://example.test' }] },
    { version: '1', targets: request.candidates, text: '<script>untrusted</script>' },
    { version: '2', targets: request.candidates }, { version: '1', targets: [] },
  ])('候補外・任意URL・重複・余分な情報を拒否してローカル結果に戻る', async (body) => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(capabilities)).mockResolvedValueOnce(response(body));
    expect(await new UniversitySearchProvider(new NetworkChecker(config, fetcher), fetcher).selectTargets(request)).toEqual({ source: 'local', targets: request.candidates });
  });
  it('検索補助だけが利用可能でも、解説APIを呼ばない', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ ...capabilities, ai: { explanations: false, searchNavigation: true } }));
    const checker = new NetworkChecker(config, fetcher);
    expect(await new UniversityGatewayProvider(checker, fetcher).getExplanation({ explanationId: 'outside-math-subscript', topicId: 'math-subscript', variant: 'brief' })).toMatchObject({ source: 'static' });
    expect(checker.supportsSearchNavigation()).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('検索用応答が失敗・期限切れならローカル結果へ戻る', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(response(capabilities)).mockImplementationOnce(() => new Promise(() => {}));
    const pending = new UniversitySearchProvider(new NetworkChecker(config, fetcher), fetcher).selectTargets(request);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toMatchObject({ source: 'local' });
    expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
  });
  it('再確認で認証要求になったら以前の能力宣言を使わない', async () => {
    let now = 0;
    const fetcher = vi.fn().mockResolvedValueOnce(response(capabilities)).mockResolvedValueOnce(response(null, 401));
    const checker = new NetworkChecker(config, fetcher, () => now);
    expect(await checker.check()).toBe('available');
    expect(checker.supportsSearchNavigation()).toBe(true);
    now = 5000;
    expect(await checker.check(true)).toBe('authentication-required');
    expect(checker.supportsSearchNavigation()).toBe(false);
    expect(checker.supportsExplanations()).toBe(false);
  });
});

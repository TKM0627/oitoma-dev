import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkChecker, MAX_GATEWAY_RESPONSE_BYTES } from './networkChecker';
import { StaticProvider } from './staticProvider';
import { UniversityGatewayProvider } from './universityGatewayProvider';
import { content } from '../domain/content/contentRepository';
import type { ExplanationRequest } from './types';

const config = { enabled: true, baseUrl: 'https://gateway.example.test' };
const capabilities = { service: 'latex-navigator-ai', version: '1', ai: { explanations: true } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const request: ExplanationRequest = { explanationId: 'outside-math-subscript', topicId: 'math-subscript', variant: 'brief' };
afterEach(() => vi.useRealTimers());

describe('大学Gatewayの接続判定（すべてモック）', () => {
  it.each([
    { enabled: false }, { enabled: false, baseUrl: config.baseUrl }, { enabled: true },
    { enabled: true, baseUrl: 'http://gateway.example.test' }, { enabled: true, baseUrl: 'https://user:secret@gateway.example.test' },
    { enabled: true, baseUrl: 'invalid' }, { enabled: true, baseUrl: 'https://gateway.example.test/?token=secret' },
  ])('未設定や不正URLは接続しない (%j)', async (settings) => {
    const fetcher = vi.fn(); const checker = new NetworkChecker(settings, fetcher);
    expect(await checker.check(true)).toBe('not-configured'); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403])('%iは認証要求', async (status) => {
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(response(null, status))).check()).toBe('authentication-required');
  });
  it.each([404, 500, 503])('%iはサービス利用不可', async (status) => {
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(response(null, status))).check()).toBe('unavailable');
  });
  it.each([{}, { ...capabilities, service: 'other' }, { ...capabilities, version: '2' }, { ...capabilities, ai: { explanations: 'true' } }])('不正な契約応答はunknown (%j)', async (body) => {
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(response(body))).check()).toBe('unknown');
  });
  it('利用可能という契約と200の両方を要求する', async () => {
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(response(capabilities))).check()).toBe('available');
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(response({ ...capabilities, ai: { explanations: false } }))).check()).toBe('unavailable');
  });
  it('CORS相当の失敗・不正JSONは原因を推測しない', async () => {
    expect(await new NetworkChecker(config, vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))).check()).toBe('unknown');
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(new Response('{'))).check()).toBe('unknown');
  });
  it('3秒で打ち切り、失敗後も再確認できる', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce(response(capabilities));
    const checker = new NetworkChecker(config, fetcher);
    const pending = checker.check();
    expect(checker.getSnapshot()).toBe('checking');
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBe('unknown');
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await checker.check(true)).toBe('available');
  });
  it('応答本文が停止した場合もタイムアウトする', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } }));
    const pending = new NetworkChecker(config, fetcher).check();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBe('unknown');
  });
  it('成功のキャッシュは60秒、手動確認は再取得、同時確認は統合', async () => {
    let now = 0;
    const fetcher = vi.fn().mockImplementation(async () => response(capabilities));
    const checker = new NetworkChecker(config, fetcher, () => now);
    const listener = vi.fn(); const unsubscribe = checker.subscribe(listener);
    const first = checker.check(); expect(checker.check()).toBe(first);
    await first; now = 59_999; await checker.check(); expect(fetcher).toHaveBeenCalledTimes(1);
    now = 60_000; await checker.check(); expect(fetcher).toHaveBeenCalledTimes(2);
    now = 65_000; await checker.check(true); expect(fetcher).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenCalled(); unsubscribe();
    expect(fetcher.mock.calls[0][0]).toBe(`${config.baseUrl}/v1/capabilities`);
  });
  it.each(['text/html', 'application/javascript', ''])('JSON以外の応答を拒否する: %s', async (type) => {
    const body = new Response(JSON.stringify(capabilities), { headers: { 'Content-Type': type } });
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(body)).check()).toBe('unknown');
  });
  it('大きすぎる宣言・本文と不正JSONを拒否する', async () => {
    const bodies = [
      new Response(JSON.stringify(capabilities), { headers: { 'Content-Type': 'application/json', 'Content-Length': String(MAX_GATEWAY_RESPONSE_BYTES + 1) } }),
      new Response(JSON.stringify({ ...capabilities, padding: 'x'.repeat(MAX_GATEWAY_RESPONSE_BYTES) }), { headers: { 'Content-Type': 'application/json', 'Content-Length': '10' } }),
      new Response('{invalid', { headers: { 'Content-Type': 'application/json' } }),
    ];
    for (const body of bodies) expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(body)).check()).toBe('unknown');
  });
  it('小分けの応答も合計容量で打ち切り、未読の本文をキャンセルする', async () => {
    const cancel = vi.fn();
    const chunk = new TextEncoder().encode('x'.repeat(4096));
    const stream = new ReadableStream({ pull(controller) { controller.enqueue(chunk); }, cancel });
    const body = new Response(stream, { headers: { 'Content-Type': 'application/json' } });
    expect(await new NetworkChecker(config, vi.fn().mockResolvedValue(body)).check()).toBe('unknown');
    expect(cancel).toHaveBeenCalled();
  });
  it('Cookie・参照元情報・リダイレクトを使わず、応答をキャッシュしない', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(capabilities));
    await new NetworkChecker(config, fetcher).check();
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store' });
  });
});

describe('補足説明の契約とフォールバック', () => {
  it('静的説明は確認済みIDとトピックだけ', async () => {
    const provider = new StaticProvider();
    expect(await provider.getExplanation(request)).toMatchObject({ source: 'static', explanationId: request.explanationId, referenceIds: ['overleaf-scripts', 'overleaf-errors'] });
    expect(await provider.getExplanation({ ...request, explanationId: 'constructor' })).toBeNull();
    expect(await provider.getExplanation({ ...request, topicId: 'figure-image' })).toBeNull();
    const entry = content.explanations[request.explanationId]; entry.reviewed = false;
    try { expect(await provider.getExplanation(request)).toBeNull(); } finally { entry.reviewed = true; }
  });
  it('未設定ならネットワークに触れず静的説明', async () => {
    const fetcher = vi.fn();
    const provider = new UniversityGatewayProvider(new NetworkChecker({ enabled: false }, fetcher), fetcher);
    expect(await provider.getExplanation(request)).toMatchObject({ source: 'static' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('POSTは許可済みIDだけを送り、余分な原文を落とす', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(capabilities)).mockResolvedValueOnce(response({ explanationId: request.explanationId, text: '補足説明', relatedTopicIds: ['math-subscript'], referenceIds: ['overleaf-scripts'] }));
    const provider = new UniversityGatewayProvider(new NetworkChecker(config, fetcher), fetcher);
    expect(await provider.getExplanation({ ...request, source: 'secret code', prompt: 'arbitrary' } as ExplanationRequest)).toMatchObject({ source: 'university' });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(request);
    expect(fetcher.mock.calls[1][0]).toBe(`${config.baseUrl}/v1/explanations`);
  });
  it.each([
    { explanationId: 'wrong', text: '補足', relatedTopicIds: [], referenceIds: [] },
    { explanationId: request.explanationId, text: '<script>text</script>', relatedTopicIds: ['missing'], referenceIds: [] },
    { explanationId: request.explanationId, text: '補足', relatedTopicIds: [], referenceIds: ['missing'] },
    { explanationId: request.explanationId, text: '', relatedTopicIds: [], referenceIds: [] },
    { explanationId: request.explanationId, text: '補足', relatedTopicIds: [], referenceIds: [], privateNotes: 'UNEXPECTED' },
    { explanationId: request.explanationId, text: 'x'.repeat(4001), relatedTopicIds: [], referenceIds: [] },
  ])('不正なライブ応答は静的説明 (%j)', async (body) => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(capabilities)).mockResolvedValueOnce(response(body));
    expect(await new UniversityGatewayProvider(new NetworkChecker(config, fetcher), fetcher).getExplanation(request)).toMatchObject({ source: 'static' });
  });
  it('接続・生成失敗と期限切れの接続を再検証する', async () => {
    let now = 0;
    const fetcher = vi.fn().mockResolvedValueOnce(response(capabilities)).mockRejectedValueOnce(new TypeError('CORS'));
    const checker = new NetworkChecker(config, fetcher, () => now);
    await checker.check(); now = 60_001;
    const provider = new UniversityGatewayProvider(checker, fetcher);
    expect(await provider.getExplanation(request)).toMatchObject({ source: 'static' }); expect(fetcher).toHaveBeenCalledTimes(2);
    const failing = vi.fn().mockResolvedValueOnce(response(capabilities)).mockRejectedValueOnce(new Error('POST failed'));
    expect(await new UniversityGatewayProvider(new NetworkChecker(config, failing), failing).getExplanation(request)).toMatchObject({ source: 'static' });
  });
  it('無効IDはcapabilities確認すら送らない', async () => {
    const fetcher = vi.fn();
    expect(await new UniversityGatewayProvider(new NetworkChecker(config, fetcher), fetcher).getExplanation({ ...request, topicId: 'invalid' })).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });
});

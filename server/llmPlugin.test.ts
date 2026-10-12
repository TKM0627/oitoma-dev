import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLlmHandler, LLM_ORIGIN } from './llmPlugin';
import { LLM_API, LLM_HEADER } from '../src/ai/llmProtocol';

const config = { key: 'test-only-key', model: 'test-model' };
const input = { question: '分数を書きたい', source: '', log: '', environment: 'none' };
let server: Server, base: string, time: number;
function call(path = '/answer', options: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: Record<string, unknown> }>((resolve, reject) => {
    const req = httpRequest(base + LLM_API + path, { method: options.method || 'POST', headers: { Host: '127.0.0.1:5174',
      Origin: LLM_ORIGIN, [LLM_HEADER]: '1', 'Content-Type': 'application/json', ...options.headers } }, (res) => {
      let text = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => { try { resolve({ status: res.statusCode!, headers: res.headers, body: JSON.parse(text) }); } catch (error) { reject(error); } });
    });
    req.on('error', reject); req.end(options.method === 'GET' ? undefined : options.body ?? JSON.stringify(input));
  });
}
async function start(fetcher: typeof fetch, configured = true) {
  const handler = createLlmHandler(configured ? config : null, fetcher);
  server = createServer((req, res) => { void handler(req, res, () => res.end('{}')); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const models = () => json({ data: [{ id: config.model }] });
const completion = () => json({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', tool_calls: [], content: '分数を書けます。\n```latex\n$\\frac{a}{b}$\n```' } }] });
const working = () => vi.fn().mockImplementation((url: string) => url.endsWith('/models') ? models() : completion());
beforeEach(() => { time = 100_000; vi.spyOn(Date, 'now').mockImplementation(() => time); });
afterEach(async () => {
  if (server?.listening) { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

describe('ローカルLLM APIの境界と自動アクセス制限', () => {
  it('入口でモデル一覧を確認し、質問もキーも応答へ含めない', async () => {
    const fetcher = working(); await start(fetcher);
    const result = await call('/status', { method: 'GET' });
    expect(result.body).toEqual({ configured: true, model: config.model, connection: 'available' });
    expect(JSON.stringify(result)).not.toContain(config.key);
    expect(result.headers).toMatchObject({ 'cache-control': 'no-store', 'cross-origin-resource-policy': 'same-origin', 'x-content-type-options': 'nosniff' });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][1].body).toBeUndefined();
    await call('/status', { method: 'GET' }); expect(fetcher).toHaveBeenCalledTimes(1);
    time += 20_000; await call('/status', { method: 'GET' }); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each<Record<string, string>>([
    { Origin: 'https://evil.example' }, { Host: 'evil.example:5174' }, { Host: '127.0.0.1:5175' },
    { [LLM_HEADER]: '' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'X-Forwarded-For': '127.0.0.1' }, { Forwarded: 'for=127.0.0.1' },
  ])('別サイト・別Host・転送されたリクエストを拒否する', async (headers) => {
    const fetcher = vi.fn(); await start(fetcher);
    expect((await call('/answer', { headers })).status).toBe(403); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ['/answer', { method: 'OPTIONS' }, 405], ['/answer', { method: 'GET' }, 405], ['/answer?key=SECRET', {}, 404], ['/check', {}, 404],
    ['/answer', { headers: { 'Content-Type': 'text/plain' } }, 415], ['/answer', { headers: { Origin: '' } }, 415],
    ['/answer', { headers: { 'Content-Encoding': 'gzip' } }, 415], ['/answer', { headers: { 'Content-Length': '65537' } }, 413],
    ['/answer', { body: '{"url":"https://evil.example"}' }, 400], ['/answer', { body: 'invalid JSON' }, 400],
    ['/answer', { body: '{"question":"x","key":"SECRET"}' }, 400],
  ] as const)('不正操作 %s を上流へ送らない', async (path, options, expected) => {
    const fetcher = vi.fn(); await start(fetcher); expect((await call(path, options)).status).toBe(expected); expect(fetcher).not.toHaveBeenCalled();
  });
  it('設定がない時は入口を閉じ、LLMを呼ばない', async () => {
    const fetcher = vi.fn(); await start(fetcher, false);
    expect((await call('/status', { method: 'GET' })).body.connection).toBe('unavailable');
    expect((await call()).status).toBe(503); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403, 500])('アクセス確認で%dの場合、入力を生成APIへ渡さない', async (code) => {
    const fetcher = vi.fn().mockImplementation(() => new Response('SECRET', { status: code })); await start(fetcher);
    const result = await call('/answer', { body: JSON.stringify({ ...input, source: 'PRIVATE SOURCE' }) });
    expect(result.status).toBe(403); expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toContain('/models'); expect(fetcher.mock.calls[0][1].body).toBeUndefined();
  });
  it('ページを開いた後にアクセスできなくなっても、直接送信を拒否する', async () => {
    const fetcher = working(); await start(fetcher); await call('/status', { method: 'GET' });
    fetcher.mockImplementation(() => Promise.resolve(new Response('SECRET', { status: 403 })));
    expect((await call()).status).toBe(403);
    expect(fetcher.mock.calls.every(([url]) => String(url).endsWith('/models'))).toBe(true);
  });
  it('成功・失敗の両方で連続呼び出しを制限する', async () => {
    const fetcher = working(); await start(fetcher);
    expect((await call()).status).toBe(200); expect((await call()).status).toBe(429);
    time += 10_000; fetcher.mockResolvedValueOnce(new Response('SECRET', { status: 401 }));
    expect((await call()).status).toBe(403); expect((await call()).status).toBe(429);
  });
  it('生成要求は起動中30回までに制限する', async () => {
    const fetcher = working(); await start(fetcher);
    for (let i = 0; i < 30; i++) { time += 10_000; expect((await call()).status).toBe(200); }
    time += 10_000; expect((await call()).status).toBe(429);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/chat/completions'))).toHaveLength(30);
  });
  it('処理中の二重送信を拒否する', async () => {
    let complete!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementation((url: string) => url.endsWith('/models') ? Promise.resolve(models()) : new Promise<Response>((resolve) => { complete = resolve; }));
    await start(fetcher); const first = call();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2)); time += 10_000; expect((await call()).status).toBe(429);
    complete(completion()); expect((await first).status).toBe(200);
  });
  it('質問の回答を整形し、キー・上流メタデータを返さない', async () => {
    const fetcher = working(); await start(fetcher);
    const result = await call(); expect(result.status).toBe(200);
    expect(result.body.answer).toBe('分数を書けます。'); expect(result.body.latex).toBe('$\\frac{a}{b}$');
    expect(JSON.stringify(result)).not.toContain(config.key); expect(result.body.choices).toBeUndefined();
  });
});

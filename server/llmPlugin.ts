import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { LLM_API, LLM_HEADER, parseLlmRequest, type LlmConnection } from '../src/ai/llmProtocol.ts';
import { askLlm, checkLlm, LlmFailure, type LlmConfig } from './llmProvider.ts';

export const LLM_ORIGIN = 'http://127.0.0.1:5174';
const MAX_REQUEST_BYTES = 64 * 1024;
const COOLDOWN_MS = 10_000;
const SESSION_LIMIT = 30;

function send(res: ServerResponse, status: number, value: unknown) {
  if (res.destroyed) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin' });
  res.end(JSON.stringify(value));
}

export function isLocalLlmRequest(req: IncomingMessage): boolean {
  const host = req.headers.host;
  return host === '127.0.0.1:5174' && req.headers[LLM_HEADER] === '1'
    && ['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')
    && !req.headers.forwarded && !req.headers['x-forwarded-for'] && !req.headers['x-forwarded-host']
    && (!req.headers.origin || req.headers.origin === LLM_ORIGIN)
    && (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site'] === 'same-origin');
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks: Buffer[] = [];
    const finish = (error?: Error) => {
      clearTimeout(timer); req.off('data', data); req.off('end', end); req.off('aborted', aborted); req.off('error', finish);
      if (error) { chunks.length = 0; req.once('error', () => {}); req.resume(); reject(error); }
    };
    const data = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BYTES) finish(new LlmFailure(413, '送信内容が上限を超えています。'));
      else chunks.push(chunk);
    };
    const end = () => {
      finish();
      try { resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
      catch { reject(new LlmFailure(400, '送信内容の形式を確認してください。')); }
    };
    const aborted = () => finish(new LlmFailure(400, '送信を中止しました。'));
    const timer = setTimeout(() => finish(new LlmFailure(408, '送信に時間がかかりすぎました。')), 5_000);
    req.on('data', data); req.once('end', end); req.once('aborted', aborted); req.once('error', finish);
  });
}

export function createLlmHandler(config: LlmConfig | null, fetcher: typeof fetch = fetch) {
  let active = false, lastAttempt = -Infinity, attempts = 0;
  let connection: LlmConnection = 'unverified';
  let checkedAt = -Infinity;
  let checking: Promise<LlmConnection> | null = null;
  const status = () => ({ configured: Boolean(config), model: config?.model || '', connection });
  async function access(force = false): Promise<LlmConnection> {
    if (!config) return connection = 'unavailable';
    if (checking) return checking;
    if (!force && Date.now() - checkedAt < (connection === 'available' ? 20_000 : 5_000)) return connection;
    checking = (async () => {
      try { await checkLlm(config!, AbortSignal.timeout(5_000), fetcher); connection = 'available'; }
      catch (error) { connection = error instanceof LlmFailure && error.status === 401 ? 'authentication-required' : 'unavailable'; }
      finally { checkedAt = Date.now(); checking = null; }
      return connection;
    })();
    return checking;
  }
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith(LLM_API)) { next(); return; }
    if (!isLocalLlmRequest(req)) { send(res, 403, { error: '学内LLMの同じ端末・画面からだけ利用できます。' }); return; }
    if (req.method === 'GET' && req.url === `${LLM_API}/status`) { await access(); send(res, 200, status()); return; }
    if (req.url !== `${LLM_API}/answer`) { send(res, 404, { error: '操作が見つかりません。' }); return; }
    if (req.method !== 'POST') { send(res, 405, { error: 'POSTで操作してください。' }); return; }
    if (req.headers.origin !== LLM_ORIGIN || !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')
      || req.headers['content-encoding']) { send(res, 415, { error: '送信元・送信形式を確認してください。' }); return; }
    const length = req.headers['content-length'];
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) { send(res, 413, { error: '送信内容が上限を超えています。' }); return; }
    if (!config) { send(res, 503, { error: 'ローカル設定にAPIキーとモデルIDを指定して再起動してください。' }); return; }
    if (active || Date.now() - lastAttempt < COOLDOWN_MS || attempts >= SESSION_LIMIT) {
      res.setHeader('Retry-After', '10');
      send(res, 429, { error: attempts >= SESSION_LIMIT ? '学内LLMの30回の上限に達しました。必要ならサーバーを再起動してください。' : '連続送信を制限しています。10秒以上待って再試行してください。' }); return;
    }
    active = true;
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableFinished) controller.abort(); };
    res.once('close', disconnect);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const body = await readBody(req);
      let request;
      try { request = parseLlmRequest(body); }
      catch { throw new LlmFailure(400, '質問は2,000文字、ソースは10,000文字、ログは4,000文字までです。入力形式・不可視文字も確認してください。'); }
      lastAttempt = Date.now(); attempts++;
      if (await access(true) !== 'available') throw new LlmFailure(403, '学内AIを利用できません。学内ネットワーク・APIの利用設定を確認してください。');
      if (controller.signal.aborted) return;
      timer = setTimeout(() => controller.abort(), 60_000);
      const answer = await askLlm(config, request, controller.signal, fetcher);
      connection = 'available'; send(res, 200, answer);
    } catch (error) {
      if (error instanceof LlmFailure) {
        if (error.status === 401) connection = 'authentication-required';
        else if (error.status === 502) connection = 'unavailable';
        send(res, error.status, { error: error.message });
      } else if (error instanceof RangeError) send(res, 400, { error: error.message });
      else {
        connection = 'unavailable';
        send(res, controller.signal.aborted ? 504 : 502, { error: controller.signal.aborted
          ? '回答待ちを終了しました。入力を短くして再試行してください。'
          : '接続または回答形式を確認できませんでした。学内ネットワーク・大学VPN・設定を確認してください。' });
      }
    } finally { clearTimeout(timer); res.off('close', disconnect); active = false; }
  };
}

export function llmPlugin(config: LlmConfig | null): Plugin {
  const createHandler = createLlmHandler(config);
  return {
    name: 'local-university-llm', apply: 'serve',
    configureServer(server) {
      if (server.config.server.host !== '127.0.0.1' || server.config.server.port !== 5174 || !server.config.server.strictPort
        || server.config.server.proxy || server.config.server.cors !== false) throw new Error('学内LLM接続は127.0.0.1:5174のローカル接続だけに対応します。');
      server.middlewares.use((req, res, next) => { void createHandler(req, res, next); });
    },
  };
}

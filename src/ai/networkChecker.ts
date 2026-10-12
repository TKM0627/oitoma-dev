import type { FetchLike, GatewayConfig, GatewayStatus } from './types';
import { gatewayBase } from './gatewayConfig';

export const MAX_GATEWAY_RESPONSE_BYTES = 32 * 1024;
export const MIN_CHECK_INTERVAL_MS = 5000;

/** Content-Lengthだけでなく、展開後の本文も制限する。 */
async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new Error('Gateway content type');
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_GATEWAY_RESPONSE_BYTES)) throw new Error('Gateway response too large');
  if (!response.body) throw new Error('Gateway empty response');
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      if (signal.aborted) throw new Error('Gateway aborted');
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_GATEWAY_RESPONSE_BYTES) throw new Error('Gateway response too large');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } finally {
    signal.removeEventListener('abort', cancel);
    cancel();
    reader.releaseLock();
  }
}

/** AbortSignalを無視するfetchも、本文取得を含めて期限で終了する。 */
export async function fetchJson(fetcher: FetchLike, url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, { ...init, signal: controller.signal, credentials: 'omit', mode: 'cors', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
        if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect') throw new Error('Gateway redirected or opaque');
        if (response.url && response.url !== url) throw new Error('Gateway response URL');
        if (response.status !== 200) await response.body?.cancel();
        const body: unknown = response.status === 200 ? await readJson(response, controller.signal) : null;
        return { status: response.status, body };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Gateway timeout')); }, timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); controller.abort(); }
}

export class NetworkChecker {
  readonly baseUrl: string | null;
  private status: GatewayStatus = 'not-configured';
  private lastSuccess = -Infinity;
  private lastAttempt = -Infinity;
  private pending: Promise<GatewayStatus> | null = null;
  private searchNavigation = false;
  private explanations = false;
  private listeners = new Set<() => void>();
  constructor(config: GatewayConfig, private fetcher: FetchLike = (url, init) => fetch(url, init), private now = () => Date.now(), private timeoutMs = 3000) {
    this.baseUrl = gatewayBase(config);
  }
  getSnapshot = () => this.status;
  supportsSearchNavigation = () => this.searchNavigation;
  supportsExplanations = () => this.explanations;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private setStatus(status: GatewayStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }
  check(force = false): Promise<GatewayStatus> {
    if (!this.baseUrl) return Promise.resolve('not-configured');
    if (this.pending) return this.pending;
    if (!force && this.status === 'available' && this.now() - this.lastSuccess < 60_000) return Promise.resolve('available');
    // 連打対策。サーバー側のレート制限とは別。
    if (this.now() - this.lastAttempt < MIN_CHECK_INTERVAL_MS) return Promise.resolve(this.status);
    this.lastAttempt = this.now();
    this.setStatus('checking');
    this.pending = this.performCheck().finally(() => { this.pending = null; });
    return this.pending;
  }
  private async performCheck(): Promise<GatewayStatus> {
    this.searchNavigation = false;
    this.explanations = false;
    let status: GatewayStatus;
    try {
      const response = await fetchJson(this.fetcher, `${this.baseUrl}/v1/capabilities`, { method: 'GET', headers: { Accept: 'application/json' } }, this.timeoutMs);
      if (response.status === 401 || response.status === 403) status = 'authentication-required';
      else if (response.status !== 200) status = 'unavailable';
      else {
        const body = response.body;
        if (typeof body === 'object' && body !== null && Object.keys(body).length === 3 && 'service' in body && body.service === 'latex-navigator-ai' && 'version' in body && body.version === '1' && 'ai' in body && typeof body.ai === 'object' && body.ai !== null && 'explanations' in body.ai && typeof body.ai.explanations === 'boolean') {
          const ai = body.ai;
          if (Object.keys(ai).some((key) => !['explanations', 'searchNavigation'].includes(key)) || ('searchNavigation' in ai && typeof ai.searchNavigation !== 'boolean')) status = 'unknown';
          else {
            this.explanations = ai.explanations === true;
            this.searchNavigation = 'searchNavigation' in ai && ai.searchNavigation === true;
            status = this.explanations || this.searchNavigation ? 'available' : 'unavailable';
          }
        } else status = 'unknown';
      }
    } catch { status = 'unknown'; }
    if (status === 'available') this.lastSuccess = this.now();
    this.setStatus(status);
    return status;
  }
}

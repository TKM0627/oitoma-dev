import type { GatewayConfig } from './types.ts';

export function gatewayBase(config: GatewayConfig): string | null {
  if (!config.enabled || !config.baseUrl?.trim()) return null;
  // CSPへ埋め込むため、URLの補正と区切り文字を拒否する。
  if (config.baseUrl.length > 2048 || /[\s\\%]/u.test(config.baseUrl)) return null;
  try {
    const url = new URL(config.baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(url.pathname)) return null;
    if (url.href !== config.baseUrl && url.href !== `${config.baseUrl}/`) return null;
    return url.href.replace(/\/$/, '');
  } catch { return null; }
}


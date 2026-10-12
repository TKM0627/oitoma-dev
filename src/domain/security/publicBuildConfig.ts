import { gatewayBase } from '../../ai/gatewayConfig.ts';

const publicKeys = new Set(['VITE_BASE_PATH', 'VITE_ENABLE_LIVE_AI', 'VITE_UNIVERSITY_GATEWAY_BASE_URL']);

/** エラーに設定値を出さない。秘密情報が含まれ得る。 */
export function validatePublicBuildConfig(env: Record<string, string | undefined>): void {
  if (Object.keys(env).some((key) => key.startsWith('VITE_') && !publicKeys.has(key))) {
    throw new Error('未承認の公開環境変数があります。VITE_変数に秘密情報を置かないでください。');
  }
  if (env.VITE_ENABLE_LIVE_AI && !['true', 'false'].includes(env.VITE_ENABLE_LIVE_AI)) {
    throw new Error('AIの有効設定はtrueまたはfalseにしてください。');
  }
  const base = env.VITE_BASE_PATH;
  if (base && (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(base) || base.split('/').some((segment) => segment === '.' || segment === '..'))) {
    throw new Error('配信パスは安全な絶対パスにしてください。');
  }
  const gateway = env.VITE_UNIVERSITY_GATEWAY_BASE_URL;
  // AI無効でも設定値は公開され得る。
  if (gateway && !gatewayBase({ enabled: true, baseUrl: gateway })) {
    throw new Error('Gateway設定が不正です。認証情報を含まない固定HTTPS URLを指定してください。');
  }
}

import { gatewayBase } from '../../ai/gatewayConfig.ts';
import type { GatewayConfig } from '../../ai/types.ts';

export function contentSecurityPolicy(config: GatewayConfig): string {
  const gateway = gatewayBase(config);
  return [
    "default-src 'none'", "script-src 'self'", "script-src-attr 'none'",
    "style-src 'self'", "style-src-attr 'none'", "font-src 'self'", "img-src 'self'",
    `connect-src ${gateway ? `${gateway}/v1/` : "'none'"}`,
    "object-src 'none'", "frame-src 'none'", "worker-src 'none'",
    "base-uri 'none'", "form-action 'none'",
  ].join('; ');
}

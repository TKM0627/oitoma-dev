import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './contentSecurityPolicy';

describe('本番の通信と実行の許可範囲', () => {
  it('未設定時は通信を許可せず、外部・インラインスクリプトやevalを許可しない', () => {
    const policy = contentSecurityPolicy({ enabled: false, baseUrl: 'https://gateway.example.test' });
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|https:;/);
  });
  it('明示設定時もGatewayのAPIパスのみ許可する', () => {
    expect(contentSecurityPolicy({ enabled: true, baseUrl: 'https://gateway.example.test/api' })).toContain('connect-src https://gateway.example.test/api/v1/;');
    expect(contentSecurityPolicy({ enabled: true, baseUrl: 'https://gateway.example.test/?token=SECRET' })).toContain("connect-src 'none'");
  });
});

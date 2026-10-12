import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { rawContent } from './src/domain/content/rawContent.ts';
import { validateContent } from './src/domain/content/validateContent.ts';
import rawChapters from './src/data/reference_chapters.json' with { type: 'json' };
import { validateReferenceChapters } from './src/domain/reference/validateReferenceChapters.ts';
import rawSymbols from './src/data/symbol_catalog.json' with { type: 'json' };
import { validateSymbolCatalog } from './src/domain/symbols/validateSymbolCatalog.ts';
import rawReferenceIndex from './src/data/reference_search_index.json' with { type: 'json' };
import { referenceSearchEntries } from './src/domain/search/catalogSearch.ts';
import { contentSecurityPolicy } from './src/domain/security/contentSecurityPolicy.ts';
import rawPhrases from './src/data/purpose_phrases.json' with { type: 'json' };
import rawSupportReferences from './src/data/support_references.json' with { type: 'json' };
import { validateStudentSupport } from './src/domain/content/validateStudentSupport.ts';
import { validatePublicBuildConfig } from './src/domain/security/publicBuildConfig.ts';
import { llmPlugin } from './server/llmPlugin.ts';
import { readLlmConfig } from './server/llmProvider.ts';

export default defineConfig(({ mode, command, isPreview }) => {
  const development = command === 'serve' && !isPreview;
  const env = loadEnv(mode, process.cwd(), '');
  validatePublicBuildConfig(env);
  if (development && (env.VITE_ENABLE_LIVE_AI === 'true' || env.VITE_UNIVERSITY_GATEWAY_BASE_URL)) throw new Error('開発中は公開Gateway設定を無効にし、ローカルの学内LLM接続を使ってください。');
  const policy = contentSecurityPolicy({ enabled: env.VITE_ENABLE_LIVE_AI === 'true', baseUrl: env.VITE_UNIVERSITY_GATEWAY_BASE_URL });
  return {
    define: { __DEV_LLM__: development },
    ...(development ? { server: { host: '127.0.0.1', port: 5174, strictPort: true, cors: false, allowedHosts: ['127.0.0.1'],
      headers: { 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "connect-src 'self' ws://127.0.0.1:5174; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" },
      fs: { strict: true, deny: ['**/.env*', '**/*.local', '**/*.{pem,key,p12,pfx}', '**/.git/**', '**/.codex/**', '**/.agents/**'] } } } : {}),
    plugins: [react(), ...(development ? [llmPlugin(readLlmConfig(env))] : []), {
      name: 'verify-public-content',
      buildStart() {
        const content = validateContent(rawContent);
        validateStudentSupport(rawPhrases, rawSupportReferences, content);
        const chapters = validateReferenceChapters(rawChapters, content);
        if (JSON.stringify(rawReferenceIndex) !== JSON.stringify(referenceSearchEntries(chapters, content))) {
          throw new Error('資料の検索索引が古いか不正です。npm run update:search-index を実行してください。');
        }
        validateSymbolCatalog(rawSymbols, content);
      },
    }, {
      name: 'production-security-policy', apply: 'build',
      transformIndexHtml() {
        return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
      },
    }],
    // CSPに合わせてdata URLへの埋め込みを無効にする。
    build: { manifest: true, assetsInlineLimit: 0, sourcemap: false },
    base: env.VITE_BASE_PATH || '/oitoma-dev/',
  };
});

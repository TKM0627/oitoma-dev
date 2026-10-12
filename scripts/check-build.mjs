import fs from 'node:fs';
import console from 'node:console';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve('dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.vite/manifest.json'), 'utf8'));
const visited = new Set();
const assets = new Set();
function collect(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const chunk = manifest[key];
  if (!chunk) throw new Error(`Missing manifest entry: ${key}`);
  if (chunk.file.endsWith('.js')) assets.add(chunk.file);
  for (const css of chunk.css || []) assets.add(css);
  for (const dependency of chunk.imports || []) collect(dependency);
  // 遅延importは初期資産から除外する。
}
collect('index.html');
const files = [...assets].map((file) => {
  if (!/^assets\/[\w.-]+\.(js|css)$/.test(file)) throw new Error('Invalid build asset path');
  const source = fs.readFileSync(path.join(root, file));
  return { file, bytes: source.length, gzipBytes: gzipSync(source).length };
});
const totals = files.reduce((total, file) => ({ bytes: total.bytes + file.bytes, gzipBytes: total.gzipBytes + file.gzipBytes }), { bytes: 0, gzipBytes: 0 });
const budgets = { bytes: 380_000, gzipBytes: 110_000 };
if (totals.bytes > budgets.bytes || totals.gzipBytes > budgets.gzipBytes) throw new Error(`Initial JS/CSS exceeds budget: ${JSON.stringify(totals)}`);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// public/からのコピーを含め、秘密ファイル・ソースマップを公開成果物に混ぜない。
function inspectArtifacts(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Build contains a symbolic link');
    if (entry.isDirectory()) {
      if (['.git', '.codex', '.agents'].includes(entry.name)) throw new Error('Build contains a private directory');
      inspectArtifacts(file);
    } else {
      if (/\.map$|^\.env(?:\.|$)|^(?:auth|credentials)\.json$|\.(?:pem|key|p12|pfx)$/i.test(entry.name)) throw new Error('Build contains a private artifact or source map');
      if (/\.(?:js|json|html|txt|svg|css)$/i.test(entry.name)
        && /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/.test(fs.readFileSync(file, 'utf8'))) throw new Error('Build contains private key material');
      if (/\.(?:js|json|html)$/i.test(entry.name)
        && /__llm|OITOMA_API_KEY|OITOMA_MODEL|ironical\.okayama-u\.ac\.jp\/ai\/v1/.test(fs.readFileSync(file, 'utf8'))) throw new Error('Build contains development LLM code');
    }
  }
}
inspectArtifacts(root);
const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1].replaceAll('&#39;', "'").replaceAll('&amp;', '&');
if (!policy || !policy.includes("script-src 'self'") || !policy.includes("base-uri 'none'") || !policy.includes("form-action 'none'") || /unsafe-inline|unsafe-eval/.test(policy)) throw new Error('Production CSP is missing or unsafe');
if (!html.includes('name="referrer" content="no-referrer"')) throw new Error('Missing referrer policy');
if (!files.length) throw new Error('Initial assets not found');
for (const file of new Set(Object.values(manifest).flatMap((chunk) => chunk.css || []))) {
  if (!/^assets\/[\w.-]+\.css$/.test(file)) throw new Error('Invalid CSS asset path');
  if (/url\(\s*['"]?data:/i.test(fs.readFileSync(path.join(root, file), 'utf8'))) throw new Error('CSS embeds a data URL forbidden by production CSP');
}

const report = { metric: 'initial-static-import-js-and-css', budgets, totals, files };
fs.writeFileSync(path.join(root, 'build-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Initial JS/CSS: ${totals.bytes} bytes; gzip ${totals.gzipBytes} bytes (budget ${budgets.gzipBytes}). Production CSP verified.`);

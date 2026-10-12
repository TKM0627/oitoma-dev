import { lazy, Suspense, useState } from 'react';

const SymbolCatalog = lazy(() => import('./SymbolCatalog'));

export function SymbolCatalogDisclosure() {
  const [loaded, setLoaded] = useState(false);
  return <details className="disclosure" onToggle={(event) => { if (event.currentTarget.open) setLoaded(true); }}>
    <summary>ギリシャ文字・記号の一覧を開く</summary>
    <div className="disclosure-body">{loaded ? <Suspense fallback={<p role="status">一覧を読み込んでいます…</p>}><SymbolCatalog /></Suspense> : <p>分類別に一覧を確認し、名前・形・コマンドから絞り込めます。</p>}</div>
  </details>;
}

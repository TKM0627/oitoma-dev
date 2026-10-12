import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { NetworkStatus } from '../components/network/NetworkStatus';
import { useStudy } from './studyContext';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { environments } from './environments';

export function AppShell() {
  const { environment, setEnvironment } = useStudy();
  const { pathname } = useLocation();
  const mode = pathname === '/workspace' ? 'workspace' : pathname.startsWith('/recipes') ? 'try' : pathname === '/diagnose' || pathname.startsWith('/errors/') ? 'fix' : 'search';
  useEffect(() => {
    const main = document.getElementById('main-content');
    main?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    const heading = main?.querySelector('h1')?.textContent;
    document.title = `${heading || 'LaTeX'} | LaTeX Navigator`;
  }, [pathname]);
  return <>
    <a href="#main-content" className="skip-link" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); window.scrollTo(0, 0); }}>本文へ移動</a>
    <header className="site-header">
      <div className="header-inner">
        <Link to="/search" className="brand" aria-label="LaTeX Navigator ホーム">LaTeX Navigator</Link>
        <nav aria-label="メインナビゲーション">
          <NavLink to="/search" className={mode === 'search' && pathname !== '/help' ? 'active' : ''} aria-current={mode === 'search' && pathname !== '/help' ? 'true' : undefined}>探す</NavLink>
          <NavLink to="/recipes" className={mode === 'try' ? 'active' : ''} aria-current={mode === 'try' ? 'true' : undefined}>試す</NavLink>
          <NavLink to="/diagnose" className={mode === 'fix' ? 'active' : ''} aria-current={mode === 'fix' ? 'true' : undefined}>直す</NavLink>
          <NavLink to="/workspace">まとめて調べる</NavLink>
          <NavLink className="help-link" to="/help">使い方</NavLink>
        </nav>
        <div className="header-tools"><details className="header-resources" key={pathname}><summary>資料・学習</summary><div><Link to="/reference">テーマ別資料</Link><Link to="/japanese">日本語文書</Link><Link to="/learn">学習コース</Link></div></details><label className="environment-picker">利用環境<select value={environment} onChange={(event) => { const selected = Object.keys(environments).find((key) => key === event.target.value) as keyof typeof environments | undefined; if (selected) setEnvironment(selected); }}>{Object.entries(environments).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      </div>
    </header>
    <main id="main-content" tabIndex={-1}><RouteErrorBoundary key={pathname}><Suspense fallback={<div className="page" role="status">画面を読み込んでいます…</div>}><Outlet /></Suspense></RouteErrorBoundary></main>
    <footer className="site-footer"><p>簡易診断です。TeXのコンパイルは行いません。</p><Link to="/help">情報の扱い・出典</Link>{!__DEV_LLM__ && <NetworkStatus />}</footer>
  </>;
}

import { Link } from 'react-router-dom';
export function NotFoundPage() { return <div className="page empty-state"><h1>ページが見つかりません</h1><p>このページは登録されていません。</p><Link className="button" to="/search">書き方を探す →</Link></div>; }

import { Link, useLocation } from 'react-router-dom';
import { publicSearchParams } from '../../domain/search/searchState';

function searchReturn(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !('searchReturn' in state) || typeof state.searchReturn !== 'string') return null;
  if (state.searchReturn.length > 2000 || !/^\/search(?:\?|$)/.test(state.searchReturn) || state.searchReturn.includes('#')) return null;
  const params = publicSearchParams(new URLSearchParams(state.searchReturn.split('?')[1]));
  return `/search${params.size ? `?${params}` : ''}`;
}

export function SearchReturnLink({ fallbackTo, fallbackLabel }: { fallbackTo?: string; fallbackLabel?: string }) {
  const { state } = useLocation();
  const to = searchReturn(state);
  if (to) return <Link className="back-link" to={to}>← 検索結果に戻る</Link>;
  return fallbackTo ? <Link className="back-link" to={fallbackTo}>{fallbackLabel}</Link> : null;
}

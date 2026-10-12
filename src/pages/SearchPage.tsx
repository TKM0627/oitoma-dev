import { lazy, Suspense, useLayoutEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { content } from '../domain/content/contentRepository';
import { MAX_QUERY_LENGTH } from '../domain/search/searchEngine';
import { PageHeading, TopicCard } from '../components/common/ContentParts';
import { useSearchInput } from '../app/searchContext';
import { publicSearchParams } from '../domain/search/searchState';
import { textInputError } from '../domain/security/textInput';

const categories = ['数式', '表', '図', '文書構造', '参照', 'エラー'];
const symptoms = ['添字でエラー', 'Missing $ inserted', '等号を揃えたい', '行列の括弧を変えたい'];
const UnifiedSearchPanel = lazy(() => import('../components/search/UnifiedSearchPanel'));

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { query, setQuery } = useSearchInput();
  const inputError = textInputError(query, MAX_QUERY_LENGTH);
  const [focusRequest, setFocusRequest] = useState(0);
  const serializedParams = params.toString();
  useLayoutEffect(() => {
    const current = new URLSearchParams(serializedParams);
    // 旧形式のリンクはメモリへ取り込み、現在の履歴項目から検索語を除く。
    const incoming = current.get('q');
    if (incoming !== null) setQuery(textInputError(incoming, MAX_QUERY_LENGTH) ? '' : incoming);
    const next = publicSearchParams(current);
    if (next.toString() !== serializedParams) setParams(next, { replace: true });
  }, [serializedParams, setParams, setQuery]);
  const filters = publicSearchParams(params);
  const tags = filters.getAll('tag');
  const isFiltering = query.trim().length > 0 || filters.size > 0;
  function applyQuery(value: string) {
    setQuery(value.slice(0, MAX_QUERY_LENGTH));
  }
  function clearFilters() { setQuery(''); setParams({}); }
  function toggleTag(tag: string) {
    const next = new URLSearchParams(filters);
    next.delete('tag');
    const nextTags = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
    nextTags.forEach((item) => next.append('tag', item));
    setParams(next, { replace: true });
  }
  return <div className="page search-page">
    <section className="search-hero"><PageHeading title="LaTeXの書き方を探す" /><form role="search" onSubmit={(event) => { event.preventDefault(); if (inputError) return; if (!isFiltering) setParams({ view: 'all' }); setFocusRequest((value) => value + 1); }}><label htmlFor="search-query" className="sr-only">キーワード・症状・コマンド名で検索</label><div className="search-input-wrap"><input id="search-query" type="search" aria-describedby="search-hint" maxLength={MAX_QUERY_LENGTH} value={query} onChange={(e) => applyQuery(e.target.value)} aria-invalid={Boolean(inputError)} placeholder="例：分数/等号" autoComplete="off" spellCheck={false} /><button type="submit" disabled={Boolean(inputError)}>検索</button></div><p id="search-hint" className="small muted">検索語は保存・外部送信しません。</p>{inputError && <p role="alert">{inputError}</p>}</form></section>
    <details className="search-browse" key={isFiltering ? 'results' : 'start'}><summary>カテゴリ・よくある症状から探す</summary>
    <section className="category-section" aria-labelledby="category-heading"><h2 id="category-heading" className="section-label">カテゴリから探す</h2><div className="category-grid">{categories.map((tag) => <button key={tag} onClick={() => toggleTag(tag)} aria-pressed={tags.includes(tag)}>{tag}</button>)}</div></section>
    <section className="filter-section" aria-label="検索の絞り込み"><div className="symptoms"><span className="small muted">よくある症状</span>{symptoms.map((symptom) => <button className="suggestion" key={symptom} onClick={() => applyQuery(symptom)}>{symptom}</button>)}</div><details><summary>タグで絞り込む{tags.length ? `（${tags.length}個選択・AND）` : ''}</summary><div className="tag-filters">{content.tags.map((tag) => <button className="tag" key={tag} aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></details></section>
    </details>
    {tags.length > 0 && <div className="active-filters" role="group" aria-label="選択中のタグ"><span className="small muted">選択中のタグ</span>{tags.map((tag) => <button key={tag} aria-label={`${tag}の絞り込みを解除`} onClick={() => toggleTag(tag)}>{tag}<span aria-hidden="true">×</span></button>)}</div>}
    {isFiltering ? <Suspense fallback={<section role="status">収録項目を読み込んでいます…</section>}><UnifiedSearchPanel query={query} tags={tags} onClear={clearFilters} focusRequest={focusRequest} /></Suspense> : <section className="search-results" aria-labelledby="results-heading"><div className="section-heading"><h2 id="results-heading">よく使う書き方</h2><Link className="text-button" to="/search?view=all">すべての項目を見る →</Link></div><div className="topic-grid">{content.topics.slice(0, 6).map((topic) => <TopicCard topic={topic} key={topic.id} />)}</div></section>}
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { content } from '../../domain/content/contentRepository';
import { createSearchCatalog, searchCatalog, targetKey, targetPath, type SearchEntry } from '../../domain/search/catalogSearch';
import { referenceIndex } from '../../domain/search/referenceSearchIndex';
import { TopicCard } from '../common/ContentParts';
import '../../styles/search.css';
import { publicSearchParams } from '../../domain/search/searchState';
import { textInputError } from '../../domain/security/textInput';
import { MAX_QUERY_LENGTH } from '../../domain/search/searchEngine';

const catalog = createSearchCatalog(content, referenceIndex);
const filters = [
  { id: 'all', label: 'すべて', kinds: [] },
  { id: 'topic', label: '書き方', kinds: ['topic'] },
  { id: 'recipe', label: '試せる例', kinds: ['recipe'] },
  { id: 'reference', label: 'テーマ別資料', kinds: ['reference'] },
  { id: 'error', label: 'エラー', kinds: ['error'] },
  { id: 'learning', label: '日本語・学習', kinds: ['guide', 'course'] },
];
const labels = { topic: '書き方', recipe: '試せる例', reference: 'テーマ別資料', error: 'エラーと修正', guide: '日本語スターター', course: '学習コース' };

function Result({ entry, searchReturn }: { entry: SearchEntry; searchReturn: string }) {
  if (entry.kind === 'topic') return <div className="unified-topic"><span className="result-kind">書き方</span><TopicCard topic={content.topics.find((topic) => topic.id === entry.id)!} searchReturn={searchReturn} /></div>;
  const title = entry.kind === 'recipe' ? `${entry.title}を試す` : entry.title;
  return <article className="unified-result"><span className="result-kind">{labels[entry.kind]}</span><h3><Link to={targetPath(entry)} state={{ searchReturn }} aria-label={entry.kind === 'reference' ? `${title}（テーマ別資料）` : undefined}>{title}</Link></h3><p>{entry.summary}</p></article>;
}

export default function UnifiedSearchPanel({ query, tags, onClear, focusRequest }: { query: string; tags: string[]; onClear: () => void; focusRequest: number }) {
  const [params, setParams] = useSearchParams();
  const filter = filters.find((filter) => filter.id === params.get('type')) || filters[0];
  const hits = textInputError(query, MAX_QUERY_LENGTH) ? [] : searchCatalog(catalog, query, tags);
  const searchReturn = `/search?${publicSearchParams(params)}`;
  const matching = filter.kinds.length ? hits.filter((hit) => filter.kinds.includes(hit.entry.kind)) : hits;
  const key = `${query}\u0000${tags.join(',')}\u0000${filter.id}`;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const shown = expandedKey === key ? matching : matching.slice(0, 8);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusRequest > 0) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start' }); }
  }, [focusRequest]);
  function select(id: string) {
    const next = publicSearchParams(params);
    if (id === 'all') next.delete('type'); else next.set('type', id);
    setParams(next, { replace: true });
  }
  return <section className="search-results" aria-labelledby="results-heading">
    <div className="section-heading"><div><h2 id="results-heading" tabIndex={-1} ref={heading}>検索結果</h2><p role="status" className="small muted">{matching.length}件{shown.length < matching.length && ` · 先頭${shown.length}件を表示`}</p></div><button className="text-button" onClick={onClear}>検索条件をクリア</button></div>
    <div className="search-types" role="group" aria-label="検索結果の種類">{filters.map((item) => {
      const count = item.kinds.length ? hits.filter((hit) => item.kinds.includes(hit.entry.kind)).length : hits.length;
      return <button key={item.id} type="button" aria-pressed={filter.id === item.id} onClick={() => select(item.id)}>{item.label}<span className="category-count">{count}</span></button>;
    })}</div>
    {shown.length ? <div className="unified-results">{shown.map(({ entry }) => <Result entry={entry} searchReturn={searchReturn} key={targetKey(entry)} />)}</div> : <div className="empty-state"><h3>該当する項目が見つかりませんでした</h3><p>{hits.length ? '他の種類には結果があります。「すべて」を選んで確認できます。' : '選択したタグを外すか、短いキーワード・コマンド名で試してください。'}</p>{hits.length > 0 && <button className="button secondary" onClick={() => select('all')}>すべての種類を見る</button>}<button className="text-button" onClick={onClear}>条件を外して探す</button></div>}
    {shown.length < matching.length && <button type="button" className="button secondary more-results" onClick={() => setExpandedKey(key)}>残りの{matching.length - shown.length}件を表示</button>}
  </section>;
}

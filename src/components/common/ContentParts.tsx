import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Reference, Topic } from '../../domain/content/schema';
import { content } from '../../domain/content/contentRepository';

export function TagChip({ tag }: { tag: string }) { return <Link className="tag" aria-label={`${tag}で絞り込む`} to={`/search?tag=${encodeURIComponent(tag)}`}>{tag}</Link>; }
export function PackageNotice({ packages }: { packages: string[] }) {
  return <div className="package-notice"><b>必要パッケージ</b>{packages.length ? <><code>{packages.map((name) => `\\usepackage{${name}}`).join('\n')}</code><span className="small">プリアンブル（\begin{'{document}'}より前）に記述します。</span></> : <span>追加パッケージは不要です。</span>}</div>;
}
const sourceTypes: Record<Reference['sourceType'], string> = {
  'official-documentation': '開発元の文書', 'maintainer-documentation': '保守者の文書',
  'project-tutorial': '制作元のチュートリアル', 'service-tutorial': 'サービス提供元の解説',
};
export function ReferenceLinks({ ids, showScope = false, references = content.references }: { ids: string[]; showScope?: boolean; references?: Reference[] }) {
  return <ul className="reference-list">{references.filter((ref) => ids.includes(ref.id)).map((ref) => <li key={ref.id}><a href={ref.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{ref.title}</a><small className="reference-meta">{sourceTypes[ref.sourceType]} · {ref.publisher} · 確認日 {ref.checkedAt}</small>{showScope && <p className="reference-scope">参照範囲：{ref.scope}</p>}</li>)}</ul>;
}
export function RelatedTopics({ ids }: { ids: string[] }) {
  return <div className="related-links">{content.topics.filter((topic) => ids.includes(topic.id)).map((topic) => <Link key={topic.id} to={`/topics/${topic.id}`}>{topic.title} <span aria-hidden="true">→</span></Link>)}</div>;
}
export function TopicCard({ topic, searchReturn }: { topic: Topic; searchReturn?: string }) {
  const state = searchReturn ? { searchReturn } : undefined;
  const recipe = content.recipes.find((recipe) => recipe.id === topic.recipeIds[0]);
  return <article className="topic-card">
    <div className="topic-main">
      <h3><Link to={`/topics/${topic.id}`} state={state}>{topic.title}</Link></h3>
      <p>{topic.summary}</p>
      {!!topic.requiredPackages.length && <p className="small muted">{topic.requiredPackages.join(' / ')}</p>}
      {recipe && <div className="topic-actions"><Link to={`/recipes/${recipe.id}`} state={state} aria-label={`${topic.title}：${recipe.title}を試す`}>{recipe.title}を試す →</Link></div>}
    </div>
    <pre className="card-example" tabIndex={0}><code>{topic.examples[0].code}</code></pre>
  </article>;
}
export function PageHeading({ title, description }: { title: string; description?: string }) {
  useEffect(() => { document.title = `${title} | LaTeX Navigator`; }, [title]);
  return <div className="page-heading"><h1>{title}</h1>{description && <p className="lead">{description}</p>}</div>;
}

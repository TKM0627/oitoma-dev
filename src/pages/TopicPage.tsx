import { SearchReturnLink } from '../components/search/SearchReturnLink';
import { Link, useParams } from 'react-router-dom';
import { content, findTopic } from '../domain/content/contentRepository';
import { CodeBlock } from '../components/common/CodeBlock';
import { PageHeading, PackageNotice, ReferenceLinks, TagChip } from '../components/common/ContentParts';
import { Disclosure } from '../components/common/Disclosure';
import { SymbolCatalogDisclosure } from '../components/symbols/SymbolCatalogDisclosure';
import { NotFoundPage } from './NotFoundPage';

export function TopicPage() {
  const { id } = useParams();
  const topic = findTopic(id || '');
  if (!topic) return <NotFoundPage />;
  const errors = content.errorCases.filter((error) => topic.errorCaseIds.includes(error.id));
  if (topic.guideId) return <div className="page"><SearchReturnLink fallbackTo="/search" fallbackLabel="← 探すに戻る" /><PageHeading title={topic.title} description={topic.summary} /><div className="tags">{topic.tags.map((tag) => <TagChip tag={tag} key={tag} />)}</div>{topic.examples.map((example) => <section key={example.label}><CodeBlock code={example.code} label={example.label} /><p>{example.explanation}</p></section>)}<aside className="next-step"><div><h2>環境に合う文書を用意する</h2><p>エンジン別の設定手順と、レポートのスターターを利用できます。</p></div><Link className="button" to="/japanese">日本語スターターを開く →</Link></aside><section><h2>参考資料</h2><Disclosure summary={`出典を確認する（${topic.referenceIds.length}件）`}><ReferenceLinks ids={topic.referenceIds} showScope /></Disclosure></section></div>;
  return <div className="page"><SearchReturnLink fallbackTo="/search" fallbackLabel="← 探すに戻る" /><PageHeading title={topic.title} description={topic.summary} /><div className="tags">{topic.tags.map((tag) => <TagChip tag={tag} key={tag} />)}</div><div className="detail-grid"><div><section><h2>正しい書き方</h2>{topic.examples.map((example) => <div className="example" key={example.label}><CodeBlock code={example.code} label={example.label} /><p>{example.explanation}</p></div>)}</section>{topic.id === 'math-greek' && <SymbolCatalogDisclosure />}<section><h2>よくあるミス・確認ポイント</h2>{errors.length ? <div className="error-case-list">{errors.map((error) => <article key={error.id}><h3><Link to={`/errors/${error.id}`}>{error.title} →</Link></h3><p>{error.cause}</p></article>)}</div> : <p>例の説明にある利用位置と引数を確認してください。文書クラス・エンジン・パッケージによる違いは簡易診断の対象外です。</p>}</section><section><h2>参考資料</h2><Disclosure summary={`出典を確認する（${topic.referenceIds.length}件）`}><ReferenceLinks ids={topic.referenceIds} showScope /></Disclosure></section></div><aside className="detail-sidebar"><PackageNotice packages={topic.requiredPackages} /><div className="sidebar-panel"><h2>この書き方を試す</h2>{topic.recipeIds.length ? topic.recipeIds.map((recipeId) => <Link className="button" key={recipeId} to={`/recipes/${recipeId}`}>{content.recipes.find((recipe) => recipe.id === recipeId)?.title}を試す →</Link>) : <p>この構文の選択式レシピは未収録です。コード例を自分の文書で試してください。</p>}<Link className="text-button" to="/diagnose">コードの間違いを確認 →</Link></div></aside></div></div>;
}

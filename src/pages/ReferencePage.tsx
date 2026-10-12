import { SearchReturnLink } from '../components/search/SearchReturnLink';
import { Link, useParams } from 'react-router-dom';
import { PageHeading, ReferenceLinks, RelatedTopics } from '../components/common/ContentParts';
import { CodeBlock } from '../components/common/CodeBlock';
import { content } from '../domain/content/contentRepository';
import { referenceChapters } from '../domain/reference/referenceRepository';
import type { ReferenceChapter } from '../domain/reference/referenceSchema';
import { Disclosure } from '../components/common/Disclosure';
import { SymbolCatalogDisclosure } from '../components/symbols/SymbolCatalogDisclosure';
import { NotFoundPage } from './NotFoundPage';
import '../styles/reference.css';

function number(index: number) { return String(index + 1).padStart(2, '0'); }

function ThemeNavigation({ currentId }: { currentId: string }) {
  return <nav className="reference-nav" aria-label="テーマの一覧">
    <p className="section-label">テーマ別資料</p>
    <ol>{referenceChapters.map((chapter, index) => <li key={chapter.id}>
      <Link to={`/reference/${chapter.id}`} aria-current={chapter.id === currentId ? 'page' : undefined}>
        <span className="reference-number" aria-hidden="true">{number(index)}</span>{chapter.title}
      </Link>
    </li>)}</ol>
  </nav>;
}

function ReferenceIndex() {
  return <div className="page reference-page">
    <PageHeading title="テーマからLaTeXを学ぶ" description="書き始める準備から、レポートで使う構文とエラーの確認まで。必要なテーマから読めます。" />
    <p className="reference-intro">要点、短いコード例、つまずきやすい点、確認ポイントをまとめました。授業のテンプレート・指定を優先してください。</p>
    <ol className="reference-index">{referenceChapters.map((chapter, index) => <li key={chapter.id}>
      <span className="reference-number" aria-hidden="true">{number(index)}</span>
      <div><h2><Link to={`/reference/${chapter.id}`}>{chapter.title}</Link></h2><p>{chapter.summary}</p></div>
      <span className="small muted">{chapter.sections.length}項目</span>
    </li>)}</ol>
    <aside className="reference-editorial-note" aria-label="資料の確認状況">
      <p>開発元・保守者の文書と、制作元の日本語チュートリアルを参照しています。各項目の「出典と参照範囲」で確認できます。</p>
      <p>説明はAIを利用して作成し、開発時に資料と照合しました。教員などによる人手校閲、大学の承認、実際のTeXコンパイル検証は未実施です。</p>
      <Link to="/help">情報の出典と利用方針</Link>
    </aside>
  </div>;
}

function ChapterView({ chapter, index }: { chapter: ReferenceChapter; index: number }) {
  const previous = referenceChapters[index - 1];
  const next = referenceChapters[index + 1];
  function jumpTo(sectionId: string) {
    const section = document.getElementById(`reference-${chapter.id}-${sectionId}`);
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ block: 'start' });
  }
  return <div className="page reference-page">
    <SearchReturnLink fallbackTo="/reference" fallbackLabel="← 全6テーマを見る" />
    <div className="reference-layout">
      <ThemeNavigation currentId={chapter.id} />
      <article className="reference-body">
        <PageHeading title={chapter.title} description={chapter.summary} />
        <div className="reference-actions"><button type="button" onClick={() => window.print()}>このテーマを印刷</button></div>
        <section className="reference-goals" aria-labelledby="reference-goals-heading">
          <h2 id="reference-goals-heading">このテーマで押さえること</h2>
          <ul>{chapter.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul>
        </section>
        <nav className="reference-contents" aria-label="このテーマの目次">
          <ol>{chapter.sections.map((section) => <li key={section.id}><button type="button" className="text-button" onClick={() => jumpTo(section.id)}>{section.title}</button></li>)}</ol>
        </nav>
        {chapter.sections.map((section, sectionIndex) => <section key={section.id} id={`reference-${chapter.id}-${section.id}`} className="reference-section" tabIndex={-1} aria-labelledby={`reference-heading-${section.id}`}>
          <h2 id={`reference-heading-${section.id}`}><span className="reference-number" aria-hidden="true">{sectionIndex + 1}.</span>{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.examples.map((example) => <div className="reference-example" key={example.label}>
            <CodeBlock code={example.code} label={example.label} />
            <p className="reference-placement"><b>置く場所：</b>{example.placement}</p>
            <ul className="reference-requirements">{example.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
          </div>)}
          {section.pitfalls.length > 0 && <Disclosure summary={`つまずきやすい点（${section.pitfalls.length}件）`}><ul>{section.pitfalls.map((pitfall) => <li key={pitfall}>{pitfall}</li>)}</ul></Disclosure>}
          <details className="reference-sources"><summary>出典と参照範囲（{section.referenceIds.length}件）</summary><ReferenceLinks ids={section.referenceIds} showScope /></details>
        </section>)}
        {chapter.id === 'math' && <><p className="small muted">記号の一覧も印刷する場合は、先に一覧を開いてください。</p><SymbolCatalogDisclosure /></>}
        <section className="reference-checklist" aria-labelledby="reference-checklist-heading">
          <h2 id="reference-checklist-heading">確認ポイント</h2>
          <ul>{chapter.checklist.map((check) => <li key={check}>{check}</li>)}</ul>
          <p className="small muted">授業の環境で確認するための目安です。アプリが達成状況を判定・記録するものではありません。</p>
        </section>
        <section className="reference-related" aria-labelledby="reference-related-heading">
          <h2 id="reference-related-heading">関連する機能</h2>
          {chapter.guideId && <p><Link to="/japanese">日本語スターターを開く</Link></p>}
          {chapter.topicIds.length > 0 && <><h3>書き方を詳しく調べる</h3><RelatedTopics ids={chapter.topicIds} /></>}
          {chapter.recipeIds.length > 0 && <><h3>レシピで試す</h3><div className="related-links">{content.recipes.filter((recipe) => chapter.recipeIds.includes(recipe.id)).map((recipe) => <Link key={recipe.id} to={`/recipes/${recipe.id}`}>{recipe.title}を試す →</Link>)}</div></>}
          {chapter.errorCaseIds.length > 0 && <><h3>エラーの原因を調べる</h3><div className="related-links">{content.errorCases.filter((error) => chapter.errorCaseIds.includes(error.id)).map((error) => <Link key={error.id} to={`/errors/${error.id}`}>{error.title} →</Link>)}</div><p><Link to="/diagnose">短いコードを診断する →</Link></p></>}
        </section>
        <aside className="reference-editorial-note" aria-label="資料の確認状況">
          <p>資料との照合日：{chapter.checkedAt}。説明はAIを利用して作成しています。教員などによる人手校閲・大学の承認・実際のTeXコンパイル検証は未実施です。授業の指定と利用する環境で確認してください。</p>
        </aside>
        <nav className="reference-pager" aria-label="前後のテーマ">
          {previous && <Link to={`/reference/${previous.id}`}>← 前：{previous.title}</Link>}
          {next && <Link to={`/reference/${next.id}`}>次：{next.title} →</Link>}
        </nav>
      </article>
    </div>
  </div>;
}

export function ReferencePage() {
  const { id } = useParams();
  if (!id) return <ReferenceIndex />;
  const index = referenceChapters.findIndex((chapter) => chapter.id === id);
  if (index < 0) return <NotFoundPage />;
  return <ChapterView key={id} chapter={referenceChapters[index]} index={index} />;
}

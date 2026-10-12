import '../styles/learning.css';
import { SearchReturnLink } from '../components/search/SearchReturnLink';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { content } from '../domain/content/contentRepository';
import type { LearningPath } from '../domain/content/schema';
import { useStudy } from '../app/studyContext';
import { CopyButton } from '../components/common/CodeBlock';
import { PageHeading, ReferenceLinks } from '../components/common/ContentParts';

function Course({ path }: { path: LearningPath }) {
  const { completed, toggleStep } = useStudy();
  const [choice, setChoice] = useState('');
  const [checked, setChecked] = useState(false);
  const count = path.steps.filter((step) => completed.has(`${path.id}/${step.id}`)).length;
  const sharedUrl = new URL(window.location.href);
  sharedUrl.search = '';
  sharedUrl.hash = `/learn?path=${path.id}`;
  return <>
    <section className="study-panel" aria-labelledby="course-title"><div className="section-heading"><div><h2 id="course-title">{path.title}</h2><p className="small muted">{path.description}</p></div><span className="progress-count" role="status">{count} / {path.steps.length} 確認済み</span></div>
      <p className="small muted">チェックは自分で確認した印です。成績・習熟度の判定ではありません。ページ間で引き継ぎますが、再読み込みで消えます。</p>
      <ol className="learning-steps">{path.steps.map((step, index) => <li key={step.id}>
        <div className="learning-step-heading"><span className="step-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3>{step.title}</h3></div><p>{step.description}</p>
        <div className="learning-step-actions"><Link className="text-button" to={step.target.kind === 'guide' ? '/japanese' : `/${step.target.kind === 'topic' ? 'topics' : 'recipes'}/${step.target.id}`}>このステップを開く →</Link><label><input type="checkbox" aria-label={`${step.title}：確認した`} checked={completed.has(`${path.id}/${step.id}`)} onChange={() => toggleStep(`${path.id}/${step.id}`)} />確認した</label></div>
      </li>)}</ol>
    </section>
    <section className="study-panel quiz-panel" aria-labelledby="quiz-heading"><h2 id="quiz-heading">理解を確かめる、一問クイズ</h2><fieldset><legend>{path.quiz.question}</legend><div className="quiz-choices">{path.quiz.choices.map((item) => <label key={item.id}><input type="radio" name={`quiz-${path.id}`} value={item.id} checked={choice === item.id} onChange={() => { setChoice(item.id); setChecked(false); }} />{item.text}</label>)}</div></fieldset><button className="button secondary" disabled={!choice} onClick={() => setChecked(true)}>答えと理由を確認</button>
      {checked && <div className="quiz-feedback" role="status"><b>{choice === path.quiz.answerId ? '正解です。' : 'もう一度、理由を確認してみましょう。'}</b><p>{path.quiz.explanation}</p></div>}
      <ReferenceLinks ids={path.quiz.referenceIds} />
    </section>
    <aside className="course-tools"><div><h2>授業・自習でこのコースを使う</h2><p className="small muted">リンクはコースの種類だけを共有します。チェック状況やクイズの回答は含みません。</p><p className="small course-share-url"><code>{sharedUrl.href}</code></p></div><div className="course-tool-buttons"><CopyButton code={sharedUrl.href} label="コースのリンクをコピー" /><button className="button secondary" onClick={() => window.print()}>学習シートを印刷</button></div></aside>
  </>;
}

export function LearnPage() {
  const [params] = useSearchParams();
  const path = content.learningPaths.find((item) => item.id === params.get('path')) || content.learningPaths[0];
  return <div className="page learn-page"><SearchReturnLink /><PageHeading title="学習コース" description="レポート・数式・実験から選び、構文例と確認問題を順に使えます。" /><nav className="course-nav" aria-label="学習コース">{content.learningPaths.map((item) => <Link key={item.id} to={`/learn?path=${item.id}`} aria-current={item.id === path.id ? 'page' : undefined}>{item.title}</Link>)}</nav><Course key={path.id} path={path} /></div>;
}

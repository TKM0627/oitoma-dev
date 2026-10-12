import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Topic } from '../../domain/content/schema';
import { content } from '../../domain/content/contentRepository';
import { defaultOptions, generateRecipe } from '../../domain/recipe/recipeEngine';
import { targetKey, targetPath } from '../../domain/search/catalogSearch';
import { fileBasename } from '../../domain/workspace/parseTexLog';
import { sourceContext, type WorkspaceResult } from '../../domain/workspace/workspaceEngine';
import { getLogAdvice } from '../../domain/diagnose/diagnosticAdvice';
import { DiagnosticDetails, OpeningLocation } from '../diagnose/DiagnosticDetails';
import { CodeBlock } from '../common/CodeBlock';
import { PackageNotice, ReferenceLinks, RelatedTopics } from '../common/ContentParts';
import { Disclosure } from '../common/Disclosure';
import { SupportReferences } from '../common/SupportReferences';
import { isTexCommandMissing } from '../../domain/workspace/logMessages';

const FormulaPreview = lazy(() => import('../recipe/FormulaPreview').then((module) => ({ default: module.FormulaPreview })));

function KnownExample({ topic, fractionStyle }: { topic: Topic; fractionStyle: string | null }) {
  const [preview, setPreview] = useState(false);
  const recipe = content.recipes.find((recipe) => recipe.topicId === topic.id && topic.recipeIds.includes(recipe.id));
  const generated = recipe ? generateRecipe(recipe, { ...defaultOptions(recipe), ...(recipe.id === 'fraction' && fractionStyle ? { style: fractionStyle } : {}) }) : null;
  return <article className="workspace-answer" aria-labelledby={`answer-${topic.id}`}>
    <p className="small muted">収録済みの説明・コード例</p>
    <h3 id={`answer-${topic.id}`}>{topic.title}</h3>
    <p>{topic.summary}</p>
    <CodeBlock code={generated?.code || topic.examples[0].code} label={`${topic.title}のコード例`} />
    {generated ? <><p className="small">本文用の例です。数式内では外側の区切りを外します。</p>
      <details className="disclosure" onToggle={(event) => { if (event.currentTarget.open) setPreview(true); }}>
        <summary>{topic.title}の数式表示を確認する</summary>
        <div className="disclosure-body">{preview && <Suspense fallback={<p role="status">数式表示を読み込んでいます…</p>}><FormulaPreview formula={generated.formula} displayMode={generated.displayMode} mode={generated.previewMode} /></Suspense>}</div>
      </details></> : <p className="small">利用位置・文書クラスの条件は、<Link to={`/topics/${topic.id}`}>この書き方の解説</Link>で確認してください。</p>}
    <PackageNotice packages={generated?.requiredPackages || topic.requiredPackages} />
    <div className="workspace-links"><Link to={`/topics/${topic.id}`}>詳しい説明を読む →</Link>{recipe && <Link to={`/recipes/${recipe.id}`}>選択肢を変えて試す →</Link>}</div>
    <Disclosure summary={`${topic.title}の出典・参照範囲`}><ReferenceLinks ids={topic.referenceIds} showScope /><p className="small muted">公開資料との照合に基づく試作です。教員の校閲・実際のTeXコンパイル検証は未実施です。</p></Disclosure>
  </article>;
}

function Context({ source, line }: { source: string; line: number }) {
  const context = sourceContext(source, line);
  return context ? <pre className="workspace-context" tabIndex={0} aria-label={`${line}行の周辺コード`}><code>{context}</code></pre> : null;
}

function MoreFindings({ children, count }: { children: ReactNode; count: number }) {
  return <Disclosure summary={`残りの指摘を開く（${count}件）`}>{children}</Disclosure>;
}

function jumpToResult(id: string) {
  const heading = document.getElementById(id);
  heading?.focus(); heading?.scrollIntoView?.({ block: 'start' });
}

export function WorkspaceResults({ result, source, sourceName, current, onJump }: {
  result: WorkspaceResult; source: string; sourceName: string; current: boolean; onJump: (line: number, column?: number) => void;
}) {
  const findings = result.findings.filter((finding) => finding.ruleId !== 'FINDING_LIMIT');
  const limit = result.findings.find((finding) => finding.ruleId === 'FINDING_LIMIT');
  const localCards = findings.map((finding, index) => <li className="workspace-finding" key={`${finding.ruleId}-${index}`}>
    <p className="small muted">簡易チェック · {finding.line}行 {finding.column}列</p><h4>{finding.message}</h4><p>{finding.suggestion}</p>
    <Context source={source} line={finding.line} />
    <button type="button" className="text-button" disabled={!current} onClick={() => onJump(finding.line, finding.column)}>{finding.line}行 {finding.column}列を編集欄で確認</button>
    <OpeningLocation finding={finding} source={source} current={current} onJump={onJump} />
    <DiagnosticDetails finding={finding} />
    <RelatedTopics ids={finding.topicIds} />
  </li>);
  const logCards = result.log.findings.map((finding, index) => <li className="workspace-finding" key={`${finding.logLine}-${index}`}>
    <p className="small muted">{isTexCommandMissing(finding.message) ? '実行環境の報告' : 'コンパイラのログ'} · {finding.severity === 'error' ? 'エラー' : '警告'} · ログの{finding.logLine}行</p><h4>{finding.message}</h4>
    {finding.reportedLine && <p>報告位置：{finding.reportedFile ? `${finding.reportedFile}の` : ''}{finding.reportedLine}行。原因の位置とは限りません。</p>}
    <pre className="workspace-context" tabIndex={0} aria-label={`ログの${finding.logLine}行の報告`}><code>{finding.context}</code></pre>
    <LogChecks message={finding.message} />
    {finding.reportedLine && finding.reportedFile && sourceName && finding.reportedFile === fileBasename(sourceName) && sourceContext(source, finding.reportedLine) && <>
      <Context source={source} line={finding.reportedLine} />
      <button type="button" className="text-button" disabled={!current} onClick={() => onJump(finding.reportedLine!)}>報告された{finding.reportedLine}行を編集欄で確認</button>
    </>}
  </li>);
  return <div className="workspace-results-body">
    <p className="small workspace-result-summary">書き方の候補 {result.totalTopics}件{source.trim() && ` · ソースの指摘 ${findings.length}件 · タイポ候補 ${result.typos.length}件`}{result.hasLog && ` · ログの報告 ${logCards.length}件`}</p>
    <div className="workspace-result-nav" role="group" aria-label="結果内の移動"><button type="button" onClick={() => jumpToResult('workspace-answer-heading')}>書き方・例へ</button>{source.trim() && <button type="button" onClick={() => jumpToResult('workspace-check-heading')}>ソースの指摘へ</button>}{result.hasLog && <button type="button" onClick={() => jumpToResult('workspace-log-heading')}>ログの報告へ</button>}</div>
    <section aria-labelledby="workspace-answer-heading"><h3 id="workspace-answer-heading" tabIndex={-1}>書き方・コピーできる例</h3>
      {result.topics.length ? <><p className="small muted">質問内の用語と、ソースのコマンド・簡易チェックに関連する項目を表示します。{result.totalTopics > 3 && `上位3件／関連${result.totalTopics}件。`}</p>
        <KnownExample topic={result.topics[0]} fractionStyle={result.fractionStyle} />
        {result.topics.length > 1 && <Disclosure summary={`関連する書き方の例（${result.topics.length - 1}件）`}>{result.topics.slice(1).map((topic) => <KnownExample topic={topic} fractionStyle={result.fractionStyle} key={topic.id} />)}</Disclosure>}
      </> : <p>収録済みの用語に合う例が見つかりませんでした。「分数」「等号を揃えたい」など具体的な書き方を入力するか、<Link to="/reference">テーマ別資料</Link>を確認してください。</p>}
    </section>
    {source.trim() && <section aria-labelledby="workspace-check-heading"><h3 id="workspace-check-heading" tabIndex={-1}>ソースの簡易チェック</h3>
      <p role="status">{findings.length ? `${findings.length}件の指摘があります。` : '登録済みの簡易規則では問題を検出しませんでした。'} 文書全体の正しさは保証できません。</p>
      {limit && <p>{limit.message}</p>}
      <ol className="workspace-findings">{localCards.slice(0, 5)}</ol>{localCards.length > 5 && <MoreFindings count={localCards.length - 5}><ol className="workspace-findings" start={6}>{localCards.slice(5)}</ol></MoreFindings>}
      <p className="small muted">基本5規則と数式内の空行を確認します。独自マクロ・外部ファイル・動的な構文以降は省略する場合があります。</p>
      {result.typos.length > 0 && <><h4>コマンドのタイポ候補</h4><p className="small">よくある綴り違いに一致した候補です。独自定義やパッケージで有効な場合があるため、置換を断定せず、自動修正もしません。</p><ul className="workspace-findings">{result.typos.map((typo, index) => <li className="workspace-finding" key={`${typo.line}-${index}`}><p><code>{typo.command}</code> は <code>{typo.replacement}</code> の書き間違いかもしれません。</p><Context source={source} line={typo.line} /><button type="button" className="text-button" disabled={!current} onClick={() => onJump(typo.line, typo.column)}>{typo.line}行 {typo.column}列を編集欄で確認</button></li>)}</ul></>}
      {result.typosLimited && <p>タイポ候補は先頭50件までです。短い範囲に分けて確認してください。</p>}
      {result.dynamic && <p className="small">動的なコマンド構文があるため、タイポ候補の照合を省略しました。</p>}
    </section>}
    {result.hasLog && <section aria-labelledby="workspace-log-heading"><h3 id="workspace-log-heading" tabIndex={-1}>ログに記録されたエラー・警告</h3>
      <p>{logCards.length ? `${logCards.length}件の報告を読み取りました。` : '読み取り対象の形式では、エラー・警告を見つけませんでした。'}</p>
      <p className="small muted">これは読み込んだログの報告です。このアプリでコンパイルした結果ではありません。ソースの版や別ファイルを確認してください。</p>
      <ol className="workspace-findings">{logCards.slice(0, 5)}</ol>{logCards.length > 5 && <MoreFindings count={logCards.length - 5}><ol className="workspace-findings" start={6}>{logCards.slice(5)}</ol></MoreFindings>}
      {result.log.limited && <p>ログの表示は先頭100件までです。</p>}
    </section>}
    {result.related.length > 0 && <aside className="workspace-related" aria-label="続けて調べる"><h3>続けて調べる</h3><ul>{result.related.map((entry) => <li key={targetKey(entry)}><Link to={targetPath(entry)}>{entry.title} →</Link></li>)}</ul></aside>}
  </div>;
}

function LogChecks({ message }: { message: string }) {
  const advice = getLogAdvice(message);
  return advice ? <Disclosure summary="この報告の確認手順"><div className="diagnostic-log-advice">
    <p><b>{advice.title}</b></p><ol>{advice.checks.map((check) => <li key={check}>{check}</li>)}</ol>
    {advice.example && <><p className="small">{advice.example.usage} 入力を修正した全文ではありません。</p><CodeBlock code={advice.example.code} label="ログの説明用コード例" /></>}
    <p className="small muted">一般的な手順です。原因は未確定です。</p>
    <RelatedTopics ids={advice.topicIds} /><Disclosure summary="確認手順の出典"><SupportReferences ids={advice.referenceIds} /></Disclosure>
  </div></Disclosure> : <p className="small muted">このメッセージに対応する確認手順は未収録です。周辺のログと利用環境を確認してください。</p>;
}

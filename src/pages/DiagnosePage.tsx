import { textInputError } from '../domain/security/textInput';
import { EnvironmentGuide } from '../components/common/EnvironmentGuide';
import { useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { content } from '../domain/content/contentRepository';
import { diagnose, MAX_CODE_LENGTH, type Finding } from '../domain/diagnose/diagnosisEngine';
import { PageHeading, RelatedTopics } from '../components/common/ContentParts';
import { readRecipeTransfer } from '../domain/recipe/recipeTransfer';

import { Disclosure } from '../components/common/Disclosure';
import { DiagnosticDetails, OpeningLocation, SourceContext } from '../components/diagnose/DiagnosticDetails';
import { sourceOffset } from '../domain/diagnose/sourceLocation';

const severityLabels = { error: 'エラー', warning: '注意', hint: 'ヒント' };
function FindingCard({ finding, source, current, onJump }: { finding: Finding; source: string; current: boolean; onJump: (line: number, column?: number) => void }) {
  return <li className={`finding ${finding.severity}`}><div><span className="severity">{severityLabels[finding.severity]}</span><code>{finding.line}行 {finding.column}列</code></div>
    <h3>{finding.message}</h3><p>{finding.suggestion}</p>
    <SourceContext source={source} line={finding.line} />
    <button type="button" className="text-button" disabled={!current} onClick={() => onJump(finding.line, finding.column)}>{finding.line}行 {finding.column}列を編集欄で確認</button>
    <OpeningLocation finding={finding} source={source} current={current} onJump={onJump} />
    <DiagnosticDetails finding={finding} /><code className="rule-id">{finding.ruleId}</code><RelatedTopics ids={finding.topicIds} />
    {content.errorCases.filter((error) => error.ruleId === finding.ruleId).map((error) => <Link key={error.id} className="text-button" to={`/errors/${error.id}`}>原因と修正例を比較 →</Link>)}
  </li>;
}

function DiagnoseEditor({ initialCode }: { initialCode: string }) {
  const [source, setSource] = useState(initialCode);
  const editor = useRef<HTMLTextAreaElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [checkedSource, setCheckedSource] = useState<string | null>(null);
  const displayedFindings = findings?.filter((finding) => finding.ruleId !== 'FINDING_LIMIT') || [];
  const limit = findings?.find((finding) => finding.ruleId === 'FINDING_LIMIT');
  const current = checkedSource === source;
  const inputError = textInputError(source, MAX_CODE_LENGTH);
  function run() { if (inputError) return; setFindings(diagnose(source)); setCheckedSource(source); resultHeading.current?.focus(); resultHeading.current?.scrollIntoView?.({ block: 'start' }); }
  function jump(line: number, column = 1) {
    if (!current) return;
    const offset = sourceOffset(editor.current?.value || source, line, column);
    if (offset === null || !editor.current) return;
    editor.current.focus(); editor.current.setSelectionRange(offset, Math.min(offset + 1, source.length)); editor.current.scrollIntoView?.({ block: 'center' });
  }
  function loadSample(code: string) { setSource(code); setFindings(null); setCheckedSource(null); }
  return <><div className="privacy-notice"><span aria-hidden="true">◉</span><div><b>入力コードは、この画面のメモリ上だけで扱います。</b><p>サーバー・学内LLMへ送信せず、自動保存もしません。画面を離れると入力は失われます。</p></div></div><div className="diagnose-grid"><section className="editor-panel"><div className="section-heading"><h2><label htmlFor="diagnose-code">LaTeXの断片を貼り付ける</label></h2><span className="small muted">{source.length.toLocaleString()} / 10,000文字</span></div><textarea ref={editor} id="diagnose-code" maxLength={MAX_CODE_LENGTH} value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} autoComplete="off" aria-describedby="diagnose-scope" placeholder={'例：x_1\n\\frac{a}{b'} /><p className="small muted" id="diagnose-scope">波括弧・環境・数式外の添字・数式区切りの5規則と数式内の空行を確認します。独自マクロや文書全体の正しさは検証できません。</p>{inputError && <p role="alert">{inputError}</p>}<div className="editor-actions"><button className="button" disabled={!source.trim() || Boolean(inputError)} onClick={run}>診断する <span aria-hidden="true">→</span></button><button className="text-button" disabled={!source} onClick={() => loadSample('')}>入力をクリア</button></div><details className="sample-picker"><summary>例を読み込んで試す（入力を置き換えます）</summary><div className="sample-buttons"><button onClick={() => loadSample('x_1')}>数式の外の添字</button><button onClick={() => loadSample('$x_1$')}>数式で囲んだ添字</button>{content.errorCases.filter((error) => !error.id.startsWith('outside-')).map((error) => <button key={error.id} onClick={() => loadSample(error.badExample)}>{error.title}</button>)}</div></details></section><section className="diagnosis-results" aria-labelledby="diagnosis-heading"><div className="section-heading"><h2 ref={resultHeading} tabIndex={-1} id="diagnosis-heading">診断結果</h2><span className="small muted">簡易チェック</span></div>{findings === null ? <div className="diagnostic-empty"><span aria-hidden="true">{ '{ }' }</span><p>コードを入力して「診断する」を押すと、<br />原因と確認ポイントを表示します。</p></div> : <><div role="status" aria-label="診断の要約" className={`diagnostic-summary ${current && findings.length === 0 ? 'clear' : ''}`}>{!current ? '入力が変更されました。再診断してください。下の結果は変更前のものです。' : findings.length ? `${findings.filter((finding) => finding.severity === 'error').length}件のエラー・${findings.filter((finding) => finding.severity === 'warning').length}件の注意・${findings.filter((finding) => finding.severity === 'hint').length}件のヒント` : '登録済みの簡易規則では問題を検出しませんでした。'}<p>LaTeXとして完全に正しいことを保証する結果ではありません。</p>{limit && <p>{limit.message}</p>}</div><ol className="finding-list">{displayedFindings.slice(0, 3).map((finding, index) => <FindingCard finding={finding} source={checkedSource || ''} current={current} onJump={jump} key={`${finding.ruleId}-${index}`} />)}</ol>{displayedFindings.length > 3 && <Disclosure key={checkedSource} summary={`残りの指摘を開く（${displayedFindings.length - 3}件）`}><p className="small">入力位置の順に表示しています。先頭から修正し、再診断して確認してください。</p><ol className="finding-list" start={4}>{displayedFindings.slice(3).map((finding, index) => <FindingCard finding={finding} source={checkedSource || ''} current={current} onJump={jump} key={`${finding.ruleId}-${index + 3}`} />)}</ol></Disclosure>}</>}</section></div></>;
}
export function DiagnosePage() {
  const { state } = useLocation();
  const [params] = useSearchParams();
  const error = content.errorCases.find((error) => error.id === params.get('case'));
  const initialCode = error?.badExample || readRecipeTransfer(state) || '';
  return <div className="page"><PageHeading title="LaTeXコードの簡易診断" description="短いコードの基本的なミスを確認します。入力は書き換えず、修正の手がかりを示します。" /><EnvironmentGuide /><DiagnoseEditor key={initialCode} initialCode={initialCode} /></div>;
}

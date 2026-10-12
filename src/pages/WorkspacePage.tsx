import { useEffect, useRef, useState } from 'react';
import { PageHeading } from '../components/common/ContentParts';
import { EnvironmentGuide } from '../components/common/EnvironmentGuide';
import { WorkspaceResults } from '../components/workspace/WorkspaceResults';
import { MAX_CODE_LENGTH } from '../domain/diagnose/diagnosisEngine';
import { readLocalFile, MAX_LOG_LENGTH, type FileEncoding, type InputKind } from '../domain/workspace/readLocalFile';
import { checkWorkspace, MAX_QUESTION_LENGTH, sourceOffset, type WorkspaceResult } from '../domain/workspace/workspaceEngine';
import '../styles/workspace.css';
import { textInputError } from '../domain/security/textInput';

type Snapshot = { id: number; question: string; source: string; log: string; sourceName: string; result: WorkspaceResult };

export function WorkspacePage() {
  const [question, setQuestion] = useState('');
  const [source, setSource] = useState('');
  const [log, setLog] = useState('');
  const [names, setNames] = useState({ tex: '', log: '' });
  const [encoding, setEncoding] = useState<FileEncoding>('utf-8');
  const [errors, setErrors] = useState({ tex: '', log: '' });
  const [reading, setReading] = useState({ tex: false, log: false });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [formError, setFormError] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const request = useRef({ tex: 0, log: 0 });
  const revision = useRef(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  const sourceDetails = useRef<HTMLDetailsElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const inputError = textInputError(question, MAX_QUESTION_LENGTH) || textInputError(source, MAX_CODE_LENGTH) || textInputError(log, MAX_LOG_LENGTH);
  const current = snapshot?.question === question && snapshot.source === source && snapshot.log === log && snapshot.sourceName === names.tex;
  useEffect(() => () => { request.current.tex++; request.current.log++; }, []);
  useEffect(() => { if (snapshot) { resultsHeading.current?.focus(); resultsHeading.current?.scrollIntoView?.({ block: 'start' }); } }, [snapshot]);
  async function load(file: File | undefined, kind: InputKind) {
    if (!file) return;
    const id = ++request.current[kind];
    setReading((value) => ({ ...value, [kind]: true }));
    setErrors((value) => ({ ...value, [kind]: '' }));
    try {
      const text = await readLocalFile(file, kind, encoding);
      if (request.current[kind] !== id) return;
      if (kind === 'tex') setSource(text); else setLog(text);
      setNames((value) => ({ ...value, [kind]: file.name }));
    } catch (error) {
      if (request.current[kind] === id) setErrors((value) => ({ ...value, [kind]: error instanceof Error ? error.message : 'ファイルを読み込めませんでした。' }));
    } finally { if (request.current[kind] === id) setReading((value) => ({ ...value, [kind]: false })); }
  }
  function edit(text: string, kind: InputKind) {
    request.current[kind]++;
    setReading((value) => ({ ...value, [kind]: false }));
    setErrors((value) => ({ ...value, [kind]: '' }));
    if (kind === 'tex') setSource(text); else setLog(text);
  }
  function clear() {
    request.current.tex++; request.current.log++;
    setQuestion(''); setSource(''); setLog(''); setNames({ tex: '', log: '' }); setErrors({ tex: '', log: '' });
    setReading({ tex: false, log: false }); setSnapshot(null); setFormError(''); setInputKey((value) => value + 1);
  }
  function run() {
    if (inputError || reading.tex || reading.log || ![question, source, log].some((value) => value.trim())) return;
    try { setSnapshot({ id: ++revision.current, question, source, log, sourceName: names.tex, result: checkWorkspace(question, source, log) }); setFormError(''); }
    catch { setFormError('入力の上限を確認してください。ソースは10,000文字、質問は500文字、ログは100,000文字までです。'); }
  }
  function jump(line: number, column = 1) {
    // textareaの値はCRLFをLFへ正規化するため、選択位置は表示側から求める。
    const offset = sourceOffset(editor.current?.value || source, line, column);
    if (offset === null || !current) return;
    if (sourceDetails.current) sourceDetails.current.open = true;
    editor.current?.focus(); editor.current?.setSelectionRange(offset, offset);
    editor.current?.scrollIntoView?.({ block: 'center' });
  }
  return <div className="page workspace-page">
    <PageHeading title="質問とTeXをまとめて確認" description="書き方の例と、TeX・ログのエラーを確認できます。" />
    <EnvironmentGuide />
    <form className="workspace-form" onSubmit={(event) => { event.preventDefault(); run(); }}>
      <label htmlFor="workspace-question" className="sr-only">LaTeXで何がしたい・何が知りたいですか？</label>
      <textarea id="workspace-question" rows={3} maxLength={MAX_QUESTION_LENGTH} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例：分数を大きくしたい／等号を揃える方法を知りたい" autoComplete="off" spellCheck={false} aria-describedby="workspace-question-help" />
      <p id="workspace-question-help" className="small muted">質問・TeX・ログのいずれかだけでも使えます。</p>
      <section className="workspace-input-section" aria-label="TeXソース">
        <label htmlFor="workspace-tex-file">TeXファイルを選ぶ（.tex）</label>
        <input key={`tex-${inputKey}`} id="workspace-tex-file" type="file" accept=".tex" aria-describedby="workspace-source-help" onChange={(event) => void load(event.target.files?.[0], 'tex')} />
        {(reading.tex || names.tex) && <p className="small" role="status">{reading.tex ? '読み込んでいます…' : `読み込み済み：${names.tex}`}</p>}
        {errors.tex && <p role="alert">{errors.tex} 既存の入力は保持しています。</p>}
        <details ref={sourceDetails} className="disclosure"><summary>TeXを貼り付け・編集</summary><div className="disclosure-body">
          <label htmlFor="workspace-source">確認するLaTeXソース</label><textarea id="workspace-source" ref={editor} rows={9} maxLength={MAX_CODE_LENGTH} value={source} onChange={(event) => edit(event.target.value, 'tex')} autoComplete="off" spellCheck={false} />
          <p id="workspace-source-help" className="small muted">{source.length.toLocaleString()} / 10,000文字（ファイルは64KiBまで）。文書全体の完全な検証は行いません。</p>
        </div></details>
        <details className="disclosure"><summary>文字コードの設定</summary><div className="disclosure-body">
          <label htmlFor="workspace-encoding">ファイルの文字コード</label><select id="workspace-encoding" value={encoding} onChange={(event) => { request.current.tex++; request.current.log++; setReading({ tex: false, log: false }); setEncoding(event.target.value as FileEncoding); }}><option value="utf-8">UTF-8</option><option value="shift_jis">Shift_JIS</option></select>
          <p className="small muted">次に選ぶファイルに適用します。</p>
        </div></details>
      </section>
      <details className="disclosure workspace-log-input"><summary>ログを追加</summary><div className="disclosure-body">
        <label htmlFor="workspace-log-file">ログファイルを選ぶ（.log）</label><input key={`log-${inputKey}`} id="workspace-log-file" type="file" accept=".log" onChange={(event) => void load(event.target.files?.[0], 'log')} />
        {(reading.log || names.log) && <p className="small" role="status">{reading.log ? '読み込んでいます…' : `読み込み済み：${names.log}`}</p>}
        {errors.log && <p role="alert">{errors.log} 既存の入力は保持しています。</p>}
        <label htmlFor="workspace-log">ログを貼り付ける・編集する</label><textarea id="workspace-log" rows={6} maxLength={MAX_LOG_LENGTH} value={log} onChange={(event) => edit(event.target.value, 'log')} autoComplete="off" spellCheck={false} />
        <p className="small muted">{log.length.toLocaleString()} / 100,000文字（ファイルは256KiBまで）。</p>
      </div></details>
      <div className="workspace-actions"><button type="submit" className="button" disabled={Boolean(inputError) || reading.tex || reading.log || ![question, source, log].some((value) => value.trim())}>確認する</button>{(question || source || log || reading.tex || reading.log || snapshot) && <button type="button" className="text-button" onClick={clear}>クリア</button>}</div>
      <p className="small muted">登録済みの例と簡易チェックを使います。入力は外部送信・保存しません。</p>
      {(inputError || formError) && <p role="alert">{inputError || formError}</p>}
    </form>
    {snapshot && <section className="workspace-results" aria-labelledby="workspace-results-heading"><h2 id="workspace-results-heading" ref={resultsHeading} tabIndex={-1}>確認結果</h2>
      {!current && <p className="workspace-stale" role="status">入力が変わりました。下の結果は変更前のものです。「確認する」で再確認してください。</p>}
      <WorkspaceResults key={snapshot.id} result={snapshot.result} source={snapshot.source} sourceName={snapshot.sourceName} current={current} onJump={jump} />
    </section>}
  </div>;
}

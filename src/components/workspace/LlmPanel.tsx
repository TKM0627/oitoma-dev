import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudy } from '../../app/studyContext';
import { LLM_API, LLM_HEADER, LLM_QUESTION_LIMIT, LLM_SOURCE_LIMIT, LLM_LOG_LIMIT, parseLlmAnswer, parseLlmRequest, parseLlmStatus, readLlmJson, type LlmAnswer, type LlmRequest, type LlmStatus } from '../../ai/llmProtocol';
import { content } from '../../domain/content/contentRepository';
import { createSearchCatalog, targetKey, targetPath } from '../../domain/search/catalogSearch';
import { referenceIndex } from '../../domain/search/referenceSearchIndex';
import { textInputError } from '../../domain/security/textInput';
import { readLocalFile, type FileEncoding, type InputKind } from '../../domain/workspace/readLocalFile';
import { CodeBlock, CopyButton } from '../common/CodeBlock';
import { PageHeading, ReferenceLinks } from '../common/ContentParts';
import '../../styles/llm.css';

const catalog = createSearchCatalog(content, referenceIndex);
const kindLabels = { topic: '解説', recipe: '試す', error: '直す', reference: 'テーマ別資料', guide: '日本語文書', course: '学ぶ' };
class ApiFailure extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
async function call(path: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(LLM_API + path, { method: body === undefined ? 'GET' : 'POST', signal,
    headers: { [LLM_HEADER]: '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
  const data = await readLlmJson(response);
  if (!response.ok) {
    const error = (data as { error?: unknown })?.error;
    throw new ApiFailure(response.status, typeof error === 'string' && !textInputError(error, 400) ? error : '回答を取得できませんでした。');
  }
  return data;
}
function sameInput(a: LlmRequest, b: LlmRequest) {
  return a.question === b.question && a.source === b.source && a.log === b.log && a.environment === b.environment;
}

export default function LlmPanel() {
  const { environment } = useStudy();
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [question, setQuestion] = useState('');
  const [source, setSource] = useState('');
  const [log, setLog] = useState('');
  const [names, setNames] = useState({ tex: '', log: '' });
  const [encoding, setEncoding] = useState<FileEncoding>('utf-8');
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ input: LlmRequest; answer: LlmAnswer } | null>(null);
  const pending = useRef<AbortController | null>(null);
  const revision = useRef({ value: 0 });
  const picker = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const input: LlmRequest = { question, source, log, environment };
  const inputError = textInputError(question, LLM_QUESTION_LIMIT) || textInputError(source, LLM_SOURCE_LIMIT) || textInputError(log, LLM_LOG_LIMIT);
  useEffect(() => { if (result) { resultHeading.current?.focus(); resultHeading.current?.scrollIntoView?.({ block: 'start' }); } }, [result]);
  useEffect(() => {
    let current = true;
    const sequence = revision.current;
    let controller: AbortController | null = null;
    function applyAccess(access: LlmStatus) {
      setStatus(access);
      if (access.connection !== 'available') {
        sequence.value++; pending.current?.abort();
        setQuestion(''); setSource(''); setLog(''); setNames({ tex: '', log: '' }); setResult(null); setReading(false); setError('');
      }
    }
    async function refresh() {
      controller?.abort();
      const requestController = new AbortController(); controller = requestController;
      const signal = requestController.signal;
      const timer = setTimeout(() => requestController.abort(), 8_000);
      try {
        const access = parseLlmStatus(await call('/status', signal));
        if (!current || signal.aborted) return;
        applyAccess(access);
      } catch { if (current && !signal.aborted) applyAccess({ configured: true, model: '', connection: 'unavailable' }); }
      finally { clearTimeout(timer); if (current && signal.aborted && controller?.signal === signal) applyAccess({ configured: true, model: '', connection: 'unavailable' }); }
    }
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh(); document.addEventListener('visibilitychange', visible);
    return () => { current = false; controller?.abort(); pending.current?.abort(); sequence.value++; document.removeEventListener('visibilitychange', visible); };
  }, []);

  async function attach(files: File[]) {
    if (!files.length || busy || reading) return;
    const id = ++revision.current.value;
    setReading(true); setError('');
    try {
      const seen = new Set<InputKind>();
      const selected: { kind: InputKind; text: string; name: string }[] = [];
      if (files.length > 2) throw new Error('TeXとログは各1ファイルまで添付できます。');
      for (const file of files) {
        const kind = file.name.toLowerCase().endsWith('.tex') ? 'tex' : file.name.toLowerCase().endsWith('.log') ? 'log' : null;
        if (!kind || seen.has(kind)) throw new Error('.texと.logを各1ファイルまで選んでください。');
        seen.add(kind);
        const text = await readLocalFile(file, kind, encoding);
        const problem = textInputError(text, kind === 'tex' ? LLM_SOURCE_LIMIT : LLM_LOG_LIMIT);
        if (problem) throw new Error(problem);
        selected.push({ kind, text, name: file.name });
      }
      if (id !== revision.current.value) return;
      for (const item of selected) {
        if (item.kind === 'tex') setSource(item.text); else setLog(item.text);
        setNames((value) => ({ ...value, [item.kind]: item.name }));
      }
    } catch (failure) { if (id === revision.current.value) setError(failure instanceof Error ? failure.message : '添付を読み込めませんでした。'); }
    finally { if (id === revision.current.value) setReading(false); if (picker.current) picker.current.value = ''; }
  }
  function clear() {
    revision.current.value++; pending.current?.abort();
    setQuestion(''); setSource(''); setLog(''); setNames({ tex: '', log: '' }); setReading(false); setResult(null); setError('');
  }
  async function send() {
    if (busy || reading || inputError || status?.connection !== 'available') return;
    let request: LlmRequest;
    try { request = parseLlmRequest(input); } catch { return; }
    const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 65_000);
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await call('/answer', controller.signal, request);
      if (!controller.signal.aborted) setResult({ input: request, answer: parseLlmAnswer(data, catalog, content.references.map((ref) => ref.id)) });
    } catch (failure) {
      if (failure instanceof ApiFailure && [401, 403, 503].includes(failure.status)) {
        setStatus({ configured: true, model: '', connection: failure.status === 401 ? 'authentication-required' : 'unavailable' });
        setQuestion(''); setSource(''); setLog(''); setNames({ tex: '', log: '' }); setResult(null);
      }
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '回答を取得できませんでした。');
      else setError('回答待ちを中止しました。');
    } finally { clearTimeout(timer); pending.current = null; setBusy(false); }
  }
  return <div className="page llm-page">
    <PageHeading title="LaTeXについて質問" />
    {!status ? <p role="status">学内AIを読み込んでいます…</p> : status.connection !== 'available' ? <section className="llm-unavailable">
      <h2>学内AIを利用できません</h2><p>{!status.configured ? '開発サーバーにAPIキーとモデルIDを設定してください。' : status.connection === 'authentication-required' ? 'APIキー・学内AIの利用権限を確認してください。' : '学内ネットワークとAPIの利用設定を確認してから、このページを再読み込みしてください。'}</p>
      <Link to="/search">書き方を探す →</Link>
    </section> : <>
      <form className="llm-composer" onSubmit={(event) => { event.preventDefault(); void send(); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void attach(Array.from(event.dataTransfer.files)); }}>
        <label htmlFor="llm-question" className="sr-only">質問・したいこと</label>
        <textarea id="llm-question" rows={4} value={question} maxLength={LLM_QUESTION_LIMIT} onChange={(event) => setQuestion(event.target.value)} placeholder="したいこと、困っていること（例：分数を大きくしたい）" autoComplete="off" spellCheck={false} aria-describedby="llm-privacy" />
        <input ref={picker} className="llm-file-input" id="llm-files" type="file" multiple accept=".tex,.log" aria-label="TeX・ログを添付" onChange={(event) => void attach(Array.from(event.target.files || []))} />
        {(source || log) && <div className="llm-attachments">{(['tex', 'log'] as const).map((kind) => {
          const text = kind === 'tex' ? source : log;
          return text && <span key={kind}>{names[kind] || (kind === 'tex' ? '貼り付けたTeX' : '貼り付けたログ')} <button type="button" aria-label={`${kind === 'tex' ? 'TeX' : 'ログ'}の添付を外す`} disabled={busy || reading} onClick={() => { if (kind === 'tex') setSource(''); else setLog(''); setNames((value) => ({ ...value, [kind]: '' })); }}>×</button></span>;
        })}</div>}
        <div className="llm-actions"><button type="button" onClick={() => picker.current?.click()} disabled={busy || reading}>ファイルを添付</button>{(question || source || log || reading || result) && <button type="button" className="text-button" onClick={clear}>クリア</button>}{busy && <button type="button" onClick={() => pending.current?.abort()}>中止</button>}<button type="submit" className="llm-submit" disabled={busy || reading || Boolean(inputError) || ![question, source, log].some((value) => value.trim())}>送信</button></div>
        <p id="llm-privacy" className="small muted">入力・添付は学内LLMへ送信します（アプリは保存しません）。個人情報・学内限定資料は含めないでください。</p>
        <details className="disclosure"><summary>TeX・ログを貼り付ける</summary><div className="llm-paste">
          <label htmlFor="llm-source">TeXソース</label><textarea id="llm-source" rows={6} value={source} maxLength={LLM_SOURCE_LIMIT} disabled={reading || busy} onChange={(event) => { setSource(event.target.value); setNames((value) => ({ ...value, tex: '' })); }} autoComplete="off" spellCheck={false} />
          <label htmlFor="llm-log">エラーログ</label><textarea id="llm-log" rows={4} value={log} maxLength={LLM_LOG_LIMIT} disabled={reading || busy} onChange={(event) => { setLog(event.target.value); setNames((value) => ({ ...value, log: '' })); }} autoComplete="off" spellCheck={false} />
        </div><details><summary>添付の設定・上限</summary><div><label htmlFor="llm-encoding">文字コード</label> <select id="llm-encoding" value={encoding} disabled={reading || busy} onChange={(event) => setEncoding(event.target.value as FileEncoding)}><option value="utf-8">UTF-8</option><option value="shift_jis">Shift_JIS</option></select><p className="small muted">.tex・.logを各1件添付・ドロップできます。質問2,000文字、TeX10,000文字、ログ4,000文字まで。</p></div></details></details>
        {(reading || busy) && <p role="status">{reading ? '添付を読み込んでいます…' : '回答を待っています…'}</p>}
        {(inputError || error) && <p role="alert">{inputError || error}</p>}
      </form>
      {result && <article className="llm-result" aria-labelledby="llm-result-heading">
        <div className="llm-result-header"><h2 id="llm-result-heading" ref={resultHeading} tabIndex={-1}>回答</h2><CopyButton code={result.answer.answer} label="回答をコピー" /></div>
        {!sameInput(result.input, input) && <p className="small muted">変更前の入力への回答です。</p>}
        <p className="llm-answer">{result.answer.answer}</p>
        {result.answer.latex && <CodeBlock code={result.answer.latex} label="LaTeXコード" copyLabel="コードをコピー" />}
        {!!result.answer.cautions.length && <ul>{result.answer.cautions.map((caution, index) => <li key={index}>{caution}</li>)}</ul>}
        {!!(result.answer.related.length || result.answer.referenceIds.length) && <details className="disclosure"><summary>関連資料・試せる例</summary>{!!result.answer.related.length && <ul>{result.answer.related.map((target) => <li key={targetKey(target)}><Link to={targetPath(target)}>{kindLabels[target.kind]}：{catalog.find((entry) => targetKey(entry) === targetKey(target))!.title}</Link></li>)}</ul>}{!!result.answer.referenceIds.length && <ReferenceLinks ids={result.answer.referenceIds} showScope />}</details>}
        <p className="small muted">LLMの回答です。コードは未コンパイルです。</p>
      </article>}
    </>}
  </div>;
}

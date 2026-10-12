import { useState } from 'react';
import type { Finding } from '../../domain/diagnose/diagnosisEngine';
import { diagnosticAdvice } from '../../domain/diagnose/diagnosticAdvice';
import { sourceContext } from '../../domain/diagnose/sourceLocation';
import { CodeBlock } from '../common/CodeBlock';
import { PackageNotice, ReferenceLinks } from '../common/ContentParts';
import { Disclosure } from '../common/Disclosure';
import '../../styles/diagnosis.css';

export function SourceContext({ source, line }: { source: string; line: number }) {
  const context = sourceContext(source, line);
  return context ? <pre className="source-context" tabIndex={0} aria-label={`${line}行の周辺コード`}><code>{context}</code></pre> : null;
}

export function OpeningLocation({ finding, source, current, onJump }: {
  finding: Finding; source: string; current: boolean; onJump: (line: number, column?: number) => void;
}) {
  const location = finding.relatedLocation;
  return location ? <div className="diagnostic-opening"><p className="small">{location.label}：{location.line}行 {location.column}列</p>
    <SourceContext source={source} line={location.line} />
    <button type="button" className="text-button" disabled={!current} onClick={() => onJump(location.line, location.column)}>開始の{location.line}行 {location.column}列を編集欄で確認</button>
  </div> : null;
}

export function DiagnosticDetails({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const advice = Object.hasOwn(diagnosticAdvice, finding.ruleId) ? diagnosticAdvice[finding.ruleId] : undefined;
  return advice ? <details className="disclosure" onToggle={(event) => setOpen(event.currentTarget.open)}><summary>修正例と確認手順</summary><div className="disclosure-body">{open && <>
    <p>{advice.explanation}</p>
    {finding.expected && <p>この開始に対応する終了：<code>{finding.expected}</code>。追加・変更する位置は文脈と合わせて確認してください。</p>}
    <p className="small muted">説明用の例です。入力全体を修正したコードではありません。</p>
    <pre className="source-context" tabIndex={0} aria-label="間違いの例"><code>{advice.before}</code></pre>
    <CodeBlock code={advice.after} label="修正例" />
    <PackageNotice packages={advice.packages} />
    <Disclosure summary="出典・検証状況"><ReferenceLinks ids={advice.referenceIds} showScope />
      <p className="small muted">資料照合済みの試作です。教員校閲・実TeX検証は未実施です。</p>
    </Disclosure>
  </>}</div></details> : null;
}

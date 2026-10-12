import { useState } from 'react';

export function CopyButton({ code, label = 'コードをコピー', text }: { code: string; label?: string; text?: string }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage('コピーしました');
    } catch { setMessage('コピーできませんでした。表示内容を選択してコピーしてください。'); }
  }
  return <div className="copy-controls"><button type="button" className="copy-button" onClick={() => void copy()} aria-label={label}>{text ?? (label === 'コードをコピー' ? 'コピー' : label)} <span aria-hidden="true">⧉</span></button><span role="status" className="small">{message}</span></div>;
}

export function CodeBlock({ code, label = 'LaTeXコード', copyLabel }: { code: string; label?: string; copyLabel?: string }) {
  return <div className="code-block"><div className="code-toolbar"><span>{label}</span><CopyButton key={code} code={code} label={copyLabel} text={copyLabel ? 'コピー' : undefined} /></div><pre tabIndex={0} aria-label={label}><code>{code}</code></pre></div>;
}

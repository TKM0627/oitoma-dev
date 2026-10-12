import '../../styles/formula.css';
import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function FormulaPreview({ formula, displayMode, mode = 'katex' }: { formula: string; displayMode: boolean; mode?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.replaceChildren();
    if (mode !== 'katex') { node.textContent = 'プレビュー対象外です。LaTeXとして不正という意味ではありません。'; return; }
    try {
      katex.render(formula, node, { displayMode, trust: false, maxExpand: 200, maxSize: 10, throwOnError: true, strict: 'error', output: 'htmlAndMathml' });
    } catch { node.textContent = 'この式はKaTeXでプレビューできません。LaTeXとしての正しさはTeXコンパイラで確認してください。'; }
  }, [formula, displayMode, mode]);
  return <div className="formula-preview" role="region" aria-label="数式プレビュー"><span className="preview-label">表示のプレビュー</span><div className="formula-output" ref={ref} /><p className="small muted">KaTeXによる表示です。文書のコンパイル結果とは異なる場合があります。</p></div>;
}

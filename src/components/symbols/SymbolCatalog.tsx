import { useId, useRef, useState } from 'react';
import rawGroups from '../../data/symbol_catalog.json';
import type { SymbolGroup } from '../../domain/symbols/validateSymbolCatalog';
import { filterSymbols } from '../../domain/symbols/symbolCatalog';
import { CopyButton } from '../common/CodeBlock';
import { ReferenceLinks } from '../common/ContentParts';
import '../../styles/symbols.css';
import { textInputError } from '../../domain/security/textInput';

// ビルド検証済みの同梱データ。
const groups = rawGroups as SymbolGroup[];
const total = groups.reduce((count, group) => count + group.entries.length, 0);

export default function SymbolCatalog() {
  const id = useId();
  const [query, setQuery] = useState('');
  const groupsRef = useRef<HTMLDivElement>(null);
  const inputError = textInputError(query, 100);
  const filtered = inputError ? [] : filterSymbols(groups, query);
  const count = filtered.reduce((sum, group) => sum + group.entries.length, 0);
  function expand(open: boolean) {
    groupsRef.current?.querySelectorAll('details').forEach((detail) => { detail.open = open; });
  }
  return <section className="symbol-catalog" aria-label="ギリシャ文字・記号一覧">
    <p>数式モード内で使う{total}種類の早見表です。ここに収録した記号に追加パッケージは不要です。コピーするのはコマンド・文字だけなので、本文では <code>$ … $</code> などで囲んでください。</p>
    <p className="small muted">形はUnicode文字による目安です。実際のTeXの字形・傾きはフォントや数式設定で変わります。網羅的な一覧ではありません。</p>
    <div className="symbol-tools">
      <label htmlFor={id}>一覧の中で探す（名前・記号・コマンド）</label>
      <input id={id} type="search" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：シータ、theta、≤" autoComplete="off" spellCheck={false} aria-describedby={`${id}-privacy`} aria-invalid={Boolean(inputError)} />
      <p id={`${id}-privacy`} className="small muted">絞り込みはこの画面内だけ。検索語を保存・送信したり、URLに含めたりしません。</p>
      {inputError && <p role="alert">{inputError}</p>}<div className="symbol-actions"><button type="button" onClick={() => expand(true)}>すべての分類を開く</button><button type="button" onClick={() => expand(false)}>すべての分類を閉じる</button>{query && <button type="button" onClick={() => setQuery('')}>絞り込みを解除</button>}</div>
      <p role="status" className="small">{count} / {total}種類{query && ' · 一致する分類を開いて表示しています'}</p>
    </div>
    {count === 0 && <p>一致する記号がありません。短い名前や英語名で探すか、絞り込みを解除してください。</p>}
    <div ref={groupsRef}>{filtered.map((group) => <details className="symbol-group" key={`${group.id}-${query}`} open={Boolean(query.trim())}>
      <summary>{group.title}（{group.entries.length}種類）</summary>
      <div className="symbol-group-body"><p className="small">{group.description}</p>
        <table><caption className="symbol-print-title">{group.title}のコマンド</caption><thead><tr><th scope="col">形</th><th scope="col">名前・書き方</th><th scope="col"><span className="sr-only">操作</span></th></tr></thead><tbody>
          {group.entries.map((entry) => <tr key={entry.id}><td className="symbol-glyph">{entry.glyph}</td><td><span>{entry.name}</span><code>{entry.code}</code></td><td><CopyButton code={entry.code} label={`${entry.code}をコピー`} text="コピー" /></td></tr>)}
        </tbody></table>
      </div>
    </details>)}</div>
    <details className="disclosure"><summary>記号一覧の出典と参照範囲</summary><div className="disclosure-body"><ReferenceLinks ids={[...new Set(groups.flatMap((group) => group.referenceIds))]} showScope /></div></details>
  </section>;
}

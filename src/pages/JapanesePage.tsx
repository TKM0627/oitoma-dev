import { SearchReturnLink } from '../components/search/SearchReturnLink';
import { EnvironmentGuide } from '../components/common/EnvironmentGuide';
import { StarterInstructions } from '../components/common/StarterInstructions';
import { Disclosure } from '../components/common/Disclosure';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { content } from '../domain/content/contentRepository';
import { generateStarter, UPLATEX_LATEXMKRC, type StarterOptions } from '../domain/japanese/starterEngine';
import { CodeBlock } from '../components/common/CodeBlock';
import { PageHeading, ReferenceLinks } from '../components/common/ContentParts';

export function JapanesePage() {
  const [options, setOptions] = useState<StarterOptions>({ engine: 'lualatex', structure: 'report' });
  const [message, setMessage] = useState('');
  const profile = content.starterProfiles.find((item) => item.id === options.engine)!;
  const code = generateStarter(options);
  function download() {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `report-${options.engine}.tex`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('ファイルの保存を開始しました。');
  }
  return <div className="page"><SearchReturnLink />
    <PageHeading title="日本語文書のスターター" description="エンジンと構成を選んで、文書の土台を生成します。授業指定のテンプレート・提出形式を優先してください。" />
    <EnvironmentGuide />
    <div className="starter-grid">
      <div>
        <section className="study-panel"><h2>文書の設定</h2>
          <label className="field-label" htmlFor="starter-engine">使うLaTeXエンジン</label>
          <select id="starter-engine" value={options.engine} onChange={(event) => { setOptions({ ...options, engine: event.target.value as StarterOptions['engine'] }); setMessage(''); }}>{content.starterProfiles.map((item) => <option value={item.id} key={item.id}>{item.title}{item.id === 'lualatex' ? '（新規文書向け）' : '（授業指定向け）'}</option>)}</select>
          <p className="small">{profile.description}</p>
          <label className="field-label" htmlFor="starter-structure">レポートの構成</label>
          <select id="starter-structure" value={options.structure} onChange={(event) => { setOptions({ ...options, structure: event.target.value as StarterOptions['structure'] }); setMessage(''); }}><option value="report">一般レポート：はじめに・内容・考察・まとめ</option><option value="lab">実験レポート：目的・方法・結果・考察・結論</option></select>
        </section>
        <StarterInstructions engine={options.engine} />
        <section><h2>参考資料</h2><ReferenceLinks ids={profile.referenceIds} /></section>
      </div>
      <div>
        <div className="scope-notice"><b>文書全体はプレビュー対象外</b><p>TeXコンパイル・PDF作成は行いません。このスターターはアプリ内でコンパイル検証していません。クラス・フォントの利用可否は実行環境に依存します。</p></div>
        <CodeBlock code={code} label="日本語文書のLaTeX" />
        <div className="editor-actions"><button className="button secondary" onClick={download}>.texファイルを保存</button><span role="status" className="small">{message}</span></div>
        <Disclosure summary={`Overleafを使う場合の設定（${options.engine === 'uplatex' ? 'upLaTeX' : 'LuaLaTeX'}）`}><ol>{profile.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>{options.engine === 'uplatex' && <CodeBlock code={UPLATEX_LATEXMKRC} label="upLaTeX用latexmkrc" />}</Disclosure>
      </div>
    </div>
    <aside className="next-step"><div><h2>本文を書きながら、基礎を確認。</h2><p>見出し・図表の参照・引用を、学習コースで順に確認できます。</p></div><Link className="button" to="/learn?path=report">レポートの学習コースへ →</Link></aside>
  </div>;
}

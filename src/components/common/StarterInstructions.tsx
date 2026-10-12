import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudy } from '../../app/studyContext';
import { starterExecution, type StarterOptions } from '../../domain/japanese/starterEngine';
import { CodeBlock } from './CodeBlock';
import { Disclosure } from './Disclosure';
import { SupportReferences } from './SupportReferences';

const modes = { unknown: 'まだ分からない', standard: 'Emacs標準のTeXモード', auctex: 'AUCTeX' };
type EmacsMode = keyof typeof modes;

export function StarterInstructions({ engine }: { engine: StarterOptions['engine'] }) {
  const { environment } = useStudy();
  const [mode, setMode] = useState<EmacsMode>('unknown');
  const execution = starterExecution(engine);
  return <section className="study-panel"><h2>保存からPDF作成まで</h2>
    <ol className="instruction-list">
      <li>下の文書を<code>{execution.fileName}</code>としてUTF-8で保存します。画像なども同じ作業フォルダに揃えます。</li>
      <li>{environment === 'linux' ? <>Emacsで保存し、授業指定のエンジンで実行します。下の選択欄でモード別の操作を確認できます。</> : environment === 'windows' ? <>拡張子が.tex.txtになっていないか確認し、エディタのビルド設定を選択中のエンジンに合わせます。</> : <>エディタのビルド設定を選択中のエンジンに合わせます。授業指定の手順があれば優先してください。</>}</li>
      <li><code>{execution.pdfName}</code>を開き、日本語・数式・表の参照番号を確認します。参照が未確定なら再コンパイルします。</li>
    </ol>
    {environment === 'linux' && <>
      <label className="field-label" htmlFor="emacs-mode">Emacsで使っているモード</label>
      <select id="emacs-mode" value={mode} onChange={(event) => { const value = Object.keys(modes).find((key) => key === event.target.value) as EmacsMode | undefined; if (value) setMode(value); }}>{Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <p className="small">{mode === 'standard' ? <>既定では<kbd>C-c C-f</kbd>（tex-file）で保存した文書を処理します。実行するエンジンはEmacsの設定によります。</> : mode === 'auctex' ? <>既定では<kbd>C-c C-c</kbd>（TeX-command-master）で処理コマンドを選びます。エンジンとメインファイルはAUCTeXの設定を確認してください。</> : <>Emacsの<kbd>C-h m</kbd>（describe-mode）で現在のモードと操作を確認できます。分からなければ授業の手順を確認してください。</>}</p>
      <p className="small muted">キー設定は変更されている場合があります。大学PCの設定やエンジンは未確認です。</p>
    </>}
    <Disclosure summary="ターミナルで実行する場合">
      <p className="small">保存したフォルダで1行ずつ実行します。WindowsではPowerShellなどを使えます。最初の行でエラーが出たら、続きより先に原因を確認してください。</p>
      <CodeBlock code={execution.command} label="PDF作成用のコマンド" copyLabel="コマンドをコピー" />
      <p className="small">参照番号のため同じ処理を2回行う例です。外部コマンド呼び出しを無効にする設定で、任意のTeX文書を安全にする保証はありません。授業指定の文書と手順を優先してください。</p>
    </Disclosure>
    <Disclosure summary="PDFが作れないとき">
      <ol><li>エンジンが見つからなければ、TeX環境とエディタの実行先を確認します。大学PCへの追加導入は管理者に確認してください。</li><li><code>{execution.logName}</code>の最初のエラーを確認し、修正して再実行します。</li><li><Link to="/workspace">まとめて調べる</Link>で.texと.logを選び、報告行と確認手順を調べられます。</li></ol>
    </Disclosure>
    <Disclosure summary="授業で確認する設定"><ul><li>指定テンプレート・文書クラス・TeXエンジン</li><li>文字コード・フォント・提出形式</li><li>エディタのビルド手順と文献処理</li></ul><p className="small">このスターターのクラスはjlreqです。指定テンプレートを置き換える前に確認してください。</p></Disclosure>
    <Disclosure summary="操作案内の出典"><SupportReferences ids={['emacs-operations', 'auctex-commands', 'web2c-options', 'learnlatex-errors', 'learnlatex-crossref']} /></Disclosure>
  </section>;
}

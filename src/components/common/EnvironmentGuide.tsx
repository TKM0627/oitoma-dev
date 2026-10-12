import { Link } from 'react-router-dom';
import { environments } from '../../app/environments';
import { useStudy } from '../../app/studyContext';
import { ReferenceLinks } from './ContentParts';

const guides = {
  linux: { text: 'Emacsで.texを保存し、授業指定の方法でコンパイルします。TeXモードとAUCTeXでは操作が異なるため、大学PCの設定を確認してください。', refs: ['emacs-tex-mode', 'learnlatex-setup'] },
  windows: { text: 'ファイルを.texとして保存し、エディタで使うTeX Liveのエンジンを確認します。.tex.txtになっていないか、拡張子も確認してください。', refs: ['texlive-guide', 'learnlatex-setup'] },
  other: { text: 'エディタで.texを保存し、ビルド設定のエンジンを確認します。エディタとTeXの実行環境は別なので、授業指定の手順を優先してください。', refs: ['learnlatex-setup'] },
};

export function EnvironmentGuide() {
  const { environment } = useStudy();
  if (environment === 'none') return null;
  const guide = guides[environment];
  return <details className="notice" key={environment}><summary>{environments[environment]}での操作案内</summary><p>{guide.text}</p><p>環境の選択では、エンジン・文書クラス・入力内容を変更しません。</p><Link to="/reference/setup">環境の準備を確認する →</Link><details><summary>参照した資料</summary><ReferenceLinks ids={guide.refs} /></details></details>;
}

import { isOverfullWarning, isTexCommandMissing } from '../workspace/logMessages.ts';

export type DiagnosticAdvice = {
  explanation: string; before: string; after: string; packages: string[]; referenceIds: string[];
};

export const diagnosticAdvice: Record<string, DiagnosticAdvice> = {
  UNBALANCED_BRACE: {
    explanation: '波括弧は引数の終わりで閉じます。文書末尾への追加は断定できません。断片の前後も確認してください。',
    before: '\\textbf{Result', after: '\\textbf{Result}', packages: [], referenceIds: ['learnlatex-errors', 'learnlatex-structure'],
  },
  ENV_MISMATCH: {
    explanation: '開始と終了の名前を揃え、内側から閉じます。両方の位置を比べてください。',
    before: '\\begin{itemize}\n\\item Example\n\\end{enumerate}', after: '\\begin{itemize}\n\\item Example\n\\end{itemize}',
    packages: [], referenceIds: ['learnlatex-structure'],
  },
  MATH_SUBSCRIPT_OUTSIDE: {
    explanation: '式全体を数式で囲みます。本文のアンダースコアは \\_ です。既に数式内なら区切りの追加は不要です。',
    before: 'x_1', after: '$x_{1}$', packages: [], referenceIds: ['learnlatex-math'],
  },
  MATH_SUPERSCRIPT_OUTSIDE: {
    explanation: '指数を含む式全体を数式で囲みます。既に数式内なら区切りの追加は不要です。',
    before: 'x^2', after: '$x^{2}$', packages: [], referenceIds: ['learnlatex-math'],
  },
  MATH_DELIMITER_MISMATCH: {
    explanation: '区切りは同じ種類で対にします。equationやalignに追加の数式区切りは不要です。',
    before: '\\(x+1\\]', after: '\\(x+1\\)', packages: [], referenceIds: ['learnlatex-math', 'amsmath-guide'],
  },
  MATH_PARAGRAPH_BREAK: {
    explanation: '数式内の空行を除きます。複数行の式にはalignなどを使います。この例の改行は組版上の改行指定ではありません。',
    before: '\\[\na+b\n\n=c\n\\]', after: '\\[\na+b\n=c\n\\]', packages: [], referenceIds: ['learnlatex-errors', 'amsmath-guide'],
  },
};

export type LogAdvice = { title: string; checks: string[]; referenceIds: string[]; topicIds: string[]; example?: { code: string; usage: string } };
const logAdvice: Record<string, LogAdvice> = {
  missingCommand: { title: 'TeXの実行先を確認', checks: ['TeXエンジンが見つからないというOS側の報告です。TeX環境の導入状況と、エディタが使う実行先を確認します。', '文書の構文を変える前に、授業の起動手順を確認します。大学PCのPATHやインストール設定は管理者に相談してください。'], referenceIds: ['learnlatex-errors', 'texlive-guide'], topicIds: ['japanese-engine'] },
  alignment: { title: '表の列数と行末を確認', checks: ['tabularやarrayの列定義と、各行の & の数を比べます。行末の \\\\ が抜けていないかも確認します。', '本文で & 自体を書きたい場合は \\& です。環境や列定義によって原因が異なるため、区切りを一律に削除しません。'], referenceIds: ['texfaq-alignment', 'learnlatex-tables', 'learnlatex-structure'], topicIds: ['table-basic', 'layout-special'], example: { code: '\\begin{tabular}{ll}\nA & B \\\\\nC & D \\\\\n\\end{tabular}', usage: 'document環境内に置く、2列の表の例です。& は列、\\\\ は行の区切りです。' } },
  linebreak: { title: '改行指定の位置を確認', checks: ['段落の外や見出しの直後に \\\\ がないか確認します。改行する行がない場所では使えません。', '通常の本文を別の段落にするなら空行を使います。表や数式の行区切りまで一括で置き換えません。'], referenceIds: ['texfaq-linebreak', 'learnlatex-structure'], topicIds: ['layout-paragraph'], example: { code: 'First paragraph.\n\nNext paragraph.', usage: 'document環境内に置く、本文の段落の例です。' } },
  overfull: { title: 'PDFのはみ出しを確認', checks: ['組版の警告です。PDFで報告位置の行や領域を確認します。PDF作成の失敗とは区別します。', '長い文章・数式・画像などが幅や高さに収まるか確認します。まず内容を見直し、余白や警告の設定を一律に変更しません。'], referenceIds: ['texfaq-overfull'], topicIds: ['layout-paragraph', 'math-aligned'] },
  stopped: { title: '停止する前の最初のエラーを確認', checks: ['この報告だけでは原因を決められません。直前だけでなく、ログの先頭から最初のエラーを確認します。', '最初の原因を修正して再実行します。後続の報告は最初のエラーに続いて発生した可能性があります。'], referenceIds: ['learnlatex-errors'], topicIds: [] },
  math: { title: '数式モードと空行を確認', checks: ['報告位置の前後で、数式区切りの対と、本文中の _・^ を確認します。', '数式中の空行も確認します。Missing $ insertedだけから原因を一つに決めることはできません。'], referenceIds: ['learnlatex-errors', 'learnlatex-math'], topicIds: ['error-math-mode'] },
  command: { title: 'コマンド名と定義を確認', checks: ['ログの展開途中のコマンド名も確認します。報告行にある呼び出し元が原因とは限りません。', '綴り・必要パッケージ・独自定義を確認します。未知のコマンドをすべてタイポにはしません。'], referenceIds: ['learnlatex-errors'], topicIds: ['error-environments'] },
  environment: { title: '環境名と提供元を確認', checks: ['begin/endの名前と綴りを確認します。', 'amsmathが提供するalign等を使う場合は、文書クラスによる読み込みも含めてパッケージの設定を確認します。任意の未定義環境がamsmathで解決するわけではありません。'], referenceIds: ['amsmath-guide', 'learnlatex-structure'], topicIds: ['error-environments', 'math-aligned'] },
  file: { title: 'ファイル名と利用環境を確認', checks: ['ファイル名の綴り、相対パス、同じ作業フォルダに必要なファイルがあるか確認します。', 'styなどが見つからない場合は、パッケージ名と導入状況を確認します。大学PCへの追加導入は授業・管理者の指示に従います。'], referenceIds: ['learnlatex-errors', 'texlive-guide'], topicIds: ['error-environments'] },
  reference: { title: '参照キーと再コンパイルを確認', checks: ['labelとrefのキー、labelを置く位置を確認します。', '他のエラーを直したあと、授業指定の環境でもう一度コンパイルし、補助ファイルの参照情報が更新されるか確認します。'], referenceIds: ['learnlatex-crossref'], topicIds: ['citation-reference'] },
  citation: { title: '文献キーと処理手順を確認', checks: ['citeなどのキーが、利用する文献データのキーと一致するか確認します。', 'BibTeX・pBibTeX・Biberのどれを使うかは設定で異なります。授業・テンプレート指定の文献処理と再コンパイルの手順を確認します。'], referenceIds: ['learnlatex-bibliography'], topicIds: ['citation-bibliography'] },
  brace: { title: '引数と波括弧を確認', checks: ['報告行だけでなく、直前のコマンド引数の波括弧を確認します。', 'オプション引数の角括弧との取り違えにも注意します。ログの一文だけから括弧を追加する場所は決められません。'], referenceIds: ['learnlatex-errors'], topicIds: ['error-braces'] },
};

export function getLogAdvice(message: string): LogAdvice | null {
  if (isTexCommandMissing(message)) return logAdvice.missingCommand;
  if (isOverfullWarning(message)) return logAdvice.overfull;
  if (/^(?:LaTeX Error:\s*)?(?:Extra alignment tab has been changed to \\cr\.?|Misplaced alignment tab character &\.)$/i.test(message.trim())) return logAdvice.alignment;
  if (/^(?:LaTeX Error:\s*)?There's no line here to end\.$/i.test(message.trim())) return logAdvice.linebreak;
  if (/^(?:Emergency stop\.|Fatal error occurred, no output PDF file produced!)$/i.test(message.trim())) return logAdvice.stopped;
  if (/^(?:LaTeX Error:\s*)?(?:Missing \$ inserted\.|Bad math environment delimiter\.)$/i.test(message.trim())) return logAdvice.math;
  if (/^Undefined control sequence\.$/i.test(message.trim())) return logAdvice.command;
  if (/^LaTeX Error:\s*Environment\s+\S+\s+undefined\./i.test(message)) return logAdvice.environment;
  if (/^LaTeX Error:\s*File\s+.+\s+not found\./i.test(message)) return logAdvice.file;
  if (/^(?:LaTeX Warning:\s*)?Reference\s+.+\s+undefined\b/i.test(message)) return logAdvice.reference;
  if (/^(?:LaTeX Warning:\s*)?Citation\s+.+\s+(?:undefined|on page\b.*\bundefined)\b/i.test(message)) return logAdvice.citation;
  if (/^(?:Extra \}, or forgotten \$\.|Argument of .+ has an extra \}\.|Paragraph ended before .+ was complete\.)$/i.test(message.trim())) return logAdvice.brace;
  return null;
}

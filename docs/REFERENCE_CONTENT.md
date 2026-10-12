# テーマ別資料の試作

確認日：2026-10-10。アプリの `#/reference` に6テーマ・16項目・16個の短いコード例を追加しました。公開資料を参照した独自の日本語説明で、教員による校閲・大学の承認・実際のTeXコンパイル検証は未実施です。

## テーマと参照範囲

| テーマID | 内容 | 主な参照資料 |
| --- | --- | --- |
| `setup` | 大学のLinux／Emacs、自前のWindows／TeX Live、日本語文書とエンジン | [GNU EmacsのTeXモード](https://www.gnu.org/software/emacs/manual/html_node/emacs/TeX-Mode.html)、[TeX Live Guide](https://tug.org/texlive/doc/texlive-en/texlive-en.html)、[jlreqの保守者ガイド](https://github.com/abenori/jlreq/blob/master/README-ja.md)、[Learn LaTeX：環境](https://www.learnlatex.org/ja/lesson-02) |
| `math` | 文中と独立した式、添字・分数、aligned・行列 | [Learn LaTeX：数式](https://www.learnlatex.org/ja/lesson-10)、[amsmathガイド](https://www.latex-project.org/help/documentation/amsldoc.pdf)の第3.7節・第4.1節 |
| `figures-tables` | tabularの列と行、画像・caption・label、配置候補 | [Learn LaTeX：画像](https://www.learnlatex.org/ja/lesson-07)、[表組み](https://www.learnlatex.org/ja/lesson-08)、[相互参照](https://www.learnlatex.org/ja/lesson-09) |
| `structure` | プリアンブルと本文、見出し、箇条書き・段落 | [Learn LaTeX：文書構造](https://www.learnlatex.org/ja/lesson-03)、[論理的な構造](https://www.learnlatex.org/ja/lesson-04) |
| `references` | label/ref、手入力の文献リスト、.bibと文献処理 | [Learn LaTeX：相互参照](https://www.learnlatex.org/ja/lesson-09)、[文献引用](https://www.learnlatex.org/ja/lesson-12)、[Overleaf：文献管理](https://www.overleaf.com/learn/latex/Bibliography_management_with_bibtex) |
| `errors` | ログと実行環境、数式区切り、括弧・環境、簡易診断の限界 | [Learn LaTeX：エラー](https://www.learnlatex.org/ja/lesson-15)、既存のOverleaf構文解説 |

補足資料も含む正確な出典IDは、各項目の `referenceIds` に保持します。確認日、発行元、資料種別、参照範囲は `references.json` に記録し、画面の「出典と参照範囲」で表示します。本文全体・画像・配布テンプレート・他資料の演習問題は収録していません。

## 出典の位置付け

- `official-documentation`：KaTeX、GNU Emacsなどの開発元文書。OverleafのCompiler設定は、Overleafの製品仕様についての文書です。
- `maintainer-documentation`：jlreq、amsmath、TeX Liveの保守者が配布する文書。
- `project-tutorial`：Learn LaTeXの制作元チュートリアル。日本語版の目的と成り立ちは[制作元の説明](https://www.learnlatex.org/ja/mission)で確認しています。
- `service-tutorial`：Overleafが制作・配布するLaTeX解説。LaTeX本体の仕様や大学の指定としては扱いません。

今回追加したLearn LaTeXの9レッスンは公開ページを読み、範囲を照合しました。GNU EmacsとTeX Liveのページは直接取得がタイムアウト／403になったため、検索ツールが返した公式ページ本文で上記の範囲を照合しました。マニュアル全体の監査や大学PCの実機確認は行っていません。

コード例は構文の説明のために作成しました。測定値と文献の著者・題名は架空の例と明記しています。授業のレポート構成・引用形式・使用画像の権利を、この資料から一律に決めることはできません。

## 大学の環境で未確認のこと

Linux／EmacsとWindows／TeX Liveを主な利用環境とすることは、ユーザーからの情報です。大学PCのTeXエンジン、文書クラス、Emacs標準TeXモード／AUCTeXの使用状況、実行コマンド、大学の提出書式は未確認です。Linuxの一般的な操作例から、大学の既定設定を推定していません。

LuaLaTeX用の文書全体の例には利用条件を示します。pLaTeX/upLaTeXや画像のドライバー設定は、授業のテンプレートと合わせる案内にしています。文献処理もBibTeX・pBibTeX・Biberから勝手に大学の設定を決めず、指定を確認する方針です。

## データ・画面・検証

- `src/data/reference_chapters.json`：テーマ、項目、原著の説明、コード、利用位置・条件、注意、出典ID、関連機能ID、確認状況。
- `src/domain/reference/validateReferenceChapters.ts`：厳密なスキーマ、重複、項目ごとの出典、関連ID、コードの制御文字、未知のフィールドを検証。Viteの起動・ビルドと単体テストで実行。
- `src/pages/ReferencePage.tsx`：一覧、テーマ間の移動、目次のキーボード操作、コピー、確認ポイント、印刷、関連トピック・レシピ・診断への導線。
- 本文JSONと専用CSSはテーマ別画面だけで遅延読み込み。新たな依存・外部データ取得・入力の保存は追加していません。
- PC／モバイルで全6テーマの直接リンクと再読込を確認。コピー、出典の種別とリンク設定、印刷時の出典表示、320px幅・文字200%、アクセシビリティ自動検査を実施。基本検索画面でテーマ資料やKaTeX資産を取得しないことも確認。

メタデータは `status: "prototype"`、`verificationMethod: "source-comparison"`、`humanReview: "not-performed"`、`texCompilation: "not-performed"` です。現在の試作スキーマで未実施の確認を「実施済み」に書き換えるとビルドが失敗します。正式なレビューを行った場合は、実施者・日付・対象範囲を記録するモデルと表示へ変更する必要があります。

## 段階的な表示（2026-10-11追加）

本文の例・利用位置・必要条件は表示したまま、つまずきやすい点と出典は項目ごとに展開します。数式テーマには86種類・8分類の記号一覧を追加し、同じページ内で検索・コピーできます。一覧を開いたときだけ追加資産を取得します。印刷に含める場合は事前に一覧を開きます。記号一覧の情報条件と全体の改善は [必要な情報を読む工夫](./USABILITY.md) に記録しています。

## 編集時の手順

1. 参照する公開資料の必要な箇所を読み、対応するエンジン・パッケージ・前提を確認する。
2. 短い独自の説明と例を作り、利用位置・必要条件・例示データを明記する。
3. 項目に出典ID、テーマに関連機能IDを設定する。未登録のURLは確認後に許可リストへ正確なホストと必要なパスだけを追加する。
4. 照合後に確認日を更新する。授業固有の操作は実機や大学の指定資料を確認するまで断定しない。
5. `npm run update:search-index` でテーマの検索用データを更新し、差分を確認する。説明・注意・確認ポイントなどを検索用に抽出し、コード例や出典全文は含めない。
6. `npm run lint`、`npm run test`、`npm run build`、`npm run test:e2e` を実行する。自動テストと、人手の校閲・TeXコンパイル検証を区別する。

この試作は16項目の導入です。検索は32トピック・10レシピ・6テーマ・5エラー事例・日本語スターター・3学習コースの57項目を横断します。テーマの見出し・説明・注意・学習目標・確認ポイントを検索用データに含めます。コード例・必要条件・外部資料の全文を含む完全な全文検索は行いません。検索の範囲と将来の学内LLM契約は [横断検索と学内LLMの接続準備](./SEARCH_AND_AI.md) に記録しています。画像のアップロード・文献データベース編集・PDFの生成・TeXエンジン実行も行いません。

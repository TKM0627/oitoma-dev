# LaTeX Navigator — 詳細設計書

- 文書種別：ハッカソン開発向け機能・技術設計
- バージョン：1.0 / MVP
- 作成日：2026-10-10
- 想定読者：実装担当者、レビュー担当者、Codex
- 実装方針：**GitHub Pagesで公開する静的SPA。利用者側のインストール、自前の常時稼働サーバーは不要。**

---

## 1. 目的・価値

大学の授業・レポートでLaTeXを記述する際、「コマンド名がわからない」「書いた構文が正しいか不安」「エラーの意味がわからない」という課題を解決する。

既存チートシートとの差別化は **「探す → 試す → 直す」の一貫した導線** とする。

| モード | 利用者の行動 | 提供する価値 |
|---|---|---|
| 探す | 症状・タグ・関連語で調べる | コマンドを知らなくても目的に到達 |
| 試す | 選択肢を変え、コードと表示を比較する | LaTeX構文を操作から理解 |
| 直す | 貼り付けた短いLaTeXコードを診断する | 基本的なミスと修正理由を把握 |

学内LLMは **補足説明の制作時の支援** と、大学側に安全な接続環境が存在する場合の **将来の実行時オプション** に限定する。

## 2. 非機能要件と前提条件

### 2.1 必須条件

1. **MVPはGitHub Pages上で単独稼働**する。API、ログイン、学内VPN、OpenCodeへの接続は基本機能の必須条件にしない。
2. PCを常時起動させる必要がない。利用者にもOpenCode/Node.js/TeX Liveのインストールを要求しない。
3. 検索・レシピ生成・簡易構文診断はすべてブラウザ内で完結し、入力されたLaTeXソースを外部へ送信しない。
4. 一般公開可能な構文情報だけを配信し、学内限定文書・学内LLM認証情報・APIキーを公開成果物へ含めない。
5. 日本語UI、PC・スマートフォン対応、キーボード操作可能なUIを提供する。
6. ネットワーク状態は学内Wi-FiのSSID判定ではなく、**大学に許可された学内専用HTTPS APIの応答確認**で扱う。
7. API不在・大学側の許可未取得・ブラウザ通信制約がある場合、LLM機能は無効化するが基本機能は使える。

### 2.2 明示的に対象外

- TeXエンジンを実行した完全コンパイル・PDF作成
- 任意のLaTeXコードを正しいと保証する完全構文解析
- PDF/大学の非公開レポートをアップロードする機能
- 自由形式のLLMチャット、一般Web検索、Webクローラー
- 利用者のLaTeXソース、履歴、個人情報のサーバー保存
- 大学管理のOpenCodeサーバーを利用者ブラウザへそのまま公開すること
- 大学に未承認のリバースプロキシ、トンネル、認証回避

### 2.3 ネットワーク上の整理

- **GitHub Pagesサイトは原則インターネット一般公開**。VPN未接続でも「探す・試す・直す」は利用可能。
- **学内LLMは学内Wi-Fiか許可された大学VPNを経由しなければ利用できない**、という前提。ただしVPN接続の有無をJSから直接判別しない。
- 学内に認証・CORS設定済みのWeb APIが存在しない場合、GitHub PagesのみでOpenCode経由の動的LLM呼び出しを実現することはできない。
- OpenCodeが自分のPCで動くだけなら、他人がPC停止中も利用できるサービスにはならない。
- 学内APIに到達しても、CORS・ブラウザのLocal Network Access・証明書・認証により通信が失敗し得る。到達性とアクセス権を分ける。

## 3. 技術スタック

| 用途 | 技術 | 理由 |
|---|---|---|
| UI | React + TypeScript | コンポーネント分割、型安全 |
| ビルド | Vite | 静的ファイル生成、GitHub Pages対応 |
| ルーティング | react-router-dom / HashRouter | Pagesのサブパスで直リンク可能にする |
| 数式プレビュー | KaTeX | クライアントサイド描画 |
| データ | 版管理したTypeScript型付きJSON | DBやサーバーが不要 |
| スタイル | CSS Modulesまたは素のCSS | 追加依存を抑え、調整容易 |
| 単体テスト | Vitest | Viteとの親和性 |
| UIテスト | Testing Library | 画面の主要操作を検証 |
| E2E（推奨） | Playwright | モード間遷移・デプロイ確認 |
| デプロイ | GitHub Actions → GitHub Pages | pushでビルド・配信 |
| 将来AI接続 | `AiProvider`インターフェース | MVPと動的LLMを分離 |

初期開発は `npm` を利用。依存のバージョンは利用時点の安定版を選び、lockfileを必ずコミットする。

## 4. アーキテクチャ

### 4.1 MVP

```text
GitHub Pages（静的配信）
 └─ 利用者ブラウザ：React SPA
     ├─ SearchPage  → SearchEngine   → topics/tags/error_cases.json
     ├─ RecipePage  → RecipeEngine   → recipes.json → KaTeX表示
     ├─ DiagnosePage→ DiagnosisEngine→ error_cases.json
     ├─ TopicDetail → 共通表示/関連項目
     ├─ ReferenceRepository → references.json（公開URL）
     └─ AiExplanationProvider（static）→ reviewed_explanations.json
```

**APIサーバー・SQLite・FastAPI・OpenCodeランタイムはMVPに含めない。** JSONはアプリ内にインポートしてビルドに含める。画面表示時に外部データ取得しない構成を基本とする。

### 4.2 将来の大学許可済み連携（MVPでは未接続）

```text
GitHub Pages SPA（公開）
    │
    └── NetworkChecker → 学内HTTPS Gateway /v1/capabilities
                                 │  CORS・認証・TLS・アクセス制御
                                 ├─ /v1/explanations（限定されたIDのみ）
                                 └─ 大学管理OpenCode → 大学指定LLM
```

- Gatewayは**大学側で運営・承認されるもの**。自分のPCにサーバーを立てない。
- 生のOpenCodeサーバーをブラウザに直接公開しない（セッション・ファイル・ツール実行APIなどが含まれるため）。
- 使えるGatewayが存在しなければ、ネットワーク確認表示は「未設定（AI拡張未提供）」にする。架空の疎通成功を示さない。

## 5. 画面設計と導線

### 5.1 共通レイアウト `AppShell`

- ヘッダー：ロゴ「LaTeX Navigator」、ナビ（探す/試す/直す）、AI接続状態、ヘルプ
- 本文：ページごとのコンテンツ。最大幅を設定し可読性を確保
- フッター：「簡易診断であり、TeXコンパイラの代替ではない」旨と参考資料
- 画面幅に応じナビは折り返しまたはモバイルメニューへ切り替え
- すべてのボタンはラベル・フォーカス表示・キーボード操作対応

### 5.2 探す `/search`

**UI部品**：`SearchBar`, `TagFilter`, `SymptomSuggestions`, `SearchResultList`, `TopicCard`, `NoResult`。

**動作**
1. 初期表示はカテゴリ＋よくある症状＋おすすめ項目。
2. キーワード検索は自由な**検索語**を受け付けるが、AIにその文字列を送信しない。
3. キーワードとタグをAND絞り込みし、一致度順で結果表示する。
4. カードにはタイトル、簡単な目的、該当タグ、使用例を表示する。
5. 選択するとトピック詳細 `/topics/:id` に遷移する。

**検索仕様**
- 入力長上限100文字、300ms debounce（任意）。空入力ならおすすめ表示。
- `normalize('NFKC')`、英字小文字化、空白の連続削除。`\begin` や `\frac` などバックスラッシュを含む入力も検索できるよう、元の記号も保持する。
- 検索重み（暫定）：正規化したID/コマンド完全一致10、タイトル完全一致9、同義語完全一致8、タグ一致5、症状一致4、説明一致2。複数語では一致語数を加点。
- 30件以上も扱えるが、MVPでは30件程度を収録。
- 検索対象には、エラー文字列（例：`Missing $ inserted`）、日本語の言い換え、英語別名を含める。
- 検索結果0件なら「タグを外す」「関連カテゴリを選ぶ」を案内する。外部検索へ勝手に送らない。

### 5.3 トピック詳細 `/topics/:id`

**UI部品**：`TopicHeader`, `CopyableCode`, `ExampleComparison`, `ReferenceLinks`, `RelatedRecipes`, `RelatedErrors`。

**表示**：何をするか／正しい書き方／よくあるミス／使用する環境・パッケージ／参考資料。

**横断導線**：「この書き方を試す」ボタンで対応レシピへ、「間違いを確認」で対応エラーケースへ遷移する。

### 5.4 試す `/recipes` と `/recipes/:id`

**UI部品**：`RecipeCatalog`, `OptionPanel`, `GeneratedCode`, `KatexPreview`, `PackageNotice`, `CopyButton`。

**初期対象（10レシピ例）**
1. 下付き文字
2. 上付き文字
3. 分数
4. 平方根
5. 総和
6. 積分
7. 行列（括弧切り替え）
8. 場合分け
9. 複数行の数式（aligned）
10. ギリシャ文字・数式記号の選択

**生成規則**
- レシピJSONに定義された列挙型オプションのみ許可する。自由入力に基づく任意のLaTeXテンプレート評価は禁止。
- 選択値→`RecipeEngine`（純関数）→LaTeXコード＋パッケージ一覧＋描画用数式を返す。
- 行列では `pmatrix`、`bmatrix`、`vmatrix` などを切り替え可能。
- 生成コードをそのままコピー可能。改行・バックスラッシュを正しく維持する。
- 必要パッケージ（例：amsmath）と推奨記述モード（数式モード等）を明記。
- KaTeX非対応の文書構造やパッケージ機能は「プレビュー対象外」と表示し、**LaTeXとして不正**と混同しない。
- 全コード例に、式全体として必要なラッパーを含めるか、利用位置（数式モード内など）を明示する。

### 5.5 直す `/diagnose`

**UI部品**：`CodeInput`, `DiagnosticSummary`, `FindingList`, `BeforeAfter`, `RelatedTopics`, `PrivacyNotice`。

**入力仕様**
- 10,000文字上限、無制限アップロード禁止、送信ボタンは存在しない。
- 入力はReact state内で扱い、サーバーやLLMへ送らない。localStorageへ自動保存しない。
- `診断する` ボタンを押すか入力停止から一定時間（例：400ms）で処理する。
- 診断対象は断片コード。断片であることにより正誤不明なケースは `hint` として扱う。

**出力仕様**
- `severity`: `error` / `warning` / `hint`
- `ruleId`: 例 `ENV_MISMATCH`
- 位置情報：可能なら1始まりの行・列
- 日本語の説明、修正例、関連トピックID
- エラー0件でも「完全に正しい」と保証せず「登録済みの簡易規則では問題を検出しませんでした」と表示
- 自動修正は非破壊的（ユーザー操作なしで入力を書き換えない）

**初期5規則**

| ruleId | 概要 | 注意 |
|---|---|---|
| `UNBALANCED_BRACE` | エスケープを考慮した `{` `}` の過不足 | コメントと `\{` `\}` を除外 |
| `ENV_MISMATCH` | `\begin{name}` / `\end{name}` の不整合 | 未完の断片はwarning/hint |
| `MATH_SUBSCRIPT_OUTSIDE` | 数式モード外の未エスケープ `_` | `\_`、コメント、verbatim対象外 |
| `MATH_SUPERSCRIPT_OUTSIDE` | 数式モード外の未エスケープ `^` | コメント、verbatim対象外 |
| `MATH_DELIMITER_MISMATCH` | `$...$`、`\(...\)`、`\[...\]` の不整合 | `\verb`など未対応領域に注意 |

実装は**文字列上の単純な正規表現のみで全体を判定しない**。最低限の字句状態（通常/コメント/数式/制限付きverbatim）を追跡する。`\verb`、`verbatim`、コメント、エスケープの完全対応が難しければ、未サポート領域を飛ばすか `hint` に下げる。曖昧な診断は表示しないほうを優先する。

## 6. TypeScriptドメインモデル

データは**id参照**で関連付ける。JSON読み込み時にスキーマ検証を行う（Zodを採用するか、小さな検証関数を実装する）。

```ts
type TopicCategory = 'math' | 'table' | 'figure' | 'layout' | 'citation' | 'error';
type Severity = 'error' | 'warning' | 'hint';

type Topic = {
  id: string;
  title: string;
  summary: string;
  category: TopicCategory;
  tags: string[];
  aliases: string[];
  symptoms: string[];
  commands: string[];
  examples: { label: string; code: string; explanation?: string }[];
  requiredPackages: string[];
  recipeIds: string[];
  errorCaseIds: string[];
  referenceIds: string[];
};

type RecipeOption = {
  key: string;
  label: string;
  type: 'select' | 'boolean' | 'integer';
  defaultValue: string | boolean | number;
  choices?: { value: string; label: string }[];
  min?: number;
  max?: number;
};

type RecipeDefinition = {
  id: string;
  title: string;
  topicId: string;
  description: string;
  options: RecipeOption[];
  generator: string;  // レジストリ上の許可済み関数名。動的evalしない。
  requiredPackages: string[];
  previewMode: 'katex' | 'static' | 'none';
};

type ErrorCase = {
  id: string;
  ruleId: string;
  title: string;
  symptoms: string[];
  cause: string;
  badExample?: string;
  goodExample?: string;
  explanationId: string;
  topicIds: string[];
};

type Reference = {
  id: string;
  title: string;
  url: string;
  publisher?: string;
};

type Finding = {
  ruleId: string;
  severity: Severity;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
  topicIds: string[];
};
```

### 6.1 JSON例

`topics.json` の1件：

```json
{
  "id": "math-subscript",
  "title": "下付き文字",
  "summary": "数式内の変数に添字を付ける",
  "category": "math",
  "tags": ["数式", "添字"],
  "aliases": ["subscript", "アンダースコア"],
  "symptoms": ["Missing $ inserted", "添字でエラー"],
  "commands": ["_"],
  "examples": [
    { "label": "正しい例", "code": "$x_1$", "explanation": "数式モード内で使用する" }
  ],
  "requiredPackages": [],
  "recipeIds": ["subscript"],
  "errorCaseIds": ["outside-math-subscript"],
  "referenceIds": ["overleaf-math"]
}
```

`recipes.json` の1件：

```json
{
  "id": "matrix",
  "title": "行列",
  "topicId": "math-matrix",
  "description": "括弧の形を切り替えて行列を生成",
  "options": [
    { "key": "bracket", "label": "括弧", "type": "select", "defaultValue": "pmatrix",
      "choices": [
        { "value": "pmatrix", "label": "丸括弧" },
        { "value": "bmatrix", "label": "角括弧" },
        { "value": "vmatrix", "label": "縦線" }
      ] }
  ],
  "generator": "matrix",
  "requiredPackages": ["amsmath"],
  "previewMode": "katex"
}
```

`reviewed_explanations.json` は `explanationId` をキーとし、`text`, `reviewed`（boolean）, `sourceTopicIds`, `updatedAt` を保持する。`reviewed !== true` の内容は公開画面に表示しない。

### 6.2 データ整合性

- ID重複禁止。`recipeIds`・`errorCaseIds`・`referenceIds`・`topicIds` は参照先が存在すること。
- サンプル内のコマンド文字列、バックスラッシュのエスケープ、リンク先URLの構文を静的に検証する。
- 参考リンクは `https:` スキームのみとし、編集対象のローカルHTMLを参照しない。
- 30 Topic / 10 Recipe / 5 Error Ruleを目標。ただし大量の低品質ダミーデータで数だけ満たさない。

## 7. モジュールとコンポーネント

```text
src/
 ├─ app/
 │   ├─ App.tsx
 │   ├─ AppShell.tsx
 │   └─ router.tsx
 ├─ pages/
 │   ├─ HomePage.tsx
 │   ├─ SearchPage.tsx
 │   ├─ TopicPage.tsx
 │   ├─ RecipeCatalogPage.tsx
 │   ├─ RecipePage.tsx
 │   ├─ DiagnosePage.tsx
 │   └─ NotFoundPage.tsx
 ├─ components/
 │   ├─ common/  (CodeBlock, CopyButton, TagChip, EmptyState)
 │   ├─ search/  (SearchBar, TagFilter, TopicCard)
 │   ├─ recipe/  (OptionPanel, FormulaPreview, PackageNotice)
 │   ├─ diagnose/(CodeInput, FindingList, DiffViewer)
 │   └─ network/ (NetworkStatus, AIAvailabilityGuard)
 ├─ domain/
 │   ├─ search/searchEngine.ts
 │   ├─ recipe/recipeEngine.ts
 │   ├─ recipe/generators.ts
 │   ├─ diagnose/tokenizer.ts
 │   ├─ diagnose/diagnosisEngine.ts
 │   └─ content/contentRepository.ts
 ├─ ai/
 │   ├─ types.ts
 │   ├─ staticProvider.ts
 │   ├─ universityGatewayProvider.ts
 │   └─ networkChecker.ts
 ├─ data/
 │   ├─ topics.json
 │   ├─ tags.json
 │   ├─ recipes.json
 │   ├─ error_cases.json
 │   ├─ references.json
 │   └─ reviewed_explanations.json
 ├─ hooks/
 ├─ styles/
 └─ main.tsx
.github/workflows/deploy.yml
public/
index.html
vite.config.ts
package.json
README.md
```

**実装上の責務**
- ページ：レイアウトとユーザー操作を扱い、検索スコア等のビジネスロジックを持たない。
- `domain/`：純関数優先。DOM・fetchに依存しない。
- `contentRepository`：JSONの型検証・ID関係の解決。ビルド時またはテスト時にも検証する。
- `ai/`：プロバイダ方式。無効時でもコンパイル可能。
- `NetworkStatus`：`available` を「学内Wi-Fi確定」と言い換えず、「学内AIサービスを利用可能」と表示する。

## 8. ネットワーク判定と将来のLLMゲートウェイ

### 8.1 状態定義

```ts
type GatewayStatus =
  | 'not-configured'
  | 'checking'
  | 'available'
  | 'authentication-required'
  | 'unavailable'
  | 'unknown';
```

| 状態 | UI | LLMボタン |
|---|---|---|
| `not-configured` | 「学内AI連携は未設定です」 | 非表示/無効 |
| `checking` | 「接続確認中」 | 無効 |
| `available` | 「学内AIサービスを利用できます」 | 有効 |
| `authentication-required` | 「学内認証が必要です」 | 無効、大学提供の認証手順を案内 |
| `unavailable` | 「学内AIサービスに接続できません。学内Wi-Fi/VPNをご確認ください」 | 無効 |
| `unknown` | 「接続状況を確認できません（ブラウザ・通信設定等）」 | 無効 |

### 8.2 判定仕様

- 初期は `not-configured`。`VITE_ENABLE_LIVE_AI=true` かつ `VITE_UNIVERSITY_GATEWAY_BASE_URL` が設定された場合のみ確認する。
- 確認は **固定の大学認可済みHTTPS URL** に対して `GET /v1/capabilities` を発行する。利用者がURLを指定できないようにする。
- 実行タイミング：初回・タブ復帰時・利用者による再確認ボタン・AI利用直前（成功キャッシュが古い場合）。頻繁なポーリングはしない。
- 例：3秒でタイムアウト。成功状態は60秒を超えて信用せず、実行時に再検証。
- レスポンスは `200` かつ期待したJSON構造かつ `ai.explanations===true` の場合のみ `available`。`401/403` がJSから読める場合は `authentication-required`。
- `fetch()` がネットワーク障害・CORS・Local Network Access・証明書エラー等で失敗した場合、原因を確定できないので原則 `unknown`。ユーザーにVPN案内と「通信制限の可能性」を示す。
- `navigator.onLine` はインターネット疎通の参考程度。学内ネットワークの証明として使わない。
- **GitHub Pagesの静的配信だけでは実際の疎通をテストできない**。Gateway不在時はモックを使ったテストにとどめ、実ネットワーク確認済みと主張しない。
- API自体が学内でしか解決できない場合でも、公開サイトからプライベートネットワークへのブラウザ通信に追加許可が必要な場合がある。

### 8.3 将来API契約（提案。大学側と協議して確定）

`GET {GATEWAY_BASE_URL}/v1/capabilities`

```json
{
  "service": "latex-navigator-ai",
  "version": "1",
  "ai": { "explanations": true }
}
```

`POST {GATEWAY_BASE_URL}/v1/explanations`

```json
{
  "explanationId": "outside-math-subscript",
  "topicId": "math-subscript",
  "variant": "brief"
}
```

成功例：

```json
{
  "explanationId": "outside-math-subscript",
  "text": "下付き文字は数式モードで利用します。...",
  "relatedTopicIds": ["math-subscript"],
  "referenceIds": ["overleaf-math"]
}
```

- リクエストに利用者のLaTeX原文、任意プロンプト、任意URLを含めない。
- GatewayでIDをホワイトリスト検証し、認証・レート制限・監査・CORSの許可Originを設定する。
- GatewayからOpenCodeを呼び出すときは、専用環境で最小権限にし、シェル、ファイル書込、Web取得などのツールを禁止する。ブラウザからOpenCode生APIは呼ばない。
- JavaScriptバンドルにトークン・パスワードを埋め込まない。SSO等の具体的認証方式は大学が提供するAPIに合わせて設計を確定する。
- 呼び出し結果が不正・タイムアウトの場合は静的な検証済み説明にフォールバックする。
- MVPではこのAPIを実装・要求しない。**Gatewayを実装するために自前サーバーや有料インフラを追加しない。**

## 9. セキュリティとプライバシー

1. **データ最小化**：編集コードはメモリ上のみ。自動外部送信、解析・監視SDK、ログ送信を行わない。
2. **XSS対策**：ユーザー入力を`dangerouslySetInnerHTML`等で描画しない。KaTeXは安全設定で描画する。
3. **KaTeX設定**：`trust: false`、有限の`maxExpand`/`maxSize`を設定し、レンダリング失敗は例外処理する。機能上必要な場合のみ安全性を見直す。
4. **秘密情報**：Viteの`VITE_`変数はクライアントへ公開される。鍵・学内資格情報を置かない。
5. **外部リンク**：管理済みURLのみ、`https:`のみ、新規タブの場合`rel="noopener noreferrer"`。
6. **公開境界**：GitHub Pagesやリポジトリに、大学の非公開ドキュメント、内部サーバー設定、認証情報を含めない。
7. **認証と接続確認の分離**：接続成功は本人認証の代替にならない。Gatewayが独立して認可する。
8. **権限**：AIからツール実行をさせず、解説文のみを出力する。

## 10. GitHub Pagesのデプロイ

- 本番URL：`https://<user>.github.io/<repo>/` を想定。
- `vite.config.ts` の `base` を **`/<repo>/`** にする。ユーザーサイトや独自ドメインの場合は `/`。READMEに変更方法を記す。
- ルーターは `HashRouter` とする。例：`/<repo>/#/search`。更新しても404にならない。
- GitHub Settings → Pages → Build and deployment → GitHub Actions。
- ワークフローは `npm ci` → `npm run lint` → `npm run test` → `npm run build` → Pagesへ`dist/`配信。正しいPages用権限を設定。
- デプロイにはリポジトリの所有者の設定・権限が必要。Codexはユーザーの明示なしにpush/公開設定変更をしない。
- 配信物は公開情報として扱う。公開停止方法・一時的公開の手順もREADMEへ記載。

## 11. テスト設計

### 11.1 単体

- SearchEngine：日本語・英語・エラー文・コマンド名・タグの検索、結果0件、全角半角、大文字小文字、複数語検索。
- RecipeEngine：全レシピの初期値、オプション変更、無効値拒否、行列の括弧形式、バックスラッシュと改行の保存。
- DiagnosisEngine：5規則の正常例/異常例、コメント、エスケープ、環境ネスト、数式モード、部分コード。
- ContentRepository：ID一意、関連参照の解決、URLスキーム、全レシピが有効な生成関数を参照すること。
- GatewayState：設定なし、200正常、401/403、タイムアウト、CORS相当のfetch失敗、不正JSON、手動再試行。モックHTTPで検証。

### 11.2 画面 / E2E

| ID | シナリオ | 合格基準 |
|---|---|---|
| E01 | 「添字」で検索 | 関連トピックが出る |
| E02 | 「Missing $ inserted」で検索 | 原因候補の項目へ到達できる |
| E03 | 検索→トピック→レシピ | 選択レシピが開く |
| E04 | 行列で括弧を切り替える | コードとプレビューが連動 |
| E05 | コードコピー | `\begin`等のバックスラッシュが壊れない |
| E06 | `x_1` の簡易診断 | 数式モード外の注意が出る |
| E07 | `$x_1$` の簡易診断 | E06と同じ誤警告が出ない |
| E08 | 未設定でAIボタン | 利用不可と明示。基本機能は動く |
| E09 | GitHub Pagesサブパスで再読込 | 画面とアセットが表示される |
| E10 | モバイル表示 | 水平にはみ出さず、各操作が可能 |

### 11.3 品質基準

- `npm run build` / `npm run lint` / `npm run test` が通る。
- キーボードで検索・選択・コードコピーが可能。
- コンソールに未処理例外が出ない。
- 外部LLM・分析サービスなしでMVP全機能を利用可能。
- 未対応構文は誤判定せず「対応範囲外」と表示。

## 12. 実装順序

### Phase 0 — 初期化

1. Vite + React + TypeScript、リンター、テストを構築。
2. アプリのルーティング、共通レイアウト、GitHub Pagesワークフローを用意。
3. READMEにローカル起動・ビルド・デプロイ手順を記載。

### Phase 1 — 探す（P0）

4. JSON型・参照検証・検索ロジック。
5. トピック詳細・タグ/症状検索・関連リンク。

### Phase 2 — 試す（P0）

6. レシピ生成レジストリ、選択UI、コードコピー。
7. KaTeXプレビュー、必要パッケージ表示。

### Phase 3 — 直す（P1）

8. 字句処理・基本診断5規則。
9. 原因解説と修正比較、トピックとの横断導線。

### Phase 4 — AI拡張の準備（P1。ただし実接続不要）

10. 検証済み静的解説の表示。
11. `AiProvider`、`NetworkChecker`、接続UIの実装。
12. 大学ゲートウェイ未設定時の完全なフォールバック。`GatewayProvider`は型と実装を用意してもよいが、**実APIへの接続試行は環境設定がある場合のみ**。

### Phase 5 — 安定化

13. 単体・UI・E2Eテスト、レスポンシブ調整、アクセシビリティ確認。
14. README・制限事項・デモ用シナリオを完成。

## 13. MVP受け入れ基準（Definition of Done）

- [ ] 「探す」「試す」「直す」の3機能が一つのSPAで利用できる。
- [ ] 構文トピック約30件・レシピ約10種類・診断規則5種類。必要なら品質優先で件数不足を明記する。
- [ ] 症状・タグ・コマンド名・関連語による検索ができる。
- [ ] レシピ変更でコードとプレビューが変わる。
- [ ] 診断に行番号と修正例または解説が出る。
- [ ] 各画面が関連トピック/レシピ/診断事例へ移動できる。
- [ ] 未設定の学内AIは自動で無効化され、基本機能は利用できる。
- [ ] GitHub Pages向けビルドとデプロイ設定が完成している。
- [ ] サーバー、課金APIキー、ログインを必須としない。
- [ ] プライバシー・簡易診断の限界・公開範囲をUIとREADMEに明記する。
- [ ] テストとビルドが通る。

## 14. 不確定事項・将来判断

1. **学内LLMの実API仕様・規約・利用許可**：未確認。OpenCodeから利用できるだけではWebブラウザ連携が可能とは限らない。
2. **大学VPNの通信経路**：VPN接続後に学内Gatewayが見えるかは大学構成に依存する。
3. **HTTPS / CORS / Local Network Access**：大学APIの構成とブラウザに依存。必要なら利用者に許可ダイアログが出る。
4. **学内限定公開の要否**：この案のPages本体は一般公開。学内限定が厳密要件ならホスティング設計を変更する必要がある。
5. **学内テンプレートの利用**：公開許可のあるもののみ収録。

## 15. 主要公式資料（開発時に再確認）

- Vite / GitHub Pages: https://vite.dev/guide/static-deploy.html
- GitHub Pages公開範囲: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- KaTeX Options: https://katex.org/docs/options
- KaTeX Security: https://katex.org/docs/security
- OpenCode Server: https://docs.opencode.ai/docs/server/
- OpenCode SDK: https://docs.opencode.ai/docs/sdk/
- Browser Local Network Access: https://developer.mozilla.org/ja/docs/Web/Security/Defenses/Local_network_access

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

declare global {
  interface Window { policyViolations: Array<{ directive: string; blocked: string; source: string }> }
}

test('保存名に対応するPDF作成手順とEmacsのモード別案内を確認できる', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('#/japanese');
  await page.getByRole('combobox', { name: '利用環境' }).selectOption('linux');
  await expect(page.getByText('C-h m', { exact: true })).toBeVisible();
  await page.getByLabel('Emacsで使っているモード').selectOption('standard');
  await expect(page.getByText('C-c C-f', { exact: true })).toBeVisible();
  await page.getByLabel('Emacsで使っているモード').selectOption('auctex');
  await expect(page.getByText('C-c C-c', { exact: true })).toBeVisible();
  await page.getByLabel('使うLaTeXエンジン').selectOption('uplatex');
  await page.getByText('ターミナルで実行する場合', { exact: true }).click();
  await page.getByRole('button', { name: 'コマンドをコピー', exact: true }).click();
  const command = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  expect(command).toBe('uplatex -no-shell-escape -file-line-error report-uplatex.tex\nuplatex -no-shell-escape -file-line-error report-uplatex.tex\ndvipdfmx report-uplatex.dvi');
  await expect(page.getByLabel('日本語文書のLaTeX')).toContainText('\\documentclass[uplatex');
  await page.getByText('操作案内の出典', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'AUCTeX Manual：文書のコマンド実行' })).toHaveAttribute('rel', 'noopener noreferrer');
  const issues = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(issues.violations).toEqual([]);
  await page.getByRole('heading', { name: '保存からPDF作成まで', exact: true }).locator('..').screenshot({ path: testInfo.outputPath('starter-steps.png') });
  await page.getByRole('combobox', { name: '利用環境' }).selectOption('windows');
  await expect(page.getByLabel('Emacsで使っているモード')).toHaveCount(0);
  await expect(page.getByLabel('使うLaTeXエンジン')).toHaveValue('uplatex');
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('言い換えで数式を探し、追加のログ案内と表の固定例をコピーできる', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const external: string[] = [];
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith('http://127.0.0.1:4173/')) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  await page.goto('#/search'); await page.getByRole('searchbox').fill('イコールをそろえたい');
  await page.getByRole('link', { name: '複数行の数式を試す', exact: true }).click();
  await expect(page.getByLabel('生成したLaTeX')).toContainText('\\begin{aligned}');
  await page.getByRole('link', { name: 'まとめて調べる', exact: true }).click();
  await page.getByLabel('LaTeXで何がしたい・何が知りたいですか？').fill('画像が変な場所に出る');
  await page.getByLabel('TeXファイルを選ぶ（.tex）').setInputFiles({ name: 'example.tex', mimeType: 'text/plain', buffer: Buffer.from('\\begin{tabular}{ll}\nA & B & C \\\\\n\\end{tabular}', 'utf8') });
  await page.getByText('ログを追加', { exact: true }).click();
  await page.getByLabel('ログを貼り付ける・編集する').fill('example.tex:2: Extra alignment tab has been changed to \\cr.\nl.2 A & B & C\n! LaTeX Error: There\'s no line here to end.\nl.5 \\\\\nOverfull \\hbox (3.0pt too wide) in paragraph at lines 7--8\nbash: uplatex: command not found\n! Emergency stop.');
  await page.getByRole('button', { name: '確認する' }).click();
  await expect(page.getByRole('article', { name: '図とキャプション' })).toBeVisible();
  const card = page.getByRole('heading', { name: 'Extra alignment tab has been changed to \\cr.', exact: true }).locator('..');
  await card.getByText('この報告の確認手順', { exact: true }).click();
  await expect(card.getByText('表の列数と行末を確認', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'コードをコピー', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('\\begin{tabular}{ll}');
  await card.getByRole('button', { name: '報告された2行を編集欄で確認', exact: true }).click();
  await expect(page.getByLabel('確認するLaTeXソース')).toBeFocused();
  await card.getByText('確認手順の出典', { exact: true }).click();
  await expect(card.getByRole('link', { name: 'The TeX FAQ：表の列数と区切り' })).toHaveAttribute('referrerpolicy', 'no-referrer');
  const log = page.getByRole('heading', { name: 'ログに記録されたエラー・警告' }).locator('..');
  for (const disclosure of await log.getByText('この報告の確認手順', { exact: true }).all()) {
    if (!(await disclosure.evaluate((node) => node.closest('details')!.open))) await disclosure.click();
  }
  for (const title of ['改行指定の位置を確認', 'PDFのはみ出しを確認', 'TeXの実行先を確認', '停止する前の最初のエラーを確認']) await expect(log.getByText(title, { exact: true })).toBeVisible();
  await expect(log.getByRole('heading', { name: 'bash: uplatex: command not found', exact: true }).locator('..').getByText(/実行環境の報告/)).toBeVisible();
  const issues = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(issues.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('additional-log-guidance.png'), fullPage: true });
  expect(new URL(page.url()).hash).toBe('#/workspace');
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(external).toEqual([]);
});

test('ヘッダーの利用環境を切り替え、入力・設定を保ち、再読み込みでリセットする', async ({ page }, testInfo) => {
  const external: string[] = [];
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith('http://127.0.0.1:4173/')) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  await page.goto('#/workspace');
  const environment = page.getByRole('combobox', { name: '利用環境' });
  const source = page.getByLabel('確認するLaTeXソース');
  await page.getByText('TeXを貼り付け・編集', { exact: true }).click();
  await source.fill('x_1'); await page.getByRole('button', { name: '確認する' }).click();
  await environment.selectOption('linux');
  await page.getByText('Linux / Emacsでの操作案内', { exact: true }).click();
  await expect(page.getByText(/TeXモードとAUCTeXでは操作が異なる/)).toBeVisible();
  await expect(source).toHaveValue('x_1');
  await expect(page.getByRole('button', { name: '1行 2列を編集欄で確認' })).toBeEnabled();
  expect(new URL(page.url()).hash).toBe('#/workspace');
  await page.locator('.header-resources > summary').click();
  await page.getByRole('link', { name: '日本語文書', exact: true }).click();
  await expect(environment).toHaveValue('linux');
  await page.getByLabel('使うLaTeXエンジン').selectOption('uplatex');
  await environment.selectOption('windows');
  await page.getByText('Windows / TeX Liveでの操作案内', { exact: true }).click();
  await expect(page.getByLabel('使うLaTeXエンジン')).toHaveValue('uplatex');
  await expect(page.getByText(/^ファイルを\.texとして保存し/)).toBeVisible();
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  const issues = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(issues.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('environment-header.png') });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await environment.selectOption('other');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.reload(); await expect(environment).toHaveValue('none');
  expect(external).toEqual([]);
});

test('診断の開始位置と修正例を確認し、入力を保って再診断する', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('#/diagnose');
  const editor = page.getByRole('textbox');
  const source = '\\begin{itemize}\n\\item A\n\\end{enumerate}';
  await editor.fill(source); await page.getByRole('button', { name: '診断する', exact: true }).click();
  await expect(page.getByRole('heading', { name: '診断結果' })).toBeFocused();
  const card = page.locator('.finding').filter({ hasText: 'itemizeを閉じる位置' });
  await card.getByRole('button', { name: '開始の1行 1列を編集欄で確認' }).click();
  await expect(editor).toBeFocused(); expect(await editor.evaluate((node) => (node as HTMLTextAreaElement).selectionStart)).toBe(0);
  await card.getByRole('button', { name: '3行 1列を編集欄で確認' }).click();
  expect(await editor.evaluate((node) => (node as HTMLTextAreaElement).selectionStart)).toBe(source.indexOf('\\end'));
  await card.getByText('修正例と確認手順', { exact: true }).click();
  await card.getByRole('button', { name: 'コードをコピー' }).click();
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe('\\begin{itemize}\n\\item Example\n\\end{itemize}');
  await expect(editor).toHaveValue(source);
  await editor.fill('\\[\na+b\n\n=c\n\\]');
  await expect(card.getByRole('button', { name: '開始の1行 1列を編集欄で確認' })).toBeDisabled();
  await page.getByRole('button', { name: '診断する', exact: true }).click();
  await expect(page.getByText('MATH_PARAGRAPH_BREAK', { exact: true })).toBeVisible();
  await page.getByText('修正例と確認手順', { exact: true }).click();
  const issues = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(issues.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('diagnosis-guidance.png'), fullPage: true });
  await editor.fill('\\[\na+b\n=c\n\\]'); await page.getByRole('button', { name: '診断する', exact: true }).click();
  await expect(page.getByRole('status', { name: '診断の要約' })).toContainText('登録済みの簡易規則では問題を検出しませんでした。');
});

test('Windows形式のTeXの行移動とログの確認手順を専用画面で使える', async ({ page }, testInfo) => {
  const outbound: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173/')) outbound.push(request.url()); });
  await page.goto('#/workspace');
  await page.getByLabel('TeXファイルを選ぶ（.tex）').setInputFiles({ name: 'windows.tex', mimeType: 'text/plain', buffer: Buffer.from('α\r\n  \\(x\r\n\\]') });
  await page.getByText(/ログを追加/).click();
  await page.getByLabel('ログを貼り付ける・編集する').fill('! Missing $ inserted.\nl.3 x_1\n! Unknown private error');
  await page.getByRole('button', { name: '確認する', exact: true }).click();
  await page.getByRole('button', { name: '開始の2行 3列を編集欄で確認' }).click();
  const editor = page.getByLabel('確認するLaTeXソース');
  expect(await editor.evaluate((node) => (node as HTMLTextAreaElement).selectionStart === (node as HTMLTextAreaElement).value.indexOf('\\('))).toBe(true);
  await page.getByRole('button', { name: '3行 1列を編集欄で確認' }).click();
  expect(await editor.evaluate((node) => (node as HTMLTextAreaElement).selectionStart === (node as HTMLTextAreaElement).value.indexOf('\\]'))).toBe(true);
  await page.getByText('この報告の確認手順', { exact: true }).click();
  await expect(page.getByText('数式モードと空行を確認', { exact: true })).toBeVisible();
  await expect(page.getByText(/原因は未確定です/)).toBeVisible();
  await expect(page.getByText(/このメッセージに対応する確認手順は未収録/)).toBeVisible();
  expect(outbound).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  const issues = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(issues.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('log-guidance.png'), fullPage: true });
});

test('専用セクションで質問・TeX・ログをまとめ、コピー・行の確認ができる', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  await page.goto('#/search'); await page.getByRole('link', { name: 'まとめて調べる', exact: true }).click();
  await expect(page.getByRole('heading', { name: '質問とTeXをまとめて確認' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('workspace-entry.png'), fullPage: false });
  await expect(page.getByRole('link', { name: 'まとめて調べる', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByLabel('LaTeXで何がしたい・何が知りたいですか？').fill('分数を大きくしたい');
  const source = '% PRIVATE_SOURCE\nx_1\n\\frca{a}{b}';
  await page.getByLabel('TeXファイルを選ぶ（.tex）').setInputFiles({ name: 'demo.tex', mimeType: 'text/plain', buffer: Buffer.from(source) });
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue(source);
  await page.getByText(/ログを追加/).click();
  await page.getByLabel('ログファイルを選ぶ（.log）').setInputFiles({ name: 'demo.log', mimeType: 'text/plain', buffer: Buffer.from('demo.tex:3: Undefined control sequence.\nl.3 \\frca{a}{b}') });
  await expect(page.getByLabel('ログを貼り付ける・編集する')).toHaveValue(/Undefined control sequence/);
  await page.getByRole('button', { name: '確認する', exact: true }).click();
  await expect(page.getByRole('heading', { name: '確認結果', exact: true })).toBeFocused();
  const answer = page.getByRole('article', { name: '分数', exact: true });
  await expect(answer.getByLabel('分数のコード例')).toContainText('\\dfrac');
  await expect(page.getByRole('heading', { name: 'コマンドのタイポ候補' })).toBeVisible();
  await page.getByRole('button', { name: 'ログの報告へ' }).click();
  await expect(page.getByRole('heading', { name: 'ログに記録されたエラー・警告' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Undefined control sequence.' })).toBeVisible();
  expect(requests.filter((url) => /FormulaPreview|\.(woff2?|ttf)$/.test(url))).toEqual([]);
  await answer.getByRole('button', { name: 'コードをコピー' }).click();
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe('\\[\n\\dfrac{a+1}{b}\n\\]');
  await answer.getByText('分数の数式表示を確認する').click();
  await expect(answer.locator('.katex')).toBeVisible();
  await page.getByRole('button', { name: '書き方・例へ' }).click();
  await page.screenshot({ path: testInfo.outputPath('workspace-answer.png'), fullPage: false });
  await page.getByRole('button', { name: '報告された3行を編集欄で確認' }).click();
  await expect(page.getByLabel('確認するLaTeXソース')).toBeFocused();
  expect(await page.getByLabel('確認するLaTeXソース').evaluate((node) => (node as HTMLTextAreaElement).selectionStart)).toBe(source.indexOf('\\frca'));
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue(source);
  const issues = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(issues.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('workspace-results.png'), fullPage: true });
  await page.getByLabel('確認するLaTeXソース').fill('x_2');
  await expect(page.getByText(/入力が変わりました/)).toBeVisible();
  await expect(page.getByRole('button', { name: '報告された3行を編集欄で確認' })).toBeDisabled();
  expect(page.url() + await page.evaluate(() => JSON.stringify(history.state))).not.toContain('PRIVATE_SOURCE');
});

test('ファイルの上限・文字コードを確認し、失敗時は既存入力を保持する', async ({ page }) => {
  await page.goto('#/workspace');
  const input = page.getByLabel('TeXファイルを選ぶ（.tex）');
  await input.setInputFiles({ name: 'good.tex', mimeType: 'text/plain', buffer: Buffer.from('x_1') });
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue('x_1');
  await input.setInputFiles({ name: 'large.tex', mimeType: 'text/plain', buffer: Buffer.from('x'.repeat(10001)) });
  await expect(page.getByRole('alert')).toContainText('内容は切り捨てず');
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue('x_1');
  await input.setInputFiles({ name: 'sjis.tex', mimeType: 'text/plain', buffer: Buffer.from([0x82, 0xa0]) });
  await expect(page.getByRole('alert')).toContainText('文字コード');
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue('x_1');
  await page.getByText('文字コードの設定').click();
  await page.getByLabel('ファイルの文字コード', { exact: true }).selectOption('shift_jis');
  await input.setInputFiles({ name: 'sjis.tex', mimeType: 'text/plain', buffer: Buffer.from([0x82, 0xa0]) });
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue('あ');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('専用画面の入力は送信・保存・実行されず、再読込で破棄される', async ({ page }) => {
  const outbound: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173/')) outbound.push(request.url()); });
  await page.goto('#/workspace');
  await page.getByLabel('LaTeXで何がしたい・何が知りたいですか？').fill('PRIVATE_QUESTION 分数');
  const source = '<img src="https://example.invalid/private" onerror="window.__workspaceInjected=true">\nx_1';
  await page.getByLabel('TeXファイルを選ぶ（.tex）').setInputFiles({ name: 'private.tex', mimeType: 'text/plain', buffer: Buffer.from(source) });
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue(source);
  await page.getByRole('button', { name: '確認する', exact: true }).click();
  await expect(page.getByRole('heading', { name: '確認結果', exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, injected: '__workspaceInjected' in window }))).toEqual({ local: 0, session: 0, injected: false });
  expect(await page.locator('main img, main script').count()).toBe(0); expect(outbound).toEqual([]);
  expect(page.url() + await page.evaluate(() => JSON.stringify(history.state))).not.toContain('PRIVATE_QUESTION');
  await page.getByRole('button', { name: 'クリア' }).click();
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue('');
  await expect(page.getByRole('region', { name: '確認結果', exact: true })).toHaveCount(0);
  await page.getByLabel('LaTeXで何がしたい・何が知りたいですか？').fill('PRIVATE_AGAIN');
  await page.reload(); await expect(page.getByLabel('LaTeXで何がしたい・何が知りたいですか？')).toHaveValue('');
});


test('検索・詳細・レシピ・括弧変更・コードコピー', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('#/search');
  await page.getByRole('searchbox').fill('添字');
  await page.getByRole('link', { name: '下付き文字', exact: true }).click();
  await page.getByRole('link', { name: '下付き文字を試す →' }).click();
  await expect(page.getByLabel('添字', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '試す', exact: true }).click();
  await page.getByRole('link', { name: '行列を試す', exact: true }).click();
  await page.getByLabel('括弧', { exact: true }).selectOption('bmatrix');
  await expect(page.getByLabel('生成したLaTeX', { exact: true })).toContainText('\\begin{bmatrix}');
  await expect(page.getByRole('region', { name: '数式プレビュー' }).locator('annotation')).toContainText('\\begin{bmatrix}');
  await page.getByRole('button', { name: 'コードをコピー' }).click();
  await expect(page.getByText('コピーしました')).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  // WindowsのクリップボードはLFをCRLFに変換する。行構造とバックスラッシュは一致を要求する。
  expect(clipboard.replace(/\r\n/g, '\n')).toBe('\\[\n\\begin{bmatrix}\n  a & b \\\\\n  c & d\n\\end{bmatrix}\n\\]');
});

test('エラー文で検索し、原因と静的説明に到達', async ({ page }) => {
  await page.goto('#/search');
  await page.getByRole('searchbox').fill('Missing $ inserted');
  await page.getByRole('link', { name: '下付き文字', exact: true }).click();
  await page.getByRole('link', { name: '数式の外にある下付き記号 →' }).click();
  await expect(page.getByText('登録済みの静的解説')).toBeVisible();
  await page.getByRole('link', { name: 'この修正前の例を診断する →' }).click();
  await expect(page.getByRole('textbox')).toHaveValue('x_1');
});

test('選択中のタグを解除しても検索語を保ち、再読込で検索語を消す', async ({ page }) => {
  await page.goto(`#/search?q=${encodeURIComponent('添字')}&tag=${encodeURIComponent('図')}`);
  await expect(page.getByText('該当する項目が見つかりませんでした')).toBeVisible();
  await page.getByRole('group', { name: '選択中のタグ' }).getByRole('button', { name: '図の絞り込みを解除' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('添字');
  await expect(page.getByRole('link', { name: '下付き文字', exact: true })).toBeVisible();
  const params = new URLSearchParams(new URL(page.url()).hash.split('?')[1]);
  expect(params.has('q')).toBe(false);
  expect(params.has('tag')).toBe(false);
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByRole('link', { name: '下付き文字', exact: true })).toBeVisible();
});

test('診断は入力を変えず、正常な数式には同じ注意を出さない', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  await page.goto('#/diagnose');
  const input = page.getByRole('textbox');
  await input.fill('x_1'); await page.getByRole('button', { name: '診断する', exact: true }).click();
  await expect(page.getByText('MATH_SUBSCRIPT_OUTSIDE', { exact: true })).toBeVisible();
  await expect(page.getByText('1行 2列', { exact: true })).toBeVisible(); await expect(input).toHaveValue('x_1');
  await input.fill('$x_1$'); await page.getByRole('button', { name: '診断する', exact: true }).click();
  await expect(page.getByText('登録済みの簡易規則では問題を検出しませんでした。')).toBeVisible();
  await expect(page.getByText('MATH_SUBSCRIPT_OUTSIDE', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0); expect(external).toEqual([]);
});

test('Pagesサブパスの直接リンク・再読込と数式表示', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('#/recipes/matrix'); expect(response?.status()).toBe(200);
  await page.reload(); await expect(page.getByRole('heading', { name: '行列', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '学内AIで補足を確認' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '数式プレビュー' }).locator('.katex')).toBeVisible();
  expect(errors).toEqual([]);
});

test('各画面は水平にはみ出さず、操作・表示ができる', async ({ page }, testInfo) => {
  for (const route of ['search', 'search?q=分数', 'workspace', 'recipes', 'recipes/matrix', 'diagnose', 'topics/math-matrix', 'errors/environment-mismatch', 'help', 'japanese', 'learn?path=lab', 'reference', 'reference/math']) {
    await page.goto(`#/${route}`); await expect(page.locator('h1')).toBeVisible();
    if (route.startsWith('search?')) await expect(page.getByRole('region', { name: '検索結果', exact: true })).toBeVisible();
    if (route === 'recipes/matrix') await page.getByLabel('括弧', { exact: true }).selectOption('vmatrix');
    expect(await page.evaluate((width) => document.documentElement.scrollWidth <= width, page.viewportSize()!.width), route).toBe(true);
    if (route === 'search' || route === 'recipes/matrix' || route === 'diagnose') await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll('/', '-')}.png`), fullPage: route !== 'search' });
  }
});

test('日本語検索からスターターへ進み、UTF-8の文書を保存', async ({ page }, testInfo) => {
  await page.goto('#/search'); await page.getByRole('searchbox').fill('日本語が出ない');
  await page.getByRole('link', { name: '日本語レポートの文書クラス', exact: true }).click();
  await page.getByRole('link', { name: '日本語スターターを開く →' }).click();
  await page.getByLabel('レポートの構成').selectOption('lab');
  await page.getByLabel('使うLaTeXエンジン').selectOption('uplatex');
  await page.getByText('Overleafを使う場合の設定（upLaTeX）', { exact: true }).click();
  await expect(page.getByLabel('upLaTeX用latexmkrc', { exact: true })).toContainText("$latex = 'uplatex %O %S';");
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '.texファイルを保存' }).click();
  const download = await downloaded; expect(download.suggestedFilename()).toBe('report-uplatex.tex');
  const source = await readFile((await download.path())!, 'utf8');
  expect(source).toContain('\\documentclass[uplatex'); expect(source).toContain('\\section{結果}');
  expect(source).toContain('項目 & 値 \\\\'); expect(source).toContain('\\end{document}\n');
  await page.screenshot({ path: testInfo.outputPath('japanese.png'), fullPage: true });
});

test('学習コースの確認・クイズ・共有・印刷表示と非保存', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  await page.goto('#/learn?path=math');
  const checkbox = page.getByRole('checkbox', { name: '本文と数式モードを分ける：確認した' });
  await checkbox.check(); await expect(page.getByText('1 / 4 確認済み')).toBeVisible();
  await page.getByRole('radio', { name: 'x_ij', exact: true }).check();
  await page.getByRole('button', { name: '答えと理由を確認' }).click();
  await expect(page.getByText('もう一度、理由を確認してみましょう。')).toBeVisible();
  await page.getByRole('radio', { name: 'x_{ij}', exact: true }).check();
  await page.getByRole('button', { name: '答えと理由を確認' }).click();
  await expect(page.getByText('正解です。')).toBeVisible();
  await page.getByRole('button', { name: 'コースのリンクをコピー' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  await page.screenshot({ path: testInfo.outputPath('learn.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.site-header')).toBeHidden(); await expect(page.locator('#course-title')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.reload(); await expect(checkbox).not.toBeChecked();
  await expect(page.getByText('0 / 4 確認済み')).toBeVisible();
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(external).toEqual([]);
});

test('生成コードを診断に渡し、編集した入力は画面遷移で消える', async ({ page }) => {
  await page.goto('#/recipes/matrix'); await page.getByLabel('括弧', { exact: true }).selectOption('vmatrix');
  await page.getByRole('button', { name: '生成コードを診断する →' }).click();
  await expect(page.getByRole('textbox')).toHaveValue(/\\begin\{vmatrix\}/);
  await page.getByRole('button', { name: '診断する', exact: true }).click();
  await expect(page.getByText('登録済みの簡易規則では問題を検出しませんでした。')).toBeVisible();
  await page.getByRole('textbox').fill('PRIVATE_SOURCE');
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain('PRIVATE_SOURCE');
  await page.getByRole('link', { name: '探す', exact: true }).click();
  await page.getByRole('link', { name: '直す', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('狭い画面での200%文字表示', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  // 文字サイズ200%と狭い幅を組み合わせ、本文を横スクロールせず読めるか確認する。
  for (const route of ['search', 'search?q=分数', 'workspace', 'recipes/matrix', 'diagnose', 'japanese', 'learn?path=lab', 'reference', 'reference/math']) {
    await page.goto(`#/${route}`); await expect(page.locator('h1')).toBeVisible();
    if (route.startsWith('search?')) await expect(page.getByRole('region', { name: '検索結果', exact: true })).toBeVisible();
    // CSPでインラインstyle要素を許可せず、テストはCSSOMで文字サイズだけを変更する。
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    if (route === 'search') await page.locator('.header-resources > summary').click();
    const width = page.viewportSize()!.width;
    const layout = await page.evaluate((viewportWidth) => ({
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: Array.from(document.querySelectorAll('body *')).filter((element) => element.getBoundingClientRect().right > viewportWidth + 1).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, text: element.textContent?.slice(0, 50) })),
    }), width);
    expect(layout.scrollWidth, `${route}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(width);
  }
});

test('主要画面と結果表示のアクセシビリティ自動検査', async ({ page }) => {
  test.setTimeout(90_000);
  const violations: Array<{ route: string; issues: unknown[] }> = [];
  for (const route of ['search', 'search?q=分数', 'workspace', 'recipes/matrix', 'diagnose', 'japanese', 'learn?path=math', 'errors/environment-mismatch', 'help', 'reference', 'reference/math']) {
    await page.goto(`#/${route}`); await expect(page.locator('h1')).toBeVisible();
    if (route.startsWith('search?')) await expect(page.getByRole('region', { name: '検索結果', exact: true })).toBeVisible();
    if (route === 'diagnose') { await page.getByRole('textbox').fill('x_1'); await page.getByRole('button', { name: '診断する', exact: true }).click(); }
    if (route.startsWith('learn')) { await page.getByRole('radio', { name: 'x_{ij}', exact: true }).check(); await page.getByRole('button', { name: '答えと理由を確認' }).click(); }
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    if (results.violations.length) violations.push({ route, issues: results.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => ({ target: node.target, reason: node.failureSummary })) })) });
  }
  expect(violations).toEqual([]);
});

test('キーボードの検索・選択・コピー', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('#/recipes/matrix');
  await page.getByLabel('括弧', { exact: true }).focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page.getByLabel('生成したLaTeX', { exact: true })).toContainText('\\begin{bmatrix}');
  await page.getByRole('button', { name: 'コードをコピー' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('コピーしました')).toBeVisible();
  await page.goto('#/search'); await page.getByRole('searchbox').focus(); await page.keyboard.type('fraction');
  await expect(page.getByRole('searchbox')).toHaveValue('fraction');
  await expect(page.getByRole('heading', { name: '分数', exact: true })).toBeVisible();
});

test('出典の確認範囲・未実施の校閲・入力情報の扱いを確認できる', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  await page.goto('#/errors/outside-math-subscript');
  await expect(page.getByText(/教員などによる人手校閲は未実施です/)).toBeVisible();
  const source = page.getByRole('link', { name: '下付き文字・上付き文字', exact: true }).first();
  await expect(source).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(page.getByText(/確認日 2026-10-10/).first()).toBeVisible();
  await page.goto('#/help');
  await expect(page.getByRole('heading', { name: '情報の出典と利用' })).toBeVisible();
  await expect(page.getByText(/検索語はメモリ内だけで保持/)).toBeVisible();
  await page.getByText('収録資料の一覧（37件）', { exact: true }).click();
  await expect(page.getByText(/参照範囲：/).first()).toBeVisible();
  expect(external).toEqual([]);
});

test('基本ページでは数式・テーマ資料用のJS・CSS・フォントを取得しない', async ({ page }) => {
  const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8')) as Record<string, { file: string; css?: string[]; name?: string }>;
  const recipe = manifest['src/pages/RecipePage.tsx'];
  const deferred = [recipe.file, ...(recipe.css || [])];
  const reference = manifest['src/pages/ReferencePage.tsx'];
  const referenceAssets = [reference.file, ...(reference.css || [])];
  const symbols = manifest['src/components/symbols/SymbolCatalog.tsx'];
  const symbolAssets = [symbols.file, ...(symbols.css || [])];
  const search = manifest['src/components/search/UnifiedSearchPanel.tsx'];
  const searchAssets = [search.file, ...(search.css || [])];
  const workspace = manifest['src/pages/WorkspacePage.tsx'];
  const workspaceAssets = [workspace.file, ...(workspace.css || [])];
  const formula = manifest['src/components/recipe/FormulaPreview.tsx'];
  const formulaAssets = [formula.file, ...(formula.css || [])];
  const support = Object.values(manifest).find((chunk) => chunk.name === 'SupportReferences')!;
  const supportAssets = [support.file, ...(support.css || [])];
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('#/search'); await expect(page.getByRole('searchbox')).toBeVisible();
  expect(requests.filter((url) => [...deferred, ...referenceAssets, ...symbolAssets, ...searchAssets, ...workspaceAssets, ...formulaAssets, ...supportAssets].some((file) => url.endsWith(file)) || /\.(woff2?|ttf)$/.test(url))).toEqual([]);
  await page.getByRole('searchbox').fill('分数');
  await expect(page.getByRole('link', { name: '分数を試す', exact: true })).toBeVisible();
  for (const file of searchAssets) expect(requests.some((url) => url.endsWith(file)), file).toBe(true);
  expect(requests.filter((url) => [...deferred, ...referenceAssets, ...symbolAssets, ...workspaceAssets, ...formulaAssets].some((file) => url.endsWith(file)) || /\.(woff2?|ttf)$/.test(url))).toEqual([]);
  await page.goto('#/reference/math');
  await expect(page.getByRole('heading', { name: '数式を書く', exact: true })).toBeVisible();
  for (const file of referenceAssets) expect(requests.some((url) => url.endsWith(file)), file).toBe(true);
  expect(requests.filter((url) => deferred.some((file) => url.endsWith(file)) || /\.(woff2?|ttf)$/.test(url))).toEqual([]);
  expect(requests.filter((url) => symbolAssets.some((file) => url.endsWith(file)))).toEqual([]);
  await page.getByText('ギリシャ文字・記号の一覧を開く', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'ギリシャ文字・記号一覧' })).toBeVisible();
  for (const file of symbolAssets) expect(requests.some((url) => url.endsWith(file)), file).toBe(true);
  await page.goto('#/recipes/matrix');
  await expect(page.locator('.katex')).toBeVisible();
  for (const file of deferred) expect(requests.some((url) => url.endsWith(file)), file).toBe(true);
});

test('テーマ一覧から全6テーマを読み、直接リンクと再読込が使える', async ({ page }, testInfo) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('#/search');
  await page.locator('.header-resources > summary').click();
  await page.getByRole('link', { name: 'テーマ別資料', exact: true }).click();
  await expect(page.locator('.reference-index > li')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('reference-index.png'), fullPage: true });
  await page.getByRole('link', { name: '環境の準備', exact: true }).click();
  await expect(page.getByRole('heading', { name: '大学PC：LinuxとEmacs' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '自前PC：WindowsとTeX Live' })).toBeVisible();
  for (const [id, title] of [
    ['setup', '環境の準備'], ['math', '数式を書く'], ['figures-tables', '表・図を入れる'],
    ['structure', '文書を組み立てる'], ['references', '引用・参照を付ける'], ['errors', 'エラーを読み解く'],
  ]) {
    await page.goto(`#/reference/${id}`);
    const response = await page.reload();
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '確認ポイント' })).toBeVisible();
    expect(await page.evaluate((width) => document.documentElement.scrollWidth <= width, page.viewportSize()!.width), id).toBe(true);
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'エラーを読み解く', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(external).toEqual([]); expect(errors).toEqual([]);
});

test('テーマの目次・コピー・出典・印刷表示から関連レシピへ進める', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('#/reference/math');
  await expect(page.getByRole('heading', { name: '数式を書く', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reference-math.png'), fullPage: false });
  await page.getByRole('navigation', { name: 'このテーマの目次' }).getByRole('button', { name: '添字と分数は、まとまりを囲む' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#reference-math-scripts-fractions')).toBeFocused();
  const section = page.locator('#reference-math-scripts-fractions');
  await section.getByRole('button', { name: 'コードをコピー' }).click();
  const expected = await section.getByLabel('複数文字の添字と分数', { exact: true }).textContent();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.replace(/\r\n/g, '\n')).toBe(expected);
  expect(clipboard).toContain('a_{ij}^{2}');
  await section.locator('.reference-sources > summary').click();
  const source = section.getByRole('link', { name: 'Learn LaTeX：数式', exact: true });
  await expect(source).toHaveAttribute('href', 'https://www.learnlatex.org/ja/lesson-10');
  await expect(source).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(section.getByText(/制作元のチュートリアル · Learn LaTeX制作チーム/)).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.reference-nav')).toBeHidden();
  await expect(page.locator('.reference-body h1')).toBeVisible();
  await expect(page.locator('.reference-sources').first().locator('a')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reference-print.png'), fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('link', { name: '行列を試す →', exact: true }).click();
  await expect(page.locator('.katex')).toBeVisible();
});

test('記号一覧を必要時に開き、検索・コピー・全分類・印刷を使える', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  for (const route of ['topics/math-greek', 'recipes/symbols', 'reference/math']) {
    await page.goto(`#/${route}`); await expect(page.locator('h1')).toBeVisible();
    const toggle = page.getByText('ギリシャ文字・記号の一覧を開く', { exact: true });
    await toggle.focus(); await page.keyboard.press('Enter');
    const catalog = page.getByRole('region', { name: 'ギリシャ文字・記号一覧' });
    await expect(catalog).toBeVisible();
    await expect(catalog.getByRole('button', { name: '\\alphaをコピー', exact: true })).toBeHidden();
    await catalog.getByRole('searchbox').fill('シータ 大文字');
    await expect(catalog.getByRole('button', { name: '\\Thetaをコピー', exact: true })).toBeVisible();
    const url = page.url();
    await catalog.getByRole('button', { name: '\\Thetaをコピー', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('\\Theta');
    expect(page.url()).toBe(url);
    await catalog.getByRole('searchbox').fill('unknown-symbol');
    await expect(catalog.getByText(/一致する記号がありません/)).toBeVisible();
    await catalog.getByRole('button', { name: '絞り込みを解除' }).click();
    await catalog.getByRole('button', { name: 'すべての分類を開く' }).click();
    await expect(catalog.getByRole('button', { name: '\\alphaをコピー', exact: true })).toBeVisible();
    expect(await page.evaluate((width) => document.documentElement.scrollWidth <= width, page.viewportSize()!.width), route).toBe(true);
  }
  const catalog = page.getByRole('region', { name: 'ギリシャ文字・記号一覧' });
  await page.screenshot({ path: testInfo.outputPath('symbols-expanded.png'), fullPage: false });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await catalog.getByRole('button', { name: 'すべての分類を閉じる' }).click();
  await expect(catalog.getByRole('button', { name: '\\alphaをコピー', exact: true })).toBeHidden();
  await page.getByText('ギリシャ文字・記号の一覧を開く', { exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.symbol-group-body').first().getByText('アルファ', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(external).toEqual([]);
});

test('長い診断結果を開いて読み、補足設定と資料一覧も必要時に確認する', async ({ page }) => {
  await page.goto('#/diagnose');
  await page.getByRole('textbox').fill('x_1\n'.repeat(6));
  await page.getByRole('button', { name: '診断する', exact: true }).click();
  const results = page.getByRole('region', { name: '診断結果' });
  await expect(results.getByRole('status', { name: '診断の要約' })).toContainText('6件の注意');
  await expect(results.locator('.finding:visible')).toHaveCount(3);
  const more = page.getByText('残りの指摘を開く（3件）', { exact: true });
  await more.focus(); await page.keyboard.press('Enter');
  await expect(results.locator('.finding:visible')).toHaveCount(6);
  await page.getByRole('textbox').fill('x_1\n'.repeat(105));
  await page.getByRole('button', { name: '診断する', exact: true }).click();
  await expect(results.getByRole('status', { name: '診断の要約' })).toContainText('先頭100件まで');
  await expect(results.locator('.finding:visible')).toHaveCount(3);
  await page.goto('#/japanese');
  await page.getByLabel('使うLaTeXエンジン').selectOption('uplatex');
  await expect(page.getByLabel('日本語文書のLaTeX', { exact: true })).toBeVisible();
  await expect(page.getByLabel('upLaTeX用latexmkrc', { exact: true })).toBeHidden();
  await page.getByText('Overleafを使う場合の設定（upLaTeX）', { exact: true }).click();
  await expect(page.getByLabel('upLaTeX用latexmkrc', { exact: true })).toBeVisible();
  await page.goto('#/help');
  await expect(page.getByText(/配布版は学内LLMに接続しません/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'ギリシャ文字・数学記号の一覧', exact: true })).toBeHidden();
  await page.getByText('収録資料の一覧（37件）', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'ギリシャ文字・数学記号の一覧', exact: true })).toBeVisible();
});

test('横断検索から直接試し、検索条件を保って戻れる', async ({ page }, testInfo) => {
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  await page.goto('#/search');
  await page.getByRole('searchbox').fill('分数');
  await page.getByRole('button', { name: '検索', exact: true }).click();
  await expect(page.getByRole('heading', { name: '検索結果', exact: true })).toBeFocused();
  const results = page.getByRole('region', { name: '検索結果' });
  await expect(results.getByRole('link', { name: '分数', exact: true })).toBeVisible();
  await expect(results.getByRole('link', { name: '分数を試す', exact: true })).toBeVisible();
  await expect(results.getByRole('link', { name: '数式を書く（テーマ別資料）', exact: true })).toBeVisible();
  await expect(results.getByRole('link', { name: '数式の書き方を身につける', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('unified-search.png'), fullPage: false });
  await results.getByRole('group', { name: '検索結果の種類' }).getByRole('button', { name: /試せる例/ }).click();
  await results.getByRole('link', { name: '分数を試す', exact: true }).click();
  await expect(page.getByLabel('生成したLaTeX', { exact: true })).toContainText('\\frac');
  await expect(page.getByRole('link', { name: '試す', exact: true })).toHaveClass(/active/);
  await page.getByRole('link', { name: '← 検索結果に戻る', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('分数');
  await expect(page.getByRole('group', { name: '検索結果の種類' }).getByRole('button', { name: /試せる例/ })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(external).toEqual([]);
});

test('別の種類にある結果へ検索語を保って進み、長い一覧も展開できる', async ({ page }) => {
  await page.goto('#/search?q=Linux&type=recipe');
  await expect(page.getByText(/他の種類には結果があります/)).toBeVisible();
  await page.getByRole('button', { name: 'すべての種類を見る' }).click();
  await page.getByRole('link', { name: '環境の準備（テーマ別資料）', exact: true }).click();
  await expect(page.getByRole('heading', { name: '大学PC：LinuxとEmacs' })).toBeVisible();
  await page.getByRole('link', { name: '← 検索結果に戻る', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('Linux');
  await page.getByRole('button', { name: '検索条件をクリア' }).click();
  await page.goto('#/search?view=all');
  const results = page.getByRole('region', { name: '検索結果' });
  await expect(results.getByRole('article')).toHaveCount(8);
  await results.getByRole('button', { name: '残りの49件を表示' }).click();
  await expect(results.getByRole('article')).toHaveCount(57);
});

test('本番CSPの下で全レシピの数式表示が動く', async ({ page }) => {
  await page.addInitScript(() => {
    const checked = window;
    checked.policyViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => checked.policyViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI, source: event.sourceFile }));
  });
  for (const recipe of ['subscript', 'superscript', 'fraction', 'root', 'sum', 'integral', 'matrix', 'cases', 'aligned', 'symbols']) {
    await page.goto(`#/recipes/${recipe}`);
    await expect(page.locator('.katex')).toBeVisible();
  }
  expect(await page.evaluate(() => (window).policyViolations)).toEqual([]);
});

test('入力をHTMLとして実行せず、CSPでインライン実行と外部通信を遮断する', async ({ page }) => {
  const external: string[] = [];
  // 制限が壊れた場合も、このテストから外部に実際の通信を出さない。
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith('http://127.0.0.1:4173/')) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  await page.addInitScript(() => {
    const checked = window;
    checked.policyViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => checked.policyViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI, source: event.sourceFile }));
  });
  await page.goto('#/diagnose');
  const payload = '<img src="https://probe.example.invalid/input" onerror="document.body.dataset.inputRan=1">';
  await page.getByRole('textbox').fill(payload);
  await page.getByRole('button', { name: '診断する', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveValue(payload);
  expect(await page.evaluate(() => document.body.dataset.inputRan)).toBeUndefined();
  expect(await page.evaluate(() => (window).policyViolations)).toEqual([]);
  await page.evaluate(async () => {
    const script = document.createElement('script');
    script.textContent = "document.body.dataset.scriptRan='yes'"; document.head.append(script);
    const button = document.createElement('button');
    button.setAttribute('onclick', "document.body.dataset.handlerRan='yes'"); document.body.append(button); button.click();
    const image = document.createElement('img'); image.src = 'https://probe.example.invalid/image'; document.body.append(image);
    try { await fetch('https://probe.example.invalid/fetch'); } catch { /* CSPにより失敗することを期待 */ }
  });
  await expect.poll(() => page.evaluate(() => (window).policyViolations.map((event) => event.directive))).toEqual(expect.arrayContaining(['script-src-elem', 'script-src-attr', 'img-src', 'connect-src']));
  expect(await page.evaluate(() => ({ script: document.body.dataset.scriptRan, handler: document.body.dataset.handlerRan }))).toEqual({ script: undefined, handler: undefined });
  expect(external).toEqual([]);
});

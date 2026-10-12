import { test, expect } from '@playwright/test';

test('検索の自由入力を履歴・リンク・Storageへ残さず、HTMLを実行しない', async ({ page }) => {
  const outbound: string[] = [];
  await page.route('https://**/*', async (route) => { outbound.push(route.request().url()); await route.abort(); });
  await page.goto('#/search');
  const query = 'PRIVATE_<img src="https://probe.example.invalid/x" onerror="alert(1)">';
  await page.getByRole('searchbox').fill(query);
  await page.getByRole('button', { name: '検索', exact: true }).click();
  await expect(page.getByRole('heading', { name: '検索結果', exact: true })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#/search');
  expect(await page.locator('main img, main script, main iframe').count()).toBe(0);
  expect(await page.evaluate(() => JSON.stringify(history.state))).not.toContain('PRIVATE_');
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(await page.locator('main a').evaluateAll((links) => links.some((link) => (link as HTMLAnchorElement).href.includes('PRIVATE_')))).toBe(false);
  expect(outbound).toEqual([]);
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('');
});

test('ファイル名と貼り付けの表示偽装を拒否し、既存の入力を保持する', async ({ page }) => {
  await page.goto('#/workspace');
  await page.getByText('TeXを貼り付け・編集', { exact: true }).click();
  const source = page.getByLabel('確認するLaTeXソース');
  await source.fill('$x_1$');
  await page.getByLabel('TeXファイルを選ぶ（.tex）').setInputFiles({ name: 'report\u202e.tex', mimeType: 'text/plain', buffer: Buffer.from('PRIVATE_') });
  await expect(page.getByRole('alert')).toContainText('不可視文字');
  await expect(source).toHaveValue('$x_1$');
  await page.getByLabel('LaTeXで何がしたい・何が知りたいですか？').fill('分\u202e数');
  await expect(page.getByRole('button', { name: '確認する', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'クリア', exact: true }).click();
  await expect(source).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('BFCacheに残る画面は入力の参照を解除し、復帰時に空の状態から始める', async ({ page }) => {
  await page.goto('#/search');
  await page.getByRole('searchbox').fill('PRIVATE_SEARCH');
  await page.getByRole('link', { name: 'まとめて調べる', exact: true }).click();
  await page.getByLabel('LaTeXで何がしたい・何が知りたいですか？').fill('PRIVATE_QUESTION');
  await page.getByLabel('TeXファイルを選ぶ（.tex）').setInputFiles({ name: 'private.tex', mimeType: 'text/plain', buffer: Buffer.from('PRIVATE_SOURCE') });
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue('PRIVATE_SOURCE');
  // BFCacheのブラウザ設定に依存せず、同じライフサイクルイベントを検証する。
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(page.locator('#root')).toBeEmpty();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.getByLabel('LaTeXで何がしたい・何が知りたいですか？')).toHaveValue('');
  await expect(page.getByLabel('確認するLaTeXソース')).toHaveValue('');
  expect(await page.getByLabel('TeXファイルを選ぶ（.tex）').evaluate((node) => (node as HTMLInputElement).files?.length)).toBe(0);
  await page.getByRole('link', { name: '探す', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
});

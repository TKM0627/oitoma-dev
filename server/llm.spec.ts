import path from 'node:path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const workspace = '/oitoma-dev/#/workspace';
const available = { configured: true, model: 'UIテスト用モック', connection: 'available' };
test('APIのOrigin制限・秘密ファイル配信拒否とアクセス不可の入口', async ({ page, request }) => {
  const html = await request.get('/oitoma-dev/');
  expect(html.headers()['x-frame-options']).toBe('DENY');
  expect(html.headers()['content-security-policy']).toContain("connect-src 'self' ws://127.0.0.1:5174");
  expect((await request.get('/__llm/status')).status()).toBe(403);
  const wrongOrigin = await request.post('/__llm/answer', { headers: { Origin: 'https://evil.example', 'x-latex-navigator-llm': '1' }, data: {} });
  expect(wrongOrigin.status()).toBe(403);
  const file = path.resolve('.env.example').replaceAll('\\', '/');
  expect((await request.get(`/oitoma-dev/@fs/${file}?raw`)).status()).toBe(403);
  await page.route('**/__llm/**', (route) => route.fulfill({ json: { ...available, connection: 'unavailable' } }));
  await page.goto(workspace);
  await expect(page.getByRole('heading', { name: '学内AIを利用できません' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel('質問・したいこと')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '送信', exact: true })).toHaveCount(0);
});

test('質問と添付を1回で送信し、コピー・横断導線・アクセシビリティを確認', async ({ page, context }) => {
  const sent: unknown[] = [];
  await page.route('**/__llm/**', async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/status')) await route.fulfill({ json: available });
    else {
      sent.push(route.request().postDataJSON());
      await route.fulfill({ json: { answer: 'UIテスト用の固定応答です。分数は\\fracで書けます。', latex: '$\\frac{a}{b}$', cautions: [], related: [{ kind: 'recipe', id: 'fraction' }], referenceIds: [] } });
    }
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(workspace);
  await expect(page.getByLabel('質問・したいこと')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('llm-input.png'), fullPage: true });
  await page.getByLabel('質問・したいこと').fill('分数を書きたい');
  await page.getByLabel('TeX・ログを添付').setInputFiles([{ name: 'sample.tex', mimeType: 'text/plain', buffer: Buffer.from('x_1') }, { name: 'sample.log', mimeType: 'text/plain', buffer: Buffer.from('! Missing $ inserted.') }]);
  await expect(page.getByText('sample.tex')).toBeVisible();
  await expect(page.getByRole('button', { name: '接続を確認' })).toHaveCount(0);
  await expect(page.getByText('送信前の確認')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: '送信', exact: true }).click();
  await expect(page.getByRole('heading', { name: '回答', exact: true })).toBeVisible();
  expect(sent).toEqual([{ question: '分数を書きたい', source: 'x_1', log: '! Missing $ inserted.', environment: 'none' }]);
  await page.getByRole('button', { name: 'コードをコピー', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('$\\frac{a}{b}$');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('llm-simple-mock.png'), fullPage: true });
  await page.getByText('関連資料・試せる例', { exact: true }).click();
  await page.getByRole('link', { name: '試す：分数' }).click();
  await expect(page).toHaveURL(/#\/recipes\/fraction$/);
});

test('入力中は送信せず、添付を外せば送信対象から外れる', async ({ page }) => {
  const sent: unknown[] = [];
  await page.route('**/__llm/**', async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/status')) await route.fulfill({ json: available });
    else { sent.push(route.request().postDataJSON()); await route.fulfill({ json: { answer: 'UIテスト用の固定応答です。', latex: '', cautions: [], related: [], referenceIds: [] } }); }
  });
  await page.goto(workspace); await page.getByLabel('質問・したいこと').fill('分数を書きたい');
  await page.getByLabel('TeX・ログを添付').setInputFiles({ name: 'remove.tex', mimeType: 'text/plain', buffer: Buffer.from('PRIVATE') });
  await expect(page.getByText('remove.tex')).toBeVisible();
  await page.getByRole('button', { name: 'TeXの添付を外す' }).click();
  expect(sent).toEqual([]); await page.getByRole('button', { name: '送信', exact: true }).click();
  await expect(page.getByRole('heading', { name: '回答', exact: true })).toBeVisible();
  expect(sent).toEqual([{ question: '分数を書きたい', source: '', log: '', environment: 'none' }]);
});

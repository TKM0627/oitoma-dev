import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

beforeEach(() => { window.history.replaceState(null, '', '/#/search'); });

it('追加の言い換えから数式のレシピへ直接進める', async () => {
  const user = userEvent.setup(); render(<App />);
  await user.type(screen.getByRole('searchbox'), 'イコールをそろえたい');
  const link = await screen.findByRole('link', { name: '複数行の数式を試す' });
  await user.click(link);
  expect(await screen.findByLabelText('生成したLaTeX')).toHaveTextContent('\\begin{aligned}');
});

it('メインナビゲーションから直接レシピへ進める', async () => {
  const user = userEvent.setup(); render(<App />);
  const start = within(screen.getByRole('navigation', { name: 'メインナビゲーション' }));
  await user.click(start.getByRole('link', { name: '試す' }));
  expect(await screen.findByRole('heading', { name: '数式レシピ' })).toBeInTheDocument();
});

it('検索語を保ったまま種類を切り替え、試せる例へ直接進む', async () => {
  const user = userEvent.setup(); render(<App />);
  await user.type(screen.getByRole('searchbox'), '分数');
  const results = within(await screen.findByRole('region', { name: '検索結果' }));
  expect(results.getByRole('link', { name: '分数' })).toBeInTheDocument();
  expect(results.getByRole('link', { name: '分数を試す' })).toBeInTheDocument();
  expect(results.getByRole('link', { name: '数式を書く（テーマ別資料）' })).toBeInTheDocument();
  const filters = within(results.getByRole('group', { name: '検索結果の種類' }));
  await user.click(filters.getByRole('button', { name: /試せる例/ }));
  expect(screen.getByRole('searchbox')).toHaveValue('分数');
  expect(results.queryByRole('link', { name: '分数' })).not.toBeInTheDocument();
  expect(new URLSearchParams(window.location.hash.split('?')[1]).get('type')).toBe('recipe');
  await user.click(results.getByRole('link', { name: '分数を試す' }));
  expect(await screen.findByLabelText('生成したLaTeX')).toHaveTextContent('\\frac');
  await user.click(screen.getByRole('link', { name: '← 検索結果に戻る' }));
  expect(screen.getByRole('searchbox')).toHaveValue('分数');
  expect(within(screen.getByRole('group', { name: '検索結果の種類' })).getByRole('button', { name: /試せる例/ })).toHaveAttribute('aria-pressed', 'true');
});

it('別の種類に結果がある場合は、同じ検索語で全種類へ戻せる', async () => {
  window.history.replaceState(null, '', '/#/search?q=Linux&type=recipe');
  const user = userEvent.setup(); render(<App />);
  expect(await screen.findByText(/他の種類には結果があります/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'すべての種類を見る' }));
  expect(screen.getByRole('searchbox')).toHaveValue('Linux');
  await user.click(screen.getByRole('link', { name: '環境の準備（テーマ別資料）' }));
  expect(await screen.findByRole('heading', { name: '大学PC：LinuxとEmacs' })).toBeInTheDocument();
});

it('一覧は必要量を先に示し、残りも同じページで確認できる', async () => {
  window.history.replaceState(null, '', '/#/search?view=all');
  const user = userEvent.setup(); render(<App />);
  const results = within(await screen.findByRole('region', { name: '検索結果' }));
  expect(results.getAllByRole('article')).toHaveLength(8);
  await user.click(results.getByRole('button', { name: '残りの49件を表示' }));
  expect(results.getAllByRole('article')).toHaveLength(57);
});

it('検索中もStorage・外部APIを使わない', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup(); render(<App />);
  await user.type(screen.getByRole('searchbox'), 'emacs');
  expect(await screen.findByRole('link', { name: '環境の準備（テーマ別資料）' })).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
});

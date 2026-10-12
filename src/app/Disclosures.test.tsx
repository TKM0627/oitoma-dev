import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

beforeEach(() => { window.history.replaceState(null, '', '/#/topics/math-greek'); });

it('記号一覧を必要時に開き、ページ内で探してコマンドだけをコピーする', async () => {
  const user = userEvent.setup(); render(<App />);
  await screen.findByRole('heading', { name: 'ギリシャ文字・数式記号' });
  expect(screen.queryByRole('region', { name: 'ギリシャ文字・記号一覧' })).not.toBeInTheDocument();
  await user.click(screen.getByText('ギリシャ文字・記号の一覧を開く'));
  const catalog = await screen.findByRole('region', { name: 'ギリシャ文字・記号一覧' });
  expect(within(catalog).getByText('86 / 86種類')).toBeInTheDocument();
  expect(within(catalog).getByText('ギリシャ文字：小文字（24種類）').closest('details')).not.toHaveAttribute('open');
  const search = within(catalog).getByRole('searchbox');
  await user.type(search, 'シータ 大文字');
  const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  await user.click(within(catalog).getByRole('button', { name: '\\Thetaをコピー' }));
  expect(clipboard).toHaveBeenCalledWith('\\Theta');
  expect(window.location.hash).toBe('#/topics/math-greek');
  await user.clear(search); await user.type(search, 'unknown-symbol');
  expect(within(catalog).getByText(/一致する記号がありません/)).toBeInTheDocument();
  await user.click(within(catalog).getByRole('button', { name: '絞り込みを解除' }));
  expect(search).toHaveValue('');
  expect(within(catalog).getByText('86 / 86種類')).toBeInTheDocument();
});

it('指摘の件数と先頭を示し、残りを開いて位置順に読める', async () => {
  window.history.replaceState(null, '', '/#/diagnose');
  const user = userEvent.setup(); render(<App />);
  const source = await screen.findByRole('textbox');
  await user.type(source, 'x_1\nx_1\nx_1\nx_1\nx_1\nx_1');
  await user.click(screen.getByRole('button', { name: '診断する' }));
  expect(within(screen.getByRole('region', { name: '診断結果' })).getByRole('status', { name: '診断の要約' })).toHaveTextContent('6件の注意');
  expect(within(screen.getByRole('region', { name: '診断結果' })).getAllByRole('list')[0].children).toHaveLength(3);
  expect(screen.getByText('残りの指摘を開く（3件）').closest('details')).not.toHaveAttribute('open');
  await user.click(screen.getByText('残りの指摘を開く（3件）'));
  expect(screen.getByText('残りの指摘を開く（3件）').closest('details')).toHaveAttribute('open');
  await user.type(source, ' ');
  expect(within(screen.getByRole('region', { name: '診断結果' })).getByRole('status', { name: '診断の要約' })).toHaveTextContent('入力が変更されました');
});

it('指摘上限の案内を折りたたみの外に表示する', async () => {
  window.history.replaceState(null, '', '/#/diagnose');
  const user = userEvent.setup(); render(<App />);
  await user.click(await screen.findByRole('textbox')); await user.paste('x_1\n'.repeat(105));
  await user.click(screen.getByRole('button', { name: '診断する' }));
  expect(within(screen.getByRole('region', { name: '診断結果' })).getByRole('status', { name: '診断の要約' })).toHaveTextContent('先頭100件まで');
  expect(screen.getByText('残りの指摘を開く（97件）')).toBeInTheDocument();
});

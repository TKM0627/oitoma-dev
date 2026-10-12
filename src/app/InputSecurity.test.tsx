import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { networkChecker, explanationProvider } from '../ai/runtime';

beforeEach(() => { window.history.replaceState(null, '', '/#/search'); });

it('検索の入力・移動・戻る・種類変更でも検索語をURLやhistory stateへ保存しない', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup(); render(<App />);
  const query = 'PRIVATE_分数';
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } });
  await user.click(await screen.findByRole('button', { name: '検索条件をクリア' }));
  await user.type(screen.getByRole('searchbox'), '分数');
  await user.click(await screen.findByRole('link', { name: '分数を試す' }));
  expect(JSON.stringify(window.history.state)).not.toContain('分数');
  await user.click(await screen.findByRole('link', { name: '← 検索結果に戻る' }));
  expect(screen.getByRole('searchbox')).toHaveValue('分数');
  expect(window.location.href).not.toContain('q=');
  expect(JSON.stringify(window.history.state)).not.toContain(query);
  expect(fetcher).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
});

it('旧URLの検索語をメモリへ取り込み、未知の項目を現在のURLから除く', async () => {
  window.history.replaceState(null, '', '/#/search?q=分数&token=PRIVATE&tag=PRIVATE&type=recipe');
  render(<App />);
  await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('分数'));
  expect(window.location.hash).toBe('#/search?type=recipe');
  expect(JSON.stringify(window.history.state)).not.toContain('PRIVATE');
});

it('巨大なURL検索語を検索せず、現在のURLから除く', () => {
  window.history.replaceState(null, '', `/#/search?q=${'x'.repeat(10000)}`);
  render(<App />);
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(window.location.hash).toBe('#/search');
});

it('検索欄に表示偽装の文字がある場合は処理を拒否し、入力を勝手に書き換えない', async () => {
  render(<App />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '分\u202e数' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('不可視文字');
  expect(screen.getByRole('searchbox')).toHaveValue('分\u202e数');
  expect(screen.getByRole('button', { name: '検索' })).toBeDisabled();
});

it.each(['diagnose', 'workspace'])('貼り付けの制御文字を%sでも拒否する', async (route) => {
  window.history.replaceState(null, '', `/#/${route}`); render(<App />);
  const input = route === 'diagnose' ? await screen.findByRole('textbox', { name: 'LaTeXの断片を貼り付ける' }) : await screen.findByLabelText('LaTeXで何がしたい・何が知りたいですか？');
  fireEvent.change(input, { target: { value: 'x\u0000_1' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('制御文字');
  expect(screen.getByRole('button', { name: route === 'diagnose' ? /診断する/ : '確認する' })).toBeDisabled();
  expect(input).toHaveValue('x\u0000_1');
});

it('学内APIを模したHTML風の回答を文字列として表示し、リンクやスクリプトに変えない', async () => {
  window.history.replaceState(null, '', '/#/errors/outside-math-subscript');
  vi.spyOn(networkChecker, 'check').mockResolvedValue('available');
  vi.spyOn(networkChecker, 'getSnapshot').mockReturnValue('available');
  vi.spyOn(networkChecker, 'supportsExplanations').mockReturnValue(true);
  const text = '<img src="https://evil.example/steal" onerror="alert(1)"><script>steal()</script>';
  vi.spyOn(explanationProvider, 'getExplanation').mockResolvedValue({ explanationId: 'outside-math-subscript', text, relatedTopicIds: [], referenceIds: [], source: 'university' });
  const user = userEvent.setup(); render(<App />);
  await user.click(await screen.findByRole('button', { name: '学内AIで補足を確認' }));
  expect(await screen.findByText(text)).toBeInTheDocument();
  expect(document.querySelector('main img, main script, main iframe, main a[href^="https://evil.example"]')).toBeNull();
});

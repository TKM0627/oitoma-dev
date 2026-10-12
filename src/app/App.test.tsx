import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { content } from '../domain/content/contentRepository';

beforeEach(() => { window.history.replaceState(null, '', '/#/search'); });
describe('主要画面の操作', () => {
  it('検索からトピック、レシピへ移動してコピーする', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByRole('searchbox'), '添字');
    await user.click(await screen.findByRole('link', { name: '下付き文字' }));
    await user.click(await screen.findByRole('link', { name: '下付き文字を試す →' }));
    await screen.findByLabelText('添字');
    await user.selectOptions(screen.getByLabelText('添字'), 'ij');
    expect(screen.getByLabelText('生成したLaTeX')).toHaveTextContent('x_{ij}');
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'コードをコピー' }));
    expect(clipboard).toHaveBeenCalledWith('\\[\nx_{ij}\n\\]');
    expect(screen.getByText('コピーしました')).toBeInTheDocument();
  });
  it('タグ・エラー文・結果0件を案内する', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByText('カテゴリ・よくある症状から探す'));
    await user.click(screen.getByRole('button', { name: /Missing \$ inserted/ }));
    expect(await screen.findByRole('link', { name: '下付き文字' })).toBeInTheDocument();
    await user.click(screen.getByText('カテゴリ・よくある症状から探す'));
    await user.click(within(screen.getByRole('region', { name: 'カテゴリから探す' })).getByRole('button', { name: /図/ }));
    expect(screen.getByText('該当する項目が見つかりませんでした')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '条件を外して探す' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
  it('選択中のタグだけを解除し、検索語を保つ', async () => {
    window.history.replaceState(null, '', '/#/search?q=添字&tag=図');
    const user = userEvent.setup(); render(<App />);
    expect(screen.getByText('該当する項目が見つかりませんでした')).toBeInTheDocument();
    await user.click(within(screen.getByRole('group', { name: '選択中のタグ' })).getByRole('button', { name: '図の絞り込みを解除' }));
    expect(screen.getByRole('searchbox')).toHaveValue('添字');
    expect(screen.getByRole('link', { name: '下付き文字' })).toBeInTheDocument();
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    expect(params.has('q')).toBe(false);
    expect(params.has('tag')).toBe(false);
  });
  it('行列の括弧とプレビューを連動させる', async () => {
    window.history.replaceState(null, '', '/#/recipes/matrix');
    const user = userEvent.setup(); render(<App />);
    const bracket = await screen.findByLabelText('括弧');
    await user.selectOptions(bracket, 'bmatrix');
    expect(screen.getByLabelText('生成したLaTeX')).toHaveTextContent('\\begin{bmatrix}');
    expect(screen.getByRole('region', { name: '数式プレビュー' }).querySelector('annotation')?.textContent).toContain('\\begin{bmatrix}');
    expect(screen.getByText('\\usepackage{amsmath}')).toBeInTheDocument();
  });
  it('入力を保存・送信・自動修正せず診断する', async () => {
    window.history.replaceState(null, '', '/#/diagnose');
    const fetcher = vi.spyOn(globalThis, 'fetch'); const storage = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup(); render(<App />);
    const input = await screen.findByRole('textbox', { name: 'LaTeXの断片を貼り付ける' });
    await user.type(input, 'x_1'); await user.click(screen.getByRole('button', { name: /診断する/ }));
    expect(screen.getByText('MATH_SUBSCRIPT_OUTSIDE')).toBeInTheDocument(); expect(screen.getByText('1行 2列')).toBeInTheDocument();
    expect(input).toHaveValue('x_1');
    await user.clear(input); await user.type(input, '$x_1$');
    expect(screen.getByText(/入力が変更されました/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /診断する/ }));
    expect(screen.getByText('登録済みの簡易規則では問題を検出しませんでした。')).toBeInTheDocument();
    expect(screen.queryByText('MATH_SUBSCRIPT_OUTSIDE')).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled();
  });
  it('未設定AIと静的説明でも修正例を使える', async () => {
    window.history.replaceState(null, '', '/#/errors/outside-math-subscript');
    const user = userEvent.setup(); render(<App />);
    expect(await screen.findByText('登録済みの静的解説')).toBeInTheDocument();
    expect(screen.getByText(/教員などによる人手校閲は未実施です/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '下付き文字・上付き文字' })[0]).toHaveAttribute('href', 'https://www.overleaf.com/learn/latex/Subscripts_and_superscripts');
    expect(screen.queryByRole('button', { name: '学内AIで補足を確認' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /この修正前の例を診断する/ }));
    expect(screen.getByRole('textbox')).toHaveValue('x_1');
  });
  it('キーボードで操作し、スキップリンクがHashRouterを壊さない', async () => {
    const user = userEvent.setup(); render(<App />);
    const skip = screen.getByRole('link', { name: '本文へ移動' }); skip.focus(); await user.keyboard('{Enter}');
    expect(window.location.hash).toBe('#/search'); expect(screen.getByRole('main')).toHaveFocus();
    screen.getByRole('searchbox').focus(); await user.keyboard('fraction');
    await user.tab(); expect(screen.getByRole('button', { name: '検索' })).toHaveFocus();
    await user.keyboard('{Enter}'); expect(await screen.findByRole('heading', { name: '検索結果' })).toHaveFocus();
  });
  it('無効IDと外部リンクの安全な表示', async () => {
    window.history.replaceState(null, '', '/#/topics/missing'); render(<App />);
    expect(await screen.findByRole('heading', { name: 'ページが見つかりません' })).toBeInTheDocument();
    const user = userEvent.setup(); await user.click(screen.getByRole('link', { name: /使い方/ }));
    const reference = await within(screen.getByRole('main')).findByRole('link', { name: /数式の記述と数式モード/ });
    expect(reference).toHaveAttribute('rel', 'noopener noreferrer'); expect(reference).toHaveAttribute('href', 'https://www.overleaf.com/learn/latex/Mathematical_expressions');
    expect(reference).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByRole('heading', { name: '情報の出典と利用' })).toBeInTheDocument();
    expect(screen.getByText(/検索語はメモリ内だけで保持/)).toBeInTheDocument();
    expect(screen.getAllByText(/確認日 \d{4}-\d{2}-\d{2}/)).toHaveLength(content.references.length);
  });
});

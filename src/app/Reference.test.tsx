import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

beforeEach(() => { window.history.replaceState(null, '', '/#/reference'); });

describe('テーマ別に読む参照資料', () => {
  it('6テーマの一覧から、必要な例と既存のレシピへ進める', async () => {
    const user = userEvent.setup(); render(<App />);
    const main = within(screen.getByRole('main'));
    await main.findByRole('heading', { name: 'テーマからLaTeXを学ぶ' });
    expect(main.getAllByRole('listitem').length).toBe(6);
    await user.click(main.getByRole('link', { name: '数式を書く' }));
    await main.findByRole('heading', { name: '数式を書く' });
    expect(main.getByLabelText('複数文字の添字と分数')).toHaveTextContent('a_{ij}^{2}');
    expect(main.getAllByText(/プリアンブルに\\usepackage\{amsmath\}/)[0]).toBeInTheDocument();
    await user.click(main.getByRole('link', { name: '行列を試す →' }));
    expect(await main.findByLabelText('括弧')).toBeInTheDocument();
  });
  it('ソースの種類・参照範囲を確認し、コードを改行のままコピーできる', async () => {
    window.history.replaceState(null, '', '/#/reference/math');
    const user = userEvent.setup(); render(<App />);
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const code = await screen.findByLabelText('文中の式と独立した式');
    await user.click(screen.getAllByRole('button', { name: 'コードをコピー' })[0]);
    expect(clipboard).toHaveBeenCalledWith(code.textContent);
    expect(clipboard.mock.calls[0][0]).toContain('\\[\n');
    await user.click(screen.getAllByText('出典と参照範囲（1件）')[0]);
    const section = within(code.closest('section')!);
    expect(section.getByText(/制作元のチュートリアル · Learn LaTeX制作チーム/)).toBeVisible();
    expect(section.getByText(/参照範囲：文中と独立した数式/)).toBeVisible();
    const source = section.getByRole('link', { name: 'Learn LaTeX：数式' });
    expect(source).toHaveAttribute('href', 'https://www.learnlatex.org/ja/lesson-10');
    expect(source).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(storage).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('大学PCの未確認設定を明示し、印刷と前後のテーマを案内する', async () => {
    window.history.replaceState(null, '', '/#/reference/setup');
    const user = userEvent.setup(); render(<App />);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await screen.findByRole('heading', { name: '環境の準備' });
    expect(screen.getByText(/大学PCにどちらが入っているか/)).toBeInTheDocument();
    expect(screen.getByText(/実際のTeXコンパイル検証は未実施/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'このテーマを印刷' }));
    expect(print).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('link', { name: '次：数式を書く →' }));
    expect(await screen.findByRole('heading', { name: '数式を書く' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '数式を書く' })).toHaveAttribute('aria-current', 'page');
  });
  it('未知のテーマでは登録済みの情報を表示せず、検索へ案内する', async () => {
    window.history.replaceState(null, '', '/#/reference/unknown'); render(<App />);
    expect(await screen.findByRole('heading', { name: 'ページが見つかりません' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '書き方を探す →' })).toHaveAttribute('href', '#/search');
  });
});

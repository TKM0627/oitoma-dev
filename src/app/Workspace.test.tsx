import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

beforeEach(() => { window.history.replaceState(null, '', '/#/workspace'); });
function localFile(name: string, source: string) {
  const file = new File([source], name, { type: 'text/plain' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(new TextEncoder().encode(source)).buffer });
  return file;
}
async function start() { render(<App />); await screen.findByRole('heading', { name: '質問とTeXをまとめて確認' }); }

describe('質問・ファイルの専用画面', () => {
  it('追加の表エラーを説明し、固定例のコピーと安全な出典表示ができる', async () => {
    const user = userEvent.setup(); const fetcher = vi.spyOn(globalThis, 'fetch'); await start();
    await user.click(screen.getByText(/ログを追加/));
    await user.type(screen.getByLabelText('ログを貼り付ける・編集する'), '! Extra alignment tab has been changed to \\cr.\nl.4 A & B & C');
    await user.click(screen.getByRole('button', { name: '確認する' }));
    const log = screen.getByRole('heading', { name: 'ログに記録されたエラー・警告' }).closest('section')!;
    await user.click(within(log).getByText('この報告の確認手順'));
    expect(within(log).getByText('表の列数と行末を確認')).toBeVisible();
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(within(log).getByRole('button', { name: 'コードをコピー' }));
    expect(clipboard.mock.calls[0][0]).toContain('\\begin{tabular}{ll}');
    expect(clipboard.mock.calls[0][0]).not.toContain('A & B & C');
    await user.click(within(log).getByText('確認手順の出典'));
    expect(within(log).getByRole('link', { name: 'The TeX FAQ：表の列数と区切り' })).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(fetcher).not.toHaveBeenCalled(); expect(window.location.hash).toBe('#/workspace');
  });
  it('WindowsのCRLFファイルでも表示欄の正しい位置に移動する', async () => {
    const user = userEvent.setup(); await start();
    await user.upload(screen.getByLabelText('TeXファイルを選ぶ（.tex）'), localFile('windows.tex', 'α\r\n  \\(x\r\n\\]'));
    await user.click(screen.getByRole('button', { name: '確認する' }));
    await user.click(screen.getByRole('button', { name: '開始の2行 3列を編集欄で確認' }));
    const editor = screen.getByLabelText('確認するLaTeXソース') as HTMLTextAreaElement;
    expect(editor.selectionStart).toBe(editor.value.indexOf('\\('));
    await user.click(screen.getByRole('button', { name: '3行 1列を編集欄で確認' }));
    expect(editor.selectionStart).toBe(editor.value.indexOf('\\]'));
    expect(editor.value).toBe('α\n  \\(x\n\\]');
  });
  it('環境の指摘で対応する開始へ移り、固定の修正例をコピーできる', async () => {
    const user = userEvent.setup(); await start();
    const source = '\\begin{itemize}\n\\item A\n\\end{enumerate}';
    await user.upload(screen.getByLabelText('TeXファイルを選ぶ（.tex）'), localFile('sample.tex', source));
    await user.click(screen.getByRole('button', { name: '確認する' }));
    const card = screen.getByRole('heading', { name: 'itemizeを閉じる位置にenumerateの終了があります。' }).closest('li')!;
    await user.click(within(card).getByRole('button', { name: '開始の1行 1列を編集欄で確認' }));
    const editor = screen.getByLabelText('確認するLaTeXソース') as HTMLTextAreaElement;
    expect(editor).toHaveFocus(); expect(editor.selectionStart).toBe(0); expect(editor.value).toBe(source);
    await user.click(within(card).getByText('修正例と確認手順'));
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(within(card).getByRole('button', { name: 'コードをコピー' }));
    expect(clipboard).toHaveBeenCalledWith('\\begin{itemize}\n\\item Example\n\\end{itemize}');
    expect(editor.value).toBe(source);
    await user.type(editor, 'a');
    expect(within(card).getByRole('button', { name: '開始の1行 1列を編集欄で確認' })).toBeDisabled();
  });
  it('ログの確認手順は一般的な候補と明示し、未知のメッセージは捏造しない', async () => {
    const user = userEvent.setup(); await start();
    await user.click(screen.getByText(/ログを追加/));
    await user.type(screen.getByLabelText('ログを貼り付ける・編集する'), '! Missing $ inserted.\nl.3 x_1\n! Unknown private error');
    await user.click(screen.getByRole('button', { name: '確認する' }));
    const log = screen.getByRole('heading', { name: 'ログに記録されたエラー・警告' }).closest('section')!;
    await user.click(within(log).getByText('この報告の確認手順'));
    expect(within(log).getByText('数式モードと空行を確認')).toBeVisible();
    expect(within(log).getByText(/原因は未確定です/)).toBeVisible();
    expect(within(log).getByText(/このメッセージに対応する確認手順は未収録/)).toBeVisible();
    expect(window.location.hash).toBe('#/workspace');
  });
  it('質問から登録済みのコードを表示し、コピーと数式確認ができる', async () => {
    const user = userEvent.setup(); await start();
    await user.type(screen.getByLabelText('LaTeXで何がしたい・何が知りたいですか？'), '分数を大きくしたい');
    await user.click(screen.getByRole('button', { name: '確認する' }));
    expect(screen.getByRole('heading', { name: '確認結果' })).toHaveFocus();
    const answer = screen.getByRole('article', { name: '分数' });
    expect(within(answer).getByLabelText('分数のコード例')).toHaveTextContent('\\dfrac');
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(within(answer).getByRole('button', { name: 'コードをコピー' }));
    expect(clipboard).toHaveBeenCalledWith('\\[\n\\dfrac{a+1}{b}\n\\]');
    await user.click(within(answer).getByText('分数の数式表示を確認する'));
    expect(await within(answer).findByRole('region', { name: '数式プレビュー' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/workspace');
  });
  it('ファイルから指摘とタイポ候補を表示し、元の位置へ移れる', async () => {
    const user = userEvent.setup(); await start();
    await user.upload(screen.getByLabelText('TeXファイルを選ぶ（.tex）'), localFile('demo.tex', 'x_1\n\\frca{a}{b}'));
    await user.click(screen.getByRole('button', { name: '確認する' }));
    expect(screen.getByRole('heading', { name: 'コマンドのタイポ候補' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ソースの指摘へ' }));
    expect(screen.getByRole('heading', { name: 'ソースの簡易チェック' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '1行 2列を編集欄で確認' }));
    const editor = screen.getByLabelText('確認するLaTeXソース') as HTMLTextAreaElement;
    expect(editor).toHaveFocus(); expect(editor.selectionStart).toBe(1); expect(editor.value).toBe('x_1\n\\frca{a}{b}');
    await user.type(editor, 'a');
    expect(screen.getByText(/入力が変わりました/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1行 2列を編集欄で確認' })).toBeDisabled();
  });
  it('質問・ソース・ログを送信・保存せず、離れたら破棄する', async () => {
    const user = userEvent.setup(); const fetcher = vi.spyOn(globalThis, 'fetch'); await start();
    await user.type(screen.getByLabelText('LaTeXで何がしたい・何が知りたいですか？'), 'PRIVATE_QUESTION 分数');
    await user.upload(screen.getByLabelText('TeXファイルを選ぶ（.tex）'), localFile('private.tex', '% PRIVATE_SOURCE\nx_1'));
    await user.click(screen.getByText(/ログを追加/));
    await user.type(screen.getByLabelText('ログを貼り付ける・編集する'), '! PRIVATE_LOG\nl.2 x_1');
    await user.click(screen.getByRole('button', { name: '確認する' }));
    expect(fetcher).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(window.history.state) + window.location.href).not.toContain('PRIVATE_');
    await user.click(screen.getByRole('link', { name: '探す' }));
    await user.click(screen.getByRole('link', { name: 'まとめて調べる' }));
    expect(await screen.findByLabelText('LaTeXで何がしたい・何が知りたいですか？')).toHaveValue('');
    expect(screen.getByLabelText('確認するLaTeXソース')).toHaveValue('');
  });
  it('ファイルが不正でも既存入力を失わない', async () => {
    const user = userEvent.setup(); await start();
    await user.upload(screen.getByLabelText('TeXファイルを選ぶ（.tex）'), localFile('good.tex', 'x_1'));
    await user.upload(screen.getByLabelText('TeXファイルを選ぶ（.tex）'), localFile('bad.tex', 'x'.repeat(10001)));
    expect(await screen.findByRole('alert')).toHaveTextContent('内容は切り捨てず');
    expect(screen.getByLabelText('確認するLaTeXソース')).toHaveValue('x_1');
  });
  it('クリア後に遅いファイル読み込みで入力を復活させない', async () => {
    const user = userEvent.setup(); await start();
    let resolve!: (value: ArrayBuffer) => void;
    const file = new File(['x_1'], 'slow.tex');
    Object.defineProperty(file, 'arrayBuffer', { value: () => new Promise<ArrayBuffer>((done) => { resolve = done; }) });
    await user.upload(screen.getByLabelText('TeXファイルを選ぶ（.tex）'), file);
    expect(screen.getByRole('button', { name: '確認する' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'クリア' }));
    await act(async () => { resolve(Uint8Array.from(new TextEncoder().encode('x_1')).buffer); });
    expect(screen.getByLabelText('確認するLaTeXソース')).toHaveValue('');
    expect(screen.queryByText('読み込み済み：slow.tex')).not.toBeInTheDocument();
  });
  it('ログだけでも読み取れ、別ファイルの位置へジャンプしない', async () => {
    const user = userEvent.setup(); await start();
    await user.click(screen.getByText(/ログを追加/));
    await user.upload(screen.getByLabelText('ログファイルを選ぶ（.log）'), localFile('demo.log', 'other.tex:12: Undefined control sequence.'));
    await user.click(screen.getByRole('button', { name: '確認する' }));
    expect(screen.getByRole('heading', { name: 'Undefined control sequence.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '報告された12行を編集欄で確認' })).not.toBeInTheDocument();
  });
});

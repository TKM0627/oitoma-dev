import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

beforeEach(() => { window.history.replaceState(null, '', '/#/diagnose'); });
describe('診断の行移動と修正例', () => {
  it('元の開始と終了を確認でき、コピーや結果移動で入力を書き換えない', async () => {
    const user = userEvent.setup(); const fetcher = vi.spyOn(globalThis, 'fetch'); render(<App />);
    const editor = await screen.findByRole('textbox') as HTMLTextAreaElement;
    const code = '\\begin{itemize}\r\n\\item A\r\n\\end{enumerate}';
    fireEvent.change(editor, { target: { value: code } });
    const unchanged = editor.value;
    await user.click(screen.getByRole('button', { name: '診断する' }));
    expect(screen.getByRole('heading', { name: '診断結果' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '開始の1行 1列を編集欄で確認' }));
    expect(editor).toHaveFocus(); expect(editor.selectionStart).toBe(0);
    await user.click(screen.getByRole('button', { name: '3行 1列を編集欄で確認' }));
    expect(editor.selectionStart).toBe(unchanged.lastIndexOf('\\end'));
    const card = screen.getByText('ENV_MISMATCH').closest('li')!;
    await user.click(within(card).getByText('修正例と確認手順'));
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(within(card).getByRole('button', { name: 'コードをコピー' }));
    expect(clipboard).toHaveBeenCalledWith('\\begin{itemize}\n\\item Example\n\\end{itemize}');
    expect(editor.value).toBe(unchanged); expect(fetcher).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  });
  it('変更前の結果にある行移動は無効にし、再診断で更新する', async () => {
    const user = userEvent.setup(); render(<App />);
    const editor = await screen.findByRole('textbox');
    fireEvent.change(editor, { target: { value: '\\(x\\]' } });
    await user.click(screen.getByRole('button', { name: '診断する' }));
    fireEvent.change(editor, { target: { value: '\\(x\\)' } });
    expect(screen.getByRole('button', { name: '開始の1行 1列を編集欄で確認' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '1行 4列を編集欄で確認' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '診断する' }));
    expect(screen.getByText('登録済みの簡易規則では問題を検出しませんでした。')).toBeVisible();
  });
  it('数式中の空行を検出し、修正例は必要なときだけ開く', async () => {
    const user = userEvent.setup(); render(<App />);
    const editor = await screen.findByRole('textbox');
    fireEvent.change(editor, { target: { value: '\\[\na+b\n\n=c\n\\]' } });
    await user.click(screen.getByRole('button', { name: '診断する' }));
    expect(screen.getByText('MATH_PARAGRAPH_BREAK')).toBeVisible();
    const card = screen.getByText('MATH_PARAGRAPH_BREAK').closest('li')!;
    expect(within(card).queryByLabelText('修正例')).not.toBeInTheDocument();
    await user.click(within(card).getByText('修正例と確認手順'));
    expect(within(card).getByLabelText('修正例')).toHaveTextContent('a+b');
    expect(within(card).getByText(/入力全体を修正したコードではありません/)).toBeVisible();
  });
});

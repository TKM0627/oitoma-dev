import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudyProvider } from '../../app/StudyProvider';
import LlmPanel from './LlmPanel';

const status = { configured: true, model: 'test-model', connection: 'available' };
const answer = { answer: '<script>ignored()</script>\n分数の例です。', latex: '$\\frac{a}{b}$', cautions: [], related: [{ kind: 'recipe', id: 'fraction' }], referenceIds: [] };
const json = (data: unknown, code = 200) => new Response(JSON.stringify(data), { status: code, headers: { 'Content-Type': 'application/json' } });
function panel() { return <MemoryRouter><StudyProvider><LlmPanel /></StudyProvider></MemoryRouter>; }
async function start() {
  const fetcher = vi.fn().mockResolvedValueOnce(json(status)); vi.stubGlobal('fetch', fetcher);
  const view = render(panel()); await screen.findByLabelText('質問・したいこと'); return { fetcher, view, user: userEvent.setup() };
}
function file(name: string, text: string) {
  const value = new File([text], name, { type: 'text/plain' });
  Object.defineProperty(value, 'arrayBuffer', { value: async () => new TextEncoder().encode(text).buffer });
  return value;
}
afterEach(() => vi.unstubAllGlobals());

describe('学内AIを使える環境だけで質問できる画面', () => {
  it('入口で自動確認し、質問・ファイルは送信を押すまで送らない', async () => {
    const { fetcher, user } = await start();
    expect(fetcher.mock.calls[0][0]).toBe('/__llm/status'); expect(fetcher.mock.calls[0][1].body).toBeUndefined();
    await user.type(screen.getByLabelText('質問・したいこと'), '分数を書きたい');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '接続を確認' })).not.toBeInTheDocument();
    expect(screen.queryByText('送信前の確認')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
  it.each(['unavailable', 'authentication-required', 'unverified'])('アクセス状態%sでは入力欄を出さない', async (connection) => {
    const fetcher = vi.fn().mockResolvedValue(json({ ...status, connection })); vi.stubGlobal('fetch', fetcher);
    render(panel()); await screen.findByRole('heading', { name: '学内AIを利用できません' });
    expect(screen.queryByLabelText('質問・したいこと')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: '送信' })).not.toBeInTheDocument();
  });
  it('添付した内容を、質問と一緒に1回の送信で渡す', async () => {
    const { fetcher, user } = await start(); fetcher.mockResolvedValueOnce(json(answer));
    await user.type(screen.getByLabelText('質問・したいこと'), 'このTeXを確認して');
    await user.upload(screen.getByLabelText('TeX・ログを添付'), [file('sample.tex', '\\frca{a}{b}'), file('sample.log', '! Missing $ inserted.')]);
    await screen.findByText('sample.tex'); await user.click(screen.getByRole('button', { name: '送信' }));
    await screen.findByRole('heading', { name: '回答' });
    const [, init] = fetcher.mock.calls[1];
    expect(JSON.parse(init.body)).toEqual({ question: 'このTeXを確認して', source: '\\frca{a}{b}', log: '! Missing $ inserted.', environment: 'none' });
    expect(init.body).not.toContain('sample.tex');
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
  });
  it('ドロップしたTeXを外すと送信対象から外れる', async () => {
    const { user, fetcher } = await start(); fetcher.mockResolvedValueOnce(json(answer));
    fireEvent.drop(screen.getByLabelText('質問・したいこと').closest('form')!, { dataTransfer: { files: [file('drop.tex', 'PRIVATE')] } });
    await screen.findByText('drop.tex'); await user.click(screen.getByRole('button', { name: 'TeXの添付を外す' }));
    await user.type(screen.getByLabelText('質問・したいこと'), '分数を書きたい'); await user.click(screen.getByRole('button', { name: '送信' }));
    await screen.findByRole('heading', { name: '回答' });
    expect(JSON.parse(fetcher.mock.calls[1][1].body).source).toBe('');
  });
  it('貼り付けたTeXも送信でき、HTMLはテキストで表示してコードをコピーできる', async () => {
    const { user, fetcher } = await start(); fetcher.mockResolvedValueOnce(json(answer));
    await user.click(screen.getByText('TeX・ログを貼り付ける')); await user.type(screen.getByLabelText('TeXソース'), 'x_1');
    await user.click(screen.getByRole('button', { name: '送信' }));
    const result = (await screen.findByRole('heading', { name: '回答' })).closest('article')!;
    expect(result.querySelector('script')).toBeNull(); expect(within(result).getByText(/<script>/)).toBeVisible();
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(); await user.click(within(result).getByRole('button', { name: 'コードをコピー' }));
    expect(clipboard).toHaveBeenCalledWith(answer.latex); expect(JSON.parse(fetcher.mock.calls[1][1].body).source).toBe('x_1');
    await user.click(within(result).getByText('関連資料・試せる例'));
    expect(within(result).getByRole('link', { name: /試す：分数/ })).toHaveAttribute('href', '/recipes/fraction');
  });
  it('大きいログを切り捨てずに拒否する', async () => {
    const { user, fetcher } = await start();
    await user.upload(screen.getByLabelText('TeX・ログを添付'), file('long.log', 'x'.repeat(4001)));
    expect(await screen.findByRole('alert')).toHaveTextContent('4,000文字'); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('long.log')).not.toBeInTheDocument();
  });
  it('中止と画面離脱で通信を打ち切る', async () => {
    const { user, fetcher, view } = await start();
    const wait = (_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    fetcher.mockImplementationOnce(wait); await user.type(screen.getByLabelText('質問・したいこと'), '分数');
    await user.click(screen.getByRole('button', { name: '送信' }));
    const signal = fetcher.mock.calls[1][1].signal; await user.click(screen.getByRole('button', { name: '中止' }));
    expect(signal.aborted).toBe(true); await screen.findByText('回答待ちを中止しました。');
    fetcher.mockImplementationOnce(wait); await user.click(screen.getByRole('button', { name: '送信' }));
    const leaving = fetcher.mock.calls[2][1].signal; await act(async () => view.unmount()); expect(leaving.aborted).toBe(true);
  });
  it('復帰時にアクセスできなくなったら入力・結果を破棄して閉じる', async () => {
    const { user, fetcher } = await start();
    await user.type(screen.getByLabelText('質問・したいこと'), 'PRIVATE'); fetcher.mockResolvedValueOnce(json({ ...status, connection: 'unavailable' }));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange'));
    await screen.findByRole('heading', { name: '学内AIを利用できません' }); expect(screen.queryByDisplayValue('PRIVATE')).not.toBeInTheDocument();
  });
  it('送信直前に拒否された場合も入力画面を閉じる', async () => {
    const { user, fetcher } = await start(); fetcher.mockResolvedValueOnce(json({ error: '学内AIを利用できません。' }, 403));
    await user.type(screen.getByLabelText('質問・したいこと'), 'PRIVATE');
    await user.click(screen.getByRole('button', { name: '送信' }));
    await screen.findByRole('heading', { name: '学内AIを利用できません' }); expect(screen.queryByDisplayValue('PRIVATE')).not.toBeInTheDocument();
  });
});

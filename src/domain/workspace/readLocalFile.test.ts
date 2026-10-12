import { describe, expect, it, vi } from 'vitest';
import { FILE_BYTE_LIMITS, readLocalFile } from './readLocalFile';

function file(name: string, data: string | number[], declaredSize?: number) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : Uint8Array.from(data);
  return { name, size: declaredSize ?? bytes.length, arrayBuffer: vi.fn(async () => Uint8Array.from(bytes).buffer) } as unknown as File;
}
describe('端末内でのファイル読み込み', () => {
  it('UTF-8の日本語・改行・バックスラッシュを保持する', async () => {
    const source = '日本語\r\n\\frac{a}{b}\r\n';
    await expect(readLocalFile(file('Report.TEX', source), 'tex', 'utf-8')).resolves.toBe(source);
  });
  it('Shift_JISは選択した場合だけ読み込む', async () => {
    await expect(readLocalFile(file('a.tex', [0x82, 0xa0]), 'tex', 'shift_jis')).resolves.toBe('あ');
    await expect(readLocalFile(file('a.tex', [0x82, 0xa0]), 'tex', 'utf-8')).rejects.toThrow('文字コード');
  });
  it('拡張子・容量を読み込み前に確認する', async () => {
    const pdf = file('report.pdf', 'text');
    await expect(readLocalFile(pdf, 'tex', 'utf-8')).rejects.toThrow('.tex'); expect(pdf.arrayBuffer).not.toHaveBeenCalled();
    const large = file('report.tex', 'text', FILE_BYTE_LIMITS.tex + 1);
    await expect(readLocalFile(large, 'tex', 'utf-8')).rejects.toThrow('64KiB'); expect(large.arrayBuffer).not.toHaveBeenCalled();
  });
  it('実際の読み込み量と文字数も制限し、切り捨てない', async () => {
    await expect(readLocalFile(file('a.tex', 'x'.repeat(65537), 1), 'tex', 'utf-8')).rejects.toThrow('容量上限');
    await expect(readLocalFile(file('a.tex', 'x'.repeat(10001)), 'tex', 'utf-8')).rejects.toThrow('切り捨てず');
    await expect(readLocalFile(file('a.log', 'x'.repeat(100001)), 'log', 'utf-8')).rejects.toThrow('100,000');
  });
  it('バイナリ・制御文字と不正な文字コードを拒否する', async () => {
    await expect(readLocalFile(file('a.tex', 'abc\u0000'), 'tex', 'utf-8')).rejects.toThrow('制御文字');
    await expect(readLocalFile(file('a.tex', [0xff]), 'tex', 'utf-8')).rejects.toThrow('文字コード');
    await expect(readLocalFile(file('a.tex', ''), 'tex', 'other' as 'utf-8')).rejects.toThrow('対応していない');
  });
  it('HTML風のテキストは実行せず、そのまま返す', async () => {
    await expect(readLocalFile(file('a.tex', '<script>alert(1)</script>'), 'tex', 'utf-8')).resolves.toBe('<script>alert(1)</script>');
  });
  it('ファイル名と本文の表示偽装を読み込み時に拒否する', async () => {
    const disguised = file('report\u202e.tex', 'text');
    await expect(readLocalFile(disguised, 'tex', 'utf-8')).rejects.toThrow('不可視文字');
    expect(disguised.arrayBuffer).not.toHaveBeenCalled();
    await expect(readLocalFile(file('report.tex', 'x\u2066_1'), 'tex', 'utf-8')).rejects.toThrow('不可視文字');
  });
});

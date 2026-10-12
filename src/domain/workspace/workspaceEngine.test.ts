import { describe, expect, it } from 'vitest';
import { checkWorkspace, sourceContext, sourceOffset } from './workspaceEngine';
import { parseTexLog } from './parseTexLog';
import { scanCommands } from './scanCommands';

describe('質問とソースのローカル確認', () => {
  it.each([
    ['LaTeXで分数を大きく表示したい', 'math-fraction'],
    ['等号を揃える方法を知りたい', 'math-aligned'],
    ['日本語レポートを始めたい', 'japanese-document'],
    ['ＦＲＡＣの使い方を教えて', 'math-fraction'],
  ])('自然文中の収録済み用語から案内する: %s', (question, id) => {
    expect(checkWorkspace(question, '', '').topics[0]?.id).toBe(id);
  });
  it('収録用語がないとき、回答を作ったふりをしない', () => {
    const result = checkWorkspace('未知の専門分野の質問', '', '');
    expect(result.topics).toEqual([]); expect(result.related).toEqual([]);
  });
  it('明示された分数の大きさだけを固定選択肢へ変換する', () => {
    expect(checkWorkspace('分数を大きくしたい', '', '').fractionStyle).toBe('\\dfrac');
    expect(checkWorkspace('小さめの分数', '', '').fractionStyle).toBe('\\tfrac');
    expect(checkWorkspace('分数を大きくしない', '', '').fractionStyle).toBeNull();
    expect(checkWorkspace('大きい分数と小さい分数', '', '').fractionStyle).toBeNull();
  });
  it('質問・ソースの指摘・ログを同じ結果にまとめる', () => {
    const result = checkWorkspace('分数を大きくしたい', 'x_1\n\\frca{a}{b}', '! Undefined control sequence.\nl.2 \\frca{a}{b}');
    expect(result.topics[0].id).toBe('math-fraction');
    expect(result.related.some((entry) => entry.kind === 'recipe' && entry.id === 'fraction')).toBe(true);
    expect(result.findings.some((finding) => finding.line === 1 && finding.column === 2)).toBe(true);
    expect(result.typos).toMatchObject([{ command: '\\frca', replacement: '\\frac', line: 2, column: 1 }]);
    expect(result.log.findings).toMatchObject([{ reportedLine: 2, message: 'Undefined control sequence.' }]);
  });
  it('質問なしでも、固定コマンドと診断から関連例を探す', () => {
    expect(checkWorkspace('', '$\\frac{a}{b}$', '').topics[0].id).toBe('math-fraction');
    expect(checkWorkspace('', 'x_1', '').topics.some((topic) => topic.id === 'math-subscript')).toBe(true);
  });
  it('コメント・verb・リテラル内をタイポとして指摘しない', () => {
    const code = String.raw`% \frca
\verb|\frca| \verb*+\alhpa+
\begin{verbatim}
\frca
\end{verbatim}
\begin{minted}{tex}
\alhpa
\end{minted}
\url{https://example.test/\frca}
\frca{a}{b}`;
    expect(checkWorkspace('', code, '').typos).toMatchObject([{ command: '\\frca', line: 10, column: 1 }]);
  });
  it.each([String.raw`\newcommand{\frca}[2]{#1/#2}`, String.raw`\def\frca#1{#1}`, String.raw`\let\frca=\frac`, String.raw`\NewDocumentCommand{\frca}{m}{#1}`])('独自定義をタイポ候補から除く: %s', (definition) => {
    expect(checkWorkspace('', `${definition}\n\\frca{a}`, '').typos).toEqual([]);
  });
  it('動的なコマンド構文ではタイポ照合を省略する', () => {
    const result = checkWorkspace('', String.raw`\catcode \frca`, '');
    expect(result.dynamic).toBe(true); expect(result.typos).toEqual([]);
  });
  it('エスケープされた%と改行の位置を保持する', () => {
    const commands = scanCommands('\\% \\frca\r\n\\alhpa').commands;
    expect(commands).toMatchObject([{ name: 'frca', line: 1, column: 4 }, { name: 'alhpa', line: 2, column: 1 }]);
  });
  it('タイポの件数上限を知らせる', () => {
    const result = checkWorkspace('', '\\frca\n'.repeat(51), '');
    expect(result.typos).toHaveLength(50); expect(result.typosLimited).toBe(true);
  });
  it.each([['q'.repeat(501), '', ''], ['', 'x'.repeat(10_001), ''], ['', '', 'x'.repeat(100_001)]])('入力上限を超えた内容を解析しない', (q, code, log) => {
    expect(() => checkWorkspace(q, code, log)).toThrow(RangeError);
  });
  it('周辺コードと編集位置を元ソースに合わせる', () => {
    const code = 'α\r\nx_1\r\nend';
    expect(sourceContext(code, 2)).toBe('1   α\n2 > x_1\n3   end');
    expect(sourceOffset(code, 2, 2)).toBe(4);
    expect(sourceContext(code, 999)).toBeNull(); expect(sourceOffset(code, 0)).toBeNull(); expect(sourceOffset(code, 2, 99)).toBeNull();
  });
});

describe('TeXログの報告形式', () => {
  it.each([
    'bash: lualatex: command not found', 'bash: line 1: uplatex: command not found', 'zsh: command not found: latexmk',
    "'dvipdfmx' is not recognized as an internal or external command,",
    "lualatex : The term 'lualatex' is not recognized as a name of a cmdlet,",
    'bash: uplatex: コマンドが見つかりません',
    "uplatex : 用語 'uplatex' は、コマンドレットの名前として認識されません。",
  ])('TeXの起動失敗を読み、構文エラーと異なる確認手順へ案内する: %s', (message) => {
    const result = checkWorkspace('', '', message);
    expect(result.log.findings).toHaveLength(1);
    expect(result.log.findings[0].severity).toBe('error');
    expect(result.topics.some((topic) => topic.id === 'japanese-engine')).toBe(true);
  });
  it('はみ出しを警告として読み、通常のエラーと分ける', () => {
    const result = parseTexLog('Overfull \\hbox (3.0pt too wide) in paragraph at lines 3--5\ntext\n! Missing $ inserted.\nl.9 x_1\nOverfull \\vbox (2.0pt too high) detected at line 12');
    expect(result.findings.map((finding) => [finding.severity, finding.reportedLine])).toEqual([['warning', 3], ['error', 9], ['warning', 12]]);
  });
  it('ファイル行形式でも警告をエラーに変えない', () => {
    const result = parseTexLog('main.tex:3: Overfull \\hbox (3pt too wide)\nmain.tex:4: LaTeX Warning: Reference `a` undefined.');
    expect(result.findings.map((finding) => finding.severity)).toEqual(['warning', 'warning']);
  });
  it.each(['not found', 'PRIVATE: command not found', '<img src=x> command not found', 'sentence Overfull \\hbox', 'normal text: uplatex: command not found'])('一般文や対象外コマンドをエラーとして扱わない: %s', (text) => {
    expect(parseTexLog(text).findings).toEqual([]);
  });
  it.each([['イコールをそろえたいです', 'math-aligned'], ['写真を入れたい', 'figure-image'], ['表の列がずれる', 'table-basic'], ['番号がはてなになる', 'citation-reference']])('質問も追加の言い換えから案内する: %s', (question, topicId) => {
    expect(checkWorkspace(question, '', '').topics[0]?.id).toBe(topicId);
  });
  it('Windowsパスを含むfile-line-errorの報告を読む', () => {
    const result = parseTexLog('C:\\Users\\Student\\demo.tex:12: Undefined control sequence.\r\nl.12 \\frca{a}{b}\r\n');
    expect(result.findings).toMatchObject([{ reportedFile: 'demo.tex', reportedLine: 12, logLine: 1, severity: 'error' }]);
  });
  it('複数のエラーと警告を別々に読み、報告行がなくても表示する', () => {
    const result = parseTexLog('! Missing $ inserted.\nl.3 x_1\n\n! Emergency stop.\n\nLaTeX Warning: Reference `a` undefined on input line 7.');
    expect(result.findings).toHaveLength(3);
    expect(result.findings[0].reportedLine).toBe(3); expect(result.findings[1].reportedLine).toBeUndefined();
    expect(result.findings[2]).toMatchObject({ severity: 'warning', reportedLine: 7 });
  });
  it('通常の本文や未知の形式からエラーを捏造しない', () => {
    expect(parseTexLog('This is LuaHBTeX\nOutput written on report.pdf').findings).toEqual([]);
    expect(parseTexLog('l.4 ordinary text').findings).toEqual([]);
  });
  it('ログ報告の上限と位置の不正を扱う', () => {
    const result = parseTexLog('! error\nl.1 x\n'.repeat(101));
    expect(result.findings).toHaveLength(100); expect(result.limited).toBe(true);
    expect(parseTexLog('a.tex:0: error').findings[0].reportedLine).toBeUndefined();
  });
});

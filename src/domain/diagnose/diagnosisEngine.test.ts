import { describe, expect, it } from 'vitest';
import { diagnose } from './diagnosisEngine';
import { tokenize } from './tokenizer';

describe('字句状態に基づく簡易診断', () => {
  it.each([
    ['', null], ['$x_1$', null], ['\\(x^2\\)', null], ['\\[x_1^2\\]', null], ['$$x_1$$', null],
    ['% x_1 { \\begin{align}\n$x_1$', null], ['file\\_name \\{ \\} \\% \\$', null],
    ['\\verb|x_1^2 $ { \\begin{align}|', null], ['\\verb*+{_^$}+', null],
    ['\\begin{verbatim}\nx_1^2 $ {\n\\end{verbatim}', null],
    ['\\begin{verbatim*}\nx_1\n\\end{verbatim*}', null],
    ['\\label{eq:x_1} \\ref{eq:x_1}', null],
    ['\\includegraphics[width=0.5\\linewidth]{my_file.png}', null],
    ['\\url{https://example.test/a_b%20c}', null],
    ['\\begin{equation}x_1^2\\end{equation}', null],
    ['\\begin{align*}x_1 &= y^2\\end{align*}', null],
    ['\\begin{itemize}\\item a\\begin{enumerate}\\item b\\end{enumerate}\\end{itemize}', null],
    ['x_1', 'MATH_SUBSCRIPT_OUTSIDE'], ['x^2', 'MATH_SUPERSCRIPT_OUTSIDE'],
    ['\\frac{a}{b', 'UNBALANCED_BRACE'], ['}', 'UNBALANCED_BRACE'],
    ['\\begin{itemize}\\end{enumerate}', 'ENV_MISMATCH'], ['\\begin{itemize}', 'ENV_MISMATCH'], ['\\end{itemize}', 'ENV_MISMATCH'],
    ['$x_1', 'MATH_DELIMITER_MISMATCH'], ['\\(x\\]', 'MATH_DELIMITER_MISMATCH'], ['\\[x\\)', 'MATH_DELIMITER_MISMATCH'], ['\\)', 'MATH_DELIMITER_MISMATCH'],
  ])('断片 %s の検査', (code, rule) => {
    const findings = diagnose(code);
    if (rule) expect(findings.some((finding) => finding.ruleId === rule)).toBe(true);
    else expect(findings).toEqual([]);
  });
  it('行・列は元のソースで1始まり', () => {
    expect(diagnose('% ignored\n  x_1')[0]).toMatchObject({ line: 2, column: 4 });
    expect(tokenize('a\r\nb_1').tokens[0]).toMatchObject({ line: 2, column: 2 });
  });
  it('エスケープはバックスラッシュの偶奇を考慮する', () => {
    expect(diagnose('\\_')).toEqual([]);
    expect(diagnose('\\\\_')[0].ruleId).toBe('MATH_SUBSCRIPT_OUTSIDE');
    expect(diagnose('\\\\% x_1')).toEqual([]);
  });
  it('交差する環境の入れ子を検出する', () => {
    const findings = diagnose('\\begin{itemize}\\begin{enumerate}\\end{itemize}');
    expect(findings).toHaveLength(1); expect(findings[0].severity).toBe('error');
  });
  it('断片の外に対応する開始・終了があるかもしれない', () => {
    expect(diagnose('\\end{align}')[0].severity).toBe('hint');
    expect(diagnose('\\begin{align}')[0].severity).toBe('warning');
  });
  it('数式中のテキストは本文として扱う', () => {
    expect(diagnose('$\\text{x_1}$')[0].ruleId).toBe('MATH_SUBSCRIPT_OUTSIDE');
    expect(diagnose('$\\text{value $x_1$}$')).toEqual([]);
  });
  it('数式内部用環境の断片はモードを断定しない', () => {
    expect(diagnose('\\begin{pmatrix}x_1\\end{pmatrix}').every((finding) => finding.severity === 'hint')).toBe(true);
  });
  it('数式環境中の追加ドル区切りを検出する', () => {
    expect(diagnose('\\begin{equation}$x_1$\\end{equation}').some((finding) => finding.ruleId === 'MATH_DELIMITER_MISMATCH')).toBe(true);
  });
  it.each(['\\newcommand{\\foo}{x_1}', '\\input{other_file}', '\\catcode`_=12', '\\begin{minted}{tex}x_1\\end{minted}', '\\verb|x_1', '\\begin{verbatim}x_1'])('未対応 %s はヒントに下げる', (code) => {
    const findings = diagnose(code); expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((finding) => finding.severity === 'hint')).toBe(true);
  });
  it('入力の上限と大量指摘の上限', () => {
    expect(() => diagnose('a'.repeat(10001))).toThrow(RangeError);
    expect(diagnose('_'.repeat(1000))).toHaveLength(101);
  });
  it('閉じる環境名が違うとき、開始位置と対応する終了を示す', () => {
    const findings = diagnose('\\begin{itemize}\r\n\\item A\r\n\\end{enumerate}');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ line: 3, column: 1, relatedLocation: { line: 1, column: 1 }, expected: '\\end{itemize}' });
  });
  it('外側を先に閉じた場合、終了名の置換ではなく内側の閉じ忘れを案内する', () => {
    const finding = diagnose('\\begin{itemize}\n\\begin{enumerate}\n\\end{itemize}')[0];
    expect(finding.relatedLocation).toMatchObject({ line: 2, column: 1 });
    expect(finding.suggestion).toContain('この行の前に\\end{enumerate}');
    expect(finding.suggestion).toContain('無条件に置き換えない');
  });
  it('数式の閉じる種類が違うとき、元の開始位置を保持する', () => {
    const finding = diagnose('prefix\r\n  \\(x\r\n\\]')[0];
    expect(finding).toMatchObject({ line: 3, column: 1, relatedLocation: { line: 2, column: 3 }, expected: '\\)' });
  });
  it.each(['{x', '\\begin{align}', '\\(x', '\\[x', '$x', '$$x'])('未完の断片に対応する終了を示す: %s', (code) => {
    expect(diagnose(code).some((finding) => finding.expected)).toBe(true);
    expect(diagnose(code).every((finding) => finding.severity !== 'error')).toBe(true);
  });
  it.each(['alignat', 'alignat*', 'flalign', 'flalign*'])('AMS数式環境を数式モードとして扱う: %s', (environment) => {
    expect(diagnose(`\\begin{${environment}}x_1^2\\end{${environment}}`)).toEqual([]);
  });
  it('gatheredは外側の数式モードを必要とする内部用環境として扱う', () => {
    expect(diagnose('\\begin{gathered}x_1\\end{gathered}').map((finding) => finding.severity)).toEqual(['hint']);
    expect(diagnose('\\[\\begin{gathered}x_1\\end{gathered}\\]')).toEqual([]);
  });
  it.each(['$a\n\nb$', '$$a\n\nb$$', '\\(a\n\nb\\)', '\\[a\n\nb\\]', '\\begin{equation}a\n\nb\\end{equation}', '\\begin{alignat}a\n\nb\\end{alignat}'])('数式内の空行を位置と開始付きで検出する: %s', (code) => {
    const finding = diagnose(code).find((finding) => finding.ruleId === 'MATH_PARAGRAPH_BREAK');
    expect(finding).toMatchObject({ line: 2, column: 1, severity: 'warning', relatedLocation: { line: 1, column: 1 } });
  });
  it('空行の位置はCRLFと空白・タブがある場合も変わらない', () => {
    expect(diagnose('\\[\r\na\r\n \t\r\nb\r\n\\]')[0]).toMatchObject({ ruleId: 'MATH_PARAGRAPH_BREAK', line: 3, column: 1 });
  });
  it('明示的なparも数式中の段落区切りとして扱う', () => {
    expect(diagnose('$a\\par b$')[0]).toMatchObject({ ruleId: 'MATH_PARAGRAPH_BREAK', line: 1, column: 3 });
  });
  it.each(['a\n\nb', '\\[a\n% comment\nb\\]', '\\[a\nb\\]', '\\verb|\\par|', '\\begin{verbatim}\na\n\nb\n\\end{verbatim}', '$\\text{a\n\nb}$', 'a\\par b'])('本文・コメント・リテラルを数式内の空行と混同しない: %s', (code) => {
    expect(diagnose(code).filter((finding) => finding.ruleId === 'MATH_PARAGRAPH_BREAK')).toEqual([]);
  });
  it('外側の数式区切りと式全体の環境の重なりを検出する', () => {
    expect(diagnose('\\[\\begin{equation}x_1\\end{equation}\\]')[0]).toMatchObject({ ruleId: 'MATH_DELIMITER_MISMATCH', relatedLocation: { line: 1, column: 1 } });
    expect(diagnose('\\[\\begin{aligned}x_1\\end{aligned}\\]')).toEqual([]);
  });
  it.each(['\\NewDocumentCommand{\\sample}{m}{x_1}', '\\DeclareRobustCommand{\\sample}{x_1}', '\\let\\sample=\\alpha'])('追加の独自定義も解析を止めてヒントにする: %s', (code) => {
    expect(diagnose(code).map((finding) => finding.ruleId)).toEqual(['UNSUPPORTED_SYNTAX']);
  });
});

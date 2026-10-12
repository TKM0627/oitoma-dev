import { describe, expect, it } from 'vitest';
import { diagnose } from '../diagnose/diagnosisEngine';
import { generateStarter, starterExecution, UPLATEX_LATEXMKRC, type StarterOptions } from './starterEngine';

describe('日本語スターター', () => {
  it.each(['lualatex', 'uplatex'] as const)('保存する固定名と実行手順を揃える: %s', (engine) => {
    const execution = starterExecution(engine);
    expect(execution.fileName).toBe(`report-${engine}.tex`);
    expect(execution.logName).toBe(`report-${engine}.log`);
    expect(execution.pdfName).toBe(`report-${engine}.pdf`);
    const commands = execution.command.split('\n');
    expect(commands.slice(0, 2)).toEqual(Array(2).fill(`${engine} -no-shell-escape -file-line-error report-${engine}.tex`));
    expect(commands).toHaveLength(engine === 'uplatex' ? 3 : 2);
    if (engine === 'uplatex') expect(commands[2]).toBe('dvipdfmx report-uplatex.dvi');
  });
  it.each(['lualatex; curl secret', '$(private)', 'uplatex PRIVATE.tex', 'pdflatex'])('入力を実行コマンドに混ぜない: %s', (engine) => {
    expect(() => starterExecution(engine as StarterOptions['engine'])).toThrow();
  });
  for (const engine of ['lualatex', 'uplatex'] as const) for (const structure of ['report', 'lab'] as const) {
    it(`${engine}/${structure}は文書とエンジンの設定を揃える`, () => {
      const code = generateStarter({ engine, structure });
      expect(code).toContain(`\\documentclass[${engine},fontsize=11pt,paper=a4paper]{jlreq}`);
      expect(code).toContain('\\begin{document}'); expect(code).toContain('\\end{document}\n');
      expect(code).toContain('氏名'); expect(code).toContain(structure === 'lab' ? '実験レポート' : '日本語レポート');
      expect(code).toContain(structure === 'lab' ? '\\section{結果}' : '\\section{はじめに}');
      expect(code).toContain(engine === 'uplatex' ? '\\usepackage[dvipdfmx]{graphicx}' : '\\usepackage{graphicx}');
      expect(code.indexOf('\\caption')).toBeLessThan(code.indexOf('\\label'));
      expect(code).toContain('項目 & 値 \\\\');
      // 基本規則の整合性だけを確認する。TeXコンパイル成功を意味しない。
      expect(diagnose(code).filter((finding) => finding.severity !== 'hint')).toEqual([]);
    });
  }
  it('任意エンジン・テンプレート・余分な入力を拒否する', () => {
    for (const options of [{ engine: 'pdflatex', structure: 'report' }, { engine: 'lualatex', structure: '\\input{secret}' }, { engine: 'lualatex', structure: 'report', name: '個人情報' }]) {
      expect(() => generateStarter(options as StarterOptions)).toThrow();
    }
  });
  it('upLaTeXのDVI変換設定を固定で提供する', () => {
    expect(UPLATEX_LATEXMKRC).toContain("$latex = 'uplatex %O %S';");
    expect(UPLATEX_LATEXMKRC).toContain('dvipdfmx %O -o %D %S');
  });
});

import { z } from '../security/validation';

export const starterOptionsSchema = z.object({
  engine: z.enum(['lualatex', 'uplatex']),
  structure: z.enum(['report', 'lab']),
}).strict();
export type StarterOptions = z.infer<typeof starterOptionsSchema>;

// 利用者のファイル名をコマンドに埋め込まない。
export function starterExecution(rawEngine: StarterOptions['engine']) {
  const engine = starterOptionsSchema.shape.engine.parse(rawEngine);
  const base = `report-${engine}`;
  const run = `${engine} -no-shell-escape -file-line-error ${base}.tex`;
  return { fileName: `${base}.tex`, logName: `${base}.log`, pdfName: `${base}.pdf`,
    command: [run, run, ...(engine === 'uplatex' ? [`dvipdfmx ${base}.dvi`] : [])].join('\n') };
}

export function generateStarter(raw: StarterOptions): string {
  const { engine, structure } = starterOptionsSchema.parse(raw);
  const sections = structure === 'lab'
    ? ['目的', '方法', '結果', '考察', '結論']
    : ['はじめに', '内容', '考察', 'まとめ'];
  return [
    `% UTF-8で保存。使用エンジン: ${engine === 'lualatex' ? 'LuaLaTeX' : 'upLaTeX + dvipdfmx'}`,
    '% 授業指定のテンプレート・書式がある場合はそちらを優先してください。',
    `\\documentclass[${engine},fontsize=11pt,paper=a4paper]{jlreq}`,
    '\\usepackage{amsmath,amssymb}',
    engine === 'uplatex' ? '\\usepackage[dvipdfmx]{graphicx}' : '\\usepackage{graphicx}',
    '', `\\title{${structure === 'lab' ? '実験レポート' : '日本語レポート'}}`,
    '\\author{氏名}', '\\date{\\today}', '',
    '\\begin{document}', '\\maketitle', '',
    ...sections.flatMap((section, index) => [
      `\\section{${section}}`,
      index === 0 ? 'ここに目的や背景を書きます。' : 'ここに本文を書きます。',
      ...(index === 1 ? [
        '', '% 数式は数式モードの中に置きます。',
        '\\[', '  y = \\frac{1}{n} \\sum_{i=1}^{n} x_i', '\\]', '',
        '\\begin{table}[htbp]', '  \\centering',
        '  \\caption{結果の例}', '  \\label{tab:result}',
        '  \\begin{tabular}{lr}', '    \\hline',
        '    項目 & 値 \\\\', '    \\hline', '    条件A & 1.0 \\\\',
        '    条件B & 2.0 \\\\', '    \\hline',
        '  \\end{tabular}', '\\end{table}',
        '表\\ref{tab:result}に結果を示します。',
      ] : []), '',
    ]),
    '% 引用した資料の著者・題名・年・URL等は、授業の引用規則に従って追記します。',
    '\\end{document}', '',
  ].join('\n');
}

export const UPLATEX_LATEXMKRC = [
  "$latex = 'uplatex %O %S';",
  "$bibtex = 'upbibtex %O %B';",
  "$dvipdf = 'dvipdfmx %O -o %D %S';",
  "$makeindex = 'mendex %O -o %D %S';",
  '',
].join('\n');

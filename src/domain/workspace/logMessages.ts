const texCommand = '(?:lualatex|uplatex|platex|pdflatex|xelatex|latex|latexmk|dvipdfmx)';
// 一般文の「not found」をエラー扱いしない。
const missingCommands = [
  new RegExp(`^(?:(?:bash|sh):\\s*(?:line \\d+:\\s*)?)?${texCommand}:\\s*(?:command not found|コマンドが見つかりません)\\s*$`, 'i'),
  new RegExp(`^zsh:\\s*command not found:\\s*${texCommand}\\s*$`, 'i'),
  new RegExp(`^['"]${texCommand}['"] is not recognized as an internal or external command[, .]?$`, 'i'),
  new RegExp(`^${texCommand}\\s*:\\s*(?:The term ['"]${texCommand}['"] is not recognized\\b|用語 ['"]${texCommand}['"] は.+認識されません)`, 'i'),
];
export const isTexCommandMissing = (message: string) => missingCommands.some((pattern) => pattern.test(message.trim()));
export const isOverfullWarning = (message: string) => /^Overfull \\[hv]box\b/.test(message.trim());

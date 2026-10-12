/** 行は1始まり、列はUTF-16単位。 */
export function sourceContext(source: string, line: number) {
  const lines = source.split('\n');
  if (!Number.isInteger(line) || line < 1 || line > lines.length) return null;
  return lines.slice(Math.max(0, line - 2), line + 1).map((text, index) => `${Math.max(1, line - 1) + index}${Math.max(1, line - 1) + index === line ? ' > ' : '   '}${text.replace(/\r$/, '')}`).join('\n');
}
export function sourceOffset(source: string, line: number, column = 1): number | null {
  const lines = source.split('\n');
  if (!Number.isInteger(line) || line < 1 || line > lines.length || !Number.isInteger(column) || column < 1 || column > lines[line - 1].length + 1) return null;
  return lines.slice(0, line - 1).reduce((count, text) => count + text.length + 1, 0) + column - 1;
}

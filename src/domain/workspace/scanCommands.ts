export type SourceCommand = { name: string; offset: number; line: number; column: number };

/** コメント・リテラル・参照キーは照合しない。 */
export function scanCommands(source: string) {
  const commands: SourceCommand[] = [];
  const definitions = new Set<string>();
  let offset = 0, line = 1, column = 1, dynamic = false;
  function advance(count: number) {
    const end = Math.min(source.length, offset + count);
    while (offset < end) { if (source[offset] === '\n') { line++; column = 1; } else column++; offset++; }
  }
  function skipArgument(open: string, close: string) {
    let depth = 0;
    while (offset < source.length) {
      const char = source[offset];
      if (char === '\\') { advance(2); continue; }
      if (char === open) depth++;
      if (char === close) depth--;
      advance(1);
      if (char === close && depth === 0) break;
    }
  }
  while (offset < source.length) {
    if (source[offset] === '%') { const end = source.indexOf('\n', offset); advance((end < 0 ? source.length : end) - offset); continue; }
    if (source[offset] !== '\\') { advance(1); continue; }
    const rest = source.slice(offset);
    const verb = /^\\verb\*?([^a-zA-Z\s])/.exec(rest);
    if (verb) {
      const end = source.indexOf(verb[1], offset + verb[0].length);
      const newline = source.indexOf('\n', offset);
      const stop = end >= 0 && (newline < 0 || end < newline) ? end + 1 : newline < 0 ? source.length : newline;
      advance(stop - offset); continue;
    }
    const literal = /^\\begin\s*\{(verbatim\*?|Verbatim|lstlisting|minted)\}/.exec(rest);
    if (literal) {
      const close = `\\end{${literal[1]}}`;
      const end = source.indexOf(close, offset + literal[0].length);
      advance((end < 0 ? source.length : end + close.length) - offset); continue;
    }
    const command = /^\\([a-zA-Z]+|[^\n])/.exec(rest);
    if (!command) { advance(1); continue; }
    const name = command[1];
    if (/^[a-zA-Z]+$/.test(name)) commands.push({ name, offset, line, column });
    if (['catcode', 'csname'].includes(name)) dynamic = true;
    if (['newcommand', 'renewcommand', 'providecommand', 'DeclareRobustCommand', 'DeclareMathOperator', 'NewDocumentCommand', 'RenewDocumentCommand', 'ProvideDocumentCommand', 'DeclareDocumentCommand', 'def', 'gdef', 'edef', 'xdef', 'let', 'futurelet'].includes(name)) {
      const definition = /^\*?\s*\{?\s*\\([a-zA-Z]+)/.exec(rest.slice(command[0].length));
      if (definition) definitions.add(definition[1]);
    }
    if (['newenvironment', 'renewenvironment'].includes(name)) {
      const definition = /^\*?\s*\{\s*([a-zA-Z]+)/.exec(rest.slice(command[0].length));
      if (definition) definitions.add(definition[1]);
    }
    advance(command[0].length);
    if (['label', 'ref', 'pageref', 'eqref', 'cite', 'bibliography', 'bibliographystyle', 'includegraphics', 'url', 'path', 'href', 'input', 'include'].includes(name)) {
      if (source[offset] === '*') advance(1);
      while (/\s/.test(source[offset] || '')) advance(1);
      while (source[offset] === '[') { skipArgument('[', ']'); while (/\s/.test(source[offset] || '')) advance(1); }
      if (source[offset] === '{') skipArgument('{', '}');
    }
  }
  return { commands, definitions, dynamic };
}

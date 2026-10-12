export type TokenKind = 'brace-open' | 'brace-close' | 'begin' | 'end' | 'delimiter' | 'subscript' | 'superscript' | 'text-command' | 'paragraph-break' | 'unsupported';
export type Token = { kind: TokenKind; value: string; offset: number; line: number; column: number };

/** コメントとリテラル領域は診断しない。 */
export function tokenize(source: string) {
  const tokens: Token[] = [];
  let offset = 0;
  let line = 1;
  let column = 1;
  let incomplete = false;
  function emit(kind: TokenKind, value: string) { tokens.push({ kind, value, offset, line, column }); }
  function advance(length: number) {
    const end = offset + length;
    while (offset < end) {
      if (source[offset] === '\n') { line++; column = 1; } else column++;
      offset++;
    }
  }
  function skipLiteralArgument(open: string, close: string, comments = true) {
    let depth = 0;
    while (offset < source.length) {
      const char = source[offset];
      if (char === '\\' && offset + 1 < source.length) { advance(2); continue; }
      if (char === '%' && comments) {
        const end = source.indexOf('\n', offset);
        advance(end < 0 ? source.length - offset : end - offset); continue;
      }
      if (char === open) depth++;
      if (char === close) depth--;
      advance(1);
      if (char === close && depth === 0) return;
    }
    emit('unsupported', 'ファイル名・参照キーの引数が未完のため、内容を読み飛ばしました。');
    incomplete = true;
  }
  while (offset < source.length) {
    const char = source[offset];
    if (char === '\n') {
      advance(1);
      // コメントだけの行は空行にしない。位置は空行の先頭を指す。
      if (/^[\t ]*\r?\n/.test(source.slice(offset))) emit('paragraph-break', '空行');
      continue;
    }
    if (char === '%') {
      const end = source.indexOf('\n', offset);
      advance(end < 0 ? source.length - offset : end - offset);
      continue;
    }
    if (char === '\\') {
      const rest = source.slice(offset);
      const verb = /^\\verb\*?([^a-zA-Z\s])/.exec(rest);
      if (verb) {
        const start = offset + verb[0].length;
        const end = source.indexOf(verb[1], start);
        const newline = source.indexOf('\n', start);
        if (end < 0 || (newline >= 0 && newline < end)) {
          emit('unsupported', '\\verbが未完のため、この行のリテラル部分を読み飛ばしました。');
          advance((newline < 0 ? source.length : newline) - offset);
        } else advance(end + 1 - offset);
        continue;
      }
      const env = /^\\(begin|end)\s*\{([a-zA-Z*]+)\}/.exec(rest);
      if (env) {
        if (env[1] === 'begin' && ['verbatim', 'verbatim*', 'Verbatim', 'lstlisting', 'minted'].includes(env[2])) {
          const endMark = `\\end{${env[2]}}`;
          const end = source.indexOf(endMark, offset + env[0].length);
          if (!env[2].startsWith('verbatim') || end < 0) emit('unsupported', `${env[2]}の内容は診断対象外です。`);
          if (end < 0) incomplete = true;
          advance(end < 0 ? source.length - offset : end + endMark.length - offset);
        } else {
          emit(env[1] as 'begin' | 'end', env[2]); advance(env[0].length);
        }
        continue;
      }
      if (/^\\[()[\]]/.test(rest)) { emit('delimiter', rest.slice(0, 2)); advance(2); continue; }
      const command = /^\\([a-zA-Z]+|[^\n])/.exec(rest);
      if (command) {
        if (['label', 'ref', 'pageref', 'eqref', 'cite', 'bibliography', 'bibliographystyle', 'includegraphics', 'url', 'path', 'href'].includes(command[1])) {
          advance(command[0].length);
          if (source[offset] === '*') advance(1);
          while (offset < source.length && /\s/.test(source[offset])) advance(1);
          while (source[offset] === '[') {
            skipLiteralArgument('[', ']');
            while (offset < source.length && /\s/.test(source[offset])) advance(1);
          }
          if (source[offset] === '{') skipLiteralArgument('{', '}', !['url', 'path'].includes(command[1]));
          continue;
        }
        if (['def', 'gdef', 'edef', 'xdef', 'let', 'futurelet', 'newcommand', 'renewcommand', 'providecommand', 'DeclareRobustCommand', 'DeclareMathOperator', 'NewDocumentCommand', 'RenewDocumentCommand', 'ProvideDocumentCommand', 'DeclareDocumentCommand', 'newenvironment', 'renewenvironment', 'catcode', 'input', 'include', 'csname', 'begin', 'end'].includes(command[1])) {
          emit('unsupported', `\\${command[1]}以降は、マクロ・外部ファイル・動的な環境を解釈できないため診断を省略しました。`);
          incomplete = true;
          break;
        }
        if (['text', 'textrm', 'textbf', 'textit', 'textnormal', 'mbox', 'hbox'].includes(command[1])) emit('text-command', command[1]);
        if (command[1] === 'par') emit('paragraph-break', '\\par');
        advance(command[0].length);
        continue;
      }
      emit('unsupported', '末尾のバックスラッシュは断片だけでは判断できません。');
    } else if (char === '{') emit('brace-open', char);
    else if (char === '}') emit('brace-close', char);
    else if (char === '$') {
      const value = source.startsWith('$$', offset) ? '$$' : '$';
      emit('delimiter', value); advance(value.length); continue;
    } else if (char === '_') emit('subscript', char);
    else if (char === '^') emit('superscript', char);
    advance(1);
  }
  return { tokens, incomplete };
}

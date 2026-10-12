import { tokenize, type Token } from './tokenizer.ts';
import { assertTextInput } from '../security/textInput.ts';

export type Severity = 'error' | 'warning' | 'hint';
export type Finding = {
  ruleId: string; severity: Severity; message: string; line: number; column: number;
  suggestion: string; topicIds: string[];
  relatedLocation?: { line: number; column: number; label: string };
  expected?: string;
};
export const MAX_CODE_LENGTH = 10_000;
const mathEnvironments = new Set(['math', 'displaymath', 'equation', 'equation*', 'align', 'align*', 'alignat', 'alignat*', 'flalign', 'flalign*', 'gather', 'gather*', 'multline', 'multline*', 'eqnarray', 'eqnarray*']);
const innerMathEnvironments = new Set(['matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'aligned', 'alignedat', 'gathered', 'split', 'array', 'smallmatrix']);

export function diagnose(source: string): Finding[] {
  assertTextInput(source, MAX_CODE_LENGTH);
  const { tokens, incomplete } = tokenize(source);
  const findings: Finding[] = [];
  const braces: { token: Token; textGroup: boolean }[] = [];
  const environments: Token[] = [];
  const math: { token: Token; close: string; textDepth: number }[] = [];
  let textDepth = 0;
  let pendingText = false;
  function add(token: Token, ruleId: string, severity: Severity, message: string, suggestion: string, topicIds: string[], opening?: Token, expected?: string) {
    findings.push({ ruleId, severity, message, suggestion, topicIds, line: token.line, column: token.column,
      ...(opening ? { relatedLocation: { line: opening.line, column: opening.column, label: '対応する開始' } } : {}),
      ...(expected ? { expected } : {}) });
  }
  for (const token of tokens) {
    switch (token.kind) {
      case 'unsupported':
        add(token, 'UNSUPPORTED_SYNTAX', 'hint', token.value, '対応範囲外の部分はTeXコンパイラで確認してください。', ['error-environments']);
        break;
      case 'text-command': pendingText = true; break;
      case 'brace-open':
        braces.push({ token, textGroup: pendingText });
        if (pendingText) textDepth++;
        pendingText = false;
        break;
      case 'brace-close': {
        const opening = braces.pop();
        if (!opening) add(token, 'UNBALANCED_BRACE', 'warning', '対応する開始のない } があります。断片の前後も確認してください。', '開始の { を確認するか、余分な } を取り除きます。', ['error-braces']);
        else if (opening.textGroup) textDepth--;
        break;
      }
      case 'begin':
        if (mathEnvironments.has(token.value) && textDepth === 0) {
          const opening = math.at(-1)?.token || environments.findLast((env) => mathEnvironments.has(env.value));
          if (opening) add(token, 'MATH_DELIMITER_MISMATCH', 'warning', '数式モードの中に、式全体を囲む環境が重なっています。', '外側の数式区切りと環境のどちらを使うか確認します。alignedなどの数式内部用環境とは区別します。', ['error-math-mode', 'math-aligned'], opening);
        }
        if (innerMathEnvironments.has(token.value) && !math.length && !environments.some((env) => mathEnvironments.has(env.value))) {
          add(token, 'UNSUPPORTED_SYNTAX', 'hint', '数式内部用の環境だけでは、外側の数式モードを判断できません。', '式全体の\\[ … \\]なども含めて確認してください。', ['error-math-mode']);
        }
        environments.push(token);
        break;
      case 'end': {
        const opening = environments.at(-1);
        if (!opening) add(token, 'ENV_MISMATCH', 'hint', `\\end{${token.value}}に対応する開始が断片内にありません。`, `文書の前後に\\begin{${token.value}}があるか確認します。`, ['error-environments']);
        else if (opening.value !== token.value) {
          const match = environments.findLastIndex((env) => env.value === token.value);
          add(token, 'ENV_MISMATCH', 'error', `${opening.value}を閉じる位置に${token.value}の終了があります。`, match >= 0
            ? `この行の前に\\end{${opening.value}}が必要か確認します。内側を先に閉じ、外側の終了名を無条件に置き換えないでください。`
            : `終了名の書き違いなら\\end{${opening.value}}を使います。開始名の書き違いの可能性も確認してください。`, ['error-environments'], opening, `\\end{${opening.value}}`);
          environments.splice(match < 0 ? environments.length - 1 : match);
        } else environments.pop();
        break;
      }
      case 'delimiter': {
        const top = math.at(-1);
        const dollar = token.value.startsWith('$');
        if (dollar && environments.some((env) => mathEnvironments.has(env.value)) && textDepth === 0) {
          add(token, 'MATH_DELIMITER_MISMATCH', 'warning', '数式環境の中に追加のドル区切りがあります。', '数式環境内では追加の$や$$を外してください。', ['error-math-mode']);
        } else if (top?.close === token.value && top.textDepth === textDepth) math.pop();
        else if (token.value === '\\)' || token.value === '\\]' || (dollar && top && top.textDepth === textDepth)) {
          add(token, 'MATH_DELIMITER_MISMATCH', top ? 'error' : 'hint', top ? `${top.token.value}の開始に${token.value}の終了は対応しません。` : `${token.value}に対応する開始が断片内にありません。`, top ? `開始が意図どおりなら終了は${top.close}を使います。` : '文書の前後に対応する数式区切りがあるか確認します。', ['error-math-mode'], top?.token, top?.close);
          if (top) math.pop();
        } else {
          if (top && top.textDepth === textDepth) add(token, 'MATH_DELIMITER_MISMATCH', 'warning', '数式の開始区切りが入れ子になっています。', '数式区切りを重ねず、開始と終了を対にします。', ['error-math-mode']);
          math.push({ token, close: token.value === '\\(' ? '\\)' : token.value === '\\[' ? '\\]' : token.value, textDepth });
        }
        break;
      }
      case 'paragraph-break': {
        const top = math.at(-1);
        const environment = environments.findLast((env) => mathEnvironments.has(env.value));
        const opening = top?.textDepth === textDepth ? top.token : textDepth === 0 ? environment : undefined;
        if (opening) add(token, 'MATH_PARAGRAPH_BREAK', 'warning', `数式モードの途中に${token.value === '\\par' ? '段落区切り（\\par）' : '空行'}があります。`, '数式内の空行や\\parを取り除きます。複数行の式はalignやalignedなどで区切り、本文の段落は数式の外に置きます。', ['error-math-mode', 'math-aligned'], opening);
        break;
      }
      case 'subscript':
      case 'superscript': {
        const top = math.at(-1);
        const inMath = top ? top.textDepth === textDepth : textDepth === 0 && environments.some((env) => mathEnvironments.has(env.value));
        const ambiguous = !inMath && textDepth === 0 && environments.some((env) => innerMathEnvironments.has(env.value));
        if (!inMath && !ambiguous) {
          const subscript = token.kind === 'subscript';
          add(token, subscript ? 'MATH_SUBSCRIPT_OUTSIDE' : 'MATH_SUPERSCRIPT_OUTSIDE', 'warning', `${token.value}が数式モードの外にあります。断片の利用位置を確認してください。`, subscript ? '式なら $x_1$、本文の文字なら file\\_name のように書きます。' : '式全体を $x^2$ のように数式モードで囲みます。', [subscript ? 'math-subscript' : 'math-superscript', 'error-math-mode']);
        }
        break;
      }
    }
  }
  if (!incomplete) {
    for (const { token } of braces) add(token, 'UNBALANCED_BRACE', 'warning', 'この { に対応する } が断片内にありません。', '引数の末尾に } があるか、文書の前後も確認します。入力末尾への追加が正しいとは限りません。', ['error-braces'], undefined, '}');
    for (const token of environments) {
      add(token, 'ENV_MISMATCH', 'warning', `${token.value}の終了が断片内にありません。`, `対応する\\end{${token.value}}を確認します。入れ子なら内側を先に閉じます。`, ['error-environments'], undefined, `\\end{${token.value}}`);
    }
    for (const { token, close } of math) add(token, 'MATH_DELIMITER_MISMATCH', 'warning', `${token.value}に対応する数式の終了が断片内にありません。`, `対応する ${close} を確認します。式がどこまで続くかを確認して閉じます。`, ['error-math-mode'], undefined, close);
  }
  const sorted = findings.sort((a, b) => a.line - b.line || a.column - b.column);
  if (sorted.length > 100) return [...sorted.slice(0, 100), { ruleId: 'FINDING_LIMIT', severity: 'hint', message: '表示は先頭100件までです。短い断片に分けて確認してください。', suggestion: '入力の先頭から修正して、もう一度診断してください。', topicIds: [], line: 1, column: 1 }];
  return sorted;
}

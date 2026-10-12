import { describe, expect, it } from 'vitest';
import { content } from '../content/contentRepository';
import { diagnose } from './diagnosisEngine';
import { diagnosticAdvice, getLogAdvice } from './diagnosticAdvice';
import { checkWorkspace } from '../workspace/workspaceEngine';
import { supportReferences } from '../content/supportReferences';

describe('修正例・ログの確認手順', () => {
  it.each(Object.keys(diagnosticAdvice))('修正例の前後と出典は整合する: %s', (rule) => {
    const advice = diagnosticAdvice[rule];
    expect(diagnose(advice.before).some((finding) => finding.ruleId === rule)).toBe(true);
    expect(diagnose(advice.after)).toEqual([]);
    expect(advice.referenceIds.every((id) => content.references.some((ref) => ref.id === id))).toBe(true);
  });
  it.each([
    ['bash: uplatex: command not found', 'TeXの実行先を確認'],
    ['Extra alignment tab has been changed to \\cr.', '表の列数と行末を確認'],
    ['Misplaced alignment tab character &.', '表の列数と行末を確認'],
    ["LaTeX Error: There's no line here to end.", '改行指定の位置を確認'],
    ['Overfull \\hbox (3.0pt too wide) in paragraph at lines 3--5', 'PDFのはみ出しを確認'],
    ['Emergency stop.', '停止する前の最初のエラーを確認'],
    ['Missing $ inserted.', '数式モードと空行を確認'],
    ['LaTeX Error: Bad math environment delimiter.', '数式モードと空行を確認'],
    ['Undefined control sequence.', 'コマンド名と定義を確認'],
    ['LaTeX Error: Environment align undefined.', '環境名と提供元を確認'],
    ["LaTeX Error: File `amsmathz.sty' not found.", 'ファイル名と利用環境を確認'],
    ["Reference `eq:a' on page 1 undefined on input line 4.", '参照キーと再コンパイルを確認'],
    ["Citation `sample' on page 1 undefined on input line 4.", '文献キーと処理手順を確認'],
    ['Extra }, or forgotten $.', '引数と波括弧を確認'],
    ['Paragraph ended before \\sample was complete.', '引数と波括弧を確認'],
  ])('代表的なログへ固定手順を示す: %s', (message, title) => {
    const advice = getLogAdvice(message);
    expect(advice?.title).toBe(title);
    expect(advice?.referenceIds.every((id) => [...content.references, ...supportReferences].some((ref) => ref.id === id))).toBe(true);
    expect(advice?.topicIds.every((id) => content.topics.some((topic) => topic.id === id))).toBe(true);
  });
  it.each(['Unknown private error', 'prefix Missing $ inserted.', 'Output written on report.pdf', '<img src=x>'])('未知の文から原因や手順を作らない: %s', (message) => {
    expect(getLogAdvice(message)).toBeNull();
  });
  it('ログだけでも対応する登録資料を案内する', () => {
    expect(checkWorkspace('', '', '! Missing $ inserted.\nl.3 x_1').topics.some((topic) => topic.id === 'error-math-mode')).toBe(true);
    expect(checkWorkspace('', '', 'LaTeX Warning: Citation `sample` on page 1 undefined on input line 4.').topics.some((topic) => topic.id === 'citation-bibliography')).toBe(true);
  });
});

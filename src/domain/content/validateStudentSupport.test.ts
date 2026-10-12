import { describe, expect, it } from 'vitest';
import rawPhrases from '../../data/purpose_phrases.json';
import rawReferences from '../../data/support_references.json';
import { content } from './contentRepository';
import { validateStudentSupport } from './validateStudentSupport';

describe('学生向けの固定用語と追加資料', () => {
  it('26トピックの70表現と6資料を既存のトピックへ対応付ける', () => {
    const result = validateStudentSupport(rawPhrases, rawReferences, content);
    expect(result.phrases).toHaveLength(26);
    expect(result.phrases.flatMap((entry) => entry.phrases)).toHaveLength(70);
    expect(result.references).toHaveLength(6);
  });
  it.each(['unknown', 'duplicate', 'control', 'tooLong', 'extra'] as const)('不正な言い換えを拒否する: %s', (kind) => {
    const data = structuredClone(rawPhrases);
    if (kind === 'unknown') data[0].topicId = 'private-unknown';
    if (kind === 'duplicate') data[1].topicId = data[0].topicId;
    if (kind === 'control') data[0].phrases.push('改行\n入り');
    if (kind === 'tooLong') data[0].phrases.push('x'.repeat(101));
    if (kind === 'extra') Object.assign(data[0], { privateInput: 'private' });
    expect(() => validateStudentSupport(data, rawReferences, content)).toThrow();
  });
  it.each(['https://texfaq.org/private', 'https://texfaq.org.evil.example/FAQ-overfull', 'https://texfaq.org/FAQ-overfull?secret=1', 'https://user@texfaq.org/FAQ-overfull'])('公開資料の範囲外を拒否する: %s', (url) => {
    const data = structuredClone(rawReferences); data[0].url = url;
    expect(() => validateStudentSupport(rawPhrases, data, content)).toThrow();
  });
  it('共通資料とのID重複を拒否する', () => {
    const data = structuredClone(rawReferences); data[0].id = content.references[0].id;
    expect(() => validateStudentSupport(rawPhrases, data, content)).toThrow('重複');
  });
});

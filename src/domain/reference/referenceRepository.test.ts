import { describe, expect, it } from 'vitest';
import rawChapters from '../../data/reference_chapters.json';
import { content } from '../content/contentRepository';
import { validateReferenceChapters } from './validateReferenceChapters';

describe('テーマ別資料の公開データ', () => {
  it('6テーマの出典・関連機能を既存の公開データへ解決する', () => {
    const chapters = validateReferenceChapters(rawChapters, content);
    expect(chapters.map((chapter) => chapter.id)).toEqual(['setup', 'math', 'figures-tables', 'structure', 'references', 'errors']);
    expect(chapters.every((chapter) => chapter.sections.length >= 2)).toBe(true);
  });
  it('テーマとテーマ内の項目の重複IDを拒否する', () => {
    const data = structuredClone(rawChapters);
    data[1].id = data[0].id;
    expect(() => validateReferenceChapters(data, content)).toThrow('重複');
    data[1].id = rawChapters[1].id;
    data[0].sections[1].id = data[0].sections[0].id;
    expect(() => validateReferenceChapters(data, content)).toThrow('重複');
  });
  it.each(['topicIds', 'recipeIds', 'errorCaseIds'] as const)('不存在の%sを拒否する', (key) => {
    const data = structuredClone(rawChapters);
    data[0][key] = ['missing'];
    expect(() => validateReferenceChapters(data, content)).toThrow('不明な参照');
  });
  it('項目ごとの出典を必須とし、未知の出典や重複を拒否する', () => {
    const data = structuredClone(rawChapters);
    data[0].sections[0].referenceIds = [];
    expect(() => validateReferenceChapters(data, content)).toThrow();
    data[0].sections[0].referenceIds = ['missing'];
    expect(() => validateReferenceChapters(data, content)).toThrow('不明な参照');
    data[0].sections[0].referenceIds = ['emacs-tex-mode', 'emacs-tex-mode'];
    expect(() => validateReferenceChapters(data, content)).toThrow('重複');
  });
  it.each(['checkedAt', 'status', 'verificationMethod', 'humanReview', 'texCompilation'] as const)('確認状況の%sが欠けたデータを拒否する', (key) => {
    const { [key]: omitted, ...chapter } = rawChapters[0];
    expect(omitted).toBeDefined();
    expect(() => validateReferenceChapters([chapter, ...rawChapters.slice(1)], content)).toThrow();
  });
  it.each(['humanReview', 'texCompilation'] as const)('未実施の%sを実施済みと捏造しない', (key) => {
    const data = structuredClone(rawChapters);
    data[0][key] = 'performed';
    expect(() => validateReferenceChapters(data, content)).toThrow();
  });
  it('非公開メモなどの未知のフィールドを各階層で拒否する', () => {
    const chapter = rawChapters[0];
    expect(() => validateReferenceChapters([{ ...chapter, privateNotes: 'INTERNAL' }], content)).toThrow();
    expect(() => validateReferenceChapters([{ ...chapter, sections: [{ ...chapter.sections[0], privateNotes: 'INTERNAL' }] }], content)).toThrow();
    const section = chapter.sections[1];
    expect(() => validateReferenceChapters([{ ...chapter, sections: [{ ...section, examples: [{ ...section.examples[0], apiKey: 'SECRET' }] }] }], content)).toThrow();
  });
  it('誤ったバックスラッシュの制御文字と、外部URLへの誘導を拒否する', () => {
    const data = structuredClone(rawChapters);
    data[0].sections[1].examples[0].code = '\b' + 'egin';
    expect(() => validateReferenceChapters(data, content)).toThrow('制御文字');
    expect(() => validateReferenceChapters([{ ...rawChapters[0], guideId: 'https://evil.example/' }], content)).toThrow();
  });
});

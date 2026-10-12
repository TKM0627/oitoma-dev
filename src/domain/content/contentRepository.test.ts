import { describe, expect, it } from 'vitest';
import { content } from './contentRepository';
import { validateContent } from './validateContent';

describe('公開コンテンツの整合性', () => {
  it('32トピック、10レシピ、5規則と学習データの参照を解決する', () => {
    expect(content.topics).toHaveLength(32); expect(content.recipes).toHaveLength(10);
    expect(content.learningPaths).toHaveLength(3); expect(content.starterProfiles).toHaveLength(2);
    expect(new Set(content.errorCases.map((error) => error.ruleId)).size).toBe(5);
    expect(validateContent(content)).toEqual(content);
  });
  it.each(['topics', 'recipes', 'errorCases', 'references', 'learningPaths', 'starterProfiles'] as const)('%sのID重複を拒否する', (key) => {
    const data = structuredClone(content); data[key][1] = data[key][0] as never;
    expect(() => validateContent(data)).toThrow('重複');
  });
  it.each(['recipeIds', 'errorCaseIds', 'referenceIds'] as const)('%sの存在しない参照を拒否する', (key) => {
    const data = structuredClone(content); data.topics[0][key] = ['missing'];
    expect(() => validateContent(data)).toThrow('不明な参照');
  });
  it('エラーと静的説明のトピック参照を検証する', () => {
    const data = structuredClone(content); data.errorCases[0].topicIds = ['missing'];
    expect(() => validateContent(data)).toThrow();
    data.errorCases[0].topicIds = content.errorCases[0].topicIds;
    data.explanations['unbalanced-brace'].sourceTopicIds = ['missing'];
    expect(() => validateContent(data)).toThrow();
  });
  it.each(['http://example.com', 'javascript:alert(1)', 'https://user:pass@example.com'])('危険な参考URL %s を拒否する', (url) => {
    const data = structuredClone(content); data.references[0].url = url;
    expect(() => validateContent(data)).toThrow();
  });
  it('未知の生成関数と不正な既定値を拒否する', () => {
    const data = structuredClone(content); data.recipes[0].generator = 'eval';
    expect(() => validateContent(data)).toThrow('生成関数');
    data.recipes[0].generator = 'subscript'; data.recipes[0].options[0].defaultValue = 'invalid';
    expect(() => validateContent(data)).toThrow('選択肢');
  });
  it('JSONのバックスラッシュの誤エスケープを拒否する', () => {
    const data = structuredClone(content); data.topics[0].commands = ['\b' + 'egin'];
    expect(() => validateContent(data)).toThrow('制御文字');
  });
  it('学習の参照先・ステップ重複・クイズ正答を検証する', () => {
    const data = structuredClone(content);
    data.learningPaths[0].steps[1].target = { kind: 'topic', id: 'missing' };
    expect(() => validateContent(data)).toThrow('不明な参照');
    data.learningPaths = structuredClone(content.learningPaths);
    data.learningPaths[0].steps.push(data.learningPaths[0].steps[0]);
    expect(() => validateContent(data)).toThrow('重複');
    data.learningPaths = structuredClone(content.learningPaths);
    data.learningPaths[0].quiz.answerId = 'missing';
    expect(() => validateContent(data)).toThrow('正答');
  });
  it('日本語案内の出典と、共有先として危険なURLを拒否する', () => {
    const data = structuredClone(content); data.starterProfiles[0].referenceIds = ['missing'];
    expect(() => validateContent(data)).toThrow('不明な参照');
    data.starterProfiles = structuredClone(content.starterProfiles);
    const raw = { ...data, learningPaths: [{ ...data.learningPaths[0], steps: [{ ...data.learningPaths[0].steps[0], target: { kind: 'guide', id: 'https://evil.example' } }] }, ...data.learningPaths.slice(1)] };
    expect(() => validateContent(raw)).toThrow();
  });
  it.each(['checkedAt', 'scope', 'sourceType', 'usage'] as const)('出典の%sが欠けた収録データを拒否する', (field) => {
    const { [field]: omitted, ...reference } = content.references[0];
    expect(omitted).toBeDefined();
    expect(() => validateContent({ ...content, references: [reference, ...content.references.slice(1)] })).toThrow();
  });
  it('存在しない日付と空の参照範囲を拒否する', () => {
    const data = structuredClone(content); data.references[0].checkedAt = '2026-02-30';
    expect(() => validateContent(data)).toThrow();
    data.references[0].checkedAt = '2026-10-10'; data.references[0].scope = '';
    expect(() => validateContent(data)).toThrow();
  });
  it('解説固有の出典参照を検証し、人手校閲の事実を捏造しない', () => {
    const data = structuredClone(content); data.explanations['unbalanced-brace'].referenceIds = ['missing'];
    expect(() => validateContent(data)).toThrow('不明な参照');
    data.explanations = structuredClone(content.explanations);
    const raw = { ...data, explanations: { ...data.explanations, 'unbalanced-brace': { ...data.explanations['unbalanced-brace'], humanReview: 'performed' } } };
    expect(() => validateContent(raw)).toThrow();
  });
  it('非公開情報を含み得る未知のJSONフィールドを黙って除去せず拒否する', () => {
    expect(() => validateContent({ ...content, privateNotes: 'INTERNAL_ONLY' })).toThrow();
    expect(() => validateContent({ ...content, topics: [{ ...content.topics[0], privateNotes: 'INTERNAL_ONLY' }, ...content.topics.slice(1)] })).toThrow();
    expect(() => validateContent({ ...content, recipes: [{ ...content.recipes[0], options: [{ ...content.recipes[0].options[0], apiKey: 'SECRET' }, ...content.recipes[0].options.slice(1)] }, ...content.recipes.slice(1)] })).toThrow();
  });
});

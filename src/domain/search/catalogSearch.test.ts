import { describe, expect, it } from 'vitest';
import { content } from '../content/contentRepository';
import { referenceIndex } from './referenceSearchIndex';
import { referenceChapters } from '../reference/referenceRepository';
import { createSearchCatalog, referenceSearchEntries, searchCatalog, targetKey, targetPath } from './catalogSearch';

const catalog = createSearchCatalog(content, referenceIndex);
describe('収録項目を横断するローカル検索', () => {
  it.each([
    ['イコールをそろえたい', 'math-aligned', 'aligned'], ['分子と分母を書きたい', 'math-fraction', 'fraction'],
    ['二乗を書きたい', 'math-superscript', 'superscript'], ['ルートを書きたい', 'math-root', 'root'],
    ['行列の括弧を変えたい', 'math-matrix', 'matrix'], ['条件ごとに式を分けたい', 'math-cases', 'cases'],
  ])('コマンドを知らなくても解説と試せる例を探せる: %s', (query, topicId, recipeId) => {
    const result = searchCatalog(catalog, query).map(({ entry }) => targetKey(entry));
    expect(result).toEqual(expect.arrayContaining([`topic:${topicId}`, `recipe:${recipeId}`]));
  });
  it.each([['画像が変な場所に出る', 'figure-float'], ['表の列数が合わない', 'table-basic'], ['番号がはてなになる', 'citation-reference'], ['行がはみ出す', 'layout-paragraph']])('学生の困りごとの表現を解説へ案内する: %s', (query, topicId) => {
    expect(searchCatalog(catalog, query)[0]?.entry.id).toBe(topicId);
  });
  it('57項目の種別・IDを一意にし、資料索引が元の資料と一致する', () => {
    expect(catalog).toHaveLength(57);
    expect(new Set(catalog.map(targetKey)).size).toBe(catalog.length);
    expect(referenceIndex).toEqual(referenceSearchEntries(referenceChapters, content));
  });
  it('同じ検索語で書き方・試せる例・資料・学習を見つける', () => {
    const keys = searchCatalog(catalog, '分数').map(({ entry }) => targetKey(entry));
    expect(keys).toEqual(expect.arrayContaining(['topic:math-fraction', 'recipe:fraction', 'reference:math', 'course:math']));
    expect(searchCatalog(catalog, 'Missing $ inserted').map(({ entry }) => entry.kind)).toEqual(expect.arrayContaining(['topic', 'recipe', 'error']));
  });
  it.each(['Linux', 'emacs', 'Windows', 'PATH'])('テーマの本文からも検索できる：%s', (query) => {
    expect(searchCatalog(catalog, query).some(({ entry }) => targetKey(entry) === 'reference:setup')).toBe(true);
  });
  it('正規化・ANDタグ・長さ制限・未知の語を扱う', () => {
    expect(searchCatalog(catalog, 'ＦＲＡＣＴＩＯＮ').some(({ entry }) => entry.id === 'fraction')).toBe(true);
    expect(searchCatalog(catalog, '行列 括弧', ['数式']).some(({ entry }) => entry.kind === 'recipe' && entry.id === 'matrix')).toBe(true);
    expect(searchCatalog(catalog, '分数', ['図'])).toEqual([]);
    expect(searchCatalog(catalog, 'unknown-keyword')).toEqual([]);
    expect(() => searchCatalog(catalog, 'a'.repeat(101))).toThrow(RangeError);
  });
  it('全結果のリンクをアプリ内の既知の画面に組み立てる', () => {
    for (const entry of catalog) expect(targetPath(entry)).toMatch(/^\/(topics|recipes|reference|errors|japanese|learn)(\/|\?|$)/);
    expect(targetPath({ kind: 'course', id: 'math' })).toBe('/learn?path=math');
  });
});

import { describe, expect, it } from 'vitest';
import { content } from '../content/contentRepository';
import { normalize } from './searchEngine';
import { createSearchCatalog, searchCatalog } from './catalogSearch';
import { referenceIndex } from './referenceSearchIndex';

const catalog = createSearchCatalog(content, referenceIndex);
const search = (query: string, tags: string[] = []) => searchCatalog(catalog, query, tags).filter(({ entry }) => entry.kind === 'topic');
describe('検索', () => {
  it.each([
    ['添字', 'math-subscript'], ['subscript', 'math-subscript'], ['SUBSCRIPT', 'math-subscript'],
    ['ＳＵＢＳＣＲＩＰＴ', 'math-subscript'], ['\\frac', 'math-fraction'],
    ['Missing $ inserted', 'math-subscript'], ['行列 括弧', 'math-matrix'],
    ['Runaway argument', 'error-braces'], ['\\begin{pmatrix}', 'math-matrix'],
  ])('%s で %s を検索できる', (query, id) => { expect(search(query).some((result) => result.entry.id === id)).toBe(true); });
  it('コマンド完全一致を説明一致より上に置く', () => { expect(search('\\frac')[0].entry.id).toBe('math-fraction'); });
  it('ID完全一致を優先する', () => { expect(search('math-matrix')[0].entry.id).toBe('math-matrix'); });
  it('複数語とタグをANDで絞る', () => {
    expect(search('添字', ['数式', '添字']).length).toBeGreaterThan(0);
    expect(search('添字', ['図'])).toEqual([]);
    expect(search('添字 存在しない語')).toEqual([]);
  });
  it('空入力・空白と結果ゼロ', () => { expect(search('  ')).toHaveLength(32); expect(search('zzzzzz')).toEqual([]); });
  it('日本語環境の目的・エンジン名から案内に到達する', () => {
    expect(search('日本語が出ない')[0].entry.id).toBe('japanese-document');
    expect(search('ｕｐＬａＴｅＸ').some(({ entry }) => entry.id === 'japanese-engine')).toBe(true);
  });
  it('記号を保持して正規化する', () => { expect(normalize('  Ａ  \\frac　Ｂ ')).toBe('a \\frac b'); });
  it('上限を超える検索を拒否する', () => { expect(() => search('a'.repeat(101))).toThrow(RangeError); });
});

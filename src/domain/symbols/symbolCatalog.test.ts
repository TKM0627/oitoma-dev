import { describe, expect, it } from 'vitest';
import katex from 'katex';
import groups from '../../data/symbol_catalog.json';
import { content } from '../content/contentRepository';
import { validateSymbolCatalog } from './validateSymbolCatalog';
import { filterSymbols } from './symbolCatalog';
import { createSearchCatalog, searchCatalog } from '../search/catalogSearch';
import { referenceIndex } from '../search/referenceSearchIndex';

const catalog = createSearchCatalog(content, referenceIndex);

describe('記号一覧のデータと検索', () => {
  it('全分類の出典とコードを検証し、KaTeX表示可能性も別に確認する', () => {
    const parsed = validateSymbolCatalog(groups, content);
    expect(parsed).toHaveLength(8);
    const entries = parsed.flatMap((group) => group.entries);
    expect(entries).toHaveLength(86);
    for (const entry of entries) expect(() => katex.renderToString(entry.code, { trust: false, throwOnError: true, maxExpand: 1000, maxSize: 20 })).not.toThrow();
    // この検証はTeXエンジンでのコンパイル検証とは異なる。
  });
  it('標準LaTeXでラテン文字を使う大文字とオミクロンを区別する', () => {
    expect(groups[0].entries.find((entry) => entry.id === 'omicron')?.code).toBe('o');
    expect(groups[2].entries.every((entry) => /^[A-Z]$/.test(entry.code))).toBe(true);
    expect(groups[1].entries.find((entry) => entry.code === '\\Gamma')?.glyph).toBe('Γ');
    expect(groups[0].entries.find((entry) => entry.code === '\\epsilon')?.glyph).toBe('ϵ');
    expect(groups[3].entries.find((entry) => entry.code === '\\varepsilon')?.glyph).toBe('ε');
  });
  it.each(['シータ', 'テータ', 'ｔｈｅｔａ', '\\theta', 'θ'])('日本語・正規化・コマンド・形から検索する：%s', (query) => {
    expect(filterSymbols(groups, query).flatMap((group) => group.entries).some((entry) => entry.code === '\\theta')).toBe(true);
  });
  it('基本検索から一覧のコマンド・別名にも到達できる', () => {
    const topic = content.topics.find((topic) => topic.id === 'math-greek')!;
    for (const entry of groups.flatMap((group) => group.entries)) {
      if (entry.code.startsWith('\\')) expect(topic.commands).toContain(entry.code);
    }
    for (const query of ['\\omega', 'オメガ', 'エプシロン', '≤', '写像の対応']) {
      expect(searchCatalog(catalog, query).some((result) => result.entry.id === 'math-greek')).toBe(true);
    }
  });
  it('複数語はAND、空検索は全件、未知の語は0件になる', () => {
    expect(filterSymbols(groups, 'シータ 大文字').flatMap((group) => group.entries).map((entry) => entry.code)).toEqual(['\\Theta']);
    expect(filterSymbols(groups, '  ').flatMap((group) => group.entries)).toHaveLength(86);
    expect(filterSymbols(groups, 'unknown-symbol')).toEqual([]);
  });
  it('重複ID・未知の出典・制御文字・任意コードや追加情報を拒否する', () => {
    const duplicate = structuredClone(groups); duplicate[1].entries[0].id = duplicate[0].entries[0].id;
    expect(() => validateSymbolCatalog(duplicate, content)).toThrow('重複');
    const missing = structuredClone(groups); missing[0].referenceIds = ['missing'];
    expect(() => validateSymbolCatalog(missing, content)).toThrow('不明な出典');
    for (const code of ['\balpha', '\\href{https://example.com}{x}', '<script>', '\\alpha\n']) {
      const data = structuredClone(groups); data[0].entries[0].code = code;
      expect(() => validateSymbolCatalog(data, content)).toThrow();
    }
    expect(() => validateSymbolCatalog([{ ...groups[0], privateNotes: 'INTERNAL' }], content)).toThrow();
    expect(() => validateSymbolCatalog([{ ...groups[0], entries: [{ ...groups[0].entries[0], privateNotes: 'INTERNAL' }] }], content)).toThrow();
  });
});

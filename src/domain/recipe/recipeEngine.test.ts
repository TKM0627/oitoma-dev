import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { content, findRecipe } from '../content/contentRepository';
import { defaultOptions, generateRecipe } from './recipeEngine';
import { diagnose } from '../diagnose/diagnosisEngine';

describe('レシピ', () => {
  for (const recipe of content.recipes) {
    it(`${recipe.title}の全選択肢を安全に生成・描画できる`, () => {
      const defaults = defaultOptions(recipe);
      const initial = generateRecipe(recipe, defaults);
      expect(initial.code.startsWith('\\[\n')).toBe(true);
      expect(diagnose(initial.code)).toEqual([]);
      for (const option of recipe.options) {
        const choices = option.type === 'select' ? option.choices.map((choice) => choice.value) : option.type === 'boolean' ? [true, false] : [option.min, option.max];
        for (const value of choices) {
          const output = generateRecipe(recipe, { ...defaults, [option.key]: value });
          expect(() => katex.renderToString(output.formula, { trust: false, maxExpand: 200, maxSize: 10, strict: 'error' })).not.toThrow();
          expect(diagnose(output.code)).toEqual([]);
        }
      }
    });
  }
  it('行列の括弧と改行・バックスラッシュを保つ', () => {
    const recipe = findRecipe('matrix')!;
    const output = generateRecipe(recipe, { ...defaultOptions(recipe), bracket: 'bmatrix' });
    expect(output.formula).toBe('\\begin{bmatrix}\n  a & b \\\\\n  c & d\n\\end{bmatrix}');
    expect(output.code).toContain('\\[\n\\begin{bmatrix}');
    expect(generateRecipe(recipe, { ...defaultOptions(recipe), bracket: 'vmatrix' }).formula).toContain('\\end{vmatrix}');
  });
  it('文中ラッパーを含む', () => {
    const recipe = findRecipe('subscript')!;
    expect(generateRecipe(recipe, { index: 'ij', mode: 'inline' }).code).toBe('$x_{ij}$');
  });
  it('任意コード・不明なキー・欠けた値を拒否する', () => {
    const recipe = findRecipe('matrix')!;
    expect(() => generateRecipe(recipe, { ...defaultOptions(recipe), bracket: '\\input{secret}' })).toThrow();
    expect(() => generateRecipe(recipe, { ...defaultOptions(recipe), prompt: 'hello' })).toThrow();
    expect(() => generateRecipe(recipe, {})).toThrow();
    expect(() => generateRecipe({ ...recipe, generator: 'constructor' }, defaultOptions(recipe))).toThrow();
  });
  it('全トピックのコード例は対応規則の指摘がない', () => {
    for (const topic of content.topics) for (const example of topic.examples) {
      expect(diagnose(example.code).filter((finding) => finding.severity !== 'hint'), topic.id).toEqual([]);
    }
  });
});

import { expect, it } from 'vitest';
import { readRecipeTransfer } from './recipeTransfer';

it('選択済みレシピだけから診断の初期コードを生成する', () => {
  expect(readRecipeTransfer({ recipeId: 'subscript', options: { index: 'ij', mode: 'inline' } })).toBe('$x_{ij}$');
});
it('巨大な履歴データ・長い選択値を診断へ渡さない', () => {
  expect(readRecipeTransfer({ recipeId: 'subscript', options: Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`key${i}`, 'x'])) })).toBeUndefined();
  expect(readRecipeTransfer({ recipeId: 'subscript', options: { index: 'x'.repeat(10000), mode: 'inline' } })).toBeUndefined();
});
it.each([null, { code: '非公開の入力' }, { recipeId: 'unknown', options: {} }, { recipeId: 'subscript', options: { index: '\\input{secret}', mode: 'inline' } }, { recipeId: 'subscript', options: {} }, { recipeId: 'subscript', options: { index: 'ij', mode: 'inline' }, code: '非公開の入力' }])('不明な履歴データ %j をコードに使わない', (raw) => {
  expect(readRecipeTransfer(raw)).toBeUndefined();
});

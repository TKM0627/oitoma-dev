import type { RecipeDefinition } from '../content/schema';
import { generators, type OptionValues } from './generators';

export function defaultOptions(recipe: RecipeDefinition): OptionValues {
  return Object.fromEntries(recipe.options.map((option) => [option.key, option.defaultValue]));
}

export function generateRecipe(recipe: RecipeDefinition, values: OptionValues) {
  if (!Object.hasOwn(generators, recipe.generator)) throw new Error('許可されていない生成関数');
  if (Object.keys(values).some((key) => !recipe.options.some((option) => option.key === key))) throw new Error('不明なオプション');
  for (const option of recipe.options) {
    const value = values[option.key];
    const valid = option.type === 'select'
      ? option.choices.some((choice) => choice.value === value)
      : option.type === 'boolean'
        ? typeof value === 'boolean'
        : typeof value === 'number' && Number.isInteger(value) && value >= option.min && value <= option.max;
    if (!valid) throw new Error(`無効な選択値: ${option.key}`);
  }
  const formula = generators[recipe.generator](values);
  const displayMode = values.mode !== 'inline';
  return {
    formula, displayMode,
    code: displayMode ? `\\[\n${formula}\n\\]` : `$${formula}$`,
    requiredPackages: [...recipe.requiredPackages], previewMode: recipe.previewMode,
  };
}

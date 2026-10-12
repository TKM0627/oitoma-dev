import { rawContent } from './rawContent.ts';
import type { Content } from './schema.ts';

// ビルド検証済みの同梱データ専用。外部入力には使わない。
export const content = rawContent as Content;
export const findTopic = (id: string) => content.topics.find((topic) => topic.id === id);
export const findRecipe = (id: string) => content.recipes.find((recipe) => recipe.id === id);

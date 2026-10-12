import { z } from '../security/validation';
import { findRecipe } from '../content/contentRepository';
import { generateRecipe } from './recipeEngine';

const transferSchema = z.object({
  recipeId: z.string().regex(/^[a-z][a-z0-9-]*$/).max(80),
  options: z.record(z.string().max(80), z.union([z.string().max(100), z.boolean(), z.number()])),
}).strict();

export function readRecipeTransfer(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object' || !('options' in raw) || !raw.options || typeof raw.options !== 'object'
    || Array.isArray(raw.options) || Object.keys(raw.options).length > 20) return;
  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) return;
  const recipe = findRecipe(parsed.data.recipeId);
  if (!recipe) return;
  try { return generateRecipe(recipe, parsed.data.options).code; }
  catch { return; }
}

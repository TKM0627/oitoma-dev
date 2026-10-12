import { z } from '../security/validation.ts';
import type { Content } from '../content/schema.ts';
import { textInputError } from '../security/textInput.ts';

const text = z.string().min(1).max(200).refine((value) => !textInputError(value, 200) && !/[\r\n\t]/.test(value), '制御文字は使えません');
const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const entrySchema = z.object({
  id, code: text.regex(/^(\\[A-Za-z]+|[A-Za-z=<>])$/), glyph: text.max(3), name: text,
  aliases: z.array(text).max(8),
}).strict();
const groupsSchema = z.array(z.object({
  id, title: text, description: text, referenceIds: z.array(id).min(1),
  entries: z.array(entrySchema).min(1).max(100),
}).strict()).min(1).max(20);
export type SymbolGroup = z.infer<typeof groupsSchema>[number];

export function validateSymbolCatalog(raw: unknown, content: Content) {
  const groups = groupsSchema.parse(raw);
  function unique(values: string[]) {
    if (new Set(values).size !== values.length) throw new Error('記号一覧のIDが重複しています');
  }
  unique(groups.map((group) => group.id));
  unique(groups.flatMap((group) => group.entries.map((entry) => entry.id)));
  const references = new Set(content.references.map((reference) => reference.id));
  for (const group of groups) {
    unique(group.referenceIds);
    for (const ref of group.referenceIds) if (!references.has(ref)) throw new Error(`記号一覧の不明な出典: ${ref}`);
  }
  return groups;
}

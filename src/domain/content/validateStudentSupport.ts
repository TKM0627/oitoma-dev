import { z } from '../security/validation.ts';
import { referenceSchema, type Content } from './schema.ts';
import { textInputError } from '../security/textInput.ts';

const phraseSchema = z.array(z.object({
  topicId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  phrases: z.array(z.string().min(2).max(100).refine((text) => !textInputError(text, 100) && !/[\r\n\t]/.test(text))).min(1),
}).strict());

export function validateStudentSupport(rawPhrases: unknown, rawReferences: unknown, content: Content) {
  const phrases = phraseSchema.parse(rawPhrases);
  const references = z.array(referenceSchema).parse(rawReferences);
  const topicIds = phrases.map((entry) => entry.topicId);
  const referenceIds = [...content.references, ...references].map((ref) => ref.id);
  if (new Set(topicIds).size !== topicIds.length || new Set(referenceIds).size !== referenceIds.length) throw new Error('学生向け資料のIDが重複しています');
  for (const entry of phrases) {
    if (!content.topics.some((topic) => topic.id === entry.topicId)) throw new Error('言い換えの参照先が不明です');
    if (new Set(entry.phrases.map((text) => text.normalize('NFKC').toLowerCase())).size !== entry.phrases.length) throw new Error('言い換えが重複しています');
  }
  return { phrases, references };
}

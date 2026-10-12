import { z } from '../security/validation.ts';
import { code } from '../content/schema.ts';
import { textInputError } from '../security/textInput.ts';

const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const text = z.string().min(1).max(2000).refine((value) => !textInputError(value, 2000), '不正な制御文字があります');
const ids = z.array(id);

export const referenceChapterSchema = z.object({
  id, title: text, summary: text, goals: z.array(text).min(1),
  sections: z.array(z.object({
    id, title: text, paragraphs: z.array(text).min(1),
    examples: z.array(z.object({
      label: text, code, placement: text, requirements: z.array(text),
    }).strict()),
    pitfalls: z.array(text), referenceIds: ids.min(1),
  }).strict()).min(1),
  checklist: z.array(text).min(1), topicIds: ids, recipeIds: ids, errorCaseIds: ids,
  guideId: z.literal('japanese').optional(),
  checkedAt: z.iso.date(), status: z.literal('prototype'),
  verificationMethod: z.literal('source-comparison'),
  humanReview: z.literal('not-performed'), texCompilation: z.literal('not-performed'),
}).strict();

export const referenceChaptersSchema = z.array(referenceChapterSchema).min(1);
export type ReferenceChapter = z.infer<typeof referenceChapterSchema>;

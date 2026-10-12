import { z } from '../security/validation.ts';
import { isApprovedReferenceUrl } from './referencePolicy.ts';
import { textInputError } from '../security/textInput.ts';

const id = z.string().regex(/^[a-z][a-z0-9-]*$/).max(80);
const text = z.string().min(1).max(4000).refine((value) => !textInputError(value, 4000), '不正な制御文字があります');
const ids = z.array(id);
export const code = z.string().min(1).max(10000).refine((value) => !textInputError(value, 10000), 'コードに不正な制御文字があります');

export const topicSchema = z.object({
  id, title: text, summary: text,
  category: z.enum(['math', 'table', 'figure', 'layout', 'citation', 'error']),
  tags: z.array(text).min(1), aliases: z.array(text), symptoms: z.array(text),
  commands: z.array(code),
  examples: z.array(z.object({ label: text, code, explanation: text.optional() }).strict()).min(1),
  requiredPackages: z.array(text), recipeIds: ids, errorCaseIds: ids, referenceIds: ids.min(1),
  guideId: z.literal('japanese').optional(),
}).strict();
export const optionSchema = z.discriminatedUnion('type', [
  z.object({ key: id, label: text, type: z.literal('select'), defaultValue: text,
    choices: z.array(z.object({ value: text, label: text }).strict()).min(1) }).strict(),
  z.object({ key: id, label: text, type: z.literal('boolean'), defaultValue: z.boolean() }).strict(),
  z.object({ key: id, label: text, type: z.literal('integer'), defaultValue: z.number().int(),
    min: z.number().int(), max: z.number().int() }).strict(),
]);
export const recipeSchema = z.object({
  id, title: text, topicId: id, description: text, options: z.array(optionSchema),
  generator: id, requiredPackages: z.array(text), previewMode: z.enum(['katex', 'static', 'none']),
}).strict();
export const errorCaseSchema = z.object({
  id, ruleId: z.enum(['UNBALANCED_BRACE', 'ENV_MISMATCH', 'MATH_SUBSCRIPT_OUTSIDE', 'MATH_SUPERSCRIPT_OUTSIDE', 'MATH_DELIMITER_MISMATCH']),
  title: text, symptoms: z.array(text), cause: text, badExample: code, goodExample: code,
  explanationId: id, topicIds: ids.min(1),
}).strict();
export const referenceSchema = z.object({
  id, title: text, publisher: text,
  url: z.url().refine(isApprovedReferenceUrl, '参考URLは管理対象の公開資料のみ（認証情報・クエリ・独自ポート不可）'),
  checkedAt: z.iso.date(), scope: text,
  sourceType: z.enum(['official-documentation', 'maintainer-documentation', 'project-tutorial', 'service-tutorial']),
  usage: z.literal('link-and-original-explanation'),
}).strict();
export const explanationSchema = z.object({
  text, reviewed: z.boolean(), sourceTopicIds: ids.min(1),
  updatedAt: z.iso.date(),
  referenceIds: ids.min(1),
  verificationMethod: z.literal('primary-source-comparison'),
  humanReview: z.literal('not-performed'),
}).strict();
export const starterProfileSchema = z.object({
  id: z.enum(['lualatex', 'uplatex']), title: text, description: text,
  instructions: z.array(text).min(1), referenceIds: ids.min(1),
}).strict();
export const learningPathSchema = z.object({
  id: z.enum(['report', 'math', 'lab']), title: text, description: text,
  steps: z.array(z.object({
    id, title: text, description: text,
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('topic'), id }).strict(),
      z.object({ kind: z.literal('recipe'), id }).strict(),
      z.object({ kind: z.literal('guide'), id: z.literal('japanese') }).strict(),
    ]),
  }).strict()).min(1),
  quiz: z.object({
    question: text, choices: z.array(z.object({ id, text }).strict()).min(2),
    answerId: id, explanation: text, referenceIds: ids.min(1),
  }).strict(),
}).strict();
export const contentSchema = z.object({
  topics: z.array(topicSchema).min(1), recipes: z.array(recipeSchema).min(1),
  errorCases: z.array(errorCaseSchema).min(1), references: z.array(referenceSchema).min(1),
  tags: z.array(text).min(1), explanations: z.record(id, explanationSchema),
  starterProfiles: z.array(starterProfileSchema).length(2),
  learningPaths: z.array(learningPathSchema).length(3),
}).strict();

export type Topic = z.infer<typeof topicSchema>;
export type RecipeOption = z.infer<typeof optionSchema>;
export type RecipeDefinition = z.infer<typeof recipeSchema>;
export type ErrorCase = z.infer<typeof errorCaseSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type Content = z.infer<typeof contentSchema>;
export type LearningPath = z.infer<typeof learningPathSchema>;

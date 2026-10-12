import type { Content } from '../content/schema.ts';
import { referenceChaptersSchema } from './referenceSchema.ts';

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label}: IDが重複しています`);
}

export function validateReferenceChapters(raw: unknown, content: Content) {
  const chapters = referenceChaptersSchema.parse(raw);
  unique(chapters.map((chapter) => chapter.id), 'テーマ');
  const known = {
    topics: new Set(content.topics.map((item) => item.id)),
    recipes: new Set(content.recipes.map((item) => item.id)),
    errorCases: new Set(content.errorCases.map((item) => item.id)),
    references: new Set(content.references.map((item) => item.id)),
  };
  function refs(values: string[], key: keyof typeof known) {
    unique(values, key);
    for (const value of values) if (!known[key].has(value)) throw new Error(`${key}: 不明な参照 ${value}`);
  }
  for (const chapter of chapters) {
    unique(chapter.sections.map((section) => section.id), chapter.id);
    refs(chapter.topicIds, 'topics');
    refs(chapter.recipeIds, 'recipes');
    refs(chapter.errorCaseIds, 'errorCases');
    for (const section of chapter.sections) refs(section.referenceIds, 'references');
  }
  return chapters;
}

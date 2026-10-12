import { contentSchema, type Content } from './schema.ts';
import { generators } from '../recipe/generators.ts';

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label}: IDまたは値が重複しています`);
}

export function validateContent(raw: unknown): Content {
  const data = contentSchema.parse(raw);
  for (const key of ['topics', 'recipes', 'errorCases', 'references', 'starterProfiles', 'learningPaths'] as const) {
    unique(data[key].map((item) => item.id), key);
  }
  unique(data.tags, 'tags');
  const known = {
    topics: new Set(data.topics.map((item) => item.id)),
    recipes: new Set(data.recipes.map((item) => item.id)),
    errorCases: new Set(data.errorCases.map((item) => item.id)),
    references: new Set(data.references.map((item) => item.id)),
    tags: new Set(data.tags),
    explanations: new Set(Object.keys(data.explanations)),
  };
  function refs(values: string[], key: keyof typeof known) {
    for (const value of values) if (!known[key].has(value)) throw new Error(`${key}: 不明な参照 ${value}`);
  }
  for (const topic of data.topics) {
    refs(topic.tags, 'tags'); refs(topic.recipeIds, 'recipes');
    refs(topic.errorCaseIds, 'errorCases'); refs(topic.referenceIds, 'references');
  }
  for (const recipe of data.recipes) {
    refs([recipe.topicId], 'topics');
    if (!Object.hasOwn(generators, recipe.generator)) throw new Error(`不明な生成関数: ${recipe.generator}`);
    unique(recipe.options.map((option) => option.key), recipe.id);
    for (const option of recipe.options) {
      if (option.type === 'select') {
        unique(option.choices.map((choice) => choice.value), option.key);
        if (!option.choices.some((choice) => choice.value === option.defaultValue)) throw new Error('無効な既定の選択肢');
      }
      if (option.type === 'integer' && (option.min > option.max || option.max - option.min > 20 || option.defaultValue < option.min || option.defaultValue > option.max)) {
        throw new Error('無効な整数範囲');
      }
    }
  }
  for (const error of data.errorCases) {
    refs(error.topicIds, 'topics'); refs([error.explanationId], 'explanations');
  }
  for (const explanation of Object.values(data.explanations)) {
    refs(explanation.sourceTopicIds, 'topics');
    refs(explanation.referenceIds, 'references');
  }
  for (const profile of data.starterProfiles) refs(profile.referenceIds, 'references');
  for (const path of data.learningPaths) {
    unique(path.steps.map((step) => step.id), path.id);
    for (const step of path.steps) {
      if (step.target.kind === 'topic') refs([step.target.id], 'topics');
      if (step.target.kind === 'recipe') refs([step.target.id], 'recipes');
    }
    unique(path.quiz.choices.map((choice) => choice.id), path.id);
    if (!path.quiz.choices.some((choice) => choice.id === path.quiz.answerId)) throw new Error('クイズの正答が選択肢にありません');
    refs(path.quiz.referenceIds, 'references');
  }
  return data;
}


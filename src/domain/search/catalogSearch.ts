import type { Content } from '../content/schema.ts';
import type { ReferenceChapter } from '../reference/referenceSchema.ts';
import { MAX_QUERY_LENGTH, normalize } from './searchEngine.ts';
import { purposePhrases } from './purposePhrases.ts';
import { assertTextInput } from '../security/textInput.ts';

export const searchKinds = ['topic', 'recipe', 'reference', 'error', 'guide', 'course'] as const;
export type SearchKind = typeof searchKinds[number];
export type SearchTarget = { kind: SearchKind; id: string };
export type SearchEntry = SearchTarget & {
  title: string; summary: string; keywords: string[]; commands: string[]; tags: string[];
};
export type SearchHit = { entry: SearchEntry; score: number };
type SearchFields = readonly (readonly [string[], number])[];
const preparedCatalogs = new WeakMap<SearchEntry[], SearchFields[]>();
function prepare(entry: SearchEntry): SearchFields {
  const fields: [string[], number][] = [
    [[entry.id, ...entry.commands], 10], [[entry.title], 9], [entry.keywords, 8], [entry.tags, 5], [[entry.summary], 2],
  ];
  return fields.map(([values, weight]) => [values.map(normalize), weight] as const);
}
export const targetKey = (target: SearchTarget) => `${target.kind}:${target.id}`;

// 外部応答のURLは使わず、種類とIDから生成する。
export function targetPath(target: SearchTarget) {
  switch (target.kind) {
    case 'topic': return `/topics/${encodeURIComponent(target.id)}`;
    case 'recipe': return `/recipes/${encodeURIComponent(target.id)}`;
    case 'reference': return `/reference/${encodeURIComponent(target.id)}`;
    case 'error': return `/errors/${encodeURIComponent(target.id)}`;
    case 'guide': return '/japanese';
    case 'course': return `/learn?path=${encodeURIComponent(target.id)}`;
  }
}

export function referenceSearchEntries(chapters: ReferenceChapter[], content: Content): SearchEntry[] {
  return chapters.map((chapter) => ({
    kind: 'reference', id: chapter.id, title: chapter.title, summary: chapter.summary,
    keywords: [...chapter.goals, ...chapter.checklist, ...chapter.sections.flatMap((section) => [section.title, ...section.paragraphs, ...section.pitfalls])],
    commands: [], tags: [...new Set(chapter.topicIds.flatMap((id) => content.topics.find((topic) => topic.id === id)?.tags || []))],
  }));
}

export function createSearchCatalog(content: Content, references: SearchEntry[]): SearchEntry[] {
  function topic(id: string) { return content.topics.find((topic) => topic.id === id)!; }
  const catalog: SearchEntry[] = [
    ...content.topics.map((topic): SearchEntry => ({
      kind: 'topic', id: topic.id, title: topic.title, summary: topic.summary,
      keywords: [...topic.aliases, ...purposePhrases(topic.id), ...topic.symptoms, ...content.errorCases.filter((error) => topic.errorCaseIds.includes(error.id)).flatMap((error) => [error.title, ...error.symptoms])],
      commands: topic.commands, tags: topic.tags,
    })),
    ...content.recipes.map((recipe): SearchEntry => ({
      kind: 'recipe', id: recipe.id, title: recipe.title, summary: recipe.description,
      keywords: [topic(recipe.topicId).title, ...topic(recipe.topicId).aliases, ...purposePhrases(recipe.topicId), ...topic(recipe.topicId).symptoms],
      commands: topic(recipe.topicId).commands, tags: topic(recipe.topicId).tags,
    })),
    ...references,
    ...content.errorCases.map((error): SearchEntry => ({
      kind: 'error', id: error.id, title: error.title, summary: error.cause,
      keywords: error.symptoms, commands: [], tags: [...new Set(['エラー', ...error.topicIds.flatMap((id) => topic(id).tags)])],
    })),
    { kind: 'guide', id: 'japanese', title: '日本語文書のスターター', summary: '使うエンジンに合わせて、レポートの土台を用意します。', keywords: ['日本語', 'レポート', '文書', 'jlreq', 'LuaLaTeX', 'upLaTeX', '日本語が出ない'], commands: [], tags: ['日本語', '文書構造'] },
    ...content.learningPaths.map((path): SearchEntry => ({ kind: 'course', id: path.id, title: path.title, summary: path.description,
      keywords: path.steps.flatMap((step) => [step.title, step.description]), commands: [],
      tags: [...new Set(path.steps.flatMap((step) => step.target.kind === 'topic' ? topic(step.target.id).tags : step.target.kind === 'recipe' ? topic(content.recipes.find((recipe) => recipe.id === step.target.id)!.topicId).tags : ['日本語']))],
    })),
  ];
  // 公開資料だけをキャッシュする。
  preparedCatalogs.set(catalog, catalog.map(prepare));
  return catalog;
}

export function searchCatalog(catalog: SearchEntry[], query: string, tags: string[] = []): SearchHit[] {
  assertTextInput(query, MAX_QUERY_LENGTH);
  const normalized = normalize(query);
  const terms = normalized.split(' ').filter(Boolean);
  const prepared = preparedCatalogs.get(catalog);
  return catalog.flatMap((entry, index) => {
    if (!tags.every((tag) => entry.tags.includes(tag))) return [];
    const values = prepared?.[index] || prepare(entry);
    let score = 0;
    for (const term of terms) {
      let best = 0;
      // 重みの降順なので、最初の一致が最大。
      for (const [texts, weight] of values) {
        if (texts.some((text) => text.includes(term))) { best = weight; break; }
      }
      if (!best) return [];
      score += best + 1;
    }
    for (const [texts, weight] of values) if (normalized && texts.includes(normalized)) score += weight;
    return [{ entry, score }];
  }).sort((a, b) => b.score - a.score);
}

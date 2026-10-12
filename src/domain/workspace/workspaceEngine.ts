import { content } from '../content/contentRepository.ts';
import { diagnose, MAX_CODE_LENGTH } from '../diagnose/diagnosisEngine.ts';
import { createSearchCatalog } from '../search/catalogSearch.ts';
import { referenceIndex } from '../search/referenceSearchIndex.ts';
import { normalize } from '../search/searchEngine.ts';
import { parseTexLog } from './parseTexLog.ts';
import { getLogAdvice } from '../diagnose/diagnosticAdvice.ts';
import { scanCommands } from './scanCommands.ts';
import { MAX_LOG_LENGTH } from './readLocalFile.ts';
import { purposePhrases } from '../search/purposePhrases.ts';
import { assertTextInput } from '../security/textInput.ts';

export const MAX_QUESTION_LENGTH = 500;
const catalog = createSearchCatalog(content, referenceIndex);
const commonTypos: Record<string, string> = { frca: 'frac', alhpa: 'alpha', squrt: 'sqrt', begni: 'begin', itme: 'item', sectoin: 'section', textbold: 'textbf' };
export type TypoCandidate = { command: string; replacement: string; line: number; column: number; topicIds: string[] };
const noise = new Set(['latex', 'tex', '書き方', 'コマンド', '数式', '文書']);
// 公開語句だけを事前に正規化する。
const searchableTopics = content.topics.map((topic) => ({ topic, phrases: [...new Set(
  [topic.title, ...topic.aliases, ...purposePhrases(topic.id), ...topic.symptoms, ...topic.commands, ...topic.commands.map((command) => command.replace(/^\\/, ''))]
    .flatMap((phrase) => { const text = normalize(phrase); return [text, text.replace(/(?:たい|方法)$/, '')]; })
)].filter((phrase) => phrase.length >= 2 && !noise.has(phrase)) }));

export function checkWorkspace(question: string, source: string, log: string) {
  assertTextInput(question, MAX_QUESTION_LENGTH);
  assertTextInput(source, MAX_CODE_LENGTH);
  assertTextInput(log, MAX_LOG_LENGTH);
  const scanned = scanCommands(source);
  const findings = source.trim() ? diagnose(source) : [];
  const typoCommands = scanned.dynamic ? [] : scanned.commands.filter((command) => Object.hasOwn(commonTypos, command.name) && !scanned.definitions.has(command.name));
  const typos: TypoCandidate[] = typoCommands.slice(0, 50).map((command) => {
    const replacement = commonTypos[command.name];
    return { command: `\\${command.name}`, replacement: `\\${replacement}`, line: command.line, column: command.column,
      topicIds: content.topics.filter((topic) => topic.commands.some((code) => code === `\\${replacement}`)).map((topic) => topic.id) };
  });
  const questionText = normalize(question);
  const sourceCommands = new Set(scanned.commands.map((command) => `\\${command.name}`));
  const parsedLog = parseTexLog(log);
  const contextIds = new Set([...findings.flatMap((finding) => finding.topicIds), ...typos.flatMap((typo) => typo.topicIds), ...parsedLog.findings.flatMap((finding) => getLogAdvice(finding.message)?.topicIds || [])]);
  const ranked = searchableTopics.map(({ topic, phrases }) => {
    const matched = phrases.filter((phrase) => questionText.includes(phrase));
    const questionScore = matched.length ? 100 + Math.max(...matched.map((phrase) => Math.min(phrase.length, 30))) + matched.length : 0;
    const score = questionScore + (contextIds.has(topic.id) ? 30 : 0) + (topic.commands.some((command) => sourceCommands.has(command)) ? 10 : 0);
    return { topic, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
  const topics = ranked.slice(0, 3).map(({ topic }) => topic);
  const selectedIds = new Set(topics.map((topic) => topic.id));
  const related = catalog.filter((entry) => entry.kind !== 'topic' && (
    entry.kind === 'recipe' ? content.recipes.some((recipe) => recipe.id === entry.id && selectedIds.has(recipe.topicId)) :
    entry.kind === 'error' ? content.errorCases.some((error) => error.id === entry.id && error.topicIds.some((id) => selectedIds.has(id))) :
    entry.kind === 'reference' ? referenceIndex.some((chapter) => chapter.id === entry.id && chapter.tags.some((tag) => topics.some((topic) => topic.tags.includes(tag)))) :
    entry.kind === 'guide' ? topics.some((topic) => topic.guideId === 'japanese') :
    entry.kind === 'course' ? content.learningPaths.some((path) => path.id === entry.id && path.steps.some((step) => step.target.kind === 'topic' && selectedIds.has(step.target.id))) : false
  )).sort((a, b) => Number(b.kind === 'recipe') - Number(a.kind === 'recipe')).slice(0, 6);
  const largeFraction = /分数を大きくしたい|分数を大きく表示|大きい分数|大きめの分数|\\dfrac/.test(questionText);
  const smallFraction = /分数を小さくしたい|小さい分数|小さめの分数|\\tfrac/.test(questionText);
  const fractionStyle = largeFraction !== smallFraction ? largeFraction ? '\\dfrac' : '\\tfrac' : null;
  return { topics, related, findings, typos, typosLimited: typoCommands.length > 50, log: parsedLog, hasLog: Boolean(log.trim()), dynamic: scanned.dynamic, totalTopics: ranked.length, fractionStyle };
}

export type WorkspaceResult = ReturnType<typeof checkWorkspace>;
export { sourceContext, sourceOffset } from '../diagnose/sourceLocation.ts';

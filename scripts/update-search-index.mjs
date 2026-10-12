import fs from 'node:fs';
import { URL } from 'node:url';
import { rawContent } from '../src/domain/content/rawContent.ts';
import { validateContent } from '../src/domain/content/validateContent.ts';
import chapters from '../src/data/reference_chapters.json' with { type: 'json' };
import { validateReferenceChapters } from '../src/domain/reference/validateReferenceChapters.ts';
import { referenceSearchEntries } from '../src/domain/search/catalogSearch.ts';

const content = validateContent(rawContent);
const entries = referenceSearchEntries(validateReferenceChapters(chapters, content), content);
fs.writeFileSync(new URL('../src/data/reference_search_index.json', import.meta.url), JSON.stringify(entries, null, 2) + '\n');

import referenceEntries from '../../data/reference_search_index.json' with { type: 'json' };
import type { SearchEntry } from './catalogSearch.ts';

export const referenceIndex = referenceEntries as SearchEntry[];

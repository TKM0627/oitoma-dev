import rawChapters from '../../data/reference_chapters.json';
import type { ReferenceChapter } from './referenceSchema';

// ビルド検証済みの同梱データ専用。外部入力には使わない。
export const referenceChapters = rawChapters as ReferenceChapter[];

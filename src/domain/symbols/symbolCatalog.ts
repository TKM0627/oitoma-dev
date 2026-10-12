import type { SymbolGroup } from './validateSymbolCatalog';
import { assertTextInput } from '../security/textInput';

export function filterSymbols(groups: SymbolGroup[], query: string): SymbolGroup[] {
  assertTextInput(query, 100);
  const words = query.slice(0, 100).normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return groups.map((group) => ({ ...group, entries: group.entries.filter((entry) => {
    const text = [group.title, entry.name, entry.code, entry.glyph, ...entry.aliases].join(' ').normalize('NFKC').toLowerCase();
    return words.every((word) => text.includes(word));
  }) })).filter((group) => group.entries.length > 0);
}

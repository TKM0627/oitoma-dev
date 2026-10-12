import { createContext, useContext } from 'react';

export const SearchContext = createContext<{ query: string; setQuery: (value: string) => void } | null>(null);
export function useSearchInput() {
  const context = useContext(SearchContext);
  if (!context) throw new Error('SearchProviderが必要です');
  return context;
}

import { createContext, useContext } from 'react';
import type { Environment } from './environments';

export interface StudyState {
  environment: Environment;
  setEnvironment: (value: Environment) => void;
  completed: ReadonlySet<string>;
  toggleStep: (key: string) => void;
}
export const StudyContext = createContext<StudyState | null>(null);
export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error('StudyProviderが必要です');
  return context;
}

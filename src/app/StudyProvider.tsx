import { useState, type ReactNode } from 'react';
import { StudyContext } from './studyContext';
import type { Environment } from './environments';

export function StudyProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironment] = useState<Environment>('none');
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  function toggleStep(key: string) {
    setCompleted((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  return <StudyContext.Provider value={{ environment, setEnvironment, completed, toggleStep }}>{children}</StudyContext.Provider>;
}

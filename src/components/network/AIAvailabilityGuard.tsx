import { useSyncExternalStore, type ReactNode } from 'react';
import { networkChecker } from '../../ai/runtime';

export function AIAvailabilityGuard({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(networkChecker.subscribe, networkChecker.getSnapshot);
  return status === 'available' && networkChecker.supportsExplanations() ? children : <p className="muted small">学内AIの補足は利用できません。登録済みの説明を表示しています。</p>;
}

import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIAvailabilityGuard } from './AIAvailabilityGuard';
import { networkChecker } from '../../ai/runtime';

it('サービスに到達しても解説の能力がない場合は補足操作を出さない', () => {
  vi.spyOn(networkChecker, 'getSnapshot').mockReturnValue('available');
  vi.spyOn(networkChecker, 'supportsExplanations').mockReturnValue(false);
  render(<AIAvailabilityGuard><button>学内AIで補足を確認</button></AIAvailabilityGuard>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByText(/登録済みの説明を表示/)).toBeInTheDocument();
});

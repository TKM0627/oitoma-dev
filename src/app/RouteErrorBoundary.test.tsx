import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from './RouteErrorBoundary';

it('画面の取得失敗から回復でき、内部の例外内容を画面に出さない', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function FailedPage(): never { throw new Error('PRIVATE_ERROR_DETAIL'); }
  const app = render(<RouteErrorBoundary key="failed"><FailedPage /></RouteErrorBoundary>);
  expect(screen.getByRole('alert')).toHaveTextContent('画面を読み込めませんでした');
  expect(screen.queryByText('PRIVATE_ERROR_DETAIL')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument();
  app.rerender(<RouteErrorBoundary key="next"><p>次の画面</p></RouteErrorBoundary>);
  expect(screen.getByText('次の画面')).toBeInTheDocument();
});

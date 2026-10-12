import { NetworkChecker } from './networkChecker';
import { StaticProvider } from './staticProvider';
import type { AiProvider } from './types';

export const networkChecker = new NetworkChecker({
  enabled: import.meta.env.VITE_ENABLE_LIVE_AI === 'true',
  baseUrl: import.meta.env.VITE_UNIVERSITY_GATEWAY_BASE_URL,
});
const staticProvider = new StaticProvider();
// AI無効時はGateway実装を読み込まない。
export const explanationProvider: AiProvider = {
  async getExplanation(request) {
    if (!networkChecker.baseUrl) return staticProvider.getExplanation(request);
    try {
      const { UniversityGatewayProvider } = await import('./universityGatewayProvider');
      return await new UniversityGatewayProvider(networkChecker).getExplanation(request);
    } catch { return staticProvider.getExplanation(request); }
  },
};

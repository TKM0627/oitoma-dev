import { useEffect, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { networkChecker } from '../../ai/runtime';
import type { GatewayStatus } from '../../ai/types';

const labels: Record<GatewayStatus, string> = {
  'not-configured': '学内AI連携は未設定です', checking: '接続確認中',
  available: '学内AIサービスを利用できます',
  'authentication-required': '学内認証が必要です',
  unavailable: '学内AIサービスに接続できません。学内Wi-Fi/VPNをご確認ください',
  unknown: '接続状況を確認できません（ブラウザ・通信設定等）。学内Wi-Fi/VPNと通信制限をご確認ください',
};

export function NetworkStatus() {
  const status = useSyncExternalStore(networkChecker.subscribe, networkChecker.getSnapshot);
  useEffect(() => {
    if (!networkChecker.baseUrl) return;
    void networkChecker.check();
    const onVisible = () => { if (document.visibilityState === 'visible') void networkChecker.check(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  if (!networkChecker.baseUrl) return null;
  return <div className="network-status">
    <span className={`status-dot ${status === 'available' ? 'available' : ''}`} aria-hidden="true" />
    <span role="status">{labels[status]}</span>
    {networkChecker.baseUrl && <button className="text-button" disabled={status === 'checking'} onClick={() => void networkChecker.check(true)}>再確認</button>}
    {status === 'authentication-required' && <Link to="/help">大学の認証手順について</Link>}
  </div>;
}

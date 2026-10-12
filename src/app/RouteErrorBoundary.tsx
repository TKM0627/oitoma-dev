import { Component, type ReactNode } from 'react';

export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="page" role="alert">
      <h1>画面を読み込めませんでした</h1>
      <p>接続を確認して再読み込みするか、上部のリンクから別の画面へ移動してください。</p>
      <p className="small">再読み込みすると入力コードと学習の確認状況は消えます。</p>
      <button onClick={() => window.location.reload()}>再読み込み</button>
    </div>;
    return this.props.children;
  }
}

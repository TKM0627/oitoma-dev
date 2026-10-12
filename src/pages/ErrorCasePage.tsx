import { SearchReturnLink } from '../components/search/SearchReturnLink';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { content } from '../domain/content/contentRepository';
import { explanationProvider } from '../ai/runtime';
import type { Explanation } from '../ai/types';
import { AIAvailabilityGuard } from '../components/network/AIAvailabilityGuard';
import { CodeBlock } from '../components/common/CodeBlock';
import { PageHeading, ReferenceLinks, RelatedTopics } from '../components/common/ContentParts';
import { NotFoundPage } from './NotFoundPage';

function ExplanationPanel({ explanationId, topicId }: { explanationId: string; topicId: string }) {
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    // 初回は必ず静的な登録済み説明。ライブ補足は明示操作時のみ。
    const entry = content.explanations[explanationId];
    if (entry?.reviewed) {
      Promise.resolve().then(() => { if (active) setExplanation({ explanationId, text: entry.text, relatedTopicIds: entry.sourceTopicIds, referenceIds: entry.referenceIds, source: 'static' }); });
    }
    return () => { active = false; };
  }, [explanationId]);
  async function supplement() {
    setLoading(true);
    try { setExplanation(await explanationProvider.getExplanation({ explanationId, topicId, variant: 'brief' })); }
    finally { setLoading(false); }
  }
  return <section className="explanation-panel"><h2>原因と修正の理由</h2>{explanation ? <><span className="eyebrow">{explanation.source === 'static' ? '登録済みの静的解説' : '学内AIによる補足'}</span><p>{explanation.text}</p>{explanation.source === 'static' && <p className="small muted">開発時に一次資料と照合しています。教員などによる人手校閲は未実施です。断片の扱い・重大度はこのアプリの診断方針です。</p>}<ReferenceLinks ids={explanation.referenceIds} /></> : <p>資料との照合を終えた静的説明は未収録です。</p>}<AIAvailabilityGuard><button className="button secondary" disabled={loading} onClick={() => void supplement()}>{loading ? '補足を確認中' : '学内AIで補足を確認'}</button></AIAvailabilityGuard></section>;
}
export function ErrorCasePage() {
  const { id } = useParams();
  const error = content.errorCases.find((error) => error.id === id);
  if (!error) return <NotFoundPage />;
  const referenceIds = [...new Set(content.topics.filter((topic) => error.topicIds.includes(topic.id)).flatMap((topic) => topic.referenceIds))];
  return <div className="page"><SearchReturnLink fallbackTo="/diagnose" fallbackLabel="← 簡易診断へ" /><PageHeading title={error.title} description={error.cause} /><div className="comparison-grid"><div><span className="comparison-label bad">修正前の例</span><CodeBlock code={error.badExample} /></div><div><span className="comparison-label good">修正後の例</span><CodeBlock code={error.goodExample} /></div></div><p className="small muted">一般的な断片例の比較です。入力コードを自動修正するものではありません。環境・本文中での利用位置は関連トピックで確認してください。</p><ExplanationPanel key={error.id} explanationId={error.explanationId} topicId={content.explanations[error.explanationId].sourceTopicIds[0]} /><section><h2>関連する書き方</h2><RelatedTopics ids={error.topicIds} /></section><section><h2>参考資料</h2><ReferenceLinks ids={referenceIds} /></section><Link className="button" to={`/diagnose?case=${error.id}`}>この修正前の例を診断する →</Link></div>;
}

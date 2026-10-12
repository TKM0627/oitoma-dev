import { content } from '../content/contentRepository';

const types = ['topic', 'recipe', 'reference', 'error', 'learning'];
/** URLには固定フィルターだけ残す。 */
export function publicSearchParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  const type = params.get('type');
  if (type && types.includes(type)) next.set('type', type);
  if (params.get('view') === 'all') next.set('view', 'all');
  for (const tag of new Set(params.getAll('tag').slice(0, 100))) {
    if (content.tags.includes(tag)) next.append('tag', tag);
  }
  return next;
}

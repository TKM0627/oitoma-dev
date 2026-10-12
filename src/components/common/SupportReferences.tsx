import { content } from '../../domain/content/contentRepository';
import { supportReferences } from '../../domain/content/supportReferences';
import { ReferenceLinks } from './ContentParts';

export function SupportReferences({ ids }: { ids: string[] }) {
  return <ReferenceLinks ids={ids} showScope references={[...content.references, ...supportReferences]} />;
}

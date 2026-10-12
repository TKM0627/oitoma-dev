import raw from '../../data/support_references.json' with { type: 'json' };
import type { Reference } from './schema';

export const supportReferences = raw as Reference[];

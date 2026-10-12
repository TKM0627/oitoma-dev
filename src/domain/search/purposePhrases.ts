import phrases from '../../data/purpose_phrases.json' with { type: 'json' };

export function purposePhrases(topicId: string): string[] {
  return phrases.find((entry) => entry.topicId === topicId)?.phrases || [];
}

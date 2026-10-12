export const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export const MAX_QUERY_LENGTH = 100;

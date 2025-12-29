const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'how',
  'many',
  'what',
  'when',
  'where',
  'why',
  'who',
  'which',
  'it',
  'this',
  'that',
])

export function extractKeywords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3)
    .filter((t) => !STOPWORDS.has(t))
    .slice(0, 8)
}

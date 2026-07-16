/**
 * Builds a safe FTS5 MATCH expression from the 1e search box text — every token
 * is quote-stripped and wrapped as a quoted prefix term so user input can never
 * inject FTS5 syntax. Called by db.searchRecordings.
 * @param query - raw user search text (names / URLs, Japanese or English)
 * @returns
 * - AND-joined quoted prefix terms, e.g. '"export"* AND "bug"*'
 * - null when no searchable token remains (caller shows the unfiltered list)
 * @example
 * buildFtsMatchExpression('export bug') // => '"export"* AND "bug"*'
 * buildFtsMatchExpression('  ') // => null
 */
export function buildFtsMatchExpression(query: string): string | null {
  const tokens = query
    .split(/[\s\u3000]+/)
    .map((token) => token.replaceAll('"', ''))
    // Symbol-only tokens ("*", "-", "()") tokenize to nothing and break FTS5 syntax.
    .filter((token) => /[\p{L}\p{N}]/u.test(token))
  if (tokens.length === 0) return null
  return tokens.map((token) => `"${token}"*`).join(' AND ')
}

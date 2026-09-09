import { describe, expect, test } from 'vitest'

import { buildFtsMatchExpression } from './fts-match-expression'

describe('library search query building (screen 1e search box → FTS5 MATCH)', () => {
  test('turns space-separated words into AND-ed quoted prefix terms', () => {
    // Act
    const expression = buildFtsMatchExpression('export bug')

    // Assert
    expect(expression).toBe('"export"* AND "bug"*')
  })

  test('keeps Japanese full-width-space-separated terms searchable', () => {
    // Act
    const expression = buildFtsMatchExpression('録画　ダッシュボード')

    // Assert
    expect(expression).toBe('"録画"* AND "ダッシュボード"*')
  })

  test('strips quotes and symbol-only tokens so user input can never produce FTS5 syntax errors', () => {
    // Act
    const expression = buildFtsMatchExpression('a"b OR *')

    // Assert
    expect(expression).toBe('"ab"* AND "OR"*')
  })

  test('returns null for blank input so callers fall back to the unfiltered list', () => {
    // Act + Assert
    expect(buildFtsMatchExpression('   ')).toBeNull()
    expect(buildFtsMatchExpression('""')).toBeNull()
    expect(buildFtsMatchExpression('* - ()')).toBeNull()
  })
})

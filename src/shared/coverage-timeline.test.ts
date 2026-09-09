import { describe, expect, test } from 'vitest'

import {
  buildLineStarts,
  coverageBucketAt,
  flattenExecutedSegments,
  offsetToLineCol,
  type CoverageBucket,
} from './coverage-timeline'

describe('flattenExecutedSegments', () => {
  test('excludes an else-branch V8 reported as a count-0 nested range', () => {
    // Arrange — executed function [0,100), with a skipped block [40,60).
    const ranges = [
      { startOffset: 0, endOffset: 100, count: 1 },
      { startOffset: 40, endOffset: 60, count: 0 },
    ]

    // Act
    const executed = flattenExecutedSegments(ranges)

    // Assert — the skipped block is carved out of the executed span.
    expect(executed).toEqual([
      [0, 40],
      [60, 100],
    ])
  })

  test('excludes the whole body of a never-invoked nested function', () => {
    // Arrange — module code ran [0,200); inner function [50,120) never called.
    const ranges = [
      { startOffset: 0, endOffset: 200, count: 1 },
      { startOffset: 50, endOffset: 120, count: 0 },
    ]

    // Act
    const executed = flattenExecutedSegments(ranges)

    // Assert
    expect(executed).toEqual([
      [0, 50],
      [120, 200],
    ])
  })

  test('re-includes an executed range nested inside a skipped one', () => {
    // Arrange — dead outer block [10,90) containing a hot callback [30,50)
    // (V8 emits this for callbacks defined in skipped code but invoked later).
    const ranges = [
      { startOffset: 0, endOffset: 100, count: 1 },
      { startOffset: 10, endOffset: 90, count: 0 },
      { startOffset: 30, endOffset: 50, count: 3 },
    ]

    // Act
    const executed = flattenExecutedSegments(ranges)

    // Assert
    expect(executed).toEqual([
      [0, 10],
      [30, 50],
      [90, 100],
    ])
  })

  test('returns nothing when the only range never executed', () => {
    // Arrange
    const ranges = [{ startOffset: 0, endOffset: 40, count: 0 }]

    // Act / Assert
    expect(flattenExecutedSegments(ranges)).toEqual([])
  })

  test('merges touching executed ranges from separate functions into one span', () => {
    // Arrange — two adjacent invoked functions.
    const ranges = [
      { startOffset: 0, endOffset: 25, count: 1 },
      { startOffset: 25, endOffset: 60, count: 2 },
    ]

    // Act
    const executed = flattenExecutedSegments(ranges)

    // Assert — one contiguous executed span, not two.
    expect(executed).toEqual([[0, 60]])
  })
})

describe('offsetToLineCol', () => {
  test('maps an offset in the middle line to its 0-based line and column', () => {
    // Arrange — "ab\ncde\nf" → line starts [0, 3, 7].
    const lineStarts = buildLineStarts('ab\ncde\nf')

    // Act / Assert — offset 5 is "e": line 1, column 2.
    expect(offsetToLineCol(lineStarts, 5)).toEqual({ line: 1, column: 2 })
  })

  test('maps offset 0 to line 0 column 0', () => {
    // Arrange
    const lineStarts = buildLineStarts('hello\nworld')

    // Act / Assert
    expect(offsetToLineCol(lineStarts, 0)).toEqual({ line: 0, column: 0 })
  })
})

describe('coverageBucketAt', () => {
  const bucket = (tStart: number, tEnd: number): CoverageBucket => ({
    tStart,
    tEnd,
    kind: 'input',
    files: [],
  })

  test('returns the bucket the playhead is inside', () => {
    // Arrange
    const buckets = [bucket(0, 1000), bucket(1000, 5000), bucket(5000, 9000)]

    // Act / Assert — 2500 falls in (1000, 5000].
    expect(coverageBucketAt(buckets, 2500)).toBe(buckets[1])
  })

  test('keeps the last passed bucket after its end (sticky display)', () => {
    // Arrange
    const buckets = [bucket(0, 1000), bucket(1000, 2000)]

    // Act / Assert — playhead far past the last bucket still shows it.
    expect(coverageBucketAt(buckets, 50_000)).toBe(buckets[1])
  })

  test('returns null before any code executed', () => {
    // Arrange
    const buckets = [bucket(3000, 4000)]

    // Act / Assert
    expect(coverageBucketAt(buckets, 2999)).toBeNull()
  })
})

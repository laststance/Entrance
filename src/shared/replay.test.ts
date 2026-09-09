import { describe, expect, test } from 'vitest'

import { parseLaneJsonl } from './replay'

function row(seq: number, tMono: number): string {
  return JSON.stringify({ seq, tMono, tWall: 1_784_262_000_000, lane: 'console', payload: { n: seq } })
}

describe('lane JSONL reading at replay time (bundle is hostile disk data)', () => {
  test('parses rows and returns them in canonical (tMono, seq) order', () => {
    // Arrange — same-millisecond tie broken by seq (golden corpus: cross-lane tie)
    const text = [row(2, 300), row(0, 100), row(3, 300), row(1, 200)].join('\n')

    // Act
    const events = parseLaneJsonl(text)

    // Assert
    expect(events.map((event) => event.seq)).toEqual([0, 1, 2, 3])
  })

  test('drops torn and garbled lines so crash-recovered bundles still replay', () => {
    // Arrange
    const text = `${row(0, 100)}\nnot json at all\n{"seq":1,"tMono":2\n${row(2, 300)}\n{"seq":"bad types"}`

    // Act
    const events = parseLaneJsonl(text)

    // Assert
    expect(events.map((event) => event.seq)).toEqual([0, 2])
  })

  test('returns an empty list for an empty lane file (golden corpus: empty recording)', () => {
    // Act + Assert
    expect(parseLaneJsonl('')).toEqual([])
  })
})

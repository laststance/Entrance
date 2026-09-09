import { describe, expect, test } from 'vitest'

import type { ReplayLaneEvent } from './replay'
import { buildRrwebTimeMap, toRrwebOffset, toTMonoOffset } from './rrweb-time-map'

function rrwebRow(seq: number, tMono: number, timestamp: number): ReplayLaneEvent {
  return { seq, tMono, tWall: 0, lane: 'rrweb', payload: { type: 3, timestamp } }
}

describe('seek clock mapping (decision 13: tMono is canonical, rrweb time stays lane-internal)', () => {
  // Arrange (shared) — rrweb events at t0+10/+1010/+5010 with wall timestamps 100ms apart from those
  const anchors = buildRrwebTimeMap(
    [rrwebRow(0, 1010, 50_000), rrwebRow(1, 2010, 51_000), rrwebRow(2, 6010, 55_000)],
    1000,
  )

  test('maps a seek-bar position to the replayer offset via the nearest earlier event', () => {
    // Act + Assert — 2510ms after t0 sits 1500ms past the second anchor (tMonoOffset 1010 → rrweb 1000)
    expect(toRrwebOffset(anchors, 2510)).toBe(2500)
  })

  test('clamps seeks past the last rrweb event to the lane end (quiet recording tail)', () => {
    // Act + Assert
    expect(toRrwebOffset(anchors, 99_999)).toBe(5000)
    expect(toRrwebOffset(anchors, -50)).toBe(0)
  })

  test('maps the replayer clock back to the canonical clock for the playhead display', () => {
    // Act + Assert — inverse of the seek mapping at an anchor and between anchors
    expect(toTMonoOffset(anchors, 1000)).toBe(1010)
    expect(toTMonoOffset(anchors, 1500)).toBe(1510)
  })

  test('skips garbled rrweb payloads without breaking the map', () => {
    // Arrange
    const withGarbage = buildRrwebTimeMap(
      [
        { seq: 0, tMono: 1010, tWall: 0, lane: 'rrweb', payload: 'garbage' },
        rrwebRow(1, 1010, 50_000),
        rrwebRow(2, 2010, 51_000),
      ],
      1000,
    )

    // Act + Assert
    expect(withGarbage).toHaveLength(2)
    expect(toRrwebOffset(withGarbage, 1010)).toBe(1000)
  })
})

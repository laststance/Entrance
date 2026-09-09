import { describe, expect, test } from 'vitest'

import type { ReplayLaneEvent } from './replay'
import { anchorAt, buildCodeAnchors } from './code-anchors'

function laneEvent(lane: ReplayLaneEvent['lane'], seq: number, tMono: number, payload: unknown): ReplayLaneEvent {
  return { seq, tMono, tWall: 0, lane, payload }
}

const sampleStack = [
  { functionName: 'warn', url: 'http://localhost:3000/chunks/vendor.js', lineNumber: 2477, columnNumber: 27 },
  { functionName: 'handleExport', url: 'http://localhost:3000/chunks/page.js', lineNumber: 41, columnNumber: 10 },
]

describe('code anchors (decision 3 line-exact highlight at console/error)', () => {
  test('collects console and uncaught events that carry stacks, in time order', () => {
    // Arrange
    const anchors = buildCodeAnchors(
      {
        console: [
          laneEvent('console', 2, 5000, { type: 'warning', preview: 'w', stack: sampleStack }),
          laneEvent('console', 3, 6000, { type: 'log', preview: 'no stack here' }),
        ],
        error: [laneEvent('error', 4, 3000, { message: 'TypeError', stack: sampleStack })],
      },
      1000,
    )

    // Act + Assert — stackless events dropped, error sorts before the warn
    expect(anchors.map((anchor) => [anchor.tMonoOffset, anchor.label])).toEqual([
      [2000, 'uncaught'],
      [4000, 'console.warn'],
    ])
    expect(anchors[1].frames[1].functionName).toBe('handleExport')
  })

  test('hides bootstrap anchors recorded before Rec was pressed (decision 27)', () => {
    // Arrange
    const anchors = buildCodeAnchors(
      { console: [laneEvent('console', 1, 500, { type: 'error', stack: sampleStack })] },
      1000,
    )

    // Act + Assert
    expect(anchors).toEqual([])
  })

  test('returns the most recently passed anchor for the playhead position', () => {
    // Arrange
    const anchors = buildCodeAnchors(
      {
        console: [
          laneEvent('console', 1, 2000, { type: 'warning', stack: sampleStack }),
          laneEvent('console', 2, 8000, { type: 'error', stack: sampleStack }),
        ],
      },
      1000,
    )

    // Act + Assert
    expect(anchorAt(anchors, 500)).toBeNull()
    expect(anchorAt(anchors, 5000)?.label).toBe('console.warn')
    expect(anchorAt(anchors, 9000)?.label).toBe('console.error')
  })
})

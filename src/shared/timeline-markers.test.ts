import { describe, expect, it } from 'vitest'

import type { ReplayLaneEvent } from './replay'
import { buildTimelineMarkers } from './timeline-markers'

function laneEvent(lane: ReplayLaneEvent['lane'], seq: number, tMono: number, payload: unknown): ReplayLaneEvent {
  return { seq, tMono, tWall: 0, lane, payload }
}

describe('timeline lane markers (mock 1a bottom timeline / 1c legend)', () => {
  it('maps clicks, app fetches, console, errors, and route changes to their lanes', () => {
    // Arrange
    const markers = buildTimelineMarkers(
      {
        input: [
          laneEvent('input', 1, 1100, { kind: 'click', x: 1, y: 1 }),
          laneEvent('input', 2, 1150, { kind: 'scroll', x: 0, y: 5 }),
        ],
        network: [
          laneEvent('network', 3, 1200, { phase: 'request', resourceType: 'Fetch' }),
          laneEvent('network', 4, 1250, { phase: 'request', resourceType: 'Image' }),
          laneEvent('network', 5, 1300, { phase: 'response', resourceType: 'Fetch' }),
        ],
        console: [
          laneEvent('console', 6, 1400, { type: 'warning', preview: 'w' }),
          laneEvent('console', 7, 1500, { type: 'error', preview: 'e' }),
        ],
        error: [laneEvent('error', 8, 1600, { message: 'TypeError' })],
        page: [
          laneEvent('page', 9, 1700, { kind: 'navigated', url: 'http://localhost:3000/x' }),
          laneEvent('page', 10, 1750, { kind: 'load' }),
        ],
      },
      1000,
    )

    // Act + Assert
    expect(markers.map((marker) => [marker.tMonoOffset, marker.kind])).toEqual([
      [100, 'click'],
      [200, 'fetch'],
      [400, 'console'],
      [500, 'error'],
      [600, 'error'],
      [700, 'route'],
    ])
  })

  it('hides bootstrap events recorded before Rec was pressed (decision 27)', () => {
    // Arrange
    const markers = buildTimelineMarkers(
      {
        network: [
          laneEvent('network', 0, 500, { phase: 'request', resourceType: 'Fetch' }),
          laneEvent('network', 1, 1500, { phase: 'request', resourceType: 'XHR' }),
        ],
      },
      1000,
    )

    // Act + Assert
    expect(markers).toEqual([{ tMonoOffset: 500, kind: 'fetch', seq: 1 }])
  })
})

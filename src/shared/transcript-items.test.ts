import { describe, expect, it } from 'vitest'

import type { ReplayLaneEvent } from './replay'
import { buildTranscriptItems, transcriptIndexAt } from './transcript-items'

function laneEvent(lane: ReplayLaneEvent['lane'], seq: number, tMono: number, payload: unknown): ReplayLaneEvent {
  return { seq, tMono, tWall: 0, lane, payload }
}

describe('transcript rows (mock 1b numbered event list)', () => {
  it('joins fetch request/response into one row with status, keeps pending when no response', () => {
    // Arrange
    const items = buildTranscriptItems(
      {
        network: [
          laneEvent('network', 1, 1100, {
            phase: 'request',
            requestId: 'r1',
            url: 'http://localhost:3000/api/export',
            method: 'GET',
            resourceType: 'Fetch',
          }),
          laneEvent('network', 2, 1150, {
            phase: 'request',
            requestId: 'img1',
            url: 'http://localhost:3000/logo.png',
            method: 'GET',
            resourceType: 'Image',
          }),
          laneEvent('network', 3, 1200, { phase: 'response', requestId: 'r1', status: 200 }),
          laneEvent('network', 4, 1300, {
            phase: 'request',
            requestId: 'r2',
            url: 'http://localhost:3000/api/slow',
            method: 'POST',
            resourceType: 'XHR',
          }),
        ],
      },
      1000,
      'http://localhost:3000/',
    )

    // Act + Assert — image subresources hidden, statuses joined by requestId
    expect(items.map((item) => [item.title, item.subtitle])).toEqual([
      ['fetch·200', 'GET /api/export'],
      ['fetch·pending', 'POST /api/slow'],
    ])
    expect(items.every((item) => item.filterGroup === 'network')).toBe(true)
  })

  it('marks a fetch row failed when the request ends in Network.loadingFailed', () => {
    // Arrange
    const items = buildTranscriptItems(
      {
        network: [
          laneEvent('network', 1, 1100, {
            phase: 'request',
            requestId: 'r1',
            url: 'http://localhost:3000/api/down',
            method: 'GET',
            resourceType: 'Fetch',
          }),
          laneEvent('network', 2, 1200, { phase: 'failed', requestId: 'r1', errorText: 'net::ERR_CONNECTION_REFUSED' }),
        ],
      },
      1000,
      'http://localhost:3000/',
    )

    // Act + Assert
    expect(items[0].title).toBe('fetch·failed')
  })

  it('collapses a typing burst into one masked input row and never shows key contents', () => {
    // Arrange — 3 keys within the burst gap, then a click, then a distant key
    const items = buildTranscriptItems(
      {
        input: [
          laneEvent('input', 1, 1100, { kind: 'key', code: 'KeyA', keyClass: 'character', masked: true }),
          laneEvent('input', 2, 1200, { kind: 'key', code: 'KeyB', keyClass: 'character', masked: true }),
          laneEvent('input', 3, 1300, { kind: 'key', code: 'Enter', keyClass: 'control', key: 'Enter' }),
          laneEvent('input', 4, 2000, { kind: 'click', x: 10, y: 20, selector: '#export-btn' }),
          laneEvent('input', 5, 9000, { kind: 'key', code: 'KeyZ', keyClass: 'character', masked: true }),
          laneEvent('input', 6, 9100, { kind: 'scroll' }),
        ],
      },
      1000,
      'http://localhost:3000/',
    )

    // Act + Assert — burst row, click row, second burst; scroll skipped
    expect(items.map((item) => [item.tMonoOffset, item.kind, item.subtitle])).toEqual([
      [100, 'input', 'キー入力 ×3(伏字)'],
      [1000, 'click', '#export-btn'],
      [8000, 'input', 'キー入力 ×1(伏字)'],
    ])
    expect(JSON.stringify(items)).not.toContain('KeyA')
  })

  it('shows route rows as path transitions starting from the recording start URL', () => {
    // Arrange — one pre-t0 navigation (tracked but hidden) then two visible ones
    const items = buildTranscriptItems(
      {
        page: [
          laneEvent('page', 1, 500, { kind: 'navigated', url: 'http://localhost:3000/login' }),
          laneEvent('page', 2, 2000, { kind: 'navigated', url: 'http://localhost:3000/dashboard' }),
          laneEvent('page', 3, 2100, { kind: 'load' }),
          laneEvent('page', 4, 4000, { kind: 'navigated', url: 'http://localhost:3000/settings?tab=1' }),
        ],
      },
      1000,
      'http://localhost:3000/',
    )

    // Act + Assert
    expect(items.map((item) => item.subtitle)).toEqual(['/login → /dashboard', '/dashboard → /settings?tab=1'])
    expect(items.map((item) => item.kind)).toEqual(['route', 'route'])
  })

  it('splits console rows into error vs other filter groups and adds uncaught rows', () => {
    // Arrange
    const items = buildTranscriptItems(
      {
        console: [
          laneEvent('console', 1, 1100, { type: 'warning', preview: 'slow render' }),
          laneEvent('console', 2, 1200, { type: 'error', preview: 'boom' }),
          laneEvent('console', 3, 1300, { type: 'log', preview: 'hello' }),
        ],
        error: [laneEvent('error', 4, 1400, { message: 'TypeError: x is not a function' })],
      },
      1000,
      'http://localhost:3000/',
    )

    // Act + Assert
    expect(items.map((item) => [item.title, item.filterGroup])).toEqual([
      ['console.warn', 'other'],
      ['console.error', 'error'],
      ['console.log', 'other'],
      ['uncaught', 'error'],
    ])
  })

  it('orders mixed-lane rows by time so the transcript reads chronologically', () => {
    // Arrange
    const items = buildTranscriptItems(
      {
        input: [laneEvent('input', 5, 3000, { kind: 'click', x: 0, y: 0, selector: 'button' })],
        console: [laneEvent('console', 2, 1500, { type: 'log', preview: 'first' })],
        network: [
          laneEvent('network', 3, 2000, {
            phase: 'request',
            requestId: 'r1',
            url: 'http://localhost:3000/api/a',
            method: 'GET',
            resourceType: 'XHR',
          }),
        ],
      },
      1000,
      'http://localhost:3000/',
    )

    // Act + Assert
    expect(items.map((item) => item.kind)).toEqual(['console', 'fetch', 'click'])
  })
})

describe('transcript playhead highlight (1b current-row follow)', () => {
  it('returns the last row at or before the playhead, and -1 before the first row', () => {
    // Arrange
    const items = buildTranscriptItems(
      {
        console: [
          laneEvent('console', 1, 2000, { type: 'log', preview: 'a' }),
          laneEvent('console', 2, 5000, { type: 'log', preview: 'b' }),
          laneEvent('console', 3, 9000, { type: 'log', preview: 'c' }),
        ],
      },
      1000,
      'http://localhost:3000/',
    )

    // Act + Assert
    expect(transcriptIndexAt(items, 500)).toBe(-1)
    expect(transcriptIndexAt(items, 1000)).toBe(0)
    expect(transcriptIndexAt(items, 4500)).toBe(1)
    expect(transcriptIndexAt(items, 99_999)).toBe(2)
  })
})

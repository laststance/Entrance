import { describe, expect, it } from 'vitest'

import type { ReplayLaneEvent } from '@shared/replay'
import { NetworkMatcher, normalizeMatchUrl } from './network-matcher'

let seq = 0
function laneEvent(payload: unknown): ReplayLaneEvent {
  seq += 1
  return { seq, tMono: seq * 10, tWall: 0, lane: 'network', payload }
}

function recordedExchange(
  requestId: string,
  url: string,
  status: number,
  bodyHash?: string,
): ReplayLaneEvent[] {
  return [
    laneEvent({ phase: 'request', requestId, url, method: 'GET', headers: {}, resourceType: 'Fetch' }),
    laneEvent({ phase: 'response', requestId, url, status, mimeType: 'application/json', headers: { 'content-type': 'application/json' } }),
    ...(bodyHash ? [laneEvent({ phase: 'body', requestId, bodyHash, bodySize: 10, base64Encoded: false })] : []),
    laneEvent({ phase: 'finished', requestId, encodedBytes: 10 }),
  ]
}

describe('Mode B network matcher (decision 29 ordinal replay)', () => {
  it('replays repeated requests to the same URL in recorded order', () => {
    // Arrange — two polls of the same endpoint with different bodies
    const matcher = new NetworkMatcher([
      ...recordedExchange('r1', 'http://localhost:3000/api/poll', 200, 'hash-first'),
      ...recordedExchange('r2', 'http://localhost:3000/api/poll', 200, 'hash-second'),
    ])

    // Act + Assert — ordinals consume FIFO
    expect(matcher.match('GET', 'http://localhost:3000/api/poll')?.bodyHash).toBe('hash-first')
    expect(matcher.match('GET', 'http://localhost:3000/api/poll')?.bodyHash).toBe('hash-second')
    expect(matcher.match('GET', 'http://localhost:3000/api/poll')).toBeNull()
  })

  it('reports a miss (divergence) for requests the recording never saw', () => {
    // Arrange
    const matcher = new NetworkMatcher(
      recordedExchange('r1', 'http://localhost:3000/api/notes', 200, 'h1'),
    )

    // Act + Assert — unknown URL and wrong method both miss
    expect(matcher.match('GET', 'http://localhost:3000/api/unknown')).toBeNull()
    expect(matcher.match('POST', 'http://localhost:3000/api/notes')).toBeNull()
  })

  it('serves a recorded RSC nav fetch even when the _rsc cache-buster drifted', () => {
    // Arrange — recorded client-side nav carried the record-session's _rsc hash
    const matcher = new NetworkMatcher(
      recordedExchange('r1', 'http://localhost:3000/guestbook?_rsc=2Md0sTUZcnjCijMr', 200, 'flight-body'),
    )

    // Act + Assert — replay's differing hash still hits; other params still discriminate
    expect(matcher.match('GET', 'http://localhost:3000/guestbook?_rsc=Z5OGjZShixn373ax')?.bodyHash).toBe('flight-body')
    expect(matcher.match('GET', 'http://localhost:3000/guestbook?tab=2')).toBeNull()
  })

  it('matches ignoring URL fragments and skips exchanges that never completed', () => {
    // Arrange — r1 has no response row (in-flight at rec stop)
    const matcher = new NetworkMatcher([
      laneEvent({ phase: 'request', requestId: 'r1', url: 'http://localhost:3000/api/slow', method: 'GET' }),
      ...recordedExchange('r2', 'http://localhost:3000/page#section', 200, 'h2'),
    ])

    // Act + Assert
    expect(normalizeMatchUrl('http://localhost:3000/page#section')).toBe('http://localhost:3000/page')
    expect(matcher.match('GET', 'http://localhost:3000/page')?.bodyHash).toBe('h2')
    expect(matcher.match('GET', 'http://localhost:3000/api/slow')).toBeNull()
  })
})

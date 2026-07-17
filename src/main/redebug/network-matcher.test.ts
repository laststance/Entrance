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

    // Act + Assert — ordinals consume FIFO; an extra GET replays the last
    // answer instead of failing (re-executions may double-fetch static assets)
    expect(matcher.match('GET', 'http://localhost:3000/api/poll')?.bodyHash).toBe('hash-first')
    expect(matcher.match('GET', 'http://localhost:3000/api/poll')?.bodyHash).toBe('hash-second')
    expect(matcher.match('GET', 'http://localhost:3000/api/poll')?.bodyHash).toBe('hash-second')
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

  it('serves a recorded exchange when only a trailing slash drifted, keeping root intact', () => {
    // Arrange — recorded WITH a trailing slash
    const matcher = new NetworkMatcher(
      recordedExchange('r1', 'http://localhost:3000/guestbook/', 200, 'hash-slash'),
    )

    // Act + Assert — slashless replay still hits; the root path is never stripped
    expect(normalizeMatchUrl('http://localhost:3000/guestbook/')).toBe('http://localhost:3000/guestbook')
    expect(normalizeMatchUrl('http://localhost:3000/')).toBe('http://localhost:3000/')
    expect(matcher.match('GET', 'http://localhost:3000/guestbook')?.bodyHash).toBe('hash-slash')
  })

  it('serves a recorded Clerk catch-all probe despite its Date.now() path suffix', () => {
    // Arrange — Clerk appends the current epoch ms to the probe path, so the
    // replay's probe URL never equals the recorded one byte-for-byte.
    const matcher = new NetworkMatcher(
      recordedExchange(
        'r1',
        'http://localhost:3000/login/SignIn_clerk_catchall_check_1784294840305',
        200,
        'probe-body',
      ),
    )

    // Act + Assert — a differently-stamped probe still pairs with the recording
    expect(
      matcher.match('GET', 'http://localhost:3000/login/SignIn_clerk_catchall_check_1784999999999')
        ?.bodyHash,
    ).toBe('probe-body')
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

describe('GET replay fallback', () => {
  it('serves a repeated GET for a static asset after its ordinal is consumed', () => {
    // Arrange — one recorded exchange for a chunk the page fetches twice
    // (preload + script tag) during re-execution.
    const matcher = new NetworkMatcher([
      {
        seq: 1,
        tMono: 0,
        tWall: 0,
        lane: 'network',
        payload: {
          phase: 'request',
          requestId: 'r1',
          url: 'http://localhost:3000/chunk.js',
          method: 'GET',
        },
      },
      {
        seq: 2,
        tMono: 1,
        tWall: 1,
        lane: 'network',
        payload: { phase: 'response', requestId: 'r1', status: 200 },
      },
    ])

    // Act
    const first = matcher.match('GET', 'http://localhost:3000/chunk.js')
    const second = matcher.match('GET', 'http://localhost:3000/chunk.js')

    // Assert — the second request replays the same recorded answer.
    expect(first?.status).toBe(200)
    expect(second?.status).toBe(200)
  })

  it('never replays exhausted POST ordinals (stateful requests stay strict FIFO)', () => {
    // Arrange
    const matcher = new NetworkMatcher([
      {
        seq: 1,
        tMono: 0,
        tWall: 0,
        lane: 'network',
        payload: {
          phase: 'request',
          requestId: 'p1',
          url: 'http://localhost:3000/api/todo',
          method: 'POST',
        },
      },
      {
        seq: 2,
        tMono: 1,
        tWall: 1,
        lane: 'network',
        payload: { phase: 'response', requestId: 'p1', status: 200 },
      },
    ])

    // Act
    matcher.match('POST', 'http://localhost:3000/api/todo')
    const second = matcher.match('POST', 'http://localhost:3000/api/todo')

    // Assert — a second POST is an honest miss, not a silent replay.
    expect(second).toBeNull()
  })
})

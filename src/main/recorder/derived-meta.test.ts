import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { Lane } from '@shared/envelope'

import { computeDerivedMeta } from './derived-meta'

/** Writes one lane JSONL file from (tMono, payload) pairs with sequential seq. */
function writeLane(dir: string, lane: Lane, rows: Array<{ tMono: number; payload: unknown }>): void {
  const lines = rows
    .map((row, index) =>
      JSON.stringify({ seq: index, tMono: row.tMono, tWall: 1_784_262_000_000, lane, payload: row.payload }),
    )
    .join('\n')
  writeFileSync(join(dir, 'lanes', `${lane}.jsonl`), `${lines}\n`)
}

describe('library card derived meta (screen 1e thumbnail + click/fetch/error chips)', () => {
  let recordingDir: string

  afterEach(() => {
    rmSync(recordingDir, { recursive: true, force: true })
  })

  it('backfills the HUD tally from lanes, counting only events at/after t0', () => {
    // Arrange — t0 = 1000; the earlier fetch is bootstrap capture and must not count
    recordingDir = mkdtempSync(join(tmpdir(), 'entrance-derived-'))
    mkdirSync(join(recordingDir, 'lanes'), { recursive: true })
    writeLane(recordingDir, 'network', [
      { tMono: 500, payload: { phase: 'request', resourceType: 'Fetch' } },
      { tMono: 1200, payload: { phase: 'request', resourceType: 'Fetch' } },
      { tMono: 1300, payload: { phase: 'response', resourceType: 'Fetch' } },
      { tMono: 1400, payload: { phase: 'request', resourceType: 'Document' } },
    ])
    writeLane(recordingDir, 'input', [
      { tMono: 1100, payload: { kind: 'click', x: 1, y: 2 } },
      { tMono: 1150, payload: { kind: 'scroll', x: 0, y: 10 } },
      { tMono: 1500, payload: { kind: 'click', x: 3, y: 4 } },
    ])
    writeLane(recordingDir, 'console', [
      { tMono: 1250, payload: { type: 'error', preview: 'boom' } },
      { tMono: 1260, payload: { type: 'log', preview: 'ok' } },
    ])
    writeLane(recordingDir, 'error', [{ tMono: 1600, payload: { message: 'TypeError' } }])

    // Act
    const meta = computeDerivedMeta(recordingDir, 1000)

    // Assert
    expect(meta.tally).toEqual({ click: 2, fetch: 1, console: 2, error: 2 })
  })

  it('picks the first screencast frame blob as the card thumbnail', () => {
    // Arrange
    recordingDir = mkdtempSync(join(tmpdir(), 'entrance-derived-'))
    mkdirSync(join(recordingDir, 'lanes'), { recursive: true })
    writeLane(recordingDir, 'screencast', [
      { tMono: 1010, payload: { bodyHash: 'firstframehash', deviceWidth: 1280, deviceHeight: 800 } },
      { tMono: 1020, payload: { bodyHash: 'secondframehash', deviceWidth: 1280, deviceHeight: 800 } },
    ])

    // Act
    const meta = computeDerivedMeta(recordingDir, 1000)

    // Assert
    expect(meta.thumbnailBlobHash).toBe('firstframehash')
  })

  it('returns zero tally and no thumbnail for an empty recording (golden corpus: empty bundle)', () => {
    // Arrange
    recordingDir = mkdtempSync(join(tmpdir(), 'entrance-derived-'))
    mkdirSync(join(recordingDir, 'lanes'), { recursive: true })

    // Act
    const meta = computeDerivedMeta(recordingDir, 0)

    // Assert
    expect(meta).toEqual({
      thumbnailBlobHash: null,
      tally: { click: 0, fetch: 0, console: 0, error: 0 },
    })
  })

  it('tolerates a torn final line (crash-recovered bundles stay listable)', () => {
    // Arrange
    recordingDir = mkdtempSync(join(tmpdir(), 'entrance-derived-'))
    mkdirSync(join(recordingDir, 'lanes'), { recursive: true })
    writeFileSync(
      join(recordingDir, 'lanes', 'input.jsonl'),
      `${JSON.stringify({ seq: 0, tMono: 1100, tWall: 1, lane: 'input', payload: { kind: 'click' } })}\n{"seq":1,"tMono":12`,
    )

    // Act
    const meta = computeDerivedMeta(recordingDir, 1000)

    // Assert
    expect(meta.tally.click).toBe(1)
  })
})

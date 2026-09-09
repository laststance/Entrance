import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'

import type { LaneEvent } from '@shared/envelope'

import { LaneWriterSet } from './lane-writer'

function makeEvent(lane: LaneEvent['lane'], seq: number): LaneEvent {
  return { seq, tMono: seq * 10, tWall: 1_784_262_000_000 + seq, lane, payload: { seq } }
}

describe('LaneWriterSet (JSONL lanes, spec decision 13)', () => {
  let tempDir: string

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('appends one JSON line per event into <lane>.jsonl', () => {
    // Arrange
    tempDir = mkdtempSync(join(tmpdir(), 'entrance-lanes-'))
    const lanes = new LaneWriterSet(tempDir)

    // Act
    lanes.append(makeEvent('network', 0))
    lanes.append(makeEvent('network', 1))
    lanes.append(makeEvent('console', 2))
    lanes.close()

    // Assert
    const networkLines = readFileSync(join(tempDir, 'lanes', 'network.jsonl'), 'utf8')
      .trim()
      .split('\n')
    expect(networkLines).toHaveLength(2)
    expect(JSON.parse(networkLines[0])).toEqual(makeEvent('network', 0))
    const consoleLines = readFileSync(join(tempDir, 'lanes', 'console.jsonl'), 'utf8')
      .trim()
      .split('\n')
    expect(consoleLines).toHaveLength(1)
  })

  test('keeps every appended line readable while writers stay open (finalize copies live files)', () => {
    // Arrange
    tempDir = mkdtempSync(join(tmpdir(), 'entrance-lanes-'))
    const lanes = new LaneWriterSet(tempDir)

    // Act — no close() before reading, like finalize during an ongoing session
    lanes.append(makeEvent('network', 0))

    // Assert
    const lines = readFileSync(join(tempDir, 'lanes', 'network.jsonl'), 'utf8').trim().split('\n')
    expect(JSON.parse(lines[0]).seq).toBe(0)
    lanes.close()
  })

  test('accounts bytes and per-lane event counts for the backpressure counter', () => {
    // Arrange
    tempDir = mkdtempSync(join(tmpdir(), 'entrance-lanes-'))
    const lanes = new LaneWriterSet(tempDir)

    // Act
    lanes.append(makeEvent('network', 0))
    lanes.append(makeEvent('error', 1))
    lanes.close()

    // Assert — counts survive close() because the manifest is written afterwards
    expect(lanes.eventCounts).toEqual({ network: 1, error: 1 })
    expect(lanes.bytesWritten).toBeGreaterThan(0)
  })
})

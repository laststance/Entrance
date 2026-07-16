import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { Lane, LaneEvent } from '@shared/envelope'

/**
 * Append-only JSONL file with synchronous ordered writes. Why sync: finalize
 * copies these files while writers stay open (multi-recording sessions,
 * decision 27) — writeSync guarantees every completed append is fully on disk.
 */
export class JsonlAppender {
  readonly filePath: string
  private fd: number | null = null
  bytesWritten = 0
  lineCount = 0

  constructor(filePath: string) {
    this.filePath = filePath
  }

  appendLine(value: unknown): void {
    // Lazy open so untouched lanes never create empty files.
    if (this.fd === null) {
      mkdirSync(dirname(this.filePath), { recursive: true })
      this.fd = openSync(this.filePath, 'a')
    }
    const lineBytes = Buffer.from(`${JSON.stringify(value)}\n`, 'utf8')
    writeSync(this.fd, lineBytes)
    this.bytesWritten += lineBytes.byteLength
    this.lineCount += 1
  }

  close(): void {
    if (this.fd !== null) closeSync(this.fd)
    this.fd = null
  }
}

/**
 * One JSONL file per lane under baseDir/lanes/, with byte/event accounting for
 * the backpressure counter (spec decision 31). Owned by TargetSession (spool
 * lanes) and RecordingManager (recording-only lanes).
 */
export class LaneWriterSet {
  private readonly appenders = new Map<Lane, JsonlAppender>()
  private readonly lanesDir: string

  constructor(baseDir: string) {
    this.lanesDir = join(baseDir, 'lanes')
  }

  get bytesWritten(): number {
    let total = 0
    for (const appender of this.appenders.values()) total += appender.bytesWritten
    return total
  }

  get eventCounts(): Partial<Record<Lane, number>> {
    const counts: Partial<Record<Lane, number>> = {}
    for (const [lane, appender] of this.appenders) counts[lane] = appender.lineCount
    return counts
  }

  append(event: LaneEvent): void {
    let appender = this.appenders.get(event.lane)
    if (!appender) {
      appender = new JsonlAppender(join(this.lanesDir, `${event.lane}.jsonl`))
      this.appenders.set(event.lane, appender)
    }
    appender.appendLine(event)
  }

  /** Lane files written so far — the finalize copy list. */
  writtenLaneFiles(): Array<{ lane: Lane; filePath: string }> {
    return [...this.appenders.entries()].map(([lane, appender]) => ({
      lane,
      filePath: appender.filePath,
    }))
  }

  /** Close fds but keep accounting readable (manifest is written after close). */
  close(): void {
    for (const appender of this.appenders.values()) appender.close()
  }
}

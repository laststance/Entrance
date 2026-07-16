import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import type { BrowserWindow } from 'electron'
import { ulid } from 'ulid'

import {
  LIVE_MANIFEST_FILENAME,
  MANIFEST_FILENAME,
  type EndReason,
  type Lane,
  type LaneEvent,
  type RecordingManifest,
} from '@shared/envelope'
import { PUSH, type AttachRequest, type RecStatus } from '@shared/ipc'

import { REC_STATUS_PUSH_INTERVAL_MS, RECORDING_MIN_FREE_DISK_BYTES } from '../constants'
import { insertRecording } from '../db'
import { recordingDir, recordingsRootDir } from '../paths'
import { defaultRecordingName } from '../utils/default-recording-name'
import { directorySizeBytes } from '../utils/directory-size-bytes'
import { LaneWriterSet } from './lane-writer'
import { TargetSession } from './session'

/**
 * Owns the attached TargetSession and the at-most-one active recording
 * (spec decisions 17/25/27/31): Rec marks t0 on the session's canonical axis;
 * finalize copies spool lanes + hardlinks blobs into recordings/<id>/ and
 * registers the library row. Instantiated once in main/index.ts.
 */

interface ActiveRecording {
  recordingId: string
  name: string
  dir: string
  t0Mono: number
  t0Wall: number
  startUrl: string
  startOrigin: string
  /** Recording-only lanes (lifecycle now; rrweb/input/screencast in later slices) written straight to the final dir. */
  recLanes: LaneWriterSet
  counts: { click: number; fetch: number; console: number; error: number }
  /** Spool+blob bytes at t0 — the live HUD shows bytes written SINCE Rec. */
  baselineBytes: number
}

export class RecordingManager {
  private session: TargetSession | null = null
  private active: ActiveRecording | null = null
  private statusTimer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  /** Replace any previous session and attach the recorder to the new target. */
  async attachSession(request: AttachRequest): Promise<{ ok: boolean; error?: string }> {
    const window = this.getWindow()
    if (!window) return { ok: false, error: 'app window missing' }
    await this.shutdownSession()
    const result = await TargetSession.attach({
      webContentsId: request.webContentsId,
      appWindow: window.webContents,
      framework: request.framework,
      bundlerVariant: request.variant,
      callbacks: {
        onLaneEvent: (event) => this.tallyLaneEvent(event),
        onTopFrameNavigated: (url) => this.handleTopFrameNavigation(url),
        onTargetGone: () => void this.handleTargetGone(),
      },
    })
    if ('error' in result) return { ok: false, error: result.error }
    this.session = result.session
    return { ok: true }
  }

  /** Stop any active recording, then drop the session and its spool (disconnect / app quit). */
  async shutdownSession(): Promise<void> {
    if (this.active) await this.stop('user-stop')
    this.session?.dispose()
    this.session = null
    this.pushStatus()
  }

  /**
   * Begin a recording: mark t0 on the session clock, open recording-only lanes,
   * and leave a live manifest for crash recovery (decisions 25/27/31).
   */
  start(): { ok: boolean; recordingId?: string; error?: string } {
    if (!this.session) return { ok: false, error: 'ターゲットに接続されていません' }
    if (this.active) return { ok: false, error: 'すでに録画中です' }

    // Backpressure pre-check (decision 31): never start a recording the disk can't hold.
    mkdirSync(recordingsRootDir(), { recursive: true })
    const disk = statfsSync(recordingsRootDir())
    if (disk.bavail * disk.bsize < RECORDING_MIN_FREE_DISK_BYTES) {
      return { ok: false, error: 'ディスクの空き容量が不足しているため録画を開始できません' }
    }

    const recordingId = ulid()
    const dir = recordingDir(recordingId)
    mkdirSync(dir, { recursive: true })
    const t0Wall = Date.now()
    const active: ActiveRecording = {
      recordingId,
      name: defaultRecordingName(new Date(t0Wall)),
      dir,
      t0Mono: this.session.sequencer.nowMono(),
      t0Wall,
      startUrl: this.session.currentUrl,
      startOrigin: safeOrigin(this.session.currentUrl),
      recLanes: new LaneWriterSet(dir),
      counts: { click: 0, fetch: 0, console: 0, error: 0 },
      baselineBytes: this.session.spoolLanes.bytesWritten + this.session.blobs.bytesWritten,
    }
    // The t0 marker shares the session's canonical clock (decisions 13/27).
    active.recLanes.append(this.session.sequencer.stamp('lifecycle', { kind: 'rec-start', recordingId }))
    // Crash-recovery marker (decision 25): a live manifest left behind means app-crash-recovered.
    writeFileSync(
      join(dir, LIVE_MANIFEST_FILENAME),
      JSON.stringify({
        schemaVersion: 1,
        recordingId,
        name: active.name,
        targetUrl: active.startUrl,
        framework: this.session.framework,
        bundlerVariant: this.session.bundlerVariant,
        t0Mono: active.t0Mono,
        t0Wall: active.t0Wall,
      }),
    )
    this.active = active
    this.statusTimer = setInterval(() => this.pushStatus(), REC_STATUS_PUSH_INTERVAL_MS)
    this.pushStatus()
    return { ok: true, recordingId }
  }

  /**
   * Finalize the active recording (decision 27): whole-session lanes travel with
   * the bundle so Mode B can serve resources loaded before t0.
   * @param reason - why it ended; anything but user-stop also pushes rec:autoStopped
   */
  async stop(
    reason: EndReason,
  ): Promise<{ ok: boolean; recordingId?: string; name?: string; error?: string }> {
    const session = this.session
    const active = this.active
    if (!session || !active) return { ok: false, error: '録画中ではありません' }
    this.active = null
    if (this.statusTimer) {
      clearInterval(this.statusTimer)
      this.statusTimer = null
    }

    const tEndMono = session.sequencer.nowMono()
    active.recLanes.append(session.sequencer.stamp('lifecycle', { kind: 'rec-stop', reason }))
    active.recLanes.close()

    for (const { filePath, lane } of session.spoolLanes.writtenLaneFiles()) {
      copyFileSync(filePath, join(active.dir, 'lanes', `${lane}.jsonl`))
    }
    hardlinkDirectoryFiles(session.blobs.blobsDir, join(active.dir, 'blobs'))
    if (existsSync(session.enclaveFilePath)) {
      copyFileSync(session.enclaveFilePath, join(active.dir, 'enclave.jsonl'))
    }

    const manifest: RecordingManifest = {
      schemaVersion: 1,
      recordingId: active.recordingId,
      name: active.name,
      targetUrl: active.startUrl,
      framework: session.framework,
      bundlerVariant: session.bundlerVariant,
      t0Mono: active.t0Mono,
      t0Wall: active.t0Wall,
      tEndMono,
      durationMs: Math.round(tEndMono - active.t0Mono),
      endReason: reason,
      eventCounts: mergeEventCounts(session.spoolLanes.eventCounts, active.recLanes.eventCounts),
      totalBytes: directorySizeBytes(active.dir),
    }
    writeFileSync(join(active.dir, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2))
    rmSync(join(active.dir, LIVE_MANIFEST_FILENAME), { force: true })
    insertRecording(manifest)

    const window = this.getWindow()
    if (window && !window.isDestroyed() && reason !== 'user-stop') {
      window.webContents.send(PUSH.recAutoStopped, { reason, recordingId: active.recordingId })
    }
    this.pushStatus()
    return { ok: true, recordingId: active.recordingId, name: active.name }
  }

  /** Live HUD tally — only events at/after t0 count (spool also holds bootstrap events). */
  private tallyLaneEvent(event: LaneEvent): void {
    const active = this.active
    if (!active || event.tMono < active.t0Mono) return
    const payload = event.payload as {
      phase?: string
      resourceType?: string
      type?: string
      kind?: string
    }
    if (event.lane === 'network' && payload.phase === 'request') {
      // The HUD's "fetch" means app data calls, not every asset request.
      if (payload.resourceType === 'XHR' || payload.resourceType === 'Fetch') {
        active.counts.fetch += 1
      }
    } else if (event.lane === 'console') {
      active.counts.console += 1
      if (payload.type === 'error') active.counts.error += 1
    } else if (event.lane === 'error') {
      active.counts.error += 1
    } else if (event.lane === 'input' && payload.kind === 'click') {
      active.counts.click += 1
    }
  }

  private handleTopFrameNavigation(url: string): void {
    const active = this.active
    if (!active) return
    // Same-origin navigation (SPA routes, dev-server reloads) keeps recording;
    // a different local server is a different world → honest auto-stop (decision 25).
    if (safeOrigin(url) !== active.startOrigin) void this.stop('navigated-away')
  }

  private async handleTargetGone(): Promise<void> {
    if (this.active) await this.stop('target-crashed')
  }

  private pushStatus(): void {
    const window = this.getWindow()
    if (!window || window.isDestroyed()) return
    window.webContents.send(PUSH.recStatus, this.currentStatus())
  }

  private currentStatus(): RecStatus {
    const session = this.session
    const active = this.active
    if (!session || !active) {
      return {
        state: 'idle',
        elapsedMs: 0,
        bytes: 0,
        counts: { click: 0, fetch: 0, console: 0, error: 0 },
        pressure: null,
      }
    }
    const liveBytes =
      session.spoolLanes.bytesWritten +
      session.blobs.bytesWritten +
      active.recLanes.bytesWritten -
      active.baselineBytes
    return {
      state: 'recording',
      recordingId: active.recordingId,
      elapsedMs: Math.max(0, Math.round(session.sequencer.nowMono() - active.t0Mono)),
      bytes: liveBytes,
      counts: { ...active.counts },
      pressure: null, // soft/hard quota thresholds land in Slice D (decision 31)
    }
  }
}

/** URL origin, or '' when the URL is unparsable (about:blank etc.). */
function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

function mergeEventCounts(
  base: Partial<Record<Lane, number>>,
  extra: Partial<Record<Lane, number>>,
): Partial<Record<Lane, number>> {
  const merged: Partial<Record<Lane, number>> = { ...base }
  for (const [lane, count] of Object.entries(extra) as Array<[Lane, number]>) {
    merged[lane] = (merged[lane] ?? 0) + count
  }
  return merged
}

/** Hardlink every file of sourceDir into destDir (same volume); copy as fallback. */
function hardlinkDirectoryFiles(sourceDir: string, destDir: string): void {
  let entries: string[]
  try {
    entries = readdirSync(sourceDir)
  } catch {
    return
  }
  if (entries.length === 0) return
  mkdirSync(destDir, { recursive: true })
  for (const name of entries) {
    const sourcePath = join(sourceDir, name)
    const destPath = join(destDir, name)
    try {
      linkSync(sourcePath, destPath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') copyFileSync(sourcePath, destPath)
    }
  }
}

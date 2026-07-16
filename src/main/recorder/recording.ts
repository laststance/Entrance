import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import type { BrowserWindow } from 'electron'
import { ulid } from 'ulid'

import {
  AGENT_REC_START_EXPRESSION,
  AGENT_REC_STOP_EXPRESSION,
  type AgentMessage,
} from '@shared/agent'
import {
  LIVE_MANIFEST_FILENAME,
  MANIFEST_FILENAME,
  type EndReason,
  type Lane,
  type LaneEvent,
  type RecordingManifest,
} from '@shared/envelope'
import { PUSH, type AttachRequest, type RecStatus } from '@shared/ipc'

import {
  DISK_CHECK_EVERY_N_TICKS,
  REC_STATUS_PUSH_INTERVAL_MS,
  RECORDING_MIN_FREE_DISK_BYTES,
  STORAGE_QUOTA_BYTES,
  STORAGE_QUOTA_WARN_RATIO,
} from '../constants'
import { insertRecording } from '../db'
import { recordingDir, recordingsRootDir } from '../paths'
import { defaultRecordingName } from '../utils/default-recording-name'
import { directorySizeBytes } from '../utils/directory-size-bytes'
import { hardlinkDirectoryFiles } from '../utils/hardlink-directory-files'
import { LaneWriterSet } from './lane-writer'
import { TargetSession, type ScreencastFrame } from './session'
import { harvestSourcemaps } from './sourcemap-harvest'

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
  /** sequencer.nowMono() right before Profiler.start — calibrates profile time to tMono. */
  profilerStartMono: number | null
  /** Library size at t0 — quota math without rescanning the library every tick. */
  libraryBytesAtStart: number
  statusTickCount: number
}

export class RecordingManager {
  private session: TargetSession | null = null
  private active: ActiveRecording | null = null
  private statusTimer: ReturnType<typeof setInterval> | null = null
  private agentSourceCache: string | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  /** Page-agent IIFE built by scripts/build-agent.mjs into out/agent/. */
  private loadAgentSource(): string {
    if (this.agentSourceCache === null) {
      this.agentSourceCache = readFileSync(
        join(import.meta.dirname, '../agent/page-agent.js'),
        'utf8',
      )
    }
    return this.agentSourceCache
  }

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
      agentSource: this.loadAgentSource(),
      callbacks: {
        onLaneEvent: (event) => this.tallyLaneEvent(event),
        onAgentEvent: (message) => this.handleAgentEvent(message),
        onScreencastFrame: (frame) => this.handleScreencastFrame(frame),
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
      profilerStartMono: null,
      libraryBytesAtStart: directorySizeBytes(recordingsRootDir()),
      statusTickCount: 0,
    }
    // The t0 marker shares the session's canonical clock (decisions 13/27).
    active.recLanes.append(this.session.sequencer.stamp('lifecycle', { kind: 'rec-start', recordingId }))
    // Crash-recovery marker (decision 25): a live manifest left behind means
    // app-crash-recovered; spoolDir lets recovery salvage the session lanes.
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
        spoolDir: this.session.spoolDir,
        enclaveFilePath: this.session.enclaveFilePath,
      }),
    )
    this.active = active
    // Arm the in-page rrweb recorder — its FullSnapshot becomes the t0 baseline.
    this.session.evaluateInPage(AGENT_REC_START_EXPRESSION)
    // Screencast + profiler + snapshot are best-effort: their loss degrades the
    // filmstrip / highlight / Mode B seeding, never the recording itself.
    const session = this.session
    void session.startScreencast().catch(() => {})
    void session
      .startProfiler()
      .then(() => {
        if (this.active?.recordingId === recordingId) {
          this.active.profilerStartMono = session.sequencer.nowMono()
        }
      })
      .catch(() => {})
    this.captureStateSnapshot(active, session)
    this.statusTimer = setInterval(() => this.statusTick(), REC_STATUS_PUSH_INTERVAL_MS)
    this.pushStatus()
    return { ok: true, recordingId }
  }

  /**
   * Browser-state snapshot near t0 (decision 28): readable facts go to
   * snapshot.json; storage/cookie VALUES are secrets and go to the enclave.
   */
  private captureStateSnapshot(active: ActiveRecording, session: TargetSession): void {
    void (async () => {
      const pageState = await session.evaluateWithResult<{
        localStorage: Record<string, string>
        sessionStorage: Record<string, string>
        viewport: { width: number; height: number; devicePixelRatio: number }
        userAgent: string
      }>(PAGE_STATE_SNAPSHOT_EXPRESSION)
      writeFileSync(
        join(active.dir, 'snapshot.json'),
        JSON.stringify(
          {
            tMono: session.sequencer.nowMono(),
            url: session.currentUrl,
            viewport: pageState?.viewport ?? null,
            userAgent: pageState?.userAgent ?? null,
            localStorageKeys: Object.keys(pageState?.localStorage ?? {}),
            sessionStorageKeys: Object.keys(pageState?.sessionStorage ?? {}),
          },
          null,
          2,
        ),
      )
      const cookies = await session.readTargetCookies()
      session.appendEnclaveEntry({
        kind: 'state-snapshot',
        tMono: session.sequencer.nowMono(),
        recordingId: active.recordingId,
        localStorage: pageState?.localStorage ?? {},
        sessionStorage: pageState?.sessionStorage ?? {},
        cookies,
      })
    })()
  }

  /** 500ms cadence: backpressure checks first, then the HUD push (decision 31). */
  private statusTick(): void {
    this.checkBackpressure()
    this.pushStatus()
  }

  private checkBackpressure(): void {
    const active = this.active
    const session = this.session
    if (!active || !session) return
    active.statusTickCount += 1
    const liveBytes =
      session.spoolLanes.bytesWritten +
      session.blobs.bytesWritten +
      active.recLanes.bytesWritten -
      active.baselineBytes
    // Hard stop: the library would blow past its quota (decision 31 auto-stop).
    if (active.libraryBytesAtStart + liveBytes > STORAGE_QUOTA_BYTES) {
      void this.stop('quota-exceeded')
      return
    }
    // Periodic free-disk probe — a full disk must stop the recording, not corrupt it.
    if (active.statusTickCount % DISK_CHECK_EVERY_N_TICKS === 0) {
      try {
        const disk = statfsSync(recordingsRootDir())
        if (disk.bavail * disk.bsize < RECORDING_MIN_FREE_DISK_BYTES / 2) {
          void this.stop('quota-exceeded')
        }
      } catch {
        /* probe failure is not a reason to kill a recording */
      }
    }
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

    session.evaluateInPage(AGENT_REC_STOP_EXPRESSION)
    void session.stopScreencast().catch(() => {})
    // Grab the CPU profile before closing lanes — its samples power the
    // function-level highlight (decision 3); calibration pair maps V8 time → tMono.
    const profile = await session.stopProfiler()
    const profilerStopMono = session.sequencer.nowMono()
    if (profile !== null) {
      writeFileSync(
        join(active.dir, 'profile.cpuprofile.json'),
        JSON.stringify({
          profilerStartMono: active.profilerStartMono,
          profilerStopMono,
          profile,
        }),
      )
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
    // Background harvest (dev server is alive right now); index.json marks completion.
    void harvestSourcemaps(active.dir).catch(() => {})
    return { ok: true, recordingId: active.recordingId, name: active.name }
  }

  /** Screencast lane: JPEG → blob store, lane row references the hash (recording-only). */
  private handleScreencastFrame(frame: ScreencastFrame): void {
    const session = this.session
    const active = this.active
    if (!session || !active) return
    const bodyHash = session.blobs.put(frame.jpegBytes)
    const event = session.sequencer.stamp('screencast', {
      bodyHash,
      deviceWidth: frame.deviceWidth,
      deviceHeight: frame.deviceHeight,
      cdpTimestamp: frame.cdpTimestamp,
    })
    active.recLanes.append(event)
  }

  /** Agent lanes (rrweb/input) are recording-only (decision 27) — dropped while idle. */
  private handleAgentEvent(message: AgentMessage): void {
    const session = this.session
    const active = this.active
    if (!session || !active) return
    if (message.lane === 'agent') {
      // A new document's agent came up mid-recording — re-arm rrweb there.
      session.evaluateInPage(AGENT_REC_START_EXPRESSION)
      return
    }
    let payload: unknown = message.payload
    if (message.lane === 'input' && message.payload.kind === 'key' && message.payload.secret) {
      // Real keystroke goes to the enclave (decision 32d); the lane keeps the masked shell.
      session.appendEnclaveEntry({
        kind: 'keystroke',
        tMono: session.sequencer.nowMono(),
        code: message.payload.code,
        key: message.payload.secret.key,
      })
      const maskedPayload = { ...message.payload }
      delete maskedPayload.secret
      payload = maskedPayload
    }
    const event = session.sequencer.stamp(message.lane, payload)
    active.recLanes.append(event)
    this.tallyLaneEvent(event)
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
    const isNearQuota =
      active.libraryBytesAtStart + liveBytes > STORAGE_QUOTA_BYTES * STORAGE_QUOTA_WARN_RATIO
    return {
      state: 'recording',
      recordingId: active.recordingId,
      elapsedMs: Math.max(0, Math.round(session.sequencer.nowMono() - active.t0Mono)),
      bytes: liveBytes,
      counts: { ...active.counts },
      pressure: isNearQuota ? 'warn' : null,
    }
  }
}

/** Runs inside the recorded page; storage reads can throw in exotic contexts. */
const PAGE_STATE_SNAPSHOT_EXPRESSION = `(() => {
  const dump = (storage) => {
    const out = {}
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key !== null) out[key] = storage.getItem(key) ?? ''
      }
    } catch {}
    return out
  }
  return {
    localStorage: dump(window.localStorage),
    sessionStorage: dump(window.sessionStorage),
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio: devicePixelRatio },
    userAgent: navigator.userAgent,
  }
})()`

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


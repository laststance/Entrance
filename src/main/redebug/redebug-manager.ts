import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { BrowserWindow } from 'electron'

import { PUSH } from '@shared/ipc'
import { COVERAGE_TIMELINE_FILE } from '@shared/coverage-timeline'
import type {
  EnsureHarvestResult,
  RedebugStatus,
  RedebugStepRequest,
  StartRedebugRequest,
} from '@shared/redebug'

import { recordingDir } from '../paths'
import { decideEnsureHarvest, type ActiveSessionKind } from './ensure-harvest-decision'
import { RedebugSession } from './redebug-session'

/**
 * One live Mode B session at a time (mirrors the single-window model,
 * decision 7): starting a new re-execution disposes the previous hidden
 * window. Status flows to the renderer over PUSH.redebugStatus.
 */
export class RedebugManager {
  private session: RedebugSession | null = null
  /** Request behind the live session — lets ensureHarvest tell debug vs harvest apart. */
  private activeRequest: StartRedebugRequest | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  async start(request: StartRedebugRequest): Promise<{ ok: boolean; error?: string }> {
    this.stop()
    try {
      const session = new RedebugSession(recordingDir(request.recordingId), request, (status) => {
        // Headless harvest runs watch stdout — the renderer may never open the panel.
        if (process.env.ENTRANCE_HARVEST_RECORDING_ID) {
          console.log(
            `[harvest] ${status.phase}`,
            JSON.stringify({
              progress: status.harvest,
              result: status.harvestResult,
              divergences: status.divergences.length,
              error: status.error,
            }),
          )
        }
        const window = this.getWindow()
        if (window && !window.isDestroyed()) window.webContents.send(PUSH.redebugStatus, status)
        // Terminal status frees the single Mode B slot — without this a
        // finished harvest would block the next auto-harvest until a manual stop.
        if (
          (status.phase === 'finished' || status.phase === 'failed') &&
          this.session === session
        ) {
          this.session = null
          this.activeRequest = null
        }
      })
      this.session = session
      this.activeRequest = request
      // start() reports its own failures via status pushes; an UNEXPECTED
      // throw (e.g. missing shim bundle on disk) must not strand the renderer
      // on 起動中 with a floating rejection.
      void session.start().catch((error) => {
        const failedStatus: RedebugStatus = {
          phase: 'failed',
          mode: request.harvest ? 'harvest' : 'debug',
          divergences: [],
          error: `再現実行が異常終了しました: ${String(error)}`,
        }
        const window = this.getWindow()
        if (window && !window.isDestroyed()) {
          window.webContents.send(PUSH.redebugStatus, failedStatus)
        }
        session.dispose()
        if (this.session === session) {
          this.session = null
          this.activeRequest = null
        }
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: `再現実行を開始できません: ${String(error)}` }
    }
  }

  async step(request: RedebugStepRequest): Promise<{ ok: boolean }> {
    // No live session = nothing stepped — never fake success.
    if (!this.session) return { ok: false }
    await this.session.step(request)
    return { ok: true }
  }

  stop(): { ok: boolean } {
    this.session?.dispose()
    this.session = null
    this.activeRequest = null
    return { ok: true }
  }

  /**
   * Auto-harvest entry (replay-screen mount): run a coverage harvest for the
   * recording unless the artifact exists or a user debug session is live.
   * @param recordingId - bundle directory name
   * @returns started=true when a harvest began; otherwise the skip reason / start error
   * @example await redebugManager.ensureHarvest('01JZX…') // => { started: true }
   */
  async ensureHarvest(recordingId: string): Promise<EnsureHarvestResult> {
    const coverageExists = existsSync(join(recordingDir(recordingId), COVERAGE_TIMELINE_FILE))
    // Classify the single Mode B slot for the policy function.
    const activeSession: ActiveSessionKind =
      this.session === null || this.activeRequest === null
        ? 'none'
        : this.activeRequest.harvest !== true
          ? 'debug'
          : this.activeRequest.recordingId === recordingId
            ? 'harvest-same-recording'
            : 'harvest-other-recording'
    const decision = decideEnsureHarvest(coverageExists, activeSession)
    if (decision.action === 'skip') return { started: false, reason: decision.reason }
    const startResult = await this.start({ recordingId, harvest: true })
    return startResult.ok ? { started: true } : { started: false, error: startResult.error }
  }
}

import type { BrowserWindow } from 'electron'

import { PUSH } from '@shared/ipc'
import type { RedebugStatus, RedebugStepRequest, StartRedebugRequest } from '@shared/redebug'

import { recordingDir } from '../paths'
import { RedebugSession } from './redebug-session'

/**
 * One live Mode B session at a time (mirrors the single-window model,
 * decision 7): starting a new re-execution disposes the previous hidden
 * window. Status flows to the renderer over PUSH.redebugStatus.
 */
export class RedebugManager {
  private session: RedebugSession | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  async start(request: StartRedebugRequest): Promise<{ ok: boolean; error?: string }> {
    this.stop()
    try {
      const session = new RedebugSession(recordingDir(request.recordingId), request, (status) => {
        const window = this.getWindow()
        if (window && !window.isDestroyed()) window.webContents.send(PUSH.redebugStatus, status)
      })
      this.session = session
      // start() reports its own failures via status pushes; an UNEXPECTED
      // throw (e.g. missing shim bundle on disk) must not strand the renderer
      // on 起動中 with a floating rejection.
      void session.start().catch((error) => {
        const failedStatus: RedebugStatus = {
          phase: 'failed',
          divergences: [],
          error: `再現実行が異常終了しました: ${String(error)}`,
        }
        const window = this.getWindow()
        if (window && !window.isDestroyed()) {
          window.webContents.send(PUSH.redebugStatus, failedStatus)
        }
        session.dispose()
        if (this.session === session) this.session = null
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
    return { ok: true }
  }
}

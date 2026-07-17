import type { BrowserWindow } from 'electron'

import { PUSH } from '@shared/ipc'
import type { RedebugStepRequest, StartRedebugRequest } from '@shared/redebug'

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
      void session.start()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: `再現実行を開始できません: ${String(error)}` }
    }
  }

  async step(request: RedebugStepRequest): Promise<{ ok: boolean }> {
    await this.session?.step(request)
    return { ok: true }
  }

  stop(): { ok: boolean } {
    this.session?.dispose()
    this.session = null
    return { ok: true }
  }
}

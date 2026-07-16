import { ipcMain } from 'electron'

import {
  IPC,
  attachRequestSchema,
  connectRequestSchema,
  updateRecordingMetaSchema,
} from '@shared/ipc'

import { listRecordings, updateRecordingMeta } from './db'
import { detectServers } from './detector'
import type { RecordingManager } from './recorder/recording'

/**
 * Control-plane IPC registration (spec decision 12): every handler Zod-parses
 * its payload before any privileged work. Called once from main/index.ts after
 * the RecordingManager exists.
 */
export function registerIpcHandlers(recordingManager: RecordingManager): void {
  ipcMain.handle(IPC.detectServers, async () => {
    // Never list Entrance's own renderer dev server (dev-mode self-detection).
    const ownRendererPort = process.env.ELECTRON_RENDERER_URL
      ? Number(new URL(process.env.ELECTRON_RENDERER_URL).port)
      : null
    return detectServers(ownRendererPort ? [ownRendererPort] : [])
  })

  ipcMain.handle(IPC.connectTarget, async (_ev, raw: unknown) => {
    // Zod refinement enforces local-origin http(s) — hostile URLs never reach the webview.
    const parsed = connectRequestSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, url: '', error: parsed.error.issues[0]?.message ?? 'invalid URL' }
    }
    return { ok: true, url: new URL(parsed.data.url).toString() }
  })

  ipcMain.handle(IPC.attachTarget, async (_ev, raw: unknown) => {
    const parsed = attachRequestSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, error: 'invalid attach request' }
    return recordingManager.attachSession(parsed.data)
  })

  ipcMain.handle(IPC.detachTarget, async () => {
    await recordingManager.shutdownSession()
    return { ok: true }
  })

  ipcMain.handle(IPC.recStart, async () => recordingManager.start())

  // The stop button is the only caller; auto-stops go through the manager directly.
  ipcMain.handle(IPC.recStop, async () => recordingManager.stop('user-stop'))

  ipcMain.handle(IPC.updateRecordingMeta, async (_ev, raw: unknown) => {
    const parsed = updateRecordingMetaSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, error: 'invalid metadata' }
    try {
      updateRecordingMeta(parsed.data.recordingId, parsed.data.name, parsed.data.groupId)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC.listRecordings, async () => listRecordings())
}

import { rmSync } from 'node:fs'

import { ipcMain } from 'electron'

import {
  IPC,
  attachRequestSchema,
  connectRequestSchema,
  createGroupSchema,
  recordingIdSchema,
  searchRecordingsSchema,
  updateRecordingMetaSchema,
  type StorageUsage,
} from '@shared/ipc'
import { redebugStepSchema, startRedebugSchema } from '@shared/redebug'

import { STORAGE_QUOTA_BYTES } from './constants'
import {
  countRecordings,
  createGroup,
  deleteRecordingRow,
  listGroups,
  listRecordings,
  searchRecordingIds,
  updateRecordingMeta,
} from './db'
import { detectServers } from './detector'
import { recordingDir, recordingsRootDir } from './paths'
import type { RecordingManager } from './recorder/recording'
import type { RedebugManager } from './redebug/redebug-manager'
import { directorySizeBytes } from './utils/directory-size-bytes'

/**
 * Control-plane IPC registration (spec decision 12): every handler Zod-parses
 * its payload before any privileged work. Called once from main/index.ts after
 * the RecordingManager exists.
 */
export function registerIpcHandlers(
  recordingManager: RecordingManager,
  redebugManager: RedebugManager,
): void {
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

  ipcMain.handle(IPC.deleteRecording, async (_ev, raw: unknown) => {
    const parsed = recordingIdSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, error: 'invalid recording id' }
    try {
      deleteRecordingRow(parsed.data.recordingId)
      // The bundle dir is content the DB row referenced — remove it with the row.
      rmSync(recordingDir(parsed.data.recordingId), { recursive: true, force: true })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC.searchRecordings, async (_ev, raw: unknown) => {
    const parsed = searchRecordingsSchema.safeParse(raw)
    if (!parsed.success) return []
    return searchRecordingIds(parsed.data.query)
  })

  ipcMain.handle(IPC.listGroups, async () => listGroups())

  ipcMain.handle(IPC.createGroup, async (_ev, raw: unknown) => {
    const parsed = createGroupSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, error: 'invalid group name' }
    try {
      return { ok: true, groupId: createGroup(parsed.data.name) }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC.storageUsage, async (): Promise<StorageUsage> => {
    return {
      usedBytes: directorySizeBytes(recordingsRootDir()),
      quotaBytes: STORAGE_QUOTA_BYTES,
      recordingCount: countRecordings(),
    }
  })

  ipcMain.handle(IPC.redebugStart, async (_ev, raw: unknown) => {
    const parsed = startRedebugSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, error: 'invalid redebug request' }
    return redebugManager.start(parsed.data)
  })

  ipcMain.handle(IPC.redebugStep, async (_ev, raw: unknown) => {
    const parsed = redebugStepSchema.safeParse(raw)
    if (!parsed.success) return { ok: false }
    return redebugManager.step(parsed.data)
  })

  ipcMain.handle(IPC.redebugStop, async () => redebugManager.stop())
}

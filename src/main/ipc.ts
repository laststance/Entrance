import { ipcMain, type BrowserWindow } from 'electron'

import { IPC, connectRequestSchema, attachRequestSchema } from '@shared/ipc'

import { attachCdp, detachCdp } from './cdp'
import { detectServers } from './detector'

/**
 * Control-plane IPC registration (spec decision 12): every handler Zod-parses
 * its payload before any privileged work. Called once from main/index.ts after
 * the app window exists.
 */
export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
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
    if (!parsed.success) return { ok: false, error: 'invalid webContentsId' }
    const win = getWindow()
    if (!win) return { ok: false, error: 'app window missing' }
    return attachCdp(parsed.data.webContentsId, win.webContents)
  })

  ipcMain.handle(IPC.detachTarget, async () => {
    detachCdp()
    return { ok: true }
  })
}

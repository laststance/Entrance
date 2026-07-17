import { join } from 'node:path'

import { app, BrowserWindow, shell } from 'electron'

import { openDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { registerEntranceProtocolHandler, registerEntranceScheme } from './protocol'
import { RecordingManager } from './recorder/recording'
import { RedebugManager } from './redebug/redebug-manager'
import { recoverAbandonedRecordings } from './recorder/recovery'

/**
 * Entrance main process bootstrap: single window (spec decision 7), macOS
 * hiddenInset chrome, hardened webview hosting (spec decision 21).
 */

let mainWindow: BrowserWindow | null = null

// One manager per app — owns the attached target session and the active recording.
const recordingManager = new RecordingManager(() => mainWindow)
const redebugManager = new RedebugManager(() => mainWindow)

// Dev-only: expose a debugging port so external QA tooling (electron MCP / Playwright)
// can drive Entrance's OWN renderer. Never attach external clients to a recorded
// target's webview — that would detach our recorder session (spec decision 8).
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

// The entrance:// bulk read plane must claim its privileges before app ready (decision 12).
registerEntranceScheme()

/**
 * QA background mode (`pnpm dev:bg`): the app never takes the foreground —
 * accessory activation policy (no Dock icon, no focus steal) and the window
 * stays hidden while still painting — so CDP-driven QA can run while the
 * developer keeps using the machine. CDP needs no OS focus or visibility.
 */
const isQaBackgroundMode = process.env.ENTRANCE_QA_BACKGROUND === '1'

/** Origins the embedded target may navigate to — local dev servers only. */
function isLocalDevUrl(rawUrl: string): boolean {
  try {
    const { protocol, hostname } = new URL(rawUrl)
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
    )
  } catch {
    return false
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 640,
    // Traffic lights sit inside the app toolbar, per mock (P0 acceptance criteria).
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 16 },
    backgroundColor: '#191d22',
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // The recorded target is hosted in a <webview> behind the EmbeddedTarget abstraction (spec decision 5).
      webviewTag: true,
      // Hidden windows throttle rAF/timers, which would stall replay QA.
      backgroundThrottling: !isQaBackgroundMode,
    },
  })

  mainWindow.once('ready-to-show', () => {
    if (!isQaBackgroundMode) mainWindow?.show()
  })
  mainWindow.on('closed', () => {
    // Finalizes any active recording before the session spool is dropped.
    void recordingManager.shutdownSession()
    // The hidden Mode B window outlives the main window unless stopped here.
    redebugManager.stop()
    mainWindow = null
  })

  // The app UI never opens child windows; external links go to the OS browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

// Recorded content is hostile input (spec decision 21): pin down every webview
// before it attaches, regardless of what renderer code asked for.
app.on('web-contents-created', (_ev, contents) => {
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    if (!isLocalDevUrl(params.src)) event.preventDefault()
  })

  if (contents.getType() === 'webview') {
    // Keep the embedded target inside local dev origins; external jumps are blocked (P0; endReason lands in P1).
    contents.on('will-navigate', (event, url) => {
      if (!isLocalDevUrl(url)) event.preventDefault()
    })
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url)
      return { action: 'deny' }
    })
  }
})

void app.whenReady().then(() => {
  if (isQaBackgroundMode && process.platform === 'darwin') app.setActivationPolicy('accessory')
  openDatabase()
  // Seal any recording the previous process died holding (endReason: app-crash-recovered).
  recoverAbandonedRecordings()
  registerEntranceProtocolHandler()
  registerIpcHandlers(recordingManager, redebugManager)
  createWindow()

  // Headless QA entry: ENTRANCE_HARVEST_RECORDING_ID=<id> runs a coverage
  // harvest on boot and logs status to stdout (drives P4-style verification
  // without the renderer UI).
  const harvestRecordingId = process.env.ENTRANCE_HARVEST_RECORDING_ID
  if (harvestRecordingId) {
    void redebugManager
      .start({ recordingId: harvestRecordingId, harvest: true })
      .then((result) => console.log('[harvest] start:', JSON.stringify(result)))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Single-window dev tool: quitting on close matches user expectation even on macOS.
  app.quit()
})

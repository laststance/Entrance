import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { BrowserWindow } from 'electron'
import { z } from 'zod'

import type {
  RedebugCallFrame,
  RedebugDivergence,
  RedebugScope,
  RedebugStatus,
  RedebugStepRequest,
  StartRedebugRequest,
} from '@shared/redebug'

import {
  REDEBUG_HARVEST_INTERIM_TAKE_MS,
  REDEBUG_HARVEST_TAIL_MS,
  REDEBUG_HYDRATION_POLL_INTERVAL_MS,
  REDEBUG_HYDRATION_TIMEOUT_MS,
  REDEBUG_INPUT_MAX_WAIT_MS,
  REDEBUG_INPUT_SETTLE_MS,
  REDEBUG_KEY_VIRTUAL_CODES,
  REDEBUG_LOAD_TIMEOUT_MS,
  REDEBUG_MAX_CALL_FRAMES,
  REDEBUG_MAX_DIVERGENCES,
  REDEBUG_MAX_SCOPE_VARIABLES,
  REDEBUG_NAV_ASSIST_SETTLE_MS,
  REDEBUG_NAV_ASSIST_TIMEOUT_MS,
  REDEBUG_PASTE_FALLBACK_CHARS,
  REDEBUG_PASTE_LOOKAHEAD_MS,
  REDEBUG_PAUSE_FALLBACK_MS,
  REDEBUG_RANDOM_SEED,
  REDEBUG_WINDOW_HEIGHT_PX,
  REDEBUG_WINDOW_WIDTH_PX,
} from '../constants'
import { readRedebugBundle, type RedebugBundle } from './bundle-reader'
import { CoverageCollector } from './coverage-collector'
import { NetworkMatcher } from './network-matcher'

type CdpSend = (method: string, params?: unknown) => Promise<unknown>

/** Mutable state threaded through a harvest input replay (bucket bookkeeping). */
interface HarvestContext {
  collector: CoverageCollector
  send: CdpSend
  /** Recorded-clock offset of the last coverage take — next bucket starts here. */
  lastBoundaryOffset: number
}

/**
 * Mode B core: re-executes a recording inside a hidden BrowserWindow with an
 * ephemeral partition — network answered ONLY from the bundle
 * (Fetch.fulfillRequest), determinism shims injected before page scripts,
 * recorded inputs re-dispatched as trusted CDP events, a real Debugger
 * attached for pause/scopes/stepping. Divergence is pushed honestly; Mode A
 * in the renderer stays untouched as the safety net. Owned by RedebugManager.
 */

interface CdpRemoteValue {
  type?: string
  subtype?: string
  value?: unknown
  description?: string
  unserializableValue?: string
  objectId?: string
}

interface CdpPausedCallFrame {
  callFrameId: string
  functionName?: string
  url?: string
  location?: { scriptId?: string; lineNumber?: number; columnNumber?: number }
  scopeChain?: Array<{ type: string; name?: string; object?: CdpRemoteValue }>
}

const inputPayloadSchema = z.looseObject({
  kind: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  button: z.number().optional(),
  selector: z.string().optional(),
  code: z.string().optional(),
  key: z.string().optional(),
  keyClass: z.string().optional(),
  masked: z.boolean().optional(),
  modifiers: z
    .looseObject({
      ctrl: z.boolean().optional(),
      meta: z.boolean().optional(),
      alt: z.boolean().optional(),
      shift: z.boolean().optional(),
    })
    .optional(),
})
const errorPayloadSchema = z.looseObject({ message: z.string().optional() })

// The bundle is hostile input (spec conventions): a bodyHash naming anything
// but a flat blob id would let join() escape blobs/ and leak local files into
// the re-executed page. Blob files are written as hex content hashes.
const SAFE_BLOB_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
// RFC 7230 header token — and values must not smuggle CR/LF header splices.
const SAFE_HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
const HEADER_CRLF_PATTERN = /[\r\n]/

export class RedebugSession {
  private window: BrowserWindow | null = null
  private readonly bundle: RedebugBundle
  private readonly matcher: NetworkMatcher
  private readonly divergences: RedebugDivergence[] = []
  private phase: RedebugStatus['phase'] = 'starting'
  private pauseState: RedebugStatus['pause'] | undefined
  private isDisposed = false
  /** FIFO cursor pairing masked input-lane keys with enclave keystrokes. */
  private keystrokeCursor = 0
  /** start() waiters released by the next Debugger.paused event. */
  private readonly pauseWaiters = new Set<() => void>()
  /** Event-listener breakpoint armed for the final input — removed on first pause. */
  private armedEventListenerBreakpoint: string | null = null
  /**
   * scriptId → url from Debugger.scriptParsed. Turbopack dev eval()s modules,
   * so paused call frames carry an empty `url` — the script's sourceURL only
   * arrives via scriptParsed, and without it sourcemap resolution is dead.
   */
  private readonly scriptUrlById = new Map<string, string>()
  /** Set only in harvest mode (request.harvest) — owns coverage takes + artifact. */
  private collector: CoverageCollector | null = null
  private inputsDispatched = 0
  private inputsTotal = 0
  private harvestResult: RedebugStatus['harvestResult']
  /** Full "METHOD url" of unserved requests (divergence messages truncate). */
  private readonly harvestMisses: string[] = []
  /** Harvest-only console/exception log (full stacks) — dumped into coverage-debug.json. */
  private readonly harvestDiag: Array<Record<string, unknown>> = []
  private harvestStartedWall = 0

  constructor(
    private readonly recordingDirPath: string,
    private readonly request: StartRedebugRequest,
    private readonly onStatus: (status: RedebugStatus) => void,
  ) {
    this.bundle = readRedebugBundle(recordingDirPath)
    this.matcher = new NetworkMatcher(this.bundle.networkLane)
  }

  private pushStatus(): void {
    if (this.isDisposed) return
    this.onStatus({
      phase: this.phase,
      pause: this.pauseState,
      divergences: [...this.divergences],
      error: this.lastError,
      ...(this.collector && {
        harvest: { inputsDispatched: this.inputsDispatched, inputsTotal: this.inputsTotal },
      }),
      ...(this.harvestResult && { harvestResult: this.harvestResult }),
    })
  }

  private lastError: string | undefined

  private fail(message: string): void {
    this.phase = 'failed'
    this.lastError = message
    this.pushStatus()
    // A failed session is terminal — reclaim the hidden window and its
    // attached debugger now instead of leaking them until the next start/stop.
    this.dispose()
  }

  private diverge(oracle: RedebugDivergence['oracle'], message: string): void {
    // A fully unmatched page can miss on EVERY request — dedupe + cap keeps
    // the array (and each status push, which copies it) bounded.
    if (this.divergences.some((d) => d.oracle === oracle && d.message === message)) return
    if (this.divergences.length >= REDEBUG_MAX_DIVERGENCES) {
      if (this.divergences.length === REDEBUG_MAX_DIVERGENCES) {
        this.divergences.push({ oracle, message: '相違が多すぎるため以降の記録は省略しました' })
        this.pushStatus()
      }
      return
    }
    this.divergences.push({ oracle, message })
    // Headless harvest reads stdout — surfacing each divergence as it lands
    // beats reconstructing it from a finalize that may never run.
    if (this.collector) console.log('[harvest] divergence:', oracle, message)
    this.pushStatus()
  }

  /** phase mutates from CDP events across awaits — a method defeats stale narrowing. */
  private isPausedNow(): boolean {
    return this.phase === 'paused'
  }

  /**
   * The page the re-execution must boot FROM: the first answerable Document in
   * the recorded lane. targetUrl is only what the user typed into the address
   * bar — the page actually open at Rec (e.g. /login mid-auth) may differ, and
   * booting the wrong route breaks every recorded input's target.
   */
  private resolveBootUrl(): string | null {
    for (const event of this.bundle.networkLane) {
      const payload = event.payload as {
        phase?: string
        resourceType?: string
        method?: string
        url?: string
      }
      if (payload.phase !== 'request' || payload.resourceType !== 'Document') continue
      if (payload.url && this.matcher.has(payload.method ?? 'GET', payload.url)) {
        return payload.url
      }
    }
    return this.matcher.has('GET', this.bundle.manifest.targetUrl)
      ? this.bundle.manifest.targetUrl
      : null
  }

  /** Boots the hidden window, replays inputs, and lands in a paused state. */
  async start(): Promise<void> {
    const { manifest } = this.bundle
    // Honest gate (decision 27): without the bootstrap Document in the bundle
    // there is nothing to re-execute — typical for "Rec pressed on an
    // already-open page before Entrance attached".
    const bootUrl = this.resolveBootUrl()
    if (!bootUrl) {
      this.diverge(
        'bootstrap',
        'この録画には起動ドキュメントが含まれていません(ページを開いた後に録画を開始したため)。モードAで再生できます。',
      )
      this.fail('再現実行に必要な起動データがありません')
      return
    }

    this.phase = 'booting'
    this.pushStatus()

    // Ephemeral partition (decision 28): no `persist:` prefix = in-memory,
    // discarded when the window closes. Never the live recording partition.
    const window = new BrowserWindow({
      show: false,
      width: this.bundle.viewport?.width ?? REDEBUG_WINDOW_WIDTH_PX,
      height: this.bundle.viewport?.height ?? REDEBUG_WINDOW_HEIGHT_PX,
      webPreferences: {
        partition: `redebug-${Date.now()}`,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    })
    this.window = window

    // Re-executed content must stay inside the recording: block window.open
    // and any navigation the Fetch interceptor doesn't serve.
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    // Death/exit visibility: a silent renderer crash or an unexpected hard
    // navigation is otherwise indistinguishable from a stalled replay.
    window.webContents.on('render-process-gone', (_event, details) => {
      console.log('[redebug] render-process-gone:', JSON.stringify(details))
    })
    window.on('closed', () => {
      console.log('[redebug] hidden window closed')
    })
    window.webContents.on('did-start-navigation', (details) => {
      if (details.isMainFrame) console.log('[redebug] main-frame navigation:', details.url.slice(0, 140))
    })
    // WebSockets bypass the Fetch interceptor — a dev-server HMR socket would
    // stream LIVE code edits into the re-execution. Cancelling them is wrong
    // too: Next dev's RSC debug channel treats a closed socket as
    // end-of-stream and rejects every pending flight row ("Connection
    // closed." → global-error). Parking the connect forever (never invoking
    // the callback) leaves the channel open-and-empty, which Next itself uses
    // as its safe fallback: the page renders from the response body alone.
    window.webContents.session.webRequest.onBeforeRequest(
      { urls: ['ws://*/*', 'wss://*/*'] },
      () => {
        /* intentionally never calls callback — the socket hangs in CONNECTING */
      },
    )

    for (const cookie of this.bundle.enclave.cookies) {
      // cookies.get() rows carry no url but cookies.set() requires one —
      // reconstruct it from the cookie's own scope fields.
      const cookieHost = (cookie.domain ?? new URL(manifest.targetUrl).hostname).replace(/^\./, '')
      try {
        await window.webContents.session.cookies.set({
          url: `http${cookie.secure ? 's' : ''}://${cookieHost}${cookie.path ?? '/'}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate,
          sameSite: cookie.sameSite,
        })
      } catch {
        /* expired/malformed cookie — page may diverge; oracles will tell */
      }
    }

    try {
      window.webContents.debugger.attach('1.3')
    } catch (error) {
      this.fail(`デバッガをアタッチできません: ${String(error)}`)
      return
    }

    // Renderer-side CDP domains (Runtime/Debugger/Page) never answer until a
    // renderer process exists — boot one with about:blank (no network, so the
    // Fetch interceptor below can't see it) before enabling them.
    try {
      await window.webContents.loadURL('about:blank')
    } catch (error) {
      this.fail(`再現実行ウィンドウを初期化できません: ${String(error)}`)
      return
    }
    window.webContents.debugger.on('message', (_event, method, params) => {
      void this.onCdpMessage(method, params)
    })

    const send = (method: string, params?: unknown): Promise<unknown> =>
      window.webContents.debugger.sendCommand(method, params)

    try {
      await send('Fetch.enable', {
        patterns: [{ urlPattern: '*', requestStage: 'Request' }],
      })
      await send('Runtime.enable')
      await send('Debugger.enable')
      await send('Page.enable')
      // DOMDebugger event-listener breakpoints silently no-op without DOM.
      await send('DOM.enable')
      if (this.request.harvest) {
        // Coverage harvest never pauses — block-precise counters instead.
        this.collector = new CoverageCollector(this.recordingDirPath)
        this.harvestStartedWall = Date.now()
        await this.collector.attach(send)
      } else if (this.request.breakpoint) {
        // Line-exact pause at a recorded anchor location (decision 30b).
        await send('Debugger.setBreakpointByUrl', {
          url: this.request.breakpoint.url,
          lineNumber: this.request.breakpoint.lineNumber,
        })
      }
      await send('Page.addScriptToEvaluateOnNewDocument', { source: this.buildShimSource() })
    } catch (error) {
      this.fail(`再現実行の初期化に失敗しました: ${String(error)}`)
      return
    }

    const loaded = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), REDEBUG_LOAD_TIMEOUT_MS)
      window.webContents.once('did-finish-load', () => {
        clearTimeout(timeout)
        resolve(true)
      })
    })
    void window.webContents.loadURL(bootUrl).catch(() => {})
    const didLoad = await loaded
    if (this.isDisposed) return
    if (!didLoad && !this.isPausedNow()) {
      this.diverge('bootstrap', '録画からの起動が時間内に完了しませんでした')
    }

    // A breakpoint that fired during boot (e.g. an anchor in first-render
    // code) already produced the honest paused state — never downgrade it,
    // and never dispatch inputs into a paused renderer (the awaited
    // Input.dispatch* would simply never ack).
    if (this.isPausedNow()) return

    // Harvest: full-timeline replay + coverage buckets, then finish — no pause.
    if (this.collector) {
      await this.runHarvest(send)
      return
    }

    // Trusted input re-dispatch up to the requested event boundary.
    this.phase = 'replaying-inputs'
    this.pushStatus()
    const didArmPause = await this.dispatchInputs()
    if (this.isDisposed) return

    // Event-boundary pause (decision 30b): dispatchInputs arms Debugger.pause
    // just before the final input so it lands inside that event's JS task. No
    // inputs replayed → arm it here instead.
    if (!didArmPause && !this.isPausedNow()) {
      try {
        await send('Debugger.pause')
      } catch {
        /* debugger detached mid-flight — dispose already reported */
      }
    }
    if (await this.waitForPause(REDEBUG_PAUSE_FALLBACK_MS)) return
    // Idle page never runs the task the armed pause is waiting for — poke a
    // no-op (fire-and-forget: the evaluate itself is what gets suspended).
    void send('Runtime.evaluate', { expression: 'void 0', silent: true }).catch(() => {})
    if (await this.waitForPause(REDEBUG_PAUSE_FALLBACK_MS)) return
    if (this.isDisposed) return
    // Still running — honest state; the pending pause catches the next JS task.
    this.phase = 'running'
    this.pushStatus()
  }

  /** Resolves true when Debugger.paused lands within the budget. */
  private waitForPause(budgetMs: number): Promise<boolean> {
    if (this.isPausedNow()) return Promise.resolve(true)
    return new Promise((resolve) => {
      const releaseWaiter = (): void => {
        clearTimeout(timeout)
        resolve(true)
      }
      const timeout = setTimeout(() => {
        this.pauseWaiters.delete(releaseWaiter)
        resolve(false)
      }, budgetMs)
      this.pauseWaiters.add(releaseWaiter)
    })
  }

  /** Shim bundle with the recording's snapshot baked in (never leaves main). */
  private buildShimSource(): string {
    const shimTemplate = readFileSync(
      join(import.meta.dirname, '../agent/redebug-shims.js'),
      'utf8',
    )
    const config = {
      t0Wall: this.bundle.manifest.t0Wall,
      localStorage: this.bundle.enclave.localStorage,
      sessionStorage: this.bundle.enclave.sessionStorage,
      randomSeed: REDEBUG_RANDOM_SEED,
    }
    return shimTemplate.replace('"__ENTRANCE_REDEBUG_CONFIG__"', JSON.stringify(config))
  }

  private async onCdpMessage(method: string, params: unknown): Promise<void> {
    if (this.isDisposed) return
    if (method === 'Fetch.requestPaused') {
      await this.onRequestPaused(
        params as {
          requestId: string
          request?: { url?: string; method?: string }
          resourceType?: string
        },
      )
    } else if (method === 'Debugger.paused') {
      await this.onDebuggerPaused(
        params as { reason?: string; callFrames?: CdpPausedCallFrame[] },
      )
    } else if (method === 'Debugger.scriptParsed') {
      const script = params as { scriptId?: string; url?: string }
      if (script.scriptId && script.url) {
        this.scriptUrlById.set(script.scriptId, script.url)
        this.collector?.onScriptParsed(script.scriptId, script.url)
      }
    } else if (method === 'Debugger.resumed') {
      if (this.phase === 'paused') {
        this.phase = 'running'
        this.pauseState = undefined
        this.pushStatus()
      }
    } else if (method === 'Runtime.exceptionThrown') {
      if (this.collector) this.captureHarvestException(params)
      this.checkExceptionOracle(
        params as { exceptionDetails?: { text?: string; exception?: { description?: string } } },
      )
    } else if (method === 'Runtime.consoleAPICalled' && this.collector) {
      const call = params as { type?: string; args?: Array<{ value?: unknown; description?: string }> }
      this.harvestDiag.push({
        atMs: Date.now() - this.harvestStartedWall,
        kind: `console.${call.type ?? 'log'}`,
        text: (call.args ?? [])
          .map((arg) => (arg.value !== undefined ? String(arg.value) : (arg.description ?? '')))
          .join(' ')
          .slice(0, 600),
      })
    }
  }

  /** Harvest diagnostics: full exception description + stack (the oracle keeps one line only). */
  private captureHarvestException(params: unknown): void {
    const details = (
      params as {
        exceptionDetails?: {
          text?: string
          url?: string
          lineNumber?: number
          exception?: { description?: string }
          stackTrace?: {
            callFrames?: Array<{ functionName?: string; url?: string; lineNumber?: number }>
          }
        }
      }
    ).exceptionDetails
    this.harvestDiag.push({
      atMs: Date.now() - this.harvestStartedWall,
      kind: 'exception',
      text: (details?.exception?.description ?? details?.text ?? '').slice(0, 2000),
      url: details?.url,
      line: details?.lineNumber,
      stack: (details?.stackTrace?.callFrames ?? []).map(
        (frame) => `${frame.functionName || '(anon)'} @ ${frame.url}:${frame.lineNumber}`,
      ),
    })
  }

  /** Every request — including the Document — is served from the recording. */
  private async onRequestPaused(params: {
    requestId: string
    request?: { url?: string; method?: string }
    resourceType?: string
  }): Promise<void> {
    const window = this.window
    if (!window || window.isDestroyed()) return
    const send = (method: string, sendParams?: unknown): Promise<unknown> =>
      window.webContents.debugger.sendCommand(method, sendParams)
    const method = params.request?.method ?? 'GET'
    const url = params.request?.url ?? ''
    if (this.collector) console.log('[harvest] paused:', method, params.resourceType ?? '', url.slice(0, 110))

    // Replay-only noise (analytics beacons, dev-overlay symbolication) is
    // blocked WITHOUT a divergence: these fire only because Mode B runs a live
    // dev build, the recording never captured them, and the page treats each
    // as fire-and-forget. Blocking telemetry additionally dodges a browser-
    // process crash — fulfilling its CORS-preflighted exchange from the
    // interceptor faulted CrBrowserMain (the preflight controller outlived its
    // request).
    let hostname = ''
    let pathname = ''
    try {
      const parsed = new URL(url)
      hostname = parsed.hostname
      pathname = parsed.pathname
    } catch {
      /* non-URL scheme (about:, data:) — fall through to the matcher */
    }
    const isTelemetryBeacon = /(^|\.)clerk-telemetry\.com$/.test(hostname)
    // Next dev error-overlay endpoints: stack-frame symbolication + editor
    // launch. Pure tooling, never corelive/src, absent from every recording.
    const isDevOverlayEndpoint =
      pathname === '/__nextjs_original-stack-frames' || pathname === '/__nextjs_launch-editor'
    if (isTelemetryBeacon || isDevOverlayEndpoint) {
      await send('Fetch.failRequest', {
        requestId: params.requestId,
        errorReason: 'BlockedByClient',
      }).catch(() => {})
      return
    }
    // Remaining CORS preflights also stay off the fulfill path: a page can't
    // observe a preflight response, so continueRequest lets them resolve (or
    // fail) natively without ever mixing interception into preflight state.
    if (method === 'OPTIONS') {
      await send('Fetch.continueRequest', { requestId: params.requestId }).catch(() => {})
      return
    }

    const recorded = this.matcher.match(method, url)
    if (!recorded) {
      if (this.collector) this.harvestMisses.push(`${method} ${url}`)
      // resourceType tells Document reload apart from an RSC fetch — without it
      // this message is undiagnosable when the URL alone looks legitimate.
      this.diverge(
        'network',
        `録画にないリクエスト: ${method} ${url.slice(0, 120)}${params.resourceType ? ` (${params.resourceType})` : ''}`,
      )
      await send('Fetch.failRequest', {
        requestId: params.requestId,
        errorReason: 'BlockedByClient',
      }).catch(() => {})
      return
    }

    let bodyBase64 = ''
    if (recorded.bodyHash) {
      if (!SAFE_BLOB_ID_PATTERN.test(recorded.bodyHash)) {
        this.diverge('network', `不正な本文IDを拒否しました: ${method} ${url.slice(0, 120)}`)
      } else {
        try {
          // async: a large body must not block the main process event loop.
          bodyBase64 = (await readFile(join(this.bundle.blobsDirPath, recorded.bodyHash))).toString(
            'base64',
          )
        } catch {
          this.diverge('network', `録画本文が見つかりません: ${method} ${url.slice(0, 120)}`)
        }
      }
    } else if (recorded.bodyDropped) {
      this.diverge('network', `録画時に本文が保存されませんでした: ${method} ${url.slice(0, 120)}`)
    }

    const responseHeaders = Object.entries(recorded.headers)
      .filter(([name]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(name.toLowerCase()))
      // Recorded header shapes are hostile — a non-token name or CR/LF in a
      // value would splice arbitrary headers into the fulfilled response.
      .filter(([name, value]) => SAFE_HEADER_NAME_PATTERN.test(name) && !HEADER_CRLF_PATTERN.test(value))
      .map(([name, value]) => ({ name, value }))
    // Real Set-Cookie values ride along from the enclave (decision 32b).
    for (const value of this.bundle.enclave.setCookieValuesByRequestId.get(recorded.requestId) ?? []) {
      if (!HEADER_CRLF_PATTERN.test(value)) responseHeaders.push({ name: 'Set-Cookie', value })
    }

    await send('Fetch.fulfillRequest', {
      requestId: params.requestId,
      responseCode: recorded.status,
      responseHeaders,
      body: bodyBase64,
    }).catch(() => {})
    if (this.collector) console.log('[harvest] fulfilled:', recorded.status, method, url.slice(0, 110))
  }

  /**
   * Recorded inputs → trusted CDP dispatch (decision 29 — never JS-synthesized),
   * re-paced by their recorded gaps. Arms Debugger.pause right before the final
   * input so the pause lands inside that event's JS task (decision 30b).
   * @returns true when the pause was armed (or a breakpoint already paused us).
   */
  private async dispatchInputs(harvestContext?: HarvestContext): Promise<boolean> {
    const window = this.window
    if (!window || window.isDestroyed()) return false
    const send = (method: string, sendParams?: unknown): Promise<unknown> =>
      window.webContents.debugger.sendCommand(method, sendParams)
    const runToSeq = this.request.runToSeq ?? Number.MAX_SAFE_INTEGER
    const t0Mono = this.bundle.manifest.t0Mono

    // The final event is needed up front (pause arming), so filter first.
    const events = this.bundle.inputLane.filter(
      (event) => event.tMono >= t0Mono && event.seq <= runToSeq,
    )
    if (harvestContext) {
      this.inputsTotal = events.length
      this.pushStatus()
    }

    let didArmPause = false
    let previousTMono = t0Mono
    for (const [index, event] of events.entries()) {
      if (this.isDisposed || this.isPausedNow()) return true
      const payload = inputPayloadSchema.safeParse(event.payload)
      if (!payload.success) continue
      const input = payload.data
      const isFinal = index === events.length - 1

      // Re-pace by the recorded gap (capped). The first input additionally
      // waits for hydration — at record time the page was interactive long
      // before Rec, but here it just booted.
      const recordedGapMs = Math.min(event.tMono - previousTMono, REDEBUG_INPUT_MAX_WAIT_MS)
      previousTMono = event.tMono
      const waitMs = Math.max(recordedGapMs, REDEBUG_INPUT_SETTLE_MS)
      // Crash bisection: ENTRANCE_HARVEST_DIAG_NO_TAKES=1 replays inputs with
      // coverage takes suppressed, separating "the page/replay crashes" from
      // "marshalling takePreciseCoverage results crashes".
      const suppressTakes = process.env.ENTRANCE_HARVEST_DIAG_NO_TAKES === '1'
      if (harvestContext && !suppressTakes) {
        await this.waitWithInterimTakes(harvestContext, waitMs, event.tMono - t0Mono)
      } else {
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
      if (index === 0) await this.waitForHydration(input.x ?? 0, input.y ?? 0)
      if (this.isDisposed || this.isPausedNow()) return true
      // The recording may have soft-navigated inside this gap — if the
      // re-execution didn't reproduce it, replay the route change now so the
      // upcoming input lands on the page it was recorded against.
      await this.assistMissedNavigation(event.tMono)

      // Close the bucket ending at this event: everything since the previous
      // boundary executed inside (lastBoundary, thisEvent] on the recorded clock.
      if (harvestContext && !suppressTakes) {
        const eventOffset = event.tMono - t0Mono
        await harvestContext.collector.take(
          {
            kind: 'input',
            seq: event.seq,
            tStart: harvestContext.lastBoundaryOffset,
            tEnd: eventOffset,
          },
          harvestContext.send,
        )
        harvestContext.lastBoundaryOffset = eventOffset
      }

      // Task-exact pause (decision 30b): an event-listener breakpoint fires
      // inside the final input's own handler — a bare Debugger.pause races
      // whatever page task happens to run first. Once armed, ANY evaluate
      // would suspend inside itself, so the final dispatches are
      // fire-and-forget past this point.
      const armPause = async (): Promise<void> => {
        // Harvest never pauses — it must run through the whole timeline.
        if (harvestContext || !isFinal || didArmPause) return
        const eventName = input.kind === 'click' ? 'click' : input.kind === 'key' ? 'keydown' : null
        try {
          if (eventName) {
            await send('DOMDebugger.setEventListenerBreakpoint', { eventName })
            this.armedEventListenerBreakpoint = eventName
          } else {
            await send('Debugger.pause')
          }
          didArmPause = true
        } catch {
          /* detached */
        }
      }
      const post = (method: string, sendParams?: unknown): Promise<unknown> => {
        // Fire-and-forget only applies when a pause is armed (the ack would
        // never come back) — harvest keeps every dispatch awaited.
        if (isFinal && !harvestContext) {
          void send(method, sendParams).catch(() => {})
          return Promise.resolve()
        }
        return send(method, sendParams)
      }

      if (harvestContext) {
        console.log(`[harvest] input #${index} seq ${event.seq} ${input.kind}`)
        await this.captureInputDiag(send, index, event.seq, input)
      }
      try {
        if (input.kind === 'click') {
          let clickX = input.x ?? 0
          let clickY = input.y ?? 0
          // An explicit flag, not a (0,0) sentinel — a legitimate corner
          // click must not read as "target missing".
          let hasClickPoint = input.x !== undefined || input.y !== undefined
          // Selector center wins over recorded coordinates: replay layout can
          // shift (e.g. record-time cache-served fonts are absent from the
          // bundle), and a coordinate click then silently lands on the wrong
          // element. Recorded (x,y) is the fallback when resolution fails.
          if (input.selector) {
            const resolved = await this.resolveSelectorCenter(input.selector)
            if (resolved) {
              clickX = resolved.x
              clickY = resolved.y
              hasClickPoint = true
            }
          }
          if (!hasClickPoint) {
            this.diverge(
              'network',
              `クリック対象が見つかりません: ${(input.selector ?? '').slice(0, 80)}`,
            )
            continue
          }
          const mouseBase = {
            x: Math.round(clickX),
            y: Math.round(clickY),
            button: 'left',
            clickCount: 1,
          }
          await armPause()
          await post('Input.dispatchMouseEvent', { ...mouseBase, type: 'mousePressed' })
          await post('Input.dispatchMouseEvent', { ...mouseBase, type: 'mouseReleased' })
        } else if (input.kind === 'key') {
          const realKey = input.masked
            ? (this.bundle.enclave.keystrokes[this.keystrokeCursor++]?.key ?? '')
            : (input.key ?? '')
          if (!realKey) continue
          const isPasteChord =
            realKey === 'v' && Boolean(input.modifiers?.meta || input.modifiers?.ctrl)
          if (isPasteChord) {
            // A synthesized Cmd/Ctrl+V runs no editing command in Chromium, so
            // the paste replays by effect: insert stand-in text sized by the
            // rrweb input event that recorded the result (the pasted content
            // itself is masked — never recorded).
            await armPause()
            if (harvestContext) console.log('[harvest] paste: focusing')
            await this.focusVisibleEmptyFieldIfBlurred(post)
            const pastedLength = this.pastedLengthNear(event.tMono)
            if (harvestContext) console.log('[harvest] paste: inserting', pastedLength, 'chars')
            await post('Input.insertText', { text: 'x'.repeat(pastedLength) })
            if (harvestContext) console.log('[harvest] paste: inserted')
          } else {
            const modifierBits =
              (input.modifiers?.alt ? 1 : 0) |
              (input.modifiers?.ctrl ? 2 : 0) |
              (input.modifiers?.meta ? 4 : 0) |
              (input.modifiers?.shift ? 8 : 0)
            const virtualKeyCode = REDEBUG_KEY_VIRTUAL_CODES[realKey]
            const keyBase = {
              code: input.code,
              key: realKey,
              modifiers: modifierBits,
              ...(virtualKeyCode !== undefined
                ? { windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode }
                : {}),
            }
            const isBareModifier =
              realKey === 'Meta' || realKey === 'Shift' || realKey === 'Control' || realKey === 'Alt'
            // keyDown (not raw) lets Chromium run the editing command behind
            // Backspace/Enter/arrows; bare modifiers stay rawKeyDown.
            const downType =
              realKey.length === 1 || (virtualKeyCode !== undefined && !isBareModifier)
                ? 'keyDown'
                : 'rawKeyDown'
            await armPause()
            await post('Input.dispatchKeyEvent', {
              ...keyBase,
              type: downType,
              text: realKey.length === 1 ? realKey : realKey === 'Enter' ? '\r' : undefined,
            })
            await post('Input.dispatchKeyEvent', { ...keyBase, type: 'keyUp' })
          }
        } else if (input.kind === 'scroll') {
          // Scroll restore is positional, not gestural — evaluate is sufficient.
          await armPause()
          await post('Runtime.evaluate', {
            expression: `window.scrollTo(${Number(input.x ?? 0)}, ${Number(input.y ?? 0)})`,
            silent: true,
          })
        }
      } catch {
        /* window went away mid-dispatch — dispose handles state */
      }
      if (harvestContext) {
        this.inputsDispatched = index + 1
        this.pushStatus()
      }
    }
    return didArmPause
  }

  /**
   * Harvest ground-truth diagnostics: what the page shows and what each input
   * is about to hit — the "did the click land on the form?" evidence.
   */
  private async captureInputDiag(
    send: CdpSend,
    index: number,
    seq: number,
    input: { kind: string; x?: number; y?: number; selector?: string },
  ): Promise<void> {
    try {
      const probe =
        input.kind === 'click'
          ? `(()=>{const el=document.elementFromPoint(${Number(input.x ?? 0)},${Number(input.y ?? 0)});return el?el.outerHTML.slice(0,200):'(null)'})()`
          : `(()=>{const el=document.activeElement;return el?el.tagName+'#'+(el.id||'')+' '+String(el.className||'').slice(0,80):'(none)'})()`
      const evaluated = (await send('Runtime.evaluate', {
        expression: probe,
        returnByValue: true,
        silent: true,
      })) as { result?: { value?: unknown } }
      this.harvestDiag.push({
        atMs: Date.now() - this.harvestStartedWall,
        kind: `input-target:${input.kind}`,
        seq,
        selector: (input.selector ?? '').slice(0, 120),
        text: String(evaluated.result?.value ?? '').slice(0, 300),
      })
      // A few full screenshots across the run — visual ground truth.
      if (index < 3 || index % 4 === 0) {
        const shot = (await send('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 55,
        })) as { data?: string }
        if (shot.data) {
          const shotsDir = join(this.recordingDirPath, 'coverage', 'shots')
          mkdirSync(shotsDir, { recursive: true })
          writeFileSync(
            join(shotsDir, `input-${String(index).padStart(2, '0')}-seq${seq}.jpg`),
            Buffer.from(shot.data, 'base64'),
          )
        }
      }
    } catch {
      /* diagnostics only — never fail the harvest */
    }
  }

  /** Harvest run: replay every input with coverage takes, settle, write the artifact. */
  private async runHarvest(send: CdpSend): Promise<void> {
    const collector = this.collector
    if (!collector) return
    this.phase = 'replaying-inputs'
    this.pushStatus()
    const harvestContext: HarvestContext = { collector, send, lastBoundaryOffset: 0 }
    await this.dispatchInputs(harvestContext)
    if (this.isDisposed) return

    const { durationMs, recordingId } = this.bundle.manifest
    // The recorded tail after the final input still runs timers/fetch handlers.
    const tailMs = Math.min(
      Math.max(durationMs - harvestContext.lastBoundaryOffset, REDEBUG_INPUT_SETTLE_MS),
      REDEBUG_HARVEST_TAIL_MS,
    )
    await new Promise((resolve) => setTimeout(resolve, tailMs))
    if (this.isDisposed) return
    await collector.take(
      { kind: 'tail', tStart: harvestContext.lastBoundaryOffset, tEnd: durationMs },
      send,
    )
    try {
      const timeline = await collector.finalize(send, {
        recordingId,
        durationMs,
        divergences: this.divergences.map((d) => ({ oracle: d.oracle, message: d.message })),
        misses: [...new Set(this.harvestMisses)],
        diag: this.harvestDiag,
      })
      this.harvestResult = {
        bucketCount: timeline.buckets.length,
        appFileCount: timeline.stats.appFileCount,
        appLineCount: timeline.stats.appLineCount,
      }
    } catch (error) {
      this.fail(`カバレッジ解析に失敗しました: ${String(error)}`)
      return
    }
    this.phase = 'finished'
    this.pushStatus()
    this.dispose()
  }

  /** Re-paced wait sliced by interim coverage takes — finer timeline attribution. */
  private async waitWithInterimTakes(
    harvestContext: HarvestContext,
    waitMs: number,
    targetOffset: number,
  ): Promise<void> {
    const gapStartOffset = harvestContext.lastBoundaryOffset
    let elapsedMs = 0
    while (elapsedMs < waitMs) {
      const sliceMs = Math.min(REDEBUG_HARVEST_INTERIM_TAKE_MS, waitMs - elapsedMs)
      await new Promise((resolve) => setTimeout(resolve, sliceMs))
      elapsedMs += sliceMs
      if (this.isDisposed) return
      // The final slice's coverage belongs to the input-boundary take instead.
      if (elapsedMs >= waitMs) return
      // Proportional position inside the recorded gap — honest approx flag.
      const estimatedOffset = gapStartOffset + (elapsedMs / waitMs) * (targetOffset - gapStartOffset)
      if (estimatedOffset <= harvestContext.lastBoundaryOffset) continue
      await harvestContext.collector.take(
        {
          kind: 'interim',
          tStart: harvestContext.lastBoundaryOffset,
          tEnd: estimatedOffset,
          approx: true,
        },
        harvestContext.send,
      )
      harvestContext.lastBoundaryOffset = estimatedOffset
    }
  }

  /**
   * Blocks the first input until the element at the recorded point carries a
   * React fiber expando (= hydrated, framework handlers attached). Non-React
   * pages never match and simply wait out the budget.
   * @param x - recorded click x (0 falls back to probing document.body)
   * @param y - recorded click y
   */
  private async waitForHydration(x: number, y: number): Promise<void> {
    const startedAt = Date.now()
    const deadline = startedAt + REDEBUG_HYDRATION_TIMEOUT_MS
    while (Date.now() < deadline) {
      const window = this.window
      if (!window || window.isDestroyed() || this.isDisposed || this.isPausedNow()) return
      try {
        const result = (await window.webContents.debugger.sendCommand('Runtime.evaluate', {
          expression: `(() => { let el = document.elementFromPoint(${Math.round(x)}, ${Math.round(y)}) ?? document.body; while (el) { if (Object.keys(el).some((key) => key.startsWith('__reactFiber'))) return true; el = el.parentElement } return false })()`,
          returnByValue: true,
          silent: true,
        })) as { result?: { value?: unknown } }
        if (result.result?.value === true) return
      } catch {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, REDEBUG_HYDRATION_POLL_INTERVAL_MS))
    }
  }

  /** Same-origin RSC nav fetches from the recording — (tMono, pathname) checkpoints re-execution must reach. */
  private navCheckpoints: Array<{ tMono: number; path: string }> | null = null
  private readonly assistedNavPaths = new Set<string>()

  /**
   * Derives the recorded soft-navigation timeline from the network lane: a
   * same-origin `_rsc` GET marks the app router landing on that pathname.
   * Consecutive fetches for one path collapse into a single checkpoint.
   * @returns checkpoints in recorded order
   * @example [{ tMono: 28917, path: '/home' }]
   */
  private buildNavCheckpoints(): Array<{ tMono: number; path: string }> {
    let origin = ''
    try {
      origin = new URL(this.bundle.manifest.targetUrl).origin
    } catch {
      return []
    }
    const rscFetchSchema = z.looseObject({
      phase: z.literal('request'),
      method: z.literal('GET'),
      url: z.string(),
    })
    const checkpoints: Array<{ tMono: number; path: string }> = []
    for (const event of this.bundle.networkLane) {
      const request = rscFetchSchema.safeParse(event.payload)
      if (!request.success) continue
      try {
        const url = new URL(request.data.url)
        if (url.origin !== origin || !url.searchParams.has('_rsc')) continue
        const previous = checkpoints[checkpoints.length - 1]
        if (previous?.path === url.pathname) continue
        checkpoints.push({ tMono: event.tMono, path: url.pathname })
      } catch {
        /* non-URL row — skip */
      }
    }
    return checkpoints
  }

  /**
   * Replays a recorded soft navigation the re-execution failed to reproduce
   * (e.g. an auth library's redirect glue stalling on replay-only state):
   * pushes the recorded route via the app router and waits for it to land.
   * Never silent — every assist is flagged as a divergence. Runs before each
   * input dispatch with that input's recorded tMono.
   * @param upToTMono - recorded clock bound; checkpoints beyond it stay pending
   * @example await this.assistMissedNavigation(event.tMono)
   */
  private async assistMissedNavigation(upToTMono: number): Promise<void> {
    this.navCheckpoints ??= this.buildNavCheckpoints()
    const window = this.window
    if (!window || window.isDestroyed()) return
    const currentPathname = async (): Promise<string> => {
      try {
        const result = (await window.webContents.debugger.sendCommand('Runtime.evaluate', {
          expression: 'location.pathname',
          returnByValue: true,
          silent: true,
        })) as { result?: { value?: unknown } }
        return typeof result.result?.value === 'string' ? result.result.value : ''
      } catch {
        return ''
      }
    }
    for (const checkpoint of this.navCheckpoints) {
      if (checkpoint.tMono > upToTMono) break
      if (this.assistedNavPaths.has(checkpoint.path)) continue
      this.assistedNavPaths.add(checkpoint.path)
      if ((await currentPathname()) === checkpoint.path) continue
      this.diverge(
        'network',
        `再実行が録画のページ遷移を再現しなかったため補正しました: ${checkpoint.path}`,
      )
      console.log('[redebug] nav-assist →', checkpoint.path)
      try {
        await window.webContents.debugger.sendCommand('Runtime.evaluate', {
          expression: `window.next?.router?.push(${JSON.stringify(checkpoint.path)})`,
          silent: true,
        })
      } catch {
        continue
      }
      // Wait for the route to land, then let the destination mount.
      for (let waitedMs = 0; waitedMs < REDEBUG_NAV_ASSIST_TIMEOUT_MS; waitedMs += REDEBUG_HYDRATION_POLL_INTERVAL_MS) {
        if ((await currentPathname()) === checkpoint.path) break
        await new Promise((resolve) => setTimeout(resolve, REDEBUG_HYDRATION_POLL_INTERVAL_MS))
      }
      await new Promise((resolve) => setTimeout(resolve, REDEBUG_NAV_ASSIST_SETTLE_MS))
    }
  }

  /**
   * Length of the text a recorded paste inserted, read from the first rrweb
   * input event following the chord (values are masked, lengths survive).
   * @param pasteTMono - recorded tMono of the Cmd+V key event
   * @returns
   * - matched rrweb event: its field-value length
   * - none within the lookahead window: REDEBUG_PASTE_FALLBACK_CHARS
   * @example this.pastedLengthNear(22930) // => 13
   */
  private pastedLengthNear(pasteTMono: number): number {
    for (const valueEvent of this.bundle.inputValueEvents) {
      if (valueEvent.tMono < pasteTMono) continue
      if (valueEvent.tMono > pasteTMono + REDEBUG_PASTE_LOOKAHEAD_MS) break
      if (valueEvent.length > 0) return valueEvent.length
    }
    return REDEBUG_PASTE_FALLBACK_CHARS
  }

  /**
   * Refocuses the first visible empty field before Input.insertText when focus
   * was lost — a step-transition re-render can drop autofocus in replay, and
   * insertText lands wherever focus sits.
   * @param post - the dispatch loop's CDP sender
   * @example await this.focusVisibleEmptyFieldIfBlurred(post)
   */
  private async focusVisibleEmptyFieldIfBlurred(
    post: (method: string, sendParams?: unknown) => Promise<unknown>,
  ): Promise<void> {
    await post('Runtime.evaluate', {
      expression: `(() => {
        const active = document.activeElement
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
        for (const field of document.querySelectorAll('input, textarea')) {
          const rect = field.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0 && !field.disabled && field.type !== 'hidden' && !field.value) {
            field.focus()
            return
          }
        }
      })()`,
      silent: true,
    })
  }

  private async resolveSelectorCenter(selector: string): Promise<{ x: number; y: number } | null> {
    // Recorded paths pin full ancestor chains that replay-only DOM drift breaks
    // (dev-overlay siblings shift nth-of-type ordinals, useId prefixes change) —
    // retry from the nearest `form >` anchor before surrendering to coordinates.
    const candidateSelectors = [selector]
    const formAnchorIndex = selector.lastIndexOf('form > ')
    if (formAnchorIndex > 0) candidateSelectors.push(selector.slice(formAnchorIndex))
    for (const candidate of candidateSelectors) {
      const center = await this.querySelectorCenter(candidate)
      if (center) return center
    }
    return null
  }

  private async querySelectorCenter(selector: string): Promise<{ x: number; y: number } | null> {
    const window = this.window
    if (!window || window.isDestroyed()) return null
    try {
      const result = (await window.webContents.debugger.sendCommand('Runtime.evaluate', {
        expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }) })()`,
        returnByValue: true,
        silent: true,
      })) as { result?: { value?: unknown } }
      if (typeof result.result?.value !== 'string') return null
      const parsed: unknown = JSON.parse(result.result.value)
      const point = z.object({ x: z.number(), y: z.number() }).safeParse(parsed)
      return point.success ? point.data : null
    } catch {
      return null
    }
  }

  /** Paused → snapshot call frames + top-frame scopes into plain IPC data. */
  private async onDebuggerPaused(params: {
    reason?: string
    callFrames?: CdpPausedCallFrame[]
  }): Promise<void> {
    const window = this.window
    if (!window || window.isDestroyed()) return
    // Harvest must keep executing: a stray pause (e.g. a `debugger` statement
    // in page code) would freeze the replay, so resume immediately.
    if (this.collector) {
      void window.webContents.debugger.sendCommand('Debugger.resume').catch(() => {})
      return
    }
    // One-shot: without removal every later click/keydown would re-trap.
    if (this.armedEventListenerBreakpoint) {
      void window.webContents.debugger
        .sendCommand('DOMDebugger.removeEventListenerBreakpoint', {
          eventName: this.armedEventListenerBreakpoint,
        })
        .catch(() => {})
      this.armedEventListenerBreakpoint = null
    }
    const frames = params.callFrames ?? []

    const callFrames: RedebugCallFrame[] = frames.slice(0, REDEBUG_MAX_CALL_FRAMES).map((frame) => ({
      callFrameId: frame.callFrameId,
      functionName: frame.functionName || '(anonymous)',
      // Turbopack eval frames have an empty url — scriptParsed knows the sourceURL.
      url: frame.url || this.scriptUrlById.get(frame.location?.scriptId ?? '') || '',
      lineNumber: frame.location?.lineNumber ?? 0,
      columnNumber: frame.location?.columnNumber ?? 0,
    }))

    const scopes: RedebugScope[] = []
    for (const scope of frames[0]?.scopeChain ?? []) {
      // Local/closure/block carry the variables users came for; global is noise.
      if (!['local', 'closure', 'block', 'catch'].includes(scope.type)) continue
      if (!scope.object?.objectId) continue
      try {
        const properties = (await window.webContents.debugger.sendCommand('Runtime.getProperties', {
          objectId: scope.object.objectId,
          ownProperties: true,
          generatePreview: true,
        })) as { result?: Array<{ name: string; value?: CdpRemoteValue }> }
        scopes.push({
          type: scope.type,
          name: scope.name,
          variables: (properties.result ?? [])
            .slice(0, REDEBUG_MAX_SCOPE_VARIABLES)
            .map((property) => ({
              name: property.name,
              preview: previewRemoteValue(property.value),
            })),
        })
      } catch {
        /* scope vanished between pause and inspect */
      }
      if (scopes.length >= 4) break
    }

    this.phase = 'paused'
    this.pauseState = {
      reason: params.reason ?? 'pause',
      callFrames,
      scopes,
    }
    this.pushStatus()
    for (const releaseWaiter of this.pauseWaiters) releaseWaiter()
    this.pauseWaiters.clear()
  }

  /** Error oracle: a re-execution exception the recording never saw = divergence. */
  private checkExceptionOracle(params: {
    exceptionDetails?: { text?: string; exception?: { description?: string } }
  }): void {
    const description =
      params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? ''
    const firstLine = description.split('\n')[0]
    const wasRecorded = this.bundle.errorLane.some((event) => {
      const payload = errorPayloadSchema.safeParse(event.payload)
      return payload.success && (payload.data.message ?? '').startsWith(firstLine.slice(0, 60))
    })
    if (!wasRecorded && firstLine) {
      this.diverge('error', `録画にない例外: ${firstLine.slice(0, 140)}`)
    }
  }

  async step(request: RedebugStepRequest): Promise<void> {
    const window = this.window
    if (!window || window.isDestroyed()) return
    const command = {
      resume: 'Debugger.resume',
      stepOver: 'Debugger.stepOver',
      stepInto: 'Debugger.stepInto',
      stepOut: 'Debugger.stepOut',
      pause: 'Debugger.pause',
    }[request.action]
    try {
      await window.webContents.debugger.sendCommand(command)
    } catch {
      /* detached */
    }
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true
    const window = this.window
    this.window = null
    if (window && !window.isDestroyed()) {
      try {
        window.webContents.debugger.detach()
      } catch {
        /* already gone */
      }
      window.destroy()
    }
  }
}

/** DevTools-style one-line preview for a CDP RemoteObject. */
function previewRemoteValue(value: CdpRemoteValue | undefined): string {
  if (!value) return 'undefined'
  if (value.unserializableValue) return value.unserializableValue
  if (value.type === 'string') return `'${String(value.value).slice(0, 80)}'`
  if (value.value !== undefined) return JSON.stringify(value.value)?.slice(0, 80) ?? String(value.value)
  return (value.description ?? value.type ?? 'undefined').slice(0, 80)
}

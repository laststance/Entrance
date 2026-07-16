import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { webContents, type WebContents } from 'electron'
import { ulid } from 'ulid'

import {
  AGENT_BINDING_NAME,
  AGENT_MESSAGE_MAX_BYTES,
  agentMessageSchema,
  type AgentMessage,
} from '@shared/agent'
import type { Lane, LaneEvent } from '@shared/envelope'
import { PUSH, type CdpEventSummary } from '@shared/ipc'

import {
  ANCHOR_STACK_FRAMES_MAX,
  CDP_NETWORK_RESOURCE_BUFFER_BYTES,
  CDP_NETWORK_TOTAL_BUFFER_BYTES,
  CONSOLE_ARG_PREVIEW_MAX_CHARS,
  NETWORK_BODY_MAX_BYTES,
} from '../constants'
import { sessionSpoolDir } from '../paths'
import { BlobStore } from './blob-store'
import { JsonlAppender, LaneWriterSet } from './lane-writer'
import { redactHeaders } from './redaction'
import { Sequencer } from './sequencer'

/**
 * One attached embedded-target session (spec decisions 8/13/27): Entrance's
 * sole CDP client streams network/console/error/page/script lanes into a spool
 * from ATTACH (not Rec) so recordings can bundle bootstrap artifacts, while
 * keeping the P0 live-log push alive. Created by RecordingManager.attachSession.
 */

/** Code location kept on console/error anchors (decision 3 line-exact highlight). */
interface AnchorFrame {
  functionName: string
  url: string
  lineNumber: number
  columnNumber: number
}

interface CdpStackTrace {
  callFrames?: Array<Partial<AnchorFrame>>
}

interface CdpRemoteObject {
  type?: string
  value?: unknown
  unserializableValue?: string
  description?: string
}

interface CdpResponseSummary {
  url?: string
  status?: number
  statusText?: string
  mimeType?: string
  headers?: Record<string, string>
  fromDiskCache?: boolean
}

export interface TargetSessionCallbacks {
  /** Fires for every stamped lane event — RecordingManager tallies the live HUD. */
  onLaneEvent: (event: LaneEvent) => void
  /** Validated page-agent message (rrweb/input) — recorded only while a recording is active. */
  onAgentEvent: (message: AgentMessage) => void
  /** Top-frame navigation; the manager decides the navigated-away auto-stop (decision 25). */
  onTopFrameNavigated: (url: string) => void
  /** Target crashed/destroyed/detached — the manager auto-stops with target-crashed. */
  onTargetGone: () => void
}

export class TargetSession {
  readonly sessionId: string
  readonly spoolDir: string
  readonly sequencer = new Sequencer()
  readonly spoolLanes: LaneWriterSet
  readonly blobs: BlobStore
  readonly enclaveFilePath: string
  readonly framework?: string
  readonly bundlerVariant?: string

  private readonly enclave: JsonlAppender
  private readonly target: WebContents
  private readonly appWindow: WebContents
  private readonly callbacks: TargetSessionCallbacks
  private readonly agentSource: string
  private topFrameUrl: string
  private isDisposed = false
  private removeCdpListeners: () => void = () => {}

  private constructor(
    target: WebContents,
    appWindow: WebContents,
    options: {
      framework?: string
      bundlerVariant?: string
      agentSource: string
      callbacks: TargetSessionCallbacks
    },
  ) {
    this.target = target
    this.appWindow = appWindow
    this.framework = options.framework
    this.bundlerVariant = options.bundlerVariant
    this.agentSource = options.agentSource
    this.callbacks = options.callbacks
    this.sessionId = ulid()
    this.spoolDir = sessionSpoolDir(this.sessionId)
    this.spoolLanes = new LaneWriterSet(this.spoolDir)
    this.blobs = new BlobStore(this.spoolDir)
    this.enclaveFilePath = join(this.spoolDir, 'enclave.jsonl')
    this.enclave = new JsonlAppender(this.enclaveFilePath)
    this.topFrameUrl = target.getURL()
  }

  /** Current top-frame URL (recording start URL / navigated-away baseline). */
  get currentUrl(): string {
    return this.topFrameUrl
  }

  /**
   * Attach the recorder session to the embedded target's webContents.
   * @param options - target id, push window, fingerprint info, manager callbacks
   * @returns
   * - success: `{ session }` with lanes already streaming
   * - failure: `{ error }` (target gone / attach or enable failed)
   */
  static async attach(options: {
    webContentsId: number
    appWindow: WebContents
    framework?: string
    bundlerVariant?: string
    agentSource: string
    callbacks: TargetSessionCallbacks
  }): Promise<{ session: TargetSession } | { error: string }> {
    const target = webContents.fromId(options.webContentsId)
    if (!target || target.isDestroyed()) return { error: 'target webContents not found' }
    try {
      target.debugger.attach('1.3')
    } catch (err) {
      return { error: `debugger attach failed: ${String(err)}` }
    }

    const session = new TargetSession(target, options.appWindow, options)
    session.installListeners()
    try {
      await session.enableCdpDomains()
      await session.installPageAgent()
    } catch (err) {
      session.dispose()
      return { error: `CDP domain enable failed: ${String(err)}` }
    }
    return { session }
  }

  /** Append a secrets-enclave row (Set-Cookie values, real keystrokes — decision 32). */
  appendEnclaveEntry(entry: Record<string, unknown>): void {
    if (this.isDisposed) return
    this.enclave.appendLine(entry)
  }

  /** Fire-and-forget page evaluation (agent rec start/stop control). */
  evaluateInPage(expression: string): void {
    if (this.isDisposed) return
    void this.target.debugger
      .sendCommand('Runtime.evaluate', { expression, silent: true })
      .catch(() => {
        /* target navigating or gone — the next agent-ready re-arms it */
      })
  }

  /** Detach CDP, close spool writers, and delete the spool (recordings were copied out at finalize). */
  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true
    this.removeCdpListeners()
    try {
      if (!this.target.isDestroyed() && this.target.debugger.isAttached()) {
        this.target.debugger.detach()
      }
    } catch {
      /* target already gone */
    }
    this.spoolLanes.close()
    this.enclave.close()
    rmSync(this.spoolDir, { recursive: true, force: true })
  }

  private installListeners(): void {
    let didReportGone = false
    const onMessage = (_ev: unknown, method: string, params: Record<string, unknown>): void => {
      this.handleCdpEvent(method, params)
    }
    // Crash, close, and external detach all funnel here exactly once.
    const onGone = (): void => {
      if (this.isDisposed || didReportGone) return
      didReportGone = true
      if (!this.appWindow.isDestroyed()) this.appWindow.send(PUSH.targetGone)
      this.callbacks.onTargetGone()
    }

    this.target.debugger.on('message', onMessage)
    this.target.debugger.once('detach', onGone)
    this.target.once('destroyed', onGone)
    this.target.on('render-process-gone', onGone)
    this.removeCdpListeners = () => {
      this.target.debugger.removeListener('message', onMessage)
      this.target.debugger.removeListener('detach', onGone)
      if (!this.target.isDestroyed()) {
        this.target.removeListener('destroyed', onGone)
        this.target.removeListener('render-process-gone', onGone)
      }
    }
  }

  private async enableCdpDomains(): Promise<void> {
    const targetDebugger = this.target.debugger
    // Generous CDP-side buffers so response bodies survive until getResponseBody.
    await targetDebugger.sendCommand('Network.enable', {
      maxTotalBufferSize: CDP_NETWORK_TOTAL_BUFFER_BYTES,
      maxResourceBufferSize: CDP_NETWORK_RESOURCE_BUFFER_BYTES,
    })
    await targetDebugger.sendCommand('Runtime.enable')
    await targetDebugger.sendCommand('Page.enable')
    // Debugger.enable only feeds the script lane (sourcemap harvest); skipAllPauses
    // guards against `debugger;` statements freezing the live target.
    await targetDebugger.sendCommand('Debugger.enable')
    await targetDebugger.sendCommand('Debugger.setSkipAllPauses', { skip: true })
  }

  /** Inject the page agent: future documents via lifecycle hook, current one by hand. */
  private async installPageAgent(): Promise<void> {
    const targetDebugger = this.target.debugger
    await targetDebugger.sendCommand('Runtime.addBinding', { name: AGENT_BINDING_NAME })
    await targetDebugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: this.agentSource,
    })
    // The attach happens after dom-ready, so the current document needs a one-off inject.
    await targetDebugger.sendCommand('Runtime.evaluate', {
      expression: this.agentSource,
      silent: true,
    })
  }

  /** Validate an agent binding call — the recorded page is hostile and can call it directly. */
  private onBindingCalled(params: { name?: string; payload?: string }): void {
    if (params.name !== AGENT_BINDING_NAME || typeof params.payload !== 'string') return
    if (params.payload.length > AGENT_MESSAGE_MAX_BYTES) return
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(params.payload)
    } catch {
      return
    }
    const message = agentMessageSchema.safeParse(parsedJson)
    if (!message.success) return
    this.callbacks.onAgentEvent(message.data)
  }

  /** Stamp + spool + notify — the single write path for every lane event. */
  private record(lane: Lane, payload: unknown): void {
    if (this.isDisposed) return
    const event = this.sequencer.stamp(lane, payload)
    this.spoolLanes.append(event)
    this.callbacks.onLaneEvent(event)
  }

  // CDP params arrive untyped from Electron; each handler casts once at this boundary.
  private handleCdpEvent(method: string, params: Record<string, unknown>): void {
    if (this.isDisposed) return

    const liveSummary = summarizeForLiveLog(method, params)
    if (liveSummary && !this.appWindow.isDestroyed()) {
      this.appWindow.send(PUSH.cdpEvent, liveSummary)
    }

    if (method === 'Network.requestWillBeSent') {
      this.onRequestWillBeSent(
        params as {
          requestId?: string
          type?: string
          redirectResponse?: CdpResponseSummary
          request?: {
            url?: string
            method?: string
            headers?: Record<string, string>
            postData?: string
          }
        },
      )
    } else if (method === 'Network.responseReceived') {
      const typed = params as { requestId?: string; response?: CdpResponseSummary }
      if (typeof typed.requestId === 'string' && typed.response) {
        this.recordResponse(typed.requestId, typed.response, false)
      }
    } else if (method === 'Network.loadingFinished') {
      const typed = params as { requestId?: string; encodedDataLength?: number }
      if (typeof typed.requestId === 'string') {
        this.record('network', {
          phase: 'finished',
          requestId: typed.requestId,
          encodedBytes: typed.encodedDataLength,
        })
        void this.captureResponseBody(typed.requestId)
      }
    } else if (method === 'Network.loadingFailed') {
      const typed = params as { requestId?: string; errorText?: string; canceled?: boolean }
      if (typeof typed.requestId === 'string') {
        this.record('network', {
          phase: 'failed',
          requestId: typed.requestId,
          errorText: typed.errorText,
          canceled: Boolean(typed.canceled),
        })
      }
    } else if (method === 'Runtime.consoleAPICalled') {
      this.onConsoleApiCalled(
        params as { type?: string; args?: CdpRemoteObject[]; stackTrace?: CdpStackTrace },
      )
    } else if (method === 'Runtime.exceptionThrown') {
      this.onExceptionThrown(
        params as {
          exceptionDetails?: {
            text?: string
            url?: string
            lineNumber?: number
            columnNumber?: number
            exception?: CdpRemoteObject
            stackTrace?: CdpStackTrace
          }
        },
      )
    } else if (method === 'Runtime.bindingCalled') {
      this.onBindingCalled(params as { name?: string; payload?: string })
    } else if (method === 'Page.frameNavigated') {
      this.onFrameNavigated(params as { frame?: { url?: string; parentId?: string } })
    } else if (method === 'Page.loadEventFired') {
      this.record('page', { kind: 'load' })
    } else if (method === 'Page.domContentEventFired') {
      this.record('page', { kind: 'domcontentloaded' })
    } else if (method === 'Debugger.scriptParsed') {
      this.onScriptParsed(
        params as {
          scriptId?: string
          url?: string
          sourceMapURL?: string
          hash?: string
          isModule?: boolean
        },
      )
    }
  }

  private onRequestWillBeSent(params: {
    requestId?: string
    type?: string
    redirectResponse?: CdpResponseSummary
    request?: { url?: string; method?: string; headers?: Record<string, string>; postData?: string }
  }): void {
    if (typeof params.requestId !== 'string' || !params.request) return
    // A redirect hop reuses the requestId — record the redirecting response first.
    if (params.redirectResponse) {
      this.recordResponse(params.requestId, params.redirectResponse, true)
    }
    const { redacted } = redactHeaders(params.request.headers ?? {}, 'request')
    const postDataHash =
      params.request.postData !== undefined
        ? this.blobs.put(Buffer.from(params.request.postData, 'utf8'))
        : undefined
    this.record('network', {
      phase: 'request',
      requestId: params.requestId,
      url: params.request.url,
      method: params.request.method,
      headers: redacted,
      resourceType: params.type,
      postDataHash,
    })
  }

  private recordResponse(
    requestId: string,
    response: CdpResponseSummary,
    didRedirect: boolean,
  ): void {
    const { redacted, enclaveEntries } = redactHeaders(response.headers ?? {}, 'response')
    for (const entry of enclaveEntries) {
      // Mode B needs real Set-Cookie values; humans/export never see them (decision 32).
      this.enclave.appendLine({
        kind: 'response-header',
        requestId,
        header: entry.header,
        value: entry.value,
        tMono: this.sequencer.nowMono(),
      })
    }
    this.record('network', {
      phase: 'response',
      requestId,
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      mimeType: response.mimeType,
      headers: redacted,
      fromDiskCache: response.fromDiskCache,
      didRedirect: didRedirect || undefined,
    })
  }

  /** Pull the finished body into the blob store (Mode B serves requests from these). */
  private async captureResponseBody(requestId: string): Promise<void> {
    try {
      const result = (await this.target.debugger.sendCommand('Network.getResponseBody', {
        requestId,
      })) as { body: string; base64Encoded: boolean }
      const bytes = result.base64Encoded
        ? Buffer.from(result.body, 'base64')
        : Buffer.from(result.body, 'utf8')
      if (bytes.byteLength > NETWORK_BODY_MAX_BYTES) {
        this.record('network', {
          phase: 'body',
          requestId,
          dropped: true,
          bodySize: bytes.byteLength,
        })
        return
      }
      this.record('network', {
        phase: 'body',
        requestId,
        bodyHash: this.blobs.put(bytes),
        bodySize: bytes.byteLength,
        base64Encoded: result.base64Encoded,
      })
    } catch {
      // Body unavailable (204/redirect/cleared buffer) — record the miss so Mode B knows honestly.
      this.record('network', { phase: 'body', requestId, dropped: true, bodySize: 0 })
    }
  }

  private onConsoleApiCalled(params: {
    type?: string
    args?: CdpRemoteObject[]
    stackTrace?: CdpStackTrace
  }): void {
    this.record('console', {
      type: params.type ?? 'log',
      args: (params.args ?? []).map(previewRemoteObject),
      stack: toAnchorFrames(params.stackTrace),
    })
  }

  private onExceptionThrown(params: {
    exceptionDetails?: {
      text?: string
      url?: string
      lineNumber?: number
      columnNumber?: number
      exception?: CdpRemoteObject
      stackTrace?: CdpStackTrace
    }
  }): void {
    const details = params.exceptionDetails
    this.record('error', {
      message: details?.exception?.description ?? details?.text ?? 'exception',
      url: details?.url,
      lineNumber: details?.lineNumber,
      columnNumber: details?.columnNumber,
      stack: toAnchorFrames(details?.stackTrace),
    })
  }

  private onFrameNavigated(params: { frame?: { url?: string; parentId?: string } }): void {
    // Sub-frame navigations are noise for the page lane; only the top frame counts.
    if (!params.frame || params.frame.parentId) return
    const url = params.frame.url ?? ''
    this.topFrameUrl = url
    this.record('page', { kind: 'navigated', url })
    // skipAllPauses can reset across navigations — re-arm so `debugger;` never freezes the target.
    void this.target.debugger.sendCommand('Debugger.setSkipAllPauses', { skip: true }).catch(() => {})
    this.callbacks.onTopFrameNavigated(url)
  }

  private onScriptParsed(params: {
    scriptId?: string
    url?: string
    sourceMapURL?: string
    hash?: string
    isModule?: boolean
  }): void {
    // Anonymous eval scripts carry no replay identity — skip to keep the lane lean.
    if (!params.url && !params.sourceMapURL) return
    // Dev bundlers often inline whole sourcemaps as data: URIs (megabytes) — blob those.
    let sourceMap: { kind: 'url'; url: string } | { kind: 'blob'; bodyHash: string } | undefined
    if (params.sourceMapURL) {
      sourceMap = params.sourceMapURL.startsWith('data:')
        ? { kind: 'blob', bodyHash: this.blobs.put(Buffer.from(params.sourceMapURL, 'utf8')) }
        : { kind: 'url', url: params.sourceMapURL }
    }
    this.record('script', {
      scriptId: params.scriptId,
      url: params.url,
      sourceMap,
      hash: params.hash,
      isModule: params.isModule,
    })
  }
}

/** Trim a CDP stack trace to the top frames the highlight anchors need. */
function toAnchorFrames(stackTrace?: CdpStackTrace): AnchorFrame[] | undefined {
  const frames = stackTrace?.callFrames
  if (!frames || frames.length === 0) return undefined
  return frames.slice(0, ANCHOR_STACK_FRAMES_MAX).map((frame) => ({
    functionName: frame.functionName ?? '',
    url: frame.url ?? '',
    lineNumber: frame.lineNumber ?? 0,
    columnNumber: frame.columnNumber ?? 0,
  }))
}

/**
 * Flatten a CDP RemoteObject into a transcript-safe preview value.
 * @param arg - remote object from Runtime.consoleAPICalled
 * @returns
 * - JSON-safe primitive: the value itself (strings truncated)
 * - anything else: its description string, truncated
 * @example previewRemoteObject({ type: 'number', value: 42 }) // => 42
 */
function previewRemoteObject(arg: CdpRemoteObject): string | number | boolean | null {
  const raw = arg.value !== undefined ? arg.value : (arg.unserializableValue ?? arg.description)
  if (raw === null) return null
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw
  if (typeof raw === 'string') return raw.slice(0, CONSOLE_ARG_PREVIEW_MAX_CHARS)
  try {
    return JSON.stringify(raw).slice(0, CONSOLE_ARG_PREVIEW_MAX_CHARS)
  } catch {
    return String(arg.type ?? 'unknown')
  }
}

/** Turn a raw CDP event into the one-line summary the renderer live log shows (P0 behavior kept). */
function summarizeForLiveLog(
  method: string,
  params: Record<string, unknown>,
): CdpEventSummary | null {
  const ts = Date.now()
  if (method === 'Network.requestWillBeSent') {
    const req = params.request as { method?: string; url?: string } | undefined
    return { ts, domain: 'Network', method, kind: 'network', summary: `→ ${req?.method ?? ''} ${req?.url ?? ''}` }
  }
  if (method === 'Network.responseReceived') {
    const res = params.response as { status?: number; url?: string } | undefined
    return { ts, domain: 'Network', method, kind: 'network', summary: `← ${res?.status ?? ''} ${res?.url ?? ''}` }
  }
  if (method === 'Runtime.consoleAPICalled') {
    const type = String(params.type ?? 'log')
    const args = (params.args as Array<{ value?: unknown; description?: string }> | undefined) ?? []
    const text = args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)
    return { ts, domain: 'Runtime', method, kind: type === 'error' ? 'error' : 'console', summary: `console.${type}: ${text}` }
  }
  if (method === 'Runtime.exceptionThrown') {
    const details = params.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined
    const text = details?.exception?.description ?? details?.text ?? 'exception'
    return { ts, domain: 'Runtime', method, kind: 'error', summary: text.split('\n')[0]?.slice(0, 200) ?? 'exception' }
  }
  if (method === 'Page.frameNavigated') {
    const frame = params.frame as { url?: string; parentId?: string } | undefined
    if (frame?.parentId) return null // only top-frame navigations are interesting in the log
    return { ts, domain: 'Page', method, kind: 'page', summary: `navigated: ${frame?.url ?? ''}` }
  }
  return null
}

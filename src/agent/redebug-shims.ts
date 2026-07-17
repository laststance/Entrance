/**
 * Mode B determinism shims (spec decision 3 of the core architecture): injected
 * via Page.addScriptToEvaluateOnNewDocument into the hidden re-execution
 * webContents BEFORE any page script. Pins wall clock + Math.random, seeds
 * storage from the recording's snapshot, and blocks service workers.
 * `__ENTRANCE_REDEBUG_CONFIG__` is replaced with JSON by RedebugSession.
 */

interface RedebugShimConfig {
  /** Recording start wall-clock ms — Date.now() resumes from here. */
  t0Wall: number
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  randomSeed: number
}

;(() => {
  const config: RedebugShimConfig = '__ENTRANCE_REDEBUG_CONFIG__' as unknown as RedebugShimConfig
  const globalScope = window as typeof window & { __entranceRedebugShimmed?: boolean }
  // addScriptToEvaluateOnNewDocument can fire once per frame — shim once.
  if (globalScope.__entranceRedebugShimmed) return
  globalScope.__entranceRedebugShimmed = true

  // Storage seed (decision 28: ephemeral partition starts from the snapshot).
  // Top frame only: this shim runs once per frame, and seeding the TARGET's
  // snapshot into an iframe would write it into that frame's own (possibly
  // cross-origin) storage. Clock/random/socket shims stay active in all frames.
  if (window === window.top) {
    try {
      for (const [key, value] of Object.entries(config.localStorage))
        localStorage.setItem(key, value)
    } catch {
      /* opaque origin — nothing to seed */
    }
    try {
      for (const [key, value] of Object.entries(config.sessionStorage))
        sessionStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  }

  // Wall clock pin: "now" restarts at the recording's t0 and advances with real time.
  const RealDate = Date
  const wallOffset = config.t0Wall - RealDate.now()
  const ShimmedDate = new Proxy(RealDate, {
    construct(target, args: unknown[]) {
      if (args.length === 0) return new target(RealDate.now() + wallOffset)
      return Reflect.construct(target, args)
    },
    get(target, property, receiver) {
      if (property === 'now') return () => RealDate.now() + wallOffset
      return Reflect.get(target, property, receiver)
    },
    apply() {
      // Legacy `Date()` string call.
      return new RealDate(RealDate.now() + wallOffset).toString()
    },
  })
  Object.defineProperty(window, 'Date', { value: ShimmedDate, configurable: true, writable: true })

  // Deterministic Math.random (mulberry32) — same seed every re-execution.
  let randomState = config.randomSeed >>> 0
  Math.random = () => {
    randomState = (randomState + 0x6d2b79f5) >>> 0
    let mixed = randomState
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }

  // Service workers would serve stale caches from outside the recording (decision 28).
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register = () =>
      Promise.reject(new Error('entrance: service workers are disabled during re-execution'))
  }

  // The document IS served from local recorded data — report it as cache-served
  // (transferSize 0). Next.js dev then restores its React debug channel from
  // the seeded sessionStorage (`__next_debug_channel:*`) instead of parking
  // hydration forever on HMR-websocket debug chunks that can never arrive.
  const nativeGetEntriesByType = Performance.prototype.getEntriesByType
  Performance.prototype.getEntriesByType = function (type: string) {
    const entries = nativeGetEntriesByType.call(this, type)
    if (type !== 'navigation') return entries
    return entries.map(
      (entry) =>
        new Proxy(entry, {
          get(target, property) {
            if (property === 'transferSize') return 0
            const value = Reflect.get(target, property)
            return typeof value === 'function' ? value.bind(target) : value
          },
        }),
    )
  }

  // Dev-server HMR sockets are blocked at the session level (live code pushes
  // would break determinism) — but Next's HMR client reconnects forever and
  // reloads the page after enough failures. Hand it a fake socket that opens,
  // replays the server's hello sequence, and then stays silent.
  const NativeWebSocket = window.WebSocket
  const HMR_PATHNAME = '/_next/webpack-hmr'
  const isHmrUrl = (url: string | URL): boolean => {
    try {
      return new URL(String(url), location.href).pathname === HMR_PATHNAME
    } catch {
      return false
    }
  }
  let activeHmrSocket: FakeHmrSocket | null = null
  class FakeHmrSocket extends EventTarget {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3
    readonly CONNECTING = 0
    readonly OPEN = 1
    readonly CLOSING = 2
    readonly CLOSED = 3
    url: string
    readyState = 0
    binaryType = 'blob'
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    onclose: ((event: Event) => void) | null = null

    constructor(url: string | URL) {
      super()
      this.url = String(url)
      // Mirrors a real Next dev server's on-connect message sequence.
      const serverHello = [
        { type: 'isrManifest', data: { [location.pathname]: true } },
        { type: 'turbopack-connected', data: { sessionId: 1 } },
        {
          type: 'sync',
          errors: [],
          warnings: [],
          hash: '',
          versionInfo: { staleness: 'fresh' },
          debug: {},
          devIndicator: { disabledUntil: 0 },
          devToolsConfig: {},
        },
      ]
      setTimeout(() => {
        this.readyState = 1
        const openEvent = new Event('open')
        this.onopen?.(openEvent)
        this.dispatchEvent(openEvent)
        for (const message of serverHello) {
          const messageEvent = new MessageEvent('message', { data: JSON.stringify(message) })
          this.onmessage?.(messageEvent)
          this.dispatchEvent(messageEvent)
        }
      }, 0)
    }

    send(): void {}
    close(): void {
      this.readyState = 3
    }

    /**
     * Delivers the dev server's end-of-debug-stream signal: a chunk-less
     * REACT_DEBUG_CHUNK binary frame ([type 0][idLength u8][id utf8]) closes
     * that request's debug-channel writer (hot-reloader-app.js). Without it,
     * a client-side navigation's flight parse parks forever awaiting debug
     * chunks the faked socket can never produce.
     * @param requestId - value of the nav fetch's x-nextjs-request-id header
     */
    deliverDebugChannelClose(requestId: string): void {
      const requestIdBytes = new TextEncoder().encode(requestId)
      const frame = new Uint8Array(2 + requestIdBytes.length)
      frame[0] = 0 // HMR_MESSAGE_SENT_TO_BROWSER.REACT_DEBUG_CHUNK
      frame[1] = requestIdBytes.length
      frame.set(requestIdBytes, 2)
      setTimeout(() => {
        const messageEvent = new MessageEvent('message', { data: frame.buffer })
        this.onmessage?.(messageEvent)
        this.dispatchEvent(messageEvent)
      }, 0)
    }
  }
  const PatchedWebSocket = new Proxy(NativeWebSocket, {
    construct(target, args: [string | URL, (string | string[])?]) {
      if (isHmrUrl(args[0])) {
        activeHmrSocket = new FakeHmrSocket(args[0])
        return activeHmrSocket
      }
      return Reflect.construct(target, args)
    },
  })
  Object.defineProperty(window, 'WebSocket', {
    value: PatchedWebSocket,
    configurable: true,
    writable: true,
  })

  // Next tags every RSC nav fetch with x-nextjs-request-id and expects that
  // request's debug chunks over the HMR socket — sniff the id here and close
  // its debug channel right away (see deliverDebugChannelClose).
  const REQUEST_ID_HEADER = 'x-nextjs-request-id'
  const readRequestIdHeader = (input: RequestInfo | URL, init?: RequestInit): string | null => {
    const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined)
    if (!headers) return null
    if (headers instanceof Headers) return headers.get(REQUEST_ID_HEADER)
    const entries = Array.isArray(headers) ? headers : Object.entries(headers)
    for (const [name, value] of entries) {
      if (name.toLowerCase() === REQUEST_ID_HEADER) return String(value)
    }
    return null
  }
  const nativeFetch = window.fetch
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const requestId = readRequestIdHeader(input, init)
    if (requestId) activeHmrSocket?.deliverDebugChannelClose(requestId)
    return nativeFetch.call(this, input, init)
  }
})()

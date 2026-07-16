import { z } from 'zod'

/**
 * Control-plane IPC contract shared by main/preload/renderer (spec decision 12).
 * Why: every invoke handler must .parse() its payload so a compromised renderer
 * can never hand malformed data to privileged code; imported by src/main/ipc.ts
 * handlers and the typed preload bridge.
 */

/** Frameworks Entrance can fingerprint on a local dev server (spec decision 11). */
export const frameworkSchema = z.enum(['nextjs', 'vite', 'storybook', 'unknown'])
export type Framework = z.infer<typeof frameworkSchema>

/** Next.js dev-bundler variant — webpack and Turbopack serve different sourcemap shapes (spec decision 4). */
export const bundlerVariantSchema = z.enum(['webpack', 'turbopack'])
export type BundlerVariant = z.infer<typeof bundlerVariantSchema>

/** One dev server found by the localhost probe, as listed on screen 1f. */
export const detectedServerSchema = z.object({
  /** Canonical displayed URL, e.g. "http://localhost:3000" */
  url: z.url(),
  framework: frameworkSchema,
  variant: bundlerVariantSchema.optional(),
  /** Human label for the 1f list row, e.g. "Next.js — dev" */
  label: z.string(),
})
export type DetectedServer = z.infer<typeof detectedServerSchema>

/** Request to open a target URL in the embedded browser; must be a local http(s) origin. */
export const connectRequestSchema = z.object({
  url: z
    .url()
    .refine((u) => {
      try {
        const { protocol, hostname } = new URL(u)
        const localHosts = ['localhost', '127.0.0.1', '[::1]', '::1']
        return (protocol === 'http:' || protocol === 'https:') && localHosts.includes(hostname)
      } catch {
        return false
      }
    }, 'ローカルのdevサーバーURL(http://localhost:...)のみ接続できます'),
})
export type ConnectRequest = z.infer<typeof connectRequestSchema>

/** Renderer → main: the <webview> finished attaching; main may now attach its CDP debugger. */
export const attachRequestSchema = z.object({
  webContentsId: z.number().int().positive(),
  /** Fingerprint from the 1f detection row — travels into the recording manifest. */
  framework: frameworkSchema.optional(),
  variant: bundlerVariantSchema.optional(),
})
export type AttachRequest = z.infer<typeof attachRequestSchema>

/** Compact CDP event pushed to the renderer live log (P0 smoke; becomes the 1d live feed lane). */
export const cdpEventSummarySchema = z.object({
  /** ms since epoch, stamped at main-process receipt (canonical clock, spec decision 13) */
  ts: z.number(),
  /** CDP domain, e.g. "Network" | "Runtime" | "Log" */
  domain: z.string(),
  /** Full CDP method, e.g. "Network.responseReceived" */
  method: z.string(),
  /** One-line human summary for the log row */
  summary: z.string(),
  kind: z.enum(['network', 'console', 'error', 'page', 'other']),
})
export type CdpEventSummary = z.infer<typeof cdpEventSummarySchema>

/** Recording end reasons (mirrors shared/envelope.ts EndReason for Zod). */
export const endReasonSchema = z.enum([
  'user-stop',
  'target-crashed',
  'navigated-away',
  'app-crash-recovered',
  'quota-exceeded',
])

/** Live recording status pushed to the 1d UI every tick (spec decision 31 live counter). */
export const recStatusSchema = z.object({
  state: z.enum(['idle', 'recording']),
  recordingId: z.string().optional(),
  /** ms since Rec press (0 while idle) */
  elapsedMs: z.number(),
  /** bytes written to the live recording so far */
  bytes: z.number(),
  counts: z.object({
    click: z.number(),
    fetch: z.number(),
    console: z.number(),
    error: z.number(),
  }),
  /** backpressure signal: null=ok, 'warn'=soft threshold, hard threshold auto-stops */
  pressure: z.enum(['warn']).nullable(),
})
export type RecStatus = z.infer<typeof recStatusSchema>

export const updateRecordingMetaSchema = z.object({
  recordingId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  groupId: z.string().nullable().optional(),
})
export type UpdateRecordingMeta = z.infer<typeof updateRecordingMetaSchema>

/** Library row summary (screen 1e; P1 exposes list for save-dialog + tests). */
export interface RecordingSummary {
  id: string
  name: string
  groupId: string | null
  targetUrl: string
  createdAtWall: number
  durationMs: number
  endReason: z.infer<typeof endReasonSchema>
  totalBytes: number
}

/** invoke() channel names — single source of truth so main and preload can never drift. */
export const IPC = {
  detectServers: 'servers:detect',
  connectTarget: 'target:connect',
  attachTarget: 'target:attach',
  detachTarget: 'target:detach',
  recStart: 'rec:start',
  recStop: 'rec:stop',
  updateRecordingMeta: 'recordings:updateMeta',
  listRecordings: 'recordings:list',
} as const

/** main → renderer push channels. */
export const PUSH = {
  cdpEvent: 'cdp:event',
  targetGone: 'target:gone',
  recStatus: 'rec:status',
  recAutoStopped: 'rec:autoStopped',
} as const

/** API surface exposed on window.entrance by the preload bridge. */
export interface EntranceApi {
  detectServers: () => Promise<DetectedServer[]>
  connectTarget: (req: ConnectRequest) => Promise<{ ok: boolean; url: string; error?: string }>
  attachTarget: (req: AttachRequest) => Promise<{ ok: boolean; error?: string }>
  detachTarget: () => Promise<{ ok: boolean }>
  recStart: () => Promise<{ ok: boolean; recordingId?: string; error?: string }>
  recStop: () => Promise<{ ok: boolean; recordingId?: string; name?: string; error?: string }>
  updateRecordingMeta: (req: UpdateRecordingMeta) => Promise<{ ok: boolean; error?: string }>
  listRecordings: () => Promise<RecordingSummary[]>
  onCdpEvent: (cb: (ev: CdpEventSummary) => void) => () => void
  onTargetGone: (cb: () => void) => () => void
  onRecStatus: (cb: (status: RecStatus) => void) => () => void
  onRecAutoStopped: (cb: (payload: { reason: string; recordingId: string }) => void) => () => void
}

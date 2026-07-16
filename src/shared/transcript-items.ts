import { z } from 'zod'

import type { Lane } from './envelope'
import type { ReplayLaneEvent } from './replay'

import { lastIndexAtOrBefore } from './last-index-at-or-before'

/**
 * Lane events → the 1b transcript rows (numbered event list with filter chips
 * すべて/操作/Network/エラー). Fetch rows join request+response by requestId;
 * keystroke bursts collapse to one masked input row (decision 32 — real keys
 * live in the enclave and are never displayed). Built once per loaded recording.
 */

export type TranscriptFilterGroup = 'action' | 'network' | 'error' | 'other'

export interface TranscriptItem {
  /** Stable key + canonical tiebreaker (seq of the underlying first event). */
  seq: number
  tMonoOffset: number
  kind: 'route' | 'click' | 'input' | 'fetch' | 'console' | 'error'
  /** Row heading, e.g. "fetch·200" / "console.warn" / "uncaught". */
  title: string
  /** Second line, e.g. "GET /api/export" / "#export-btn". */
  subtitle: string
  filterGroup: TranscriptFilterGroup
}

/** Keystrokes closer than this collapse into one "input" row. */
export const INPUT_BURST_GAP_MS = 1500

const pagePayloadSchema = z.looseObject({ kind: z.string(), url: z.string().optional() })
const inputPayloadSchema = z.looseObject({
  kind: z.string(),
  selector: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  keyClass: z.string().optional(),
})
const networkPayloadSchema = z.looseObject({
  phase: z.string(),
  requestId: z.string().optional(),
  url: z.string().optional(),
  method: z.string().optional(),
  resourceType: z.string().optional(),
  status: z.number().optional(),
})
const consolePayloadSchema = z.looseObject({ type: z.string().optional(), preview: z.string().optional() })
const errorPayloadSchema = z.looseObject({ message: z.string().optional() })

/**
 * Builds transcript rows from all lanes in canonical order.
 * @param lanes - per-lane envelopes (loadRecording output)
 * @param t0Mono - manifest t0; bootstrap events are excluded
 * @param startUrl - recording start URL (first route row's "from")
 * @returns rows sorted by (tMonoOffset, seq)
 * @example buildTranscriptItems(lanes, 1000, 'http://localhost:3000/')[0].title // => 'click'
 */
export function buildTranscriptItems(
  lanes: Partial<Record<Lane, ReplayLaneEvent[]>>,
  t0Mono: number,
  startUrl: string,
): TranscriptItem[] {
  const items: TranscriptItem[] = []

  // route rows: previous path → next path (mock: "/ → /dashboard")
  let previousPath = pathOf(startUrl)
  for (const event of lanes.page ?? []) {
    const payload = pagePayloadSchema.safeParse(event.payload)
    if (!payload.success || payload.data.kind !== 'navigated') continue
    const nextPath = pathOf(payload.data.url ?? '')
    if (event.tMono >= t0Mono) {
      items.push({
        seq: event.seq,
        tMonoOffset: event.tMono - t0Mono,
        kind: 'route',
        title: 'route',
        subtitle: `${previousPath} → ${nextPath}`,
        filterGroup: 'action',
      })
    }
    // Track the path even for pre-t0 navigations so the first row's "from" is right.
    previousPath = nextPath
  }

  // click rows + keystroke bursts
  let burstStart: ReplayLaneEvent | null = null
  let burstCount = 0
  let burstLastTMono = 0
  const flushBurst = (): void => {
    if (!burstStart) return
    items.push({
      seq: burstStart.seq,
      tMonoOffset: burstStart.tMono - t0Mono,
      kind: 'input',
      title: 'input',
      subtitle: `キー入力 ×${burstCount}(伏字)`,
      filterGroup: 'action',
    })
    burstStart = null
    burstCount = 0
  }
  for (const event of lanes.input ?? []) {
    if (event.tMono < t0Mono) continue
    const payload = inputPayloadSchema.safeParse(event.payload)
    if (!payload.success) continue
    if (payload.data.kind === 'key') {
      if (burstStart && event.tMono - burstLastTMono > INPUT_BURST_GAP_MS) flushBurst()
      if (!burstStart) burstStart = event
      burstCount += 1
      burstLastTMono = event.tMono
      continue
    }
    if (payload.data.kind === 'click') {
      flushBurst()
      const point = `(${Math.round(payload.data.x ?? 0)}, ${Math.round(payload.data.y ?? 0)})`
      items.push({
        seq: event.seq,
        tMonoOffset: event.tMono - t0Mono,
        kind: 'click',
        title: 'click',
        subtitle: payload.data.selector || point,
        filterGroup: 'action',
      })
    }
  }
  flushBurst()

  // fetch rows: app data requests joined with their response status by requestId
  const statusByRequestId = new Map<string, number | 'failed'>()
  for (const event of lanes.network ?? []) {
    const payload = networkPayloadSchema.safeParse(event.payload)
    if (!payload.success || !payload.data.requestId) continue
    if (payload.data.phase === 'response' && typeof payload.data.status === 'number') {
      statusByRequestId.set(payload.data.requestId, payload.data.status)
    } else if (payload.data.phase === 'failed' && !statusByRequestId.has(payload.data.requestId)) {
      statusByRequestId.set(payload.data.requestId, 'failed')
    }
  }
  for (const event of lanes.network ?? []) {
    if (event.tMono < t0Mono) continue
    const payload = networkPayloadSchema.safeParse(event.payload)
    if (!payload.success || payload.data.phase !== 'request') continue
    const isFetchApi = payload.data.resourceType === 'XHR' || payload.data.resourceType === 'Fetch'
    if (!isFetchApi) continue
    const status = payload.data.requestId ? statusByRequestId.get(payload.data.requestId) : undefined
    items.push({
      seq: event.seq,
      tMonoOffset: event.tMono - t0Mono,
      kind: 'fetch',
      title: `fetch·${status ?? 'pending'}`,
      subtitle: `${payload.data.method ?? 'GET'} ${pathOf(payload.data.url ?? '')}`,
      filterGroup: 'network',
    })
  }

  // console + uncaught rows
  for (const event of lanes.console ?? []) {
    if (event.tMono < t0Mono) continue
    const payload = consolePayloadSchema.safeParse(event.payload)
    const consoleType = payload.success ? (payload.data.type ?? 'log') : 'log'
    const isError = consoleType === 'error'
    items.push({
      seq: event.seq,
      tMonoOffset: event.tMono - t0Mono,
      kind: isError ? 'error' : 'console',
      title: `console.${consoleType === 'warning' ? 'warn' : consoleType}`,
      subtitle: payload.success ? (payload.data.preview ?? '') : '',
      filterGroup: isError ? 'error' : 'other',
    })
  }
  for (const event of lanes.error ?? []) {
    if (event.tMono < t0Mono) continue
    const payload = errorPayloadSchema.safeParse(event.payload)
    items.push({
      seq: event.seq,
      tMonoOffset: event.tMono - t0Mono,
      kind: 'error',
      title: 'uncaught',
      subtitle: payload.success ? (payload.data.message ?? '') : '',
      filterGroup: 'error',
    })
  }

  return items.sort((a, b) => a.tMonoOffset - b.tMonoOffset || a.seq - b.seq)
}

/**
 * Index of the transcript row the playhead is on (last row at/before the
 * position) — drives the 1b current-row highlight and follow-scroll.
 * @param items - buildTranscriptItems output
 * @param tMonoOffsetMs - playhead position
 * @returns row index, or -1 before the first row
 * @example transcriptIndexAt(items, 12_400) // => 5
 */
export function transcriptIndexAt(items: TranscriptItem[], tMonoOffsetMs: number): number {
  return lastIndexAtOrBefore(
    items.map((item) => item.tMonoOffset),
    tMonoOffsetMs,
  )
}

/** "/dashboard?x=1" from an absolute URL; falls back to the raw string. */
function pathOf(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.pathname}${url.search}`
  } catch {
    return rawUrl || '/'
  }
}

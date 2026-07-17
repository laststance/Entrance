import { z } from 'zod'

import type { ReplayLaneEvent } from '@shared/replay'

/**
 * Mode B network matcher (decision 29): every request the re-executing page
 * makes is answered from the recording — keyed on method + normalized URL,
 * consumed in recorded order per key (ordinals disambiguate repeated polls).
 * A miss is a divergence signal, never a live network fallback.
 */

export interface RecordedExchange {
  requestId: string
  method: string
  url: string
  status: number
  mimeType?: string
  /** Response headers as recorded (redacted set — auth values live in the enclave). */
  headers: Record<string, string>
  bodyHash?: string
  base64Encoded?: boolean
  /** Body was dropped at record time (size cap / unavailable) — fulfill empty, flag honestly. */
  bodyDropped: boolean
}

const requestPayloadSchema = z.looseObject({
  phase: z.literal('request'),
  requestId: z.string(),
  url: z.string(),
  method: z.string(),
})
const responsePayloadSchema = z.looseObject({
  phase: z.literal('response'),
  requestId: z.string(),
  url: z.string().optional(),
  status: z.number(),
  mimeType: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
})
const bodyPayloadSchema = z.looseObject({
  phase: z.literal('body'),
  requestId: z.string(),
  bodyHash: z.string().optional(),
  base64Encoded: z.boolean().optional(),
  dropped: z.boolean().optional(),
})

/** Strip fragment + trailing slash noise so record/replay URLs compare stably. */
export function normalizeMatchUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    url.hash = ''
    // Next.js RSC cache-buster: a hash of the router-state request headers,
    // so any record/replay state drift changes it while the response still
    // matches — and a miss makes the router hard-navigate (fetch-server-
    // response.js "Falling back to browser navigation") onto chrome-error://.
    url.searchParams.delete('_rsc')
    return url.toString()
  } catch {
    return rawUrl
  }
}

const matchKey = (method: string, url: string): string =>
  `${method.toUpperCase()} ${normalizeMatchUrl(url)}`

export class NetworkMatcher {
  /** FIFO per key — recorded order is the ordinal (decision 29). */
  private readonly queues = new Map<string, RecordedExchange[]>()

  /**
   * Indexes a recording's network lane into match queues.
   * @param networkLane - canonical-order network lane events
   * @example const matcher = new NetworkMatcher(lanes.network ?? [])
   */
  constructor(networkLane: ReplayLaneEvent[]) {
    const exchangeByRequestId = new Map<string, RecordedExchange>()
    for (const event of networkLane) {
      const request = requestPayloadSchema.safeParse(event.payload)
      if (request.success) {
        const exchange: RecordedExchange = {
          requestId: request.data.requestId,
          method: request.data.method,
          url: request.data.url,
          status: 0,
          headers: {},
          bodyDropped: false,
        }
        // Redirect hops reuse the requestId; the final response wins (v1 fulfills the end state).
        exchangeByRequestId.set(request.data.requestId, exchange)
        const key = matchKey(exchange.method, exchange.url)
        const queue = this.queues.get(key)
        if (queue) queue.push(exchange)
        else this.queues.set(key, [exchange])
        continue
      }
      const response = responsePayloadSchema.safeParse(event.payload)
      if (response.success) {
        const exchange = exchangeByRequestId.get(response.data.requestId)
        if (exchange) {
          exchange.status = response.data.status
          exchange.mimeType = response.data.mimeType
          exchange.headers = response.data.headers ?? {}
        }
        continue
      }
      const body = bodyPayloadSchema.safeParse(event.payload)
      if (body.success) {
        const exchange = exchangeByRequestId.get(body.data.requestId)
        if (exchange) {
          exchange.bodyHash = body.data.bodyHash
          exchange.base64Encoded = body.data.base64Encoded
          exchange.bodyDropped = Boolean(body.data.dropped)
        }
      }
    }
    // Requests that never got a response can't be fulfilled — drop them from queues.
    for (const [key, queue] of this.queues) {
      const answerable = queue.filter((exchange) => exchange.status > 0)
      if (answerable.length === 0) this.queues.delete(key)
      else this.queues.set(key, answerable)
    }
  }

  /**
   * Answers one live request from the recording (consuming its ordinal).
   * @param method - live request method
   * @param url - live request URL
   * @returns
   * - the next recorded exchange for that key
   * - null on a miss (divergence — caller fails the request and flags it)
   * @example matcher.match('GET', 'http://localhost:3000/api/notes')
   */
  match(method: string, url: string): RecordedExchange | null {
    const queue = this.queues.get(matchKey(method, url))
    if (!queue || queue.length === 0) return null
    return queue.shift() ?? null
  }

  /**
   * Non-consuming answerability check — RedebugSession verifies the bootstrap
   * Document exists before opening the hidden window (honest fail otherwise).
   * @example matcher.has('GET', manifest.targetUrl)
   */
  has(method: string, url: string): boolean {
    return (this.queues.get(matchKey(method, url))?.length ?? 0) > 0
  }
}

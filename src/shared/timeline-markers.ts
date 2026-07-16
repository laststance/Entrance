import { z } from 'zod'

import type { Lane } from './envelope'
import type { ReplayLaneEvent } from './replay'

/**
 * Lane events → colored timeline dots (mock 1a bottom multi-lane timeline /
 * 1c legend: 操作・fetch・console・エラー・route). Marker rules mirror the
 * HUD/card tally so every count chip has matching dots. Built once per loaded
 * recording; consumed by the Canvas timeline and (slice D) the transcript.
 */

export type TimelineMarkerKind = 'click' | 'fetch' | 'console' | 'error' | 'route'

export interface TimelineMarker {
  /** ms since t0 on the canonical clock */
  tMonoOffset: number
  kind: TimelineMarkerKind
  /** Cross-lane stable ordering key (canonical order tiebreaker). */
  seq: number
}

const markerPayloadSchema = z
  .looseObject({
    phase: z.string().optional(),
    resourceType: z.string().optional(),
    type: z.string().optional(),
    kind: z.string().optional(),
  })
  .optional()

/**
 * Extracts recording-window markers from all lanes in canonical order.
 * @param lanes - per-lane envelopes (loadRecording output)
 * @param t0Mono - manifest t0; earlier (bootstrap) events never appear on the timeline
 * @returns markers sorted by (tMonoOffset, seq)
 * @example buildTimelineMarkers({ input: [...] }, 1000)[0] // => { tMonoOffset: 120, kind: 'click', seq: 3 }
 */
export function buildTimelineMarkers(
  lanes: Partial<Record<Lane, ReplayLaneEvent[]>>,
  t0Mono: number,
): TimelineMarker[] {
  const markers: TimelineMarker[] = []
  const push = (event: ReplayLaneEvent, kind: TimelineMarkerKind): void => {
    markers.push({ tMonoOffset: event.tMono - t0Mono, kind, seq: event.seq })
  }

  for (const event of lanes.input ?? []) {
    if (event.tMono < t0Mono) continue
    if (markerPayloadSchema.parse(event.payload)?.kind === 'click') push(event, 'click')
  }
  for (const event of lanes.network ?? []) {
    if (event.tMono < t0Mono) continue
    const payload = markerPayloadSchema.parse(event.payload)
    const isFetchApi = payload?.resourceType === 'XHR' || payload?.resourceType === 'Fetch'
    if (payload?.phase === 'request' && isFetchApi) push(event, 'fetch')
  }
  for (const event of lanes.console ?? []) {
    if (event.tMono < t0Mono) continue
    push(event, markerPayloadSchema.parse(event.payload)?.type === 'error' ? 'error' : 'console')
  }
  for (const event of lanes.error ?? []) {
    if (event.tMono >= t0Mono) push(event, 'error')
  }
  for (const event of lanes.page ?? []) {
    if (event.tMono < t0Mono) continue
    if (markerPayloadSchema.parse(event.payload)?.kind === 'navigated') push(event, 'route')
  }

  return markers.sort((a, b) => a.tMonoOffset - b.tMonoOffset || a.seq - b.seq)
}

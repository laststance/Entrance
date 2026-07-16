import { z } from 'zod'

import type { ReplayLaneEvent } from './replay'

/**
 * Bidirectional mapping between the canonical recording clock (tMono offsets
 * from t0) and the rrweb replayer's own clock (offsets from its first event's
 * wall timestamp). Spec decision 13 forbids comparing the clocks directly, so
 * seeking goes through anchor pairs sampled at every rrweb event. Built once
 * per loaded recording; used by the transport bar and the timeline.
 */

export interface RrwebTimeAnchor {
  /** ms since t0 on the canonical main-process clock */
  tMonoOffset: number
  /** ms since the first rrweb event on the replayer clock */
  rrwebOffset: number
}

const rrwebTimestampSchema = z.looseObject({ timestamp: z.number() })

/**
 * Extracts (tMono, rrweb timestamp) anchor pairs from the rrweb lane.
 * @param rrwebLane - rrweb lane envelopes in canonical order
 * @param t0Mono - manifest t0 (Rec press) on the canonical clock
 * @returns anchors ordered by tMonoOffset; [] when the lane is empty/garbled
 * @example buildRrwebTimeMap(lane, 1000)[0] // => { tMonoOffset: 12, rrwebOffset: 0 }
 */
export function buildRrwebTimeMap(rrwebLane: ReplayLaneEvent[], t0Mono: number): RrwebTimeAnchor[] {
  const anchors: RrwebTimeAnchor[] = []
  let firstTimestamp: number | null = null
  for (const event of rrwebLane) {
    const payload = rrwebTimestampSchema.safeParse(event.payload)
    if (!payload.success) continue
    if (firstTimestamp === null) firstTimestamp = payload.data.timestamp
    anchors.push({
      tMonoOffset: event.tMono - t0Mono,
      rrwebOffset: payload.data.timestamp - firstTimestamp,
    })
  }
  return anchors
}

/**
 * Canonical-clock seek position → rrweb replayer offset, interpolating past
 * the nearest anchor at/before the position (clamped to the lane's range).
 * @param anchors - buildRrwebTimeMap output (non-empty)
 * @param tMonoOffset - target position, ms since t0
 * @returns rrweb offset to hand to Replayer.play/pause
 * @example toRrwebOffset(anchors, 12_400) // => 12_388
 */
export function toRrwebOffset(anchors: RrwebTimeAnchor[], tMonoOffset: number): number {
  if (anchors.length === 0) return 0
  const anchor = anchorAtOrBefore(anchors, tMonoOffset, (a) => a.tMonoOffset)
  if (anchor === null) return 0
  const last = anchors[anchors.length - 1]
  const interpolated = anchor.rrwebOffset + (tMonoOffset - anchor.tMonoOffset)
  return Math.max(0, Math.min(interpolated, last.rrwebOffset))
}

/**
 * rrweb replayer clock → canonical clock (playhead display during playback).
 * @param anchors - buildRrwebTimeMap output (non-empty)
 * @param rrwebOffset - Replayer.getCurrentTime() value
 * @returns ms since t0 on the canonical clock
 * @example toTMonoOffset(anchors, 12_388) // => 12_400
 */
export function toTMonoOffset(anchors: RrwebTimeAnchor[], rrwebOffset: number): number {
  if (anchors.length === 0) return 0
  const anchor = anchorAtOrBefore(anchors, rrwebOffset, (a) => a.rrwebOffset)
  if (anchor === null) return anchors[0].tMonoOffset
  return anchor.tMonoOffset + (rrwebOffset - anchor.rrwebOffset)
}

/** Binary search: last anchor whose key is ≤ target, or null when target precedes all. */
function anchorAtOrBefore(
  anchors: RrwebTimeAnchor[],
  target: number,
  keyOf: (anchor: RrwebTimeAnchor) => number,
): RrwebTimeAnchor | null {
  let low = 0
  let high = anchors.length - 1
  let found: RrwebTimeAnchor | null = null
  while (low <= high) {
    const mid = (low + high) >> 1
    if (keyOf(anchors[mid]) <= target) {
      found = anchors[mid]
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

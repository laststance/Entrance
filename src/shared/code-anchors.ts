import { z } from 'zod'

import type { Lane } from './envelope'
import type { ReplayLaneEvent } from './replay'

import { lastIndexAtOrBefore } from './last-index-at-or-before'

/**
 * Line-exact highlight anchors (decision 3): console/error lane events carry a
 * CDP stack — the code panel jumps to the anchor's frame when the playhead
 * passes one. Built once per loaded recording by ReplayScreen.
 */

/** One CDP call frame as recorded on console/error payloads (0-based line/column). */
export interface CodeFrame {
  functionName: string
  url: string
  lineNumber: number
  columnNumber: number
}

export interface CodeAnchor {
  seq: number
  tMonoOffset: number
  kind: 'console' | 'error'
  /** Row heading shown in the code panel header, e.g. "console.warn" / "uncaught". */
  label: string
  /** Top-first call frames; the panel resolves the first app-code frame. */
  frames: CodeFrame[]
}

const codeFrameSchema = z.object({
  functionName: z.string().catch(''),
  url: z.string(),
  lineNumber: z.number(),
  columnNumber: z.number(),
})
const stackPayloadSchema = z.looseObject({
  type: z.string().optional(),
  stack: z.array(codeFrameSchema).optional(),
})

/**
 * Collects console/error events that carry a stack into sorted anchors.
 * @param lanes - per-lane envelopes (loadRecording output)
 * @param t0Mono - manifest t0; bootstrap events are excluded
 * @returns anchors sorted by (tMonoOffset, seq); events without stacks dropped
 * @example buildCodeAnchors(lanes, 1000)[0].label // => 'console.warn'
 */
export function buildCodeAnchors(
  lanes: Partial<Record<Lane, ReplayLaneEvent[]>>,
  t0Mono: number,
): CodeAnchor[] {
  const anchors: CodeAnchor[] = []
  for (const lane of ['console', 'error'] as const) {
    for (const event of lanes[lane] ?? []) {
      if (event.tMono < t0Mono) continue
      const payload = stackPayloadSchema.safeParse(event.payload)
      if (!payload.success || !payload.data.stack || payload.data.stack.length === 0) continue
      const consoleType = payload.data.type ?? 'log'
      anchors.push({
        seq: event.seq,
        tMonoOffset: event.tMono - t0Mono,
        kind: lane,
        label:
          lane === 'error'
            ? 'uncaught'
            : `console.${consoleType === 'warning' ? 'warn' : consoleType}`,
        frames: payload.data.stack,
      })
    }
  }
  return anchors.sort((a, b) => a.tMonoOffset - b.tMonoOffset || a.seq - b.seq)
}

/**
 * The anchor the playhead most recently passed (line-exact highlight source).
 * @param anchors - buildCodeAnchors output
 * @param tMonoOffsetMs - playhead position
 * @returns the last anchor at/before the position, or null before the first
 * @example anchorAt(anchors, 13_100)?.label // => 'console.warn'
 */
export function anchorAt(anchors: CodeAnchor[], tMonoOffsetMs: number): CodeAnchor | null {
  const index = lastIndexAtOrBefore(
    anchors.map((anchor) => anchor.tMonoOffset),
    tMonoOffsetMs,
  )
  return index >= 0 ? anchors[index] : null
}

import { z } from 'zod'

import type { CodeFrame } from './code-anchors'

import { lastIndexAtOrBefore } from './last-index-at-or-before'

/**
 * Always-on function-level highlight (decision 3): turns the recorded V8 CPU
 * profile into a playhead-indexed sample timeline so the code panel can show
 * which function was executing at any replay position. Built once per loaded
 * recording; profileStackAt() runs per playhead notify.
 */

const callFrameSchema = z.object({
  functionName: z.string().catch(''),
  url: z.string().catch(''),
  lineNumber: z.number().catch(-1),
  columnNumber: z.number().catch(-1),
})
const profileNodeSchema = z.object({
  id: z.number(),
  callFrame: callFrameSchema,
  children: z.array(z.number()).optional(),
})

/** Bundle file shape: profile.cpuprofile.json = calibration pair + raw V8 profile. */
export const cpuProfileFileSchema = z.object({
  profilerStartMono: z.number(),
  profile: z.object({
    startTime: z.number(),
    nodes: z.array(profileNodeSchema),
    samples: z.array(z.number()),
    timeDeltas: z.array(z.number()),
  }),
})
export type CpuProfileFile = z.infer<typeof cpuProfileFileSchema>

export interface ProfileTimeline {
  /** Ascending tMonoOffset per sample (parallel to stacks). */
  sampleOffsets: number[]
  /** Top-first call frames per sample; null for idle/meta samples. */
  stacks: Array<CodeFrame[] | null>
}

/** V8 meta frames that mean "nothing of the page is executing". */
const META_FUNCTION_NAMES = new Set(['(root)', '(program)', '(idle)', '(garbage collector)'])

/**
 * Indexes profile samples on the canonical clock via the calibration pair.
 * @param file - parsed profile.cpuprofile.json
 * @param t0Mono - manifest t0 (samples before Rec start get negative offsets)
 * @returns sample offsets + per-sample stacks (leaf first, meta frames dropped)
 * @example profileStackAt(buildProfileTimeline(file, t0), 5_000)?.[0].functionName
 */
export function buildProfileTimeline(file: CpuProfileFile, t0Mono: number): ProfileTimeline {
  const { profile, profilerStartMono } = file

  // Parent links let us unwind leaf → root; V8 only records children.
  const nodeById = new Map<number, (typeof profile.nodes)[number]>()
  const parentByNodeId = new Map<number, number>()
  for (const node of profile.nodes) nodeById.set(node.id, node)
  for (const node of profile.nodes) {
    for (const childId of node.children ?? []) parentByNodeId.set(childId, node.id)
  }

  // Same leaf node repeats across thousands of samples — unwind each once.
  const stackByNodeId = new Map<number, CodeFrame[] | null>()
  const stackFor = (leafNodeId: number): CodeFrame[] | null => {
    const cached = stackByNodeId.get(leafNodeId)
    if (cached !== undefined) return cached
    const frames: CodeFrame[] = []
    let cursor: number | undefined = leafNodeId
    while (cursor !== undefined) {
      const node = nodeById.get(cursor)
      if (!node) break
      if (!META_FUNCTION_NAMES.has(node.callFrame.functionName)) {
        frames.push(node.callFrame)
      }
      cursor = parentByNodeId.get(cursor)
    }
    const stack = frames.length > 0 ? frames : null
    stackByNodeId.set(leafNodeId, stack)
    return stack
  }

  const sampleOffsets: number[] = []
  const stacks: Array<CodeFrame[] | null> = []
  // timeDeltas[i] is µs since the previous sample (first delta from startTime).
  let elapsedUs = 0
  const baseOffsetMs = profilerStartMono - t0Mono
  for (let index = 0; index < profile.samples.length; index += 1) {
    elapsedUs += profile.timeDeltas[index] ?? 0
    sampleOffsets.push(baseOffsetMs + elapsedUs / 1000)
    stacks.push(stackFor(profile.samples[index]))
  }
  return { sampleOffsets, stacks }
}

/**
 * The stack executing at a playhead position (function-level highlight).
 * @param timeline - buildProfileTimeline output
 * @param tMonoOffsetMs - playhead position
 * @returns
 * - top-first frames of the sample at/before the position
 * - null when before the first sample or the page was idle
 * @example profileStackAt(timeline, 12_400)?.[0].url // => 'http://localhost:3000/...'
 */
export function profileStackAt(timeline: ProfileTimeline, tMonoOffsetMs: number): CodeFrame[] | null {
  const index = lastIndexAtOrBefore(timeline.sampleOffsets, tMonoOffsetMs)
  return index >= 0 ? timeline.stacks[index] : null
}

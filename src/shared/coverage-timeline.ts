import { z } from 'zod'

/**
 * Mode B precise-coverage timeline (goal: EVERY executed app line, no sampling
 * gaps): the harvest re-executes a recording and takes V8 coverage deltas at
 * recorded event boundaries — this module holds the artifact schema plus the
 * pure range→line math shared by the main-process collector and the renderer.
 */

/** One V8 coverage range as delivered by Profiler.takePreciseCoverage (0-based byte offsets). */
export interface V8CoverageRange {
  startOffset: number
  endOffset: number
  count: number
}

export interface V8FunctionCoverage {
  functionName: string
  ranges: V8CoverageRange[]
  isBlockCoverage: boolean
}

export interface V8ScriptCoverage {
  scriptId: string
  url: string
  functions: V8FunctionCoverage[]
}

/** Executed original lines of one app source file inside one bucket. */
export const coverageFileSchema = z.object({
  /** Raw sourcemap source id, e.g. "file:///…/corelive/src/app/page.tsx". */
  source: z.string(),
  /** Short panel label, e.g. "src/app/page.tsx". */
  display: z.string(),
  /** 1-based original lines executed in this bucket, ascending, deduped. */
  lines: z.array(z.number().int().positive()),
})
export type CoverageFile = z.infer<typeof coverageFileSchema>

export const coverageBucketSchema = z.object({
  /** Recorded-clock interval (tMonoOffset ms): code here executed in (tStart, tEnd]. */
  tStart: z.number(),
  tEnd: z.number(),
  /** Boundary that closed the bucket: page load, an input event, an interim tick, or the tail settle. */
  kind: z.enum(['load', 'input', 'interim', 'tail']),
  /** Input-lane seq when kind === 'input'. */
  seq: z.number().int().optional(),
  /** True when tEnd is a proportional estimate inside a re-paced wait (interim ticks). */
  approx: z.boolean().optional(),
  files: z.array(coverageFileSchema),
})
export type CoverageBucket = z.infer<typeof coverageBucketSchema>

export const coverageTimelineSchema = z.object({
  schemaVersion: z.literal(1),
  recordingId: z.string(),
  generatedAtWall: z.number(),
  method: z.literal('modeB-precise-coverage'),
  durationMs: z.number(),
  buckets: z.array(coverageBucketSchema),
  /** Divergences observed during the harvest run — honesty surface (decision 11). */
  divergences: z.array(z.object({ oracle: z.string(), message: z.string() })),
  stats: z.object({
    scriptsSeen: z.number(),
    scriptsResolved: z.number(),
    appFileCount: z.number(),
    appLineCount: z.number(),
  }),
})
export type CoverageTimeline = z.infer<typeof coverageTimelineSchema>

/** Bundle-relative artifact location (served over entrance:// like sourcemaps). */
export const COVERAGE_TIMELINE_FILE = 'coverage/coverage-timeline.json'

/**
 * Flattens one script's nested V8 ranges into disjoint executed [start, end) segments.
 * @param ranges - every function's ranges of a ScriptCoverage, any order
 * @returns ascending, non-adjacent segments whose deepest covering count > 0
 * @example flattenExecutedSegments([{ startOffset: 0, endOffset: 10, count: 1 }, { startOffset: 2, endOffset: 4, count: 0 }])
 * // => [[0, 2], [4, 10]]
 */
export function flattenExecutedSegments(ranges: V8CoverageRange[]): Array<[number, number]> {
  if (ranges.length === 0) return []
  // Parent-before-child order: outer ranges first, so the sweep stack nests correctly.
  const sorted = [...ranges].sort(
    (a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset,
  )
  // Elementary boundaries: coverage counts only change at range starts/ends.
  const boundarySet = new Set<number>()
  for (const range of sorted) {
    boundarySet.add(range.startOffset)
    boundarySet.add(range.endOffset)
  }
  const boundaries = [...boundarySet].sort((a, b) => a - b)

  const executed: Array<[number, number]> = []
  const stack: V8CoverageRange[] = []
  let rangeIndex = 0
  for (let i = 0; i < boundaries.length - 1; i++) {
    const segmentStart = boundaries[i]
    const segmentEnd = boundaries[i + 1]
    // Ranges that ended at or before this point no longer cover the segment.
    while (stack.length > 0 && stack[stack.length - 1].endOffset <= segmentStart) stack.pop()
    // Ranges starting here become the new deepest cover (V8 ranges nest properly).
    while (rangeIndex < sorted.length && sorted[rangeIndex].startOffset <= segmentStart) {
      if (sorted[rangeIndex].endOffset > segmentStart) stack.push(sorted[rangeIndex])
      rangeIndex++
    }
    const deepest = stack[stack.length - 1]
    if (!deepest || deepest.count === 0) continue
    // Merge with the previous segment when they touch — fewer, cleaner spans.
    const previous = executed[executed.length - 1]
    if (previous && previous[1] === segmentStart) previous[1] = segmentEnd
    else executed.push([segmentStart, segmentEnd])
  }
  return executed
}

/**
 * Byte offset of each line start — the offset→line converter's index.
 * @param source - full script source text
 * @returns ascending offsets; index i = start of 0-based line i
 * @example buildLineStarts('a\nbc\n') // => [0, 2, 5]
 */
export function buildLineStarts(source: string): number[] {
  const starts = [0]
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') starts.push(i + 1)
  }
  return starts
}

/**
 * Converts a script byte offset to a 0-based generated line/column.
 * @param lineStarts - buildLineStarts() output for the same source
 * @param offset - 0-based byte offset into the source
 * @returns 0-based line and column (clamped into the last line for EOF offsets)
 * @example offsetToLineCol([0, 2, 5], 3) // => { line: 1, column: 1 }
 */
export function offsetToLineCol(
  lineStarts: number[],
  offset: number,
): { line: number; column: number } {
  let low = 0
  let high = lineStarts.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (lineStarts[mid] <= offset) low = mid
    else high = mid - 1
  }
  return { line: low, column: offset - lineStarts[low] }
}

/**
 * The coverage bucket the playhead is inside (or has most recently passed).
 * @param buckets - CoverageTimeline.buckets (ascending tEnd)
 * @param tMonoOffsetMs - playhead position
 * @returns
 * - the last bucket whose tStart ≤ playhead (its code is "running here")
 * - null before the first bucket
 * @example coverageBucketAt(timeline.buckets, 23_400)?.kind // => 'input'
 */
export function coverageBucketAt(
  buckets: CoverageBucket[],
  tMonoOffsetMs: number,
): CoverageBucket | null {
  let low = -1
  let high = buckets.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (buckets[mid].tStart <= tMonoOffsetMs) low = mid
    else high = mid - 1
  }
  return low >= 0 ? buckets[low] : null
}

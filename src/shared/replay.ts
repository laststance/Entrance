import { z } from 'zod'

import { LANES } from './envelope'

/**
 * Replay-side readers for the .entrance bundle (spec decision 13). The bundle
 * is disk data and treated as hostile: every row/manifest is Zod-validated
 * before use. Shared so main (Mode B, P3) and renderer (Mode A) read one way.
 */

/** Envelope row as read back from a lane JSONL file. */
export const laneEventSchema = z.object({
  seq: z.number(),
  tMono: z.number(),
  tWall: z.number(),
  lane: z.enum(LANES),
  payload: z.unknown(),
})
export type ReplayLaneEvent = z.infer<typeof laneEventSchema>

/** manifest.json of a finalized bundle (mirrors envelope.RecordingManifest). */
export const recordingManifestSchema = z.object({
  schemaVersion: z.literal(1),
  recordingId: z.string(),
  name: z.string(),
  targetUrl: z.string(),
  framework: z.string().optional(),
  bundlerVariant: z.string().optional(),
  t0Mono: z.number(),
  t0Wall: z.number(),
  tEndMono: z.number(),
  durationMs: z.number(),
  endReason: z.enum(['user-stop', 'target-crashed', 'navigated-away', 'app-crash-recovered', 'quota-exceeded']),
  eventCounts: z.record(z.string(), z.number()),
  totalBytes: z.number(),
})
export type ReplayManifest = z.infer<typeof recordingManifestSchema>

/**
 * Parses one lane's JSONL text into validated envelopes, dropping torn or
 * garbled lines (crash-recovered bundles). Sorted by canonical (tMono, seq).
 * @param jsonlText - raw lane file contents fetched over entrance://
 * @returns validated rows in canonical order; [] for empty/absent lanes
 * @example parseLaneJsonl('{"seq":0,"tMono":5,...}\n{"seq":1,...}').length // => 2
 */
export function parseLaneJsonl(jsonlText: string): ReplayLaneEvent[] {
  const rows: ReplayLaneEvent[] = []
  for (const line of jsonlText.split('\n')) {
    if (line.length === 0) continue
    try {
      const parsed = laneEventSchema.safeParse(JSON.parse(line))
      if (parsed.success) rows.push(parsed.data)
    } catch {
      // Torn tail line — skip.
    }
  }
  return rows.sort((a, b) => a.tMono - b.tMono || a.seq - b.seq)
}

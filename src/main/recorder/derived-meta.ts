import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { z } from 'zod'

import type { Lane } from '@shared/envelope'
import type { HudTally } from '@shared/ipc'

/** Thumbnail + card-chip counts derived from a finalized bundle's lanes. */
export interface DerivedRecordingMeta {
  /** First screencast frame's blob hash — the 1e card thumbnail; null when no frame exists. */
  thumbnailBlobHash: string | null
  tally: HudTally
}

/** One lane row as this scanner needs it — disk data is untrusted, so rows are Zod-validated. */
const laneRowSchema = z.object({
  tMono: z.number(),
  payload: z
    .looseObject({
      phase: z.string().optional(),
      resourceType: z.string().optional(),
      type: z.string().optional(),
      kind: z.string().optional(),
      bodyHash: z.string().optional(),
    })
    .optional(),
})
type LaneRow = z.infer<typeof laneRowSchema>

/**
 * Recomputes the 1e card meta (thumbnail blob + click/fetch/error tally) by
 * scanning a bundle's lanes — the backfill path for recordings saved before
 * these fields existed and for crash-recovered bundles. Called lazily from
 * db.listRecordings for rows missing tally_json; new recordings get the same
 * values written directly at finalize.
 * @param recordingDirPath - finalized bundle directory containing lanes/
 * @param t0Mono - manifest t0 — events before it are bootstrap capture and never count
 * @returns thumbnail hash (or null) plus the HUD tally, zeros for empty bundles
 * @example
 * computeDerivedMeta('/rec/01AB', 1_000)
 * // => { thumbnailBlobHash: 'a3f2…', tally: { click: 2, fetch: 1, console: 0, error: 0 } }
 */
export function computeDerivedMeta(recordingDirPath: string, t0Mono: number): DerivedRecordingMeta {
  const tally: HudTally = { click: 0, fetch: 0, console: 0, error: 0 }

  for (const row of readLaneRows(recordingDirPath, 'network')) {
    if (row.tMono < t0Mono) continue
    // Same rule as the live HUD: "fetch" means app data calls, not every asset request.
    const isFetchApi = row.payload?.resourceType === 'XHR' || row.payload?.resourceType === 'Fetch'
    if (row.payload?.phase === 'request' && isFetchApi) tally.fetch += 1
  }
  for (const row of readLaneRows(recordingDirPath, 'input')) {
    if (row.tMono >= t0Mono && row.payload?.kind === 'click') tally.click += 1
  }
  for (const row of readLaneRows(recordingDirPath, 'console')) {
    if (row.tMono < t0Mono) continue
    tally.console += 1
    if (row.payload?.type === 'error') tally.error += 1
  }
  for (const row of readLaneRows(recordingDirPath, 'error')) {
    if (row.tMono >= t0Mono) tally.error += 1
  }

  let thumbnailBlobHash: string | null = null
  for (const row of readLaneRows(recordingDirPath, 'screencast')) {
    if (typeof row.payload?.bodyHash === 'string') {
      thumbnailBlobHash = row.payload.bodyHash
      break
    }
  }

  return { thumbnailBlobHash, tally }
}

/** Parses one lane JSONL, skipping torn/garbled lines (crash-recovered bundles stay listable). */
function readLaneRows(recordingDirPath: string, lane: Lane): LaneRow[] {
  const lanePath = join(recordingDirPath, 'lanes', `${lane}.jsonl`)
  if (!existsSync(lanePath)) return []
  const rows: LaneRow[] = []
  for (const line of readFileSync(lanePath, 'utf8').split('\n')) {
    if (line.length === 0) continue
    try {
      const parsed = laneRowSchema.safeParse(JSON.parse(line))
      if (parsed.success) rows.push(parsed.data)
    } catch {
      // Torn final line after a crash — skip and keep scanning.
    }
  }
  return rows
}

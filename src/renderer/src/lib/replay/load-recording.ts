import { LANES, type Lane } from '@shared/envelope'
import {
  COVERAGE_TIMELINE_FILE,
  coverageTimelineSchema,
  type CoverageTimeline,
} from '@shared/coverage-timeline'
import { cpuProfileFileSchema, type CpuProfileFile } from '@shared/cpuprofile-timeline'
import {
  parseLaneJsonl,
  recordingManifestSchema,
  type ReplayLaneEvent,
  type ReplayManifest,
} from '@shared/replay'
import { buildRrwebTimeMap, type RrwebTimeAnchor } from '@shared/rrweb-time-map'

import { sourcemapIndexSchema, type SourcemapIndexEntry } from './source-resolver'

/**
 * Everything the replay screen needs, loaded once over the entrance:// bulk
 * plane (spec decision 12) and Zod-validated (bundle = hostile disk data).
 */
export interface LoadedRecording {
  manifest: ReplayManifest
  lanes: Partial<Record<Lane, ReplayLaneEvent[]>>
  /** Raw rrweb events (lane payloads) for the Replayer. */
  rrwebEvents: unknown[]
  /** Canonical-clock ⇄ replayer-clock anchors (decision 13). */
  timeAnchors: RrwebTimeAnchor[]
  /** Harvested sourcemap index (empty when the harvest never ran). */
  sourcemapIndex: SourcemapIndexEntry[]
  /** V8 CPU profile + calibration (decision 3); null for pre-P1 or crashed recordings. */
  cpuProfile: CpuProfileFile | null
  /** Mode B precise-coverage timeline; null until a harvest has run. */
  coverageTimeline: CoverageTimeline | null
}

/**
 * Fetches manifest + all lanes of a finalized bundle. Missing lanes (404) are
 * simply absent — an empty recording still opens. Called from ReplayScreen via
 * use(); throwing here surfaces the screen-level error state.
 * @param recordingId - library row id (= bundle directory name)
 * @returns validated manifest, per-lane envelopes in canonical order, rrweb feed + time anchors
 * @example const { manifest } = await loadRecording('01JZX…')
 */
export async function loadRecording(recordingId: string): Promise<LoadedRecording> {
  const manifestResponse = await fetch(`entrance://recording/${recordingId}/manifest.json`)
  if (!manifestResponse.ok) throw new Error('録画データが見つかりません')
  const manifest = recordingManifestSchema.parse(await manifestResponse.json())

  const lanes: Partial<Record<Lane, ReplayLaneEvent[]>> = {}
  let sourcemapIndex: SourcemapIndexEntry[] = []
  let cpuProfile: CpuProfileFile | null = null
  let coverageTimeline: CoverageTimeline | null = null
  await Promise.all([
    ...LANES.map(async (lane) => {
      const laneResponse = await fetch(`entrance://recording/${recordingId}/lanes/${lane}.jsonl`)
      if (!laneResponse.ok) return
      lanes[lane] = parseLaneJsonl(await laneResponse.text())
    }),
    (async () => {
      const indexResponse = await fetch(
        `entrance://recording/${recordingId}/sourcemaps/index.json`,
      )
      if (!indexResponse.ok) return
      const parsed = sourcemapIndexSchema.safeParse(await indexResponse.json())
      if (parsed.success) sourcemapIndex = parsed.data.maps
    })(),
    (async () => {
      const profileResponse = await fetch(
        `entrance://recording/${recordingId}/profile.cpuprofile.json`,
      )
      if (!profileResponse.ok) return
      const parsed = cpuProfileFileSchema.safeParse(await profileResponse.json())
      if (parsed.success) cpuProfile = parsed.data
    })(),
    (async () => {
      coverageTimeline = await loadCoverageTimeline(recordingId)
    })(),
  ])

  const rrwebLane = lanes.rrweb ?? []
  return {
    manifest,
    lanes,
    rrwebEvents: rrwebLane.map((event) => event.payload),
    timeAnchors: buildRrwebTimeMap(rrwebLane, manifest.t0Mono),
    sourcemapIndex,
    cpuProfile,
    coverageTimeline,
  }
}

/**
 * Fetches the Mode B coverage artifact alone — the auto-harvest path re-reads
 * it after a harvest finishes without reloading the whole bundle.
 * @param recordingId - bundle directory name
 * @returns parsed timeline, or null when absent/invalid (pre-harvest recordings)
 * @example (await loadCoverageTimeline('01JZX…'))?.buckets.length
 */
export async function loadCoverageTimeline(recordingId: string): Promise<CoverageTimeline | null> {
  const coverageResponse = await fetch(
    `entrance://recording/${recordingId}/${COVERAGE_TIMELINE_FILE}`,
  )
  if (!coverageResponse.ok) return null
  const parsed = coverageTimelineSchema.safeParse(await coverageResponse.json())
  return parsed.success ? parsed.data : null
}

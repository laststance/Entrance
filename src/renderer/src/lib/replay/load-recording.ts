import { LANES, type Lane } from '@shared/envelope'
import {
  parseLaneJsonl,
  recordingManifestSchema,
  type ReplayLaneEvent,
  type ReplayManifest,
} from '@shared/replay'
import { buildRrwebTimeMap, type RrwebTimeAnchor } from '@shared/rrweb-time-map'

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
  await Promise.all(
    LANES.map(async (lane) => {
      const laneResponse = await fetch(`entrance://recording/${recordingId}/lanes/${lane}.jsonl`)
      if (!laneResponse.ok) return
      lanes[lane] = parseLaneJsonl(await laneResponse.text())
    }),
  )

  const rrwebLane = lanes.rrweb ?? []
  return {
    manifest,
    lanes,
    rrwebEvents: rrwebLane.map((event) => event.payload),
    timeAnchors: buildRrwebTimeMap(rrwebLane, manifest.t0Mono),
  }
}

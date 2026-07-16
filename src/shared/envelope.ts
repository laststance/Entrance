/**
 * The `.entrance` event model (spec decision 13): every lane event is wrapped
 * in one envelope stamped by the single main-process sequencer. Canonical sort
 * order everywhere is (tMono, seq). Shared by recorder (write) and replay (read).
 */

/** Event lanes. CDP-sourced lanes run from target attach (decision 27); agent lanes run only while recording. */
export const LANES = [
  'network',
  'console',
  'error',
  'page',
  'script',
  'rrweb',
  'input',
  'screencast',
  'lifecycle',
] as const
export type Lane = (typeof LANES)[number]

/** Envelope every JSONL row carries (spec decision 13). */
export interface LaneEvent<TPayload = unknown> {
  /** Arrival-order integer from the single main-process sequencer (cross-lane tiebreaker). */
  seq: number
  /** Main-process monotonic receipt time in ms — the sole canonical time axis. */
  tMono: number
  /** Wall clock at receipt (display only, never ordering). */
  tWall: number
  lane: Lane
  payload: TPayload
}

/** Bundle manifest, written at finalize (spec decisions 13/25). */
export interface RecordingManifest {
  schemaVersion: 1
  recordingId: string
  name: string
  targetUrl: string
  framework?: string
  bundlerVariant?: string
  /** tMono of Rec press — replay t=0; earlier events are bootstrap context (decision 27). */
  t0Mono: number
  t0Wall: number
  tEndMono: number
  durationMs: number
  endReason: EndReason
  eventCounts: Partial<Record<Lane, number>>
  totalBytes: number
}

/** Why a recording ended (spec decisions 25/31). */
export type EndReason =
  | 'user-stop'
  | 'target-crashed'
  | 'navigated-away'
  | 'app-crash-recovered'
  | 'quota-exceeded'

export const MANIFEST_FILENAME = 'manifest.json'
export const LIVE_MANIFEST_FILENAME = 'manifest.live.json'

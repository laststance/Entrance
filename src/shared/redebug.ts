import { z } from 'zod'

/**
 * Mode B (deterministic re-execution debugging) IPC contract — renderer
 * controls a hidden re-execution session in main; main pushes status/pause
 * state. Divergence is surfaced honestly (decision 4): Mode A stays the
 * safety net, the UI never silently shows wrong state.
 */

/** Renderer → main: start re-execution of a recording, running inputs up to an event. */
export const startRedebugSchema = z.object({
  recordingId: z.string().min(1),
  /** Replay inputs whose seq ≤ this, then pause at the next idle (event boundary). */
  runToSeq: z.number().int().nonnegative().optional(),
  /**
   * Optional line-exact pause: a breakpoint at this recorded (generated) location
   * before inputs run — anchor rows pass their top frame here.
   */
  breakpoint: z
    .object({ url: z.string(), lineNumber: z.number().int().nonnegative() })
    .optional(),
  /**
   * Coverage harvest mode: replay ALL inputs without pausing while taking
   * precise-coverage deltas at event boundaries, then write
   * coverage/coverage-timeline.json into the bundle and finish.
   */
  harvest: z.boolean().optional(),
})
export type StartRedebugRequest = z.infer<typeof startRedebugSchema>

export const redebugStepSchema = z.object({
  action: z.enum(['resume', 'stepOver', 'stepInto', 'stepOut', 'pause']),
})
export type RedebugStepRequest = z.infer<typeof redebugStepSchema>

/**
 * Renderer → main: auto-harvest entry on replay-screen open — run a coverage
 * harvest unless the artifact already exists or a user session would be clobbered.
 */
export const ensureHarvestSchema = z.object({ recordingId: z.string().min(1) })
export type EnsureHarvestRequest = z.infer<typeof ensureHarvestSchema>

/** Why ensureHarvest skipped (started === false without error). */
export type EnsureHarvestSkipReason =
  | 'coverage-exists'
  | 'debug-session-active'
  | 'already-harvesting'

export interface EnsureHarvestResult {
  started: boolean
  reason?: EnsureHarvestSkipReason
  /** Set when a start was attempted but failed (bundle unreadable etc.). */
  error?: string
}

/** One variable in a paused scope (already stringified — renderer never gets live handles). */
export interface RedebugVariable {
  name: string
  /** Display preview, e.g. "Array(1204)" / "'30d'" / "undefined". */
  preview: string
}

export interface RedebugScope {
  /** CDP scope type: local / closure / global / block …. */
  type: string
  name?: string
  variables: RedebugVariable[]
}

export interface RedebugCallFrame {
  callFrameId: string
  functionName: string
  /** Generated location — renderer resolves via the recording's sourcemaps. */
  url: string
  lineNumber: number
  columnNumber: number
}

/** Divergence oracle finding (decision 30: detection over rate). */
export interface RedebugDivergence {
  oracle: 'network' | 'console' | 'error' | 'bootstrap'
  message: string
}

export type RedebugPhase =
  | 'starting'
  | 'booting'
  | 'replaying-inputs'
  | 'paused'
  | 'running'
  | 'finished'
  | 'failed'

/** Main → renderer status push (single channel; renderer renders it verbatim). */
export interface RedebugStatus {
  phase: RedebugPhase
  /**
   * Which run produced this status: 'debug' = user-started Mode B session
   * (RedebugPanel renders it), 'harvest' = coverage collection (auto or
   * headless; DebugSidePanel's banner renders it). Consumers filter on this so
   * an auto-harvest never hijacks the debug controls.
   */
  mode: 'debug' | 'harvest'
  /** Set while phase === 'paused'. */
  pause?: {
    reason: string
    callFrames: RedebugCallFrame[]
    scopes: RedebugScope[]
  }
  divergences: RedebugDivergence[]
  /** Human-readable why, when phase === 'failed'. */
  error?: string
  /** Harvest progress while a coverage run replays inputs. */
  harvest?: { inputsDispatched: number; inputsTotal: number }
  /** Set with phase 'finished' after a harvest wrote its artifact. */
  harvestResult?: { bucketCount: number; appFileCount: number; appLineCount: number }
}

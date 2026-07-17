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
})
export type StartRedebugRequest = z.infer<typeof startRedebugSchema>

export const redebugStepSchema = z.object({
  action: z.enum(['resume', 'stepOver', 'stepInto', 'stepOut', 'pause']),
})
export type RedebugStepRequest = z.infer<typeof redebugStepSchema>

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
  /** Set while phase === 'paused'. */
  pause?: {
    reason: string
    callFrames: RedebugCallFrame[]
    scopes: RedebugScope[]
  }
  divergences: RedebugDivergence[]
  /** Human-readable why, when phase === 'failed'. */
  error?: string
}

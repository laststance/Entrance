import type { EnsureHarvestSkipReason } from '@shared/redebug'

/** What the single Mode B slot (RedebugManager.session) is currently running. */
export type ActiveSessionKind =
  | 'none'
  | 'debug'
  | 'harvest-same-recording'
  | 'harvest-other-recording'

export type EnsureHarvestDecision =
  | { action: 'start' }
  | { action: 'skip'; reason: EnsureHarvestSkipReason }

/**
 * Policy for auto-harvest when a recording opens: collect coverage only when it
 * is missing, and never steal the Mode B slot from a user debug session.
 * Called by RedebugManager.ensureHarvest on every replay-screen mount.
 * @param coverageExists - coverage/coverage-timeline.json already in the bundle
 * @param activeSession - what the single Mode B slot is running right now
 * @returns
 * - { action: 'start' }: begin a harvest (a stale harvest for another recording is replaced)
 * - { action: 'skip', reason }: artifact already there / would clobber user work / duplicate
 * @example decideEnsureHarvest(false, 'none') // => { action: 'start' }
 */
export function decideEnsureHarvest(
  coverageExists: boolean,
  activeSession: ActiveSessionKind,
): EnsureHarvestDecision {
  // Artifact already on disk — opening the screen again must not re-run Mode B.
  if (coverageExists) return { action: 'skip', reason: 'coverage-exists' }
  // A user-started debug session owns the slot — manual Mode B always wins.
  if (activeSession === 'debug') return { action: 'skip', reason: 'debug-session-active' }
  // The exact harvest we want is already running — no double start.
  if (activeSession === 'harvest-same-recording') return { action: 'skip', reason: 'already-harvesting' }
  // Free slot, or a leftover harvest for a different recording: (re)start —
  // RedebugManager.start() disposes the old hidden window first.
  return { action: 'start' }
}

import { PLAYHEAD_NOTIFY_GRANULARITY_MS } from '../../constants'

/**
 * Replay playhead position outside Redux (spec decision 15): written every
 * animation frame by RrwebPlayer, read via useSyncExternalStore by the
 * transport clock/seek bar, and read directly (peek) by the Canvas timeline.
 */

export interface PlayheadSnapshot {
  /** ms since t0 on the canonical clock */
  tMonoOffsetMs: number
  isPlaying: boolean
  speed: number
}

const IDLE_PLAYHEAD: PlayheadSnapshot = { tMonoOffsetMs: 0, isPlaying: false, speed: 1 }

let current: PlayheadSnapshot = IDLE_PLAYHEAD
// React re-renders only when this cached reference changes (coarser than rAF).
let notifiedSnapshot: PlayheadSnapshot = IDLE_PLAYHEAD
const listeners = new Set<() => void>()

function emitChange(): void {
  for (const listener of listeners) listener()
}

export const playheadStore = {
  /** rAF-rate write; React listeners fire only when display-relevant bits change. */
  set(next: PlayheadSnapshot): void {
    current = next
    const displayChanged =
      Math.round(next.tMonoOffsetMs / PLAYHEAD_NOTIFY_GRANULARITY_MS) !==
        Math.round(notifiedSnapshot.tMonoOffsetMs / PLAYHEAD_NOTIFY_GRANULARITY_MS) ||
      next.isPlaying !== notifiedSnapshot.isPlaying ||
      next.speed !== notifiedSnapshot.speed
    if (displayChanged) {
      notifiedSnapshot = next
      emitChange()
    }
  },
  reset(): void {
    current = IDLE_PLAYHEAD
    notifiedSnapshot = IDLE_PLAYHEAD
    emitChange()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): PlayheadSnapshot {
    return notifiedSnapshot
  },
  /** Frame-accurate value for rAF consumers (Canvas playhead) — bypasses React. */
  peek(): PlayheadSnapshot {
    return current
  },
}

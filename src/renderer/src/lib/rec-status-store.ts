import type { RecStatus } from '@shared/ipc'

/**
 * Latest rec:status push, consumed via useSyncExternalStore. Why: status ticks
 * every 500ms — Redux would re-render the world (same rule as the playhead,
 * spec decision 15); written by the push subscription in BrowserShell.
 */

const IDLE_STATUS: RecStatus = {
  state: 'idle',
  elapsedMs: 0,
  bytes: 0,
  counts: { click: 0, fetch: 0, console: 0, error: 0 },
  totalEvents: 0,
  pressure: null,
}

/** Status plus its arrival time — the HUD clock interpolates between 500ms pushes. */
export interface RecStatusSnapshot {
  status: RecStatus
  receivedAt: number
}

let currentSnapshot: RecStatusSnapshot = { status: IDLE_STATUS, receivedAt: 0 }
const listeners = new Set<() => void>()

function emitChange(): void {
  for (const listener of listeners) listener()
}

export const recStatusStore = {
  set(status: RecStatus): void {
    currentSnapshot = { status, receivedAt: Date.now() }
    emitChange()
  },
  reset(): void {
    currentSnapshot = { status: IDLE_STATUS, receivedAt: 0 }
    emitChange()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): RecStatusSnapshot {
    return currentSnapshot
  },
}

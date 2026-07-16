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
  pressure: null,
}

let currentStatus: RecStatus = IDLE_STATUS
const listeners = new Set<() => void>()

function emitChange(): void {
  for (const listener of listeners) listener()
}

export const recStatusStore = {
  set(status: RecStatus): void {
    currentStatus = status
    emitChange()
  },
  reset(): void {
    currentStatus = IDLE_STATUS
    emitChange()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): RecStatus {
    return currentStatus
  },
}

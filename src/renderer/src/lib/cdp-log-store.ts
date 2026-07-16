import type { CdpEventSummary } from '@shared/ipc'

import { CDP_LOG_MAX_ROWS } from '../constants'

/**
 * Ring-buffer store for the P0 CDP live log, consumed via useSyncExternalStore.
 * Why: CDP events arrive at network speed — pushing each into Redux would
 * re-render the world (same rule that keeps the playhead out of Redux,
 * spec decision 15); written by the preload push subscription in BrowserShell.
 */

let rows: CdpEventSummary[] = []
const listeners = new Set<() => void>()

function emitChange(): void {
  for (const listener of listeners) listener()
}

export const cdpLogStore = {
  push(event: CdpEventSummary): void {
    // Immutable append so getSnapshot changes identity only when content changes.
    rows = rows.length >= CDP_LOG_MAX_ROWS ? [...rows.slice(1), event] : [...rows, event]
    emitChange()
  },
  clear(): void {
    rows = []
    emitChange()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): CdpEventSummary[] {
    return rows
  },
}

import { join } from 'node:path'

import { app } from 'electron'

/**
 * Storage layout under userData (spec decision 14): SQLite DB + recordings as
 * external files. Session spools hold attach-time capture (decision 27) until
 * a recording is finalized out of them.
 */

export function recordingsRootDir(): string {
  return join(app.getPath('userData'), 'recordings')
}

/** Live spool for an attached target session (deleted on disconnect if unrecorded). */
export function sessionSpoolDir(sessionId: string): string {
  return join(recordingsRootDir(), `.spool-${sessionId}`)
}

/** Final home of a saved recording. */
export function recordingDir(recordingId: string): string {
  return join(recordingsRootDir(), recordingId)
}

export function databasePath(): string {
  return join(app.getPath('userData'), 'entrance.db')
}

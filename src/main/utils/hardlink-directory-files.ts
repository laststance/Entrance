import { copyFileSync, linkSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Hardlink every file of sourceDir into destDir (finalize/recovery blob dedup —
 * same userData volume); falls back to a plain copy per file.
 * @param sourceDir - flat directory of files (no recursion)
 * @param destDir - created on demand; existing files are kept
 * @example hardlinkDirectoryFiles(spoolBlobs, join(recordingDir, 'blobs'))
 */
export function hardlinkDirectoryFiles(sourceDir: string, destDir: string): void {
  let entries: string[]
  try {
    entries = readdirSync(sourceDir)
  } catch {
    return
  }
  if (entries.length === 0) return
  mkdirSync(destDir, { recursive: true })
  for (const name of entries) {
    const sourcePath = join(sourceDir, name)
    const destPath = join(destDir, name)
    try {
      linkSync(sourcePath, destPath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') copyFileSync(sourcePath, destPath)
    }
  }
}

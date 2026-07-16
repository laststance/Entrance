import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Recursive on-disk size of a directory — manifest totalBytes at finalize and
 * the 1e storage meter both read this.
 * @param dirPath - absolute directory path
 * @returns
 * - existing dir: sum of contained file sizes in bytes
 * - missing/unreadable dir: 0
 * @example directorySizeBytes('/tmp/rec') // => 10485760
 */
export function directorySizeBytes(dirPath: string): number {
  let entries
  try {
    entries = readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return 0
  }
  let totalBytes = 0
  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name)
    if (entry.isDirectory()) totalBytes += directorySizeBytes(entryPath)
    else if (entry.isFile()) totalBytes += statSync(entryPath).size
  }
  return totalBytes
}

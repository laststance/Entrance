import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Content-addressed blob files (network bodies, screencast JPEGs) — dedup by
 * sha256 so repeated polling responses cost one file (spec decision 13 blob
 * entries). Owned by TargetSession; finalize hardlinks blobs into recordings.
 */
export class BlobStore {
  readonly blobsDir: string
  bytesWritten = 0

  constructor(baseDir: string) {
    this.blobsDir = join(baseDir, 'blobs')
    mkdirSync(this.blobsDir, { recursive: true })
  }

  /**
   * Store bytes, return their content hash (the lane row references this).
   * @returns sha256 hex digest — stable key for the blob file
   */
  put(bytes: Buffer): string {
    const hash = createHash('sha256').update(bytes).digest('hex')
    const path = join(this.blobsDir, hash)
    if (!existsSync(path)) {
      writeFileSync(path, bytes)
      this.bytesWritten += bytes.byteLength
    }
    return hash
  }
}

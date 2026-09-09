import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'

import { BlobStore } from './blob-store'

describe('BlobStore (content-addressed bodies, spec decision 13)', () => {
  let tempDir: string

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('stores bytes under their sha256 so lane rows can reference the body', () => {
    // Arrange
    tempDir = mkdtempSync(join(tmpdir(), 'entrance-blobs-'))
    const store = new BlobStore(tempDir)
    const body = Buffer.from('{"hello":"world"}', 'utf8')
    const expectedHash = createHash('sha256').update(body).digest('hex')

    // Act
    const hash = store.put(body)

    // Assert
    expect(hash).toBe(expectedHash)
    expect(readFileSync(join(tempDir, 'blobs', hash), 'utf8')).toBe('{"hello":"world"}')
  })

  test('dedupes identical bodies so repeated polling responses cost one file', () => {
    // Arrange
    tempDir = mkdtempSync(join(tmpdir(), 'entrance-blobs-'))
    const store = new BlobStore(tempDir)
    const body = Buffer.from('same-response', 'utf8')

    // Act
    const firstHash = store.put(body)
    const secondHash = store.put(body)

    // Assert
    expect(secondHash).toBe(firstHash)
    expect(readdirSync(join(tempDir, 'blobs'))).toHaveLength(1)
    expect(store.bytesWritten).toBe(body.byteLength)
  })
})

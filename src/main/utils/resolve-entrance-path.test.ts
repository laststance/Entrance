import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveEntrancePath } from './resolve-entrance-path'

const ROOT = join(sep, 'tmp', 'entrance-test-recordings')
const RECORDING_ID = '01JZX5A6B7C8D9E0F1G2H3J4K5'

describe('entrance:// bulk-read path resolution (spec decisions 12/24 — hostile input)', () => {
  it('serves lane files inside a recording directory', () => {
    // Arrange
    const url = `entrance://recording/${RECORDING_ID}/lanes/rrweb.jsonl`

    // Act
    const resolved = resolveEntrancePath(ROOT, url)

    // Assert
    expect(resolved).toBe(join(ROOT, RECORDING_ID, 'lanes', 'rrweb.jsonl'))
  })

  it('serves content-addressed blobs', () => {
    // Arrange
    const url = `entrance://recording/${RECORDING_ID}/blobs/a3f2b1c4d5e6`

    // Act
    const resolved = resolveEntrancePath(ROOT, url)

    // Assert
    expect(resolved).toBe(join(ROOT, RECORDING_ID, 'blobs', 'a3f2b1c4d5e6'))
  })

  it('rejects .. traversal out of the recordings root', () => {
    // Arrange
    const raw = `entrance://recording/${RECORDING_ID}/../../etc/passwd`
    const encoded = `entrance://recording/${RECORDING_ID}/%2e%2e/%2e%2e/etc/passwd`
    const doubleEncoded = `entrance://recording/${RECORDING_ID}/%252e%252e/secret`

    // Act + Assert
    expect(resolveEntrancePath(ROOT, raw)).toBeNull()
    expect(resolveEntrancePath(ROOT, encoded)).toBeNull()
    expect(resolveEntrancePath(ROOT, doubleEncoded)).toBeNull()
  })

  it('rejects encoded slashes and backslashes smuggled inside one segment', () => {
    // Arrange
    const encodedSlash = `entrance://recording/${RECORDING_ID}/lanes%2F..%2F..%2Fsecret`
    const backslash = `entrance://recording/${RECORDING_ID}/lanes%5C..%5Csecret`

    // Act + Assert
    expect(resolveEntrancePath(ROOT, encodedSlash)).toBeNull()
    expect(resolveEntrancePath(ROOT, backslash)).toBeNull()
  })

  it('rejects the sensitive enclave file at any depth (spec decision 32 — never displayed)', () => {
    // Act + Assert
    expect(resolveEntrancePath(ROOT, `entrance://recording/${RECORDING_ID}/enclave.jsonl`)).toBeNull()
    expect(
      resolveEntrancePath(ROOT, `entrance://recording/${RECORDING_ID}/lanes/enclave.jsonl`),
    ).toBeNull()
  })

  it('rejects dot-prefixed recording ids so live session spools stay unreadable', () => {
    // Act + Assert
    expect(resolveEntrancePath(ROOT, 'entrance://recording/.spool-abc/lanes/network.jsonl')).toBeNull()
    expect(resolveEntrancePath(ROOT, 'entrance://recording/./manifest.json')).toBeNull()
  })

  it('rejects wrong scheme, wrong host, missing file path, and unparseable URLs', () => {
    // Act + Assert
    expect(resolveEntrancePath(ROOT, `file:///${RECORDING_ID}/manifest.json`)).toBeNull()
    expect(resolveEntrancePath(ROOT, `entrance://settings/${RECORDING_ID}/manifest.json`)).toBeNull()
    expect(resolveEntrancePath(ROOT, `entrance://recording/${RECORDING_ID}`)).toBeNull()
    expect(resolveEntrancePath(ROOT, 'not a url')).toBeNull()
  })
})

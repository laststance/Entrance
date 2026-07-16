import { readFileSync, statSync } from 'node:fs'

import { protocol } from 'electron'

import { recordingsRootDir } from './paths'
import { resolveEntrancePath } from './utils/resolve-entrance-path'

/**
 * The read-only bulk plane (spec decision 12): replay-time lane/blob/manifest
 * reads go over entrance:// instead of per-event-validated IPC. Serves ONLY
 * from the recordings directory via resolveEntrancePath; everything else 404s.
 */

/** Must run before app.whenReady — standard+fetch privileges let the renderer fetch() lanes. */
export function registerEntranceScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'entrance',
      // corsEnabled marks the scheme CORS-capable — without it the renderer's
      // cross-origin fetch() is rejected before the handler ever runs.
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
    },
  ])
}

/** Installs the entrance:// handler on the default session (call after app.whenReady). */
export function registerEntranceProtocolHandler(): void {
  protocol.handle('entrance', (request) => {
    const filePath = resolveEntrancePath(recordingsRootDir(), request.url)
    if (!filePath) return new Response('not found', { status: 404 })
    try {
      if (!statSync(filePath).isFile()) return new Response('not found', { status: 404 })
      const bytes = readFileSync(filePath)
      return new Response(bytes, {
        headers: {
          'content-type': contentTypeFor(filePath, bytes),
          'x-content-type-options': 'nosniff',
          // Bundles are immutable once finalized — let replay re-reads hit the HTTP cache.
          'cache-control': 'max-age=3600',
          // entrance:// is a standard scheme, so renderer fetches are cross-origin.
          // Open CORS is safe: the handler exists only on the app session (the
          // recorded webview's persist: partition never resolves this scheme).
          'access-control-allow-origin': '*',
        },
      })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}

/**
 * Content type from extension, falling back to magic-byte sniffing for
 * extension-less blob files (screencast JPEG frames, network bodies).
 * @param filePath - resolved on-disk path
 * @param bytes - file contents (first bytes used for sniffing)
 * @returns a concrete MIME type; unknown blobs stay application/octet-stream
 * @example contentTypeFor('/r/01A/lanes/rrweb.jsonl', buf) // => 'application/x-ndjson; charset=utf-8'
 */
function contentTypeFor(filePath: string, bytes: Buffer): string {
  if (filePath.endsWith('.jsonl')) return 'application/x-ndjson; charset=utf-8'
  if (filePath.endsWith('.json') || filePath.endsWith('.map')) return 'application/json; charset=utf-8'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  return 'application/octet-stream'
}

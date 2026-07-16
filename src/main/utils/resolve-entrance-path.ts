import { resolve, sep } from 'node:path'

/**
 * Maps an entrance://recording/<id>/<file...> URL to an absolute path inside the
 * recordings root, rejecting anything else — the bulk read plane treats every
 * URL as hostile (spec decisions 12/24). Called by the protocol handler for
 * each renderer fetch of lanes/blobs/manifest at replay time.
 * @param recordingsRoot - absolute recordings directory (paths.recordingsRootDir())
 * @param rawUrl - full request URL from the protocol handler
 * @returns
 * - resolved absolute file path when the URL is a well-formed in-root file reference
 * - null for traversal attempts, spool dirs, the sensitive enclave, or malformed URLs
 * @example
 * resolveEntrancePath('/data/recordings', 'entrance://recording/01AB/lanes/rrweb.jsonl')
 * // => '/data/recordings/01AB/lanes/rrweb.jsonl'
 * resolveEntrancePath('/data/recordings', 'entrance://recording/01AB/../../etc/passwd') // => null
 */
export function resolveEntrancePath(recordingsRoot: string, rawUrl: string): string | null {
  // URL parsers resolve dot-segments before we ever see them — reject suspicious
  // byte patterns on the raw string first. Lane/blob/manifest names never
  // legitimately contain any of these.
  const lowered = rawUrl.toLowerCase()
  if (
    lowered.includes('..') ||
    lowered.includes('\\') ||
    lowered.includes('%2e') ||
    lowered.includes('%2f') ||
    lowered.includes('%5c') ||
    lowered.includes('%00')
  ) {
    return null
  }
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'entrance:' || url.host !== 'recording') return null

  // Decode each path segment exactly once; a decode failure means malformed input.
  const segments: string[] = []
  for (const rawSegment of url.pathname.split('/')) {
    if (rawSegment.length === 0) continue
    try {
      segments.push(decodeURIComponent(rawSegment))
    } catch {
      return null
    }
  }
  // Need at least <recordingId>/<file> — bare directories are never served.
  if (segments.length < 2) return null

  const [recordingId, ...fileSegments] = segments
  // Dot-prefixed ids would reach live .spool-* session dirs; ulids are plain alphanumerics.
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(recordingId)) return null

  for (const segment of fileSegments) {
    // Reject dot-segments, separators, and leftover percent-encoding (defeats double-encoding).
    if (segment === '.' || segment === '..') return null
    if (segment.includes('/') || segment.includes('\\') || segment.includes('\0')) return null
    if (segment.includes('%')) return null
    // The enclave holds secrets Mode B needs but humans must never see (decision 32c).
    if (segment.toLowerCase().startsWith('enclave')) return null
  }

  const resolved = resolve(recordingsRoot, recordingId, ...fileSegments)
  // Defense-in-depth: even with segments validated, require the result stays in-root.
  if (!resolved.startsWith(resolve(recordingsRoot) + sep)) return null
  return resolved
}

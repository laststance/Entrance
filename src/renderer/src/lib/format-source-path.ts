/** Directory names that mark the interesting part of an absolute source path. */
const PROJECT_ANCHOR_SEGMENTS = new Set([
  'app',
  'src',
  'pages',
  'components',
  'lib',
  'actions',
  'hooks',
  'utils',
  'styles',
])

/**
 * Short display form of a sourcemap source id for the code panel tab —
 * strips file:// + machine-specific prefix down to the project-relative path.
 * @param sourcePath - raw source id (e.g. "file:///Users/…/next-play/app/guestbook/page.tsx")
 * @returns
 * - path from the first project anchor segment: "app/guestbook/page.tsx"
 * - otherwise the last 3 path segments
 * @example formatSourcePath('file:///w/proj/app/guestbook/page.tsx') // => 'app/guestbook/page.tsx'
 */
export function formatSourcePath(sourcePath: string): string {
  const decoded = safeDecode(sourcePath).replace(/^file:\/\//, '')
  const segments = decoded.split('/').filter(Boolean)
  const anchorIndex = segments.findIndex((segment) => PROJECT_ANCHOR_SEGMENTS.has(segment))
  if (anchorIndex >= 0) return segments.slice(anchorIndex).join('/')
  return segments.slice(-3).join('/')
}

/** decodeURIComponent that tolerates stray "%" in generated source names. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

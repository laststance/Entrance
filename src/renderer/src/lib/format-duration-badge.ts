/**
 * Library-card duration badge per mock 1e ("01:24"). Hours fold into minutes —
 * dev-tool recordings are minutes long, not movies.
 * @param durationMs - recording duration
 * @returns zero-padded "MM:SS"
 * @example formatDurationBadge(84_000) // => "01:24"
 */
export function formatDurationBadge(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(minutes)}:${pad(seconds)}`
}

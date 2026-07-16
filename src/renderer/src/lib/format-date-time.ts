/**
 * Library-card date label per mock 1e ("7/15 14:32"). Rendered next to the target URL.
 * @param wallMs - recording start wall-clock time (ms since epoch)
 * @returns "M/D HH:mm" in local time
 * @example formatDateTime(new Date('2026-07-15T14:32:00').getTime()) // => "7/15 14:32"
 */
export function formatDateTime(wallMs: number): string {
  const date = new Date(wallMs)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

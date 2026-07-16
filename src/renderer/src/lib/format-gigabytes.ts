/**
 * Storage-meter size label per mock 1e ("1.9 GB / 5 GB"). Sub-GB sizes show MB
 * so a fresh library never reads "0.0 GB".
 * @param bytes - byte count (recordings dir size or quota)
 * @returns
 * - ≥ 1 GB: one-decimal gigabytes, e.g. "1.9 GB"
 * - < 1 GB: whole megabytes, e.g. "245 MB"
 * @example formatGigabytes(1_900_000_000) // => "1.9 GB"
 * @example formatGigabytes(245_000_000) // => "245 MB"
 */
export function formatGigabytes(bytes: number): string {
  const gigabytes = bytes / 1_000_000_000
  if (gigabytes >= 1) return `${(Math.round(gigabytes * 10) / 10).toString()} GB`
  return `${Math.round(bytes / 1_000_000)} MB`
}

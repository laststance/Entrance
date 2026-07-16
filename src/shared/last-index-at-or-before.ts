/**
 * Binary search shared by every playhead-synced list (transcript rows, code
 * anchors, profile samples): which entry is "current" at a given offset.
 * @param sortedOffsets - ascending tMonoOffset values
 * @param tMonoOffsetMs - playhead position
 * @returns
 * - index of the last entry at/before the position
 * - -1 when the position is before the first entry
 * @example lastIndexAtOrBefore([100, 500, 900], 600) // => 1
 */
export function lastIndexAtOrBefore(sortedOffsets: ArrayLike<number>, tMonoOffsetMs: number): number {
  let low = 0
  let high = sortedOffsets.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (sortedOffsets[mid] <= tMonoOffsetMs) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

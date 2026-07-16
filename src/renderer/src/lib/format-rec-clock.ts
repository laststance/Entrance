/**
 * REC clock label per mock 1d ("REC 00:18.42") — centisecond precision.
 * @param elapsedMs - milliseconds since Rec press (interpolated between pushes)
 * @returns "MM:SS.cc"
 * @example formatRecClock(18_420) // => "00:18.42"
 */
export function formatRecClock(elapsedMs: number): string {
  const clamped = Math.max(0, elapsedMs)
  const minutes = Math.floor(clamped / 60_000)
  const seconds = Math.floor(clamped / 1000) % 60
  const centiseconds = Math.floor((clamped % 1000) / 10)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`
}

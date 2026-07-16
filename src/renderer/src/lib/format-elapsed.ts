/**
 * Elapsed-time label for the recording HUD (screen 1d) and replay clock.
 * @param elapsedMs - milliseconds since Rec press
 * @returns
 * - under an hour: "m:ss"
 * - an hour or more: "h:mm:ss"
 * @example formatElapsed(67_000) // => "1:07"
 */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
  return `${minutes}:${seconds}`
}

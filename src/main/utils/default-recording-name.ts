/**
 * Default library name for a new recording (1d save dialog pre-fill; app UI is
 * Japanese per spec decision 22). Called by RecordingManager.start.
 * @param startedAt - wall-clock time of the Rec press
 * @returns "録画 YYYY-MM-DD HH:mm"
 * @example defaultRecordingName(new Date(2026, 6, 17, 9, 5)) // => "録画 2026-07-17 09:05"
 */
export function defaultRecordingName(startedAt: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const datePart = `${startedAt.getFullYear()}-${pad(startedAt.getMonth() + 1)}-${pad(startedAt.getDate())}`
  const timePart = `${pad(startedAt.getHours())}:${pad(startedAt.getMinutes())}`
  return `録画 ${datePart} ${timePart}`
}

/** How often screen 1f re-probes localhost for dev servers while visible. */
export const SERVER_POLL_INTERVAL_MS = 4000

/** Ring-buffer cap for the P0 CDP live log — old rows drop first. */
export const CDP_LOG_MAX_ROWS = 500

/** REC clock re-render cadence — interpolates between 500ms status pushes (mock 1d shows centiseconds). */
export const REC_CLOCK_TICK_MS = 100

/** Live-event toasts kept on screen during recording (mock 1d shows a short stack). */
export const REC_TOAST_MAX_ROWS = 4

/** Playhead store notifies React only at this granularity; Canvas reads peek() at full rAF rate. */
export const PLAYHEAD_NOTIFY_GRANULARITY_MS = 10

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

/** Timeline geometry (mock 1a bottom multi-lane timeline with the 1c filmstrip folded in). */
export const TIMELINE_FILMSTRIP_HEIGHT_PX = 54
export const TIMELINE_LANE_HEIGHT_PX = 15
export const TIMELINE_RULER_HEIGHT_PX = 18
export const TIMELINE_LABEL_WIDTH_PX = 52
/** Scrub-preview seeks are throttled — each seek rebuilds the rrweb DOM. */
export const TIMELINE_SCRUB_THROTTLE_MS = 90
/** Filmstrip thumbnails decoded per recording (evenly sampled from the screencast lane). */
export const TIMELINE_FILMSTRIP_MAX_FRAMES = 30

/** Replay 3-panel split (mock 1b: transcript left, player center, inspector right). */
export const REPLAY_TRANSCRIPT_PANEL_DEFAULT_PCT = 22
export const REPLAY_TRANSCRIPT_PANEL_MIN_PCT = 14
export const REPLAY_DEBUG_PANEL_DEFAULT_PCT = 24
export const REPLAY_DEBUG_PANEL_MIN_PCT = 16

/** After passing a console/error anchor, its line stays highlighted this long; then the profile takes over. */
export const CODE_ANCHOR_FRESH_WINDOW_MS = 1500

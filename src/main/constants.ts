/** Ports commonly used by Next.js (3000+), Vite (5173+/4173), Storybook (6006+), misc (8080). */
export const PROBE_PORTS = [
  3000, 3001, 3002, 3003, 3004, 3005, 4173, 5173, 5174, 5175, 5176, 5177, 6006, 6007, 8080,
]

/** Probe both stacks — some dev servers bind only IPv6 `::1` (spec test corpus). */
export const PROBE_HOSTS = ['127.0.0.1', '[::1]']

/** Per-origin probe budget; anything slower than this is not a local dev server. */
export const PROBE_TIMEOUT_MS = 900

/** Only this much body is needed for fingerprinting; avoids slurping huge dev pages. */
export const BODY_SNIFF_BYTES = 65536

/** Cap per captured response body — a single dev asset over this is not worth spooling (decision 31). */
export const NETWORK_BODY_MAX_BYTES = 50 * 1024 * 1024

/** CDP-side network buffers so bodies survive until Network.getResponseBody runs. */
export const CDP_NETWORK_TOTAL_BUFFER_BYTES = 256 * 1024 * 1024
export const CDP_NETWORK_RESOURCE_BUFFER_BYTES = 64 * 1024 * 1024

/** Console arg previews feed the transcript (1b); cap so huge objects can't bloat the lane. */
export const CONSOLE_ARG_PREVIEW_MAX_CHARS = 4096

/** Stack frames kept per console/error anchor (decision 3 line-exact highlight). */
export const ANCHOR_STACK_FRAMES_MAX = 8

/** Live recording HUD tick (spec decision 31 live counter). */
export const REC_STATUS_PUSH_INTERVAL_MS = 500

/** Refuse to start a recording with less free disk than this (backpressure pre-check, decision 31). */
export const RECORDING_MIN_FREE_DISK_BYTES = 500 * 1024 * 1024

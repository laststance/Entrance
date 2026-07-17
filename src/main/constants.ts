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

/** Screencast tuning (1c filmstrip lane): dev-tool quality, not video quality. */
export const SCREENCAST_JPEG_QUALITY = 60
export const SCREENCAST_MAX_WIDTH_PX = 1280
export const SCREENCAST_MAX_HEIGHT_PX = 800
export const SCREENCAST_EVERY_NTH_FRAME = 2

/** Sampling profiler powers the always-on function-level highlight (decision 3). */
export const PROFILER_SAMPLING_INTERVAL_US = 1000

/** Per-map fetch budget when harvesting sourcemaps from the dev server at finalize. */
export const SOURCEMAP_FETCH_TIMEOUT_MS = 3000
/** Whole-harvest budget — a dead dev server must not hold the bundle open forever. */
export const SOURCEMAP_HARVEST_TOTAL_TIMEOUT_MS = 20000

/** Library storage quota (spec decision 14 default; user-configurable in v2). Decimal so the 1e meter reads exactly "5 GB". */
export const STORAGE_QUOTA_BYTES = 5_000_000_000
/** Above this fraction of quota the HUD shows pressure:'warn' (decision 31). */
export const STORAGE_QUOTA_WARN_RATIO = 0.8
/** Free-disk probe cadence in status ticks (10 ticks × 500ms = every 5s). */
export const DISK_CHECK_EVERY_N_TICKS = 10

/** Mode B re-execution (P3): hidden-window boot + input pacing + pause snapshot caps. */
export const REDEBUG_LOAD_TIMEOUT_MS = 15000
/** Gap between re-dispatched inputs so the page's fetches/renders settle (spike #2 policy v1). */
export const REDEBUG_INPUT_SETTLE_MS = 150
/** At record time the page was hydrated long before the first input, but a
 * re-execution clicks right after load — too early and framework links degrade
 * to full navigations the recording never saw. Poll the click target for its
 * React fiber expando; non-React pages just wait out the budget. */
export const REDEBUG_HYDRATION_TIMEOUT_MS = 8000
export const REDEBUG_HYDRATION_POLL_INTERVAL_MS = 250
/** Inputs re-pace by their recorded gaps, capped so a slow original session replays quickly. */
export const REDEBUG_INPUT_MAX_WAIT_MS = 2000
/** Debugger.pause only fires on the next JS task — after this, poke the page once. */
export const REDEBUG_PAUSE_FALLBACK_MS = 1500
export const REDEBUG_MAX_CALL_FRAMES = 20
export const REDEBUG_MAX_SCOPE_VARIABLES = 40
/** Fixed Math.random seed — same value every re-execution, by design. */
export const REDEBUG_RANDOM_SEED = 0x12345678
/** Fallback viewport when the bundle has no snapshot (pre-P1 recordings). */
export const REDEBUG_WINDOW_WIDTH_PX = 1280
export const REDEBUG_WINDOW_HEIGHT_PX = 720

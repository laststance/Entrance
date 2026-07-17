/**
 * Dependency-free shared constants — importable from the injected agent
 * bundles (page-agent / redebug-shims), which must stay tiny and must never
 * pull runtime libraries into recorded pages.
 */

/**
 * Next dev persists each document's React debug-channel chunks under this
 * sessionStorage prefix. Three cooperating sites use it: the recorder sweeps
 * these keys at stop (they only exist post-hydration), the bundle reader
 * overlays them onto the seeded storage, and the re-execution shim answers a
 * missing entry with '[]' (absent entry = silent location.reload() in Next).
 */
export const NEXT_DEBUG_CHANNEL_KEY_PREFIX = '__next_debug_channel:'

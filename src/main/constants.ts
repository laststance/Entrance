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

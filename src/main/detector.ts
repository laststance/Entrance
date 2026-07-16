import type { DetectedServer, Framework, BundlerVariant } from '@shared/ipc'

/**
 * Dev-server auto-detection for screen 1f (spec decision 11).
 * Why: main-process HTTP probes have no CORS constraints; called by the
 * `servers:detect` IPC handler on empty-screen polling.
 */

import { BODY_SNIFF_BYTES, PROBE_HOSTS, PROBE_PORTS, PROBE_TIMEOUT_MS } from './constants'

export interface ProbeResult {
  status: number
  headers: Record<string, string>
  body: string
}

/**
 * Classify a live HTTP response into a framework fingerprint.
 * Why: screen 1f labels each row ("Next.js — dev" etc.) and later phases pick
 * sourcemap strategies per bundler; called by detectServers() and unit tests.
 * @param probe - status/headers/body captured from the dev server
 * @returns framework id, optional Next.js bundler variant, and a display label
 * @example fingerprint({status:200, headers:{'x-powered-by':'Next.js'}, body:'…__NEXT_DATA__…'})
 *          // → { framework: 'nextjs', variant: 'webpack', label: 'Next.js — dev' }
 */
export function fingerprint(probe: ProbeResult): {
  framework: Framework
  variant?: BundlerVariant
  label: string
} {
  const body = probe.body.toLowerCase()
  const poweredBy = (probe.headers['x-powered-by'] ?? '').toLowerCase()

  // Next.js: dev responses carry X-Powered-By and/or _next asset paths / __NEXT_DATA__.
  if (poweredBy.includes('next.js') || body.includes('/_next/') || body.includes('__next_data__') || body.includes('id="__next"')) {
    // Turbopack dev chunks are namespaced with [turbopack] / _turbopack markers; webpack otherwise.
    const isTurbopack = body.includes('turbopack')
    return {
      framework: 'nextjs',
      variant: isTurbopack ? 'turbopack' : 'webpack',
      label: isTurbopack ? 'Next.js (Turbopack) — dev' : 'Next.js — dev',
    }
  }

  // Vite: the dev client script is injected into every served page.
  if (body.includes('/@vite/client') || body.includes('vite/dist/client')) {
    return { framework: 'vite', label: 'Vite — dev' }
  }

  // Storybook: manager HTML references storybook globals / root elements.
  if (body.includes('storybook')) {
    return { framework: 'storybook', label: 'Storybook' }
  }

  return { framework: 'unknown', label: 'HTTPサーバー' }
}

/** Fetch one origin with a short timeout; any HTTP status counts as alive (spec decision 11). */
async function probe(origin: string): Promise<ProbeResult | null> {
  try {
    const res = await fetch(origin, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      redirect: 'follow',
    })
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v))
    const body = (await res.text()).slice(0, BODY_SNIFF_BYTES)
    return { status: res.status, headers, body }
  } catch {
    return null
  }
}

/**
 * Scan localhost (v4+v6) across common dev ports and fingerprint every live server.
 * Why: powers the 1f "検出されたDEVサーバー" list; called by the servers:detect handler.
 * @param excludePorts - ports that must never be listed (Entrance's own renderer dev server)
 * @returns deduped list (one row per port, localhost-canonical URL), Next.js first
 */
export async function detectServers(excludePorts: number[] = []): Promise<DetectedServer[]> {
  const attempts = PROBE_HOSTS.flatMap((host) =>
    PROBE_PORTS.filter((port) => !excludePorts.includes(port)).map((port) => ({
      host,
      port,
      origin: `http://${host}:${port}`,
    })),
  )
  const results = await Promise.all(
    attempts.map(async (a) => ({ ...a, probe: await probe(a.origin) })),
  )

  // Dedupe v4/v6 twins of the same port — prefer the canonical localhost display URL.
  const byPort = new Map<number, DetectedServer>()
  for (const r of results) {
    if (!r.probe) continue
    if (byPort.has(r.port)) continue
    const fp = fingerprint(r.probe)
    byPort.set(r.port, {
      url: `http://localhost:${r.port}`,
      framework: fp.framework,
      variant: fp.variant,
      label: fp.label,
    })
  }

  // Next.js first (first-class target), then Vite, Storybook, unknown — mirrors mock ordering.
  const rank: Record<Framework, number> = { nextjs: 0, vite: 1, storybook: 2, unknown: 3 }
  return [...byPort.values()].sort((a, b) => rank[a.framework] - rank[b.framework])
}

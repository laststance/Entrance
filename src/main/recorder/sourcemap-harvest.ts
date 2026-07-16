import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { LaneEvent } from '@shared/envelope'

import { SOURCEMAP_FETCH_TIMEOUT_MS, SOURCEMAP_HARVEST_TOTAL_TIMEOUT_MS } from '../constants'

/**
 * Pull external sourcemaps referenced by the script lane into the bundle at
 * finalize (portable bundles, spec decision 25) — the dev server is alive right
 * after a recording, later maybe not. Runs in the background after stop();
 * sourcemaps/index.json existing marks a completed harvest.
 */

interface ScriptLanePayload {
  scriptId?: string
  url?: string
  sourceMap?: { kind: 'url'; url: string } | { kind: 'blob'; bodyHash: string }
}

interface HarvestIndexEntry {
  scriptUrl: string
  resolvedMapUrl?: string
  /** File name under sourcemaps/ (url kind) or blob hash (inline data: kind). */
  file?: string
  bodyHash?: string
  error?: string
}

/** Local dev origins only — never fetch sourcemaps from the wider internet. */
function isLocalUrl(rawUrl: string): boolean {
  try {
    const { hostname, protocol } = new URL(rawUrl)
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
    )
  } catch {
    return false
  }
}

export async function harvestSourcemaps(recordingDirPath: string): Promise<void> {
  let scriptLaneRaw: string
  try {
    scriptLaneRaw = readFileSync(join(recordingDirPath, 'lanes', 'script.jsonl'), 'utf8')
  } catch {
    return // no scripts recorded — nothing to harvest
  }

  // Dedup by resolved map URL: HMR re-parses the same script many times.
  const byResolvedUrl = new Map<string, HarvestIndexEntry>()
  const inlineEntries: HarvestIndexEntry[] = []
  for (const line of scriptLaneRaw.split('\n')) {
    if (!line) continue
    let event: LaneEvent<ScriptLanePayload>
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    const { url: scriptUrl = '', sourceMap } = event.payload
    if (!sourceMap) continue
    if (sourceMap.kind === 'blob') {
      inlineEntries.push({ scriptUrl, bodyHash: sourceMap.bodyHash })
      continue
    }
    let resolvedMapUrl: string
    try {
      resolvedMapUrl = new URL(sourceMap.url, scriptUrl).toString()
    } catch {
      continue
    }
    if (!isLocalUrl(resolvedMapUrl)) continue
    if (!byResolvedUrl.has(resolvedMapUrl)) {
      byResolvedUrl.set(resolvedMapUrl, { scriptUrl, resolvedMapUrl })
    }
  }
  if (byResolvedUrl.size === 0 && inlineEntries.length === 0) return

  const sourcemapsDir = join(recordingDirPath, 'sourcemaps')
  mkdirSync(sourcemapsDir, { recursive: true })
  const harvestDeadline = Date.now() + SOURCEMAP_HARVEST_TOTAL_TIMEOUT_MS

  await Promise.allSettled(
    [...byResolvedUrl.values()].map(async (entry) => {
      if (Date.now() > harvestDeadline) {
        entry.error = 'harvest-deadline'
        return
      }
      try {
        const response = await fetch(entry.resolvedMapUrl ?? '', {
          signal: AbortSignal.timeout(SOURCEMAP_FETCH_TIMEOUT_MS),
        })
        if (!response.ok) {
          entry.error = `http-${response.status}`
          return
        }
        const body = Buffer.from(await response.arrayBuffer())
        const fileName = `${createHash('sha256').update(entry.resolvedMapUrl ?? '').digest('hex')}.map`
        writeFileSync(join(sourcemapsDir, fileName), body)
        entry.file = fileName
      } catch (err) {
        entry.error = err instanceof Error ? err.name : String(err)
      }
    }),
  )

  writeFileSync(
    join(sourcemapsDir, 'index.json'),
    JSON.stringify({ maps: [...byResolvedUrl.values(), ...inlineEntries] }, null, 2),
  )
}

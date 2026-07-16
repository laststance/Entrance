import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  LIVE_MANIFEST_FILENAME,
  MANIFEST_FILENAME,
  type Lane,
  type LaneEvent,
  type RecordingManifest,
} from '@shared/envelope'

import { insertRecording } from '../db'
import { recordingsRootDir } from '../paths'
import { directorySizeBytes } from '../utils/directory-size-bytes'
import { hardlinkDirectoryFiles } from '../utils/hardlink-directory-files'

/**
 * Startup crash recovery (spec decision 25 app-crash-recovered): a recording
 * dir with a leftover live manifest means Entrance died mid-recording. Salvage
 * the surviving spool into it, seal a manifest, register the library row, and
 * sweep orphaned spools. Called once from main/index.ts after openDatabase.
 */

interface LiveManifest {
  recordingId: string
  name: string
  targetUrl: string
  framework?: string
  bundlerVariant?: string
  t0Mono: number
  t0Wall: number
  spoolDir?: string
  enclaveFilePath?: string
}

export function recoverAbandonedRecordings(): void {
  const root = recordingsRootDir()
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return
  }

  for (const name of entries) {
    if (name.startsWith('.')) continue
    const dir = join(root, name)
    const livePath = join(dir, LIVE_MANIFEST_FILENAME)
    if (!existsSync(livePath)) continue
    try {
      recoverOne(dir, JSON.parse(readFileSync(livePath, 'utf8')) as LiveManifest)
      rmSync(livePath, { force: true })
    } catch {
      /* leave the dir for manual inspection rather than destroying evidence */
    }
  }

  // Every remaining spool belongs to a previous process — dead weight.
  for (const name of entries) {
    if (name.startsWith('.spool-')) rmSync(join(root, name), { recursive: true, force: true })
  }
}

function recoverOne(dir: string, live: LiveManifest): void {
  // Salvage session lanes/blobs/enclave if the spool survived the crash.
  if (live.spoolDir && existsSync(live.spoolDir)) {
    const spoolLanesDir = join(live.spoolDir, 'lanes')
    if (existsSync(spoolLanesDir)) {
      mkdirSync(join(dir, 'lanes'), { recursive: true })
      for (const laneFile of readdirSync(spoolLanesDir)) {
        copyFileSync(join(spoolLanesDir, laneFile), join(dir, 'lanes', laneFile))
      }
    }
    hardlinkDirectoryFiles(join(live.spoolDir, 'blobs'), join(dir, 'blobs'))
    if (live.enclaveFilePath && existsSync(live.enclaveFilePath)) {
      copyFileSync(live.enclaveFilePath, join(dir, 'enclave.jsonl'))
    }
  }

  const { eventCounts, newestTMono } = scanLanes(join(dir, 'lanes'))
  const tEndMono = Math.max(live.t0Mono, newestTMono)
  const manifest: RecordingManifest = {
    schemaVersion: 1,
    recordingId: live.recordingId,
    name: live.name,
    targetUrl: live.targetUrl,
    framework: live.framework,
    bundlerVariant: live.bundlerVariant,
    t0Mono: live.t0Mono,
    t0Wall: live.t0Wall,
    tEndMono,
    durationMs: Math.round(tEndMono - live.t0Mono),
    endReason: 'app-crash-recovered',
    eventCounts,
    totalBytes: directorySizeBytes(dir),
  }
  writeFileSync(join(dir, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2))
  insertRecording(manifest)
}

/** Count events per lane and find the newest tMono (the recovered recording's end). */
function scanLanes(lanesDir: string): {
  eventCounts: Partial<Record<Lane, number>>
  newestTMono: number
} {
  const eventCounts: Partial<Record<Lane, number>> = {}
  let newestTMono = 0
  let laneFiles: string[]
  try {
    laneFiles = readdirSync(lanesDir)
  } catch {
    return { eventCounts, newestTMono }
  }
  for (const laneFile of laneFiles) {
    if (!laneFile.endsWith('.jsonl')) continue
    const lane = laneFile.replace(/\.jsonl$/, '') as Lane
    const lines = readFileSync(join(lanesDir, laneFile), 'utf8').split('\n').filter(Boolean)
    eventCounts[lane] = lines.length
    const lastLine = lines[lines.length - 1]
    if (lastLine) {
      try {
        const lastEvent = JSON.parse(lastLine) as LaneEvent
        if (lastEvent.tMono > newestTMono) newestTMono = lastEvent.tMono
      } catch {
        /* torn final line from the crash — earlier lanes still bound tEnd */
      }
    }
  }
  return { eventCounts, newestTMono }
}

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { z } from 'zod'

import {
  parseLaneJsonl,
  recordingManifestSchema,
  type ReplayLaneEvent,
  type ReplayManifest,
} from '@shared/replay'

/**
 * Loads the pieces of a finalized bundle that Mode B re-execution needs —
 * read via fs in main (the enclave NEVER crosses to the renderer; decision 32).
 * Called once per RedebugSession start.
 */

/** Electron Cookie fields Mode B restores — validated, never a blind cast (hostile bundle). */
export type EnclaveCookie = z.infer<typeof enclaveCookieSchema>

export interface RedebugEnclave {
  cookies: EnclaveCookie[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  /** Real Set-Cookie values keyed by recorded requestId (restored on fulfill). */
  setCookieValuesByRequestId: Map<string, string[]>
  /** Real keystrokes in record order — FIFO-paired with masked input-lane keys. */
  keystrokes: Array<{ code: string; key: string }>
}

export interface RedebugBundle {
  manifest: ReplayManifest
  networkLane: ReplayLaneEvent[]
  inputLane: ReplayLaneEvent[]
  errorLane: ReplayLaneEvent[]
  enclave: RedebugEnclave
  blobsDirPath: string
  /** Recorded viewport (snapshot.json) — the hidden window matches it for layout fidelity. */
  viewport: { width: number; height: number } | null
}

// Shape of session.cookies.get() rows as the recorder stored them. Rows that
// fail validation are dropped (cookie restore is best-effort by design).
const enclaveCookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  expirationDate: z.number().optional(),
  sameSite: z.enum(['unspecified', 'no_restriction', 'lax', 'strict']).optional(),
})
const enclaveSnapshotSchema = z.looseObject({
  kind: z.literal('state-snapshot'),
  cookies: z.array(z.unknown()).catch([]),
  localStorage: z.record(z.string(), z.string()).catch({}),
  sessionStorage: z.record(z.string(), z.string()).catch({}),
})
const enclaveResponseHeaderSchema = z.looseObject({
  kind: z.literal('response-header'),
  requestId: z.string(),
  header: z.string(),
  value: z.string(),
})
const enclaveKeystrokeSchema = z.looseObject({
  kind: z.literal('keystroke'),
  code: z.string(),
  key: z.string(),
})

/**
 * Reads manifest + Mode B lanes + enclave off disk.
 * @param recordingDirPath - bundle directory
 * @returns everything RedebugSession.start consumes
 * @example const bundle = readRedebugBundle(join(recordingsDir, recordingId))
 */
export function readRedebugBundle(recordingDirPath: string): RedebugBundle {
  const manifest: ReplayManifest = recordingManifestSchema.parse(
    JSON.parse(readFileSync(join(recordingDirPath, 'manifest.json'), 'utf8')),
  )

  const readLane = (lane: string): ReplayLaneEvent[] => {
    try {
      return parseLaneJsonl(readFileSync(join(recordingDirPath, 'lanes', `${lane}.jsonl`), 'utf8'))
    } catch {
      return []
    }
  }

  const enclave: RedebugEnclave = {
    cookies: [],
    localStorage: {},
    sessionStorage: {},
    setCookieValuesByRequestId: new Map(),
    keystrokes: [],
  }
  let enclaveRaw = ''
  try {
    enclaveRaw = readFileSync(join(recordingDirPath, 'enclave.jsonl'), 'utf8')
  } catch {
    /* stripped-on-export bundle — Mode B runs without secrets, divergence may flag it */
  }
  for (const line of enclaveRaw.split('\n')) {
    if (!line) continue
    let row: unknown
    try {
      row = JSON.parse(line)
    } catch {
      continue // torn tail
    }
    const snapshot = enclaveSnapshotSchema.safeParse(row)
    if (snapshot.success) {
      enclave.cookies = snapshot.data.cookies
        .map((cookie) => enclaveCookieSchema.safeParse(cookie))
        .filter((parsed) => parsed.success)
        .map((parsed) => parsed.data)
      enclave.localStorage = snapshot.data.localStorage
      enclave.sessionStorage = snapshot.data.sessionStorage
      continue
    }
    const responseHeader = enclaveResponseHeaderSchema.safeParse(row)
    if (responseHeader.success && responseHeader.data.header.toLowerCase() === 'set-cookie') {
      const existing = enclave.setCookieValuesByRequestId.get(responseHeader.data.requestId)
      if (existing) existing.push(responseHeader.data.value)
      else enclave.setCookieValuesByRequestId.set(responseHeader.data.requestId, [responseHeader.data.value])
      continue
    }
    const keystroke = enclaveKeystrokeSchema.safeParse(row)
    if (keystroke.success) {
      enclave.keystrokes.push({ code: keystroke.data.code, key: keystroke.data.key })
    }
  }

  let viewport: { width: number; height: number } | null = null
  try {
    const snapshot: unknown = JSON.parse(readFileSync(join(recordingDirPath, 'snapshot.json'), 'utf8'))
    const parsed = z
      .looseObject({ viewport: z.object({ width: z.number(), height: z.number() }) })
      .safeParse(snapshot)
    if (parsed.success) viewport = parsed.data.viewport
  } catch {
    /* pre-P1 bundle without snapshot — fallback viewport constants apply */
  }

  return {
    manifest,
    networkLane: readLane('network'),
    inputLane: readLane('input'),
    errorLane: readLane('error'),
    enclave,
    blobsDirPath: join(recordingDirPath, 'blobs'),
    viewport,
  }
}

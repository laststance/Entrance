#!/usr/bin/env node
/**
 * Backfills dev-server chunks a recording references but never captured —
 * chunks loaded BEFORE Rec was pressed exist only in the recorded page's
 * memory, so Mode B re-execution (fresh browser) requests them and misses.
 * Scans every recorded blob (including RSC flight payloads) for
 * `static/chunks/…` references, fetches the missing ones from the live dev
 * server, and appends synthetic lane rows. Run while the target dev server
 * is up: `node scripts/backfill-chunks.mjs <recordingDir> <baseUrl>`
 */
import { createHash } from 'node:crypto'
import { appendFileSync, copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [recordingDir, baseUrl] = process.argv.slice(2)
if (!recordingDir || !baseUrl) {
  console.error('usage: node scripts/backfill-chunks.mjs <recordingDir> <baseUrl>')
  process.exit(1)
}

const lanePath = join(recordingDir, 'lanes', 'network.jsonl')
const blobsDir = join(recordingDir, 'blobs')

/** Chunk path references as Turbopack embeds them (raw, unencoded). */
const CHUNK_REF_PATTERN = /static\/chunks\/[A-Za-z0-9_@\-.[\]%()]+\.(?:js|css)/g

/** Recorded rows percent-encode [ ] @ etc. — mirror that so match keys align. */
const encodeChunkPath = (chunkPath) => chunkPath.split('/').map(encodeURIComponent).join('/')

// 1. Chunk paths the lane already answers (compare in DECODED space).
const laneRows = readFileSync(lanePath, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
const recordedChunkPaths = new Set()
for (const row of laneRows) {
  const url = row.payload?.url
  if (row.payload?.phase !== 'request' || typeof url !== 'string') continue
  const match = url.match(/\/_next\/(static\/chunks\/.+)$/)
  if (match) recordedChunkPaths.add(decodeURIComponent(match[1]))
}

// 2. References from every recorded blob that looks textual.
const referencedChunkPaths = new Set()
const scanText = (text) => {
  for (const ref of text.match(CHUNK_REF_PATTERN) ?? []) referencedChunkPaths.add(decodeURIComponent(ref))
}
for (const blobName of readdirSync(blobsDir)) {
  const buffer = readFileSync(join(blobsDir, blobName))
  if (buffer.subarray(0, 512).includes(0)) continue // binary (image/font)
  scanText(buffer.toString('utf8'))
}

// 3. Fetch missing chunks; their contents can reference further chunks — loop to closure.
const fetched = new Map() // decoded path -> Buffer
const missingQueue = [...referencedChunkPaths].filter((p) => !recordedChunkPaths.has(p))
while (missingQueue.length > 0) {
  const chunkPath = missingQueue.shift()
  if (fetched.has(chunkPath) || recordedChunkPaths.has(chunkPath)) continue
  const url = `${baseUrl}/_next/${encodeChunkPath(chunkPath)}`
  const response = await fetch(url)
  if (!response.ok) {
    console.warn('SKIP (live ' + response.status + '):', chunkPath)
    fetched.set(chunkPath, null)
    continue
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  fetched.set(chunkPath, buffer)
  const before = referencedChunkPaths.size
  scanText(buffer.toString('utf8'))
  for (const ref of referencedChunkPaths) {
    if (!recordedChunkPaths.has(ref) && !fetched.has(ref)) missingQueue.push(ref)
  }
  if (referencedChunkPaths.size > before) console.log('  (new refs from', chunkPath + ')')
}

const backfillEntries = [...fetched.entries()].filter(([, buffer]) => buffer !== null)
if (backfillEntries.length === 0) {
  console.log('nothing to backfill — lane already covers every referenced chunk')
  process.exit(0)
}

// 4. Write blobs + append lane rows (request/response/body/finished per chunk).
const backupPath = lanePath + '.pre-chunk-backfill-' + Date.now()
copyFileSync(lanePath, backupPath)
let appended = ''
let syntheticIndex = 0
for (const [chunkPath, buffer] of backfillEntries) {
  const bodyHash = createHash('sha256').update(buffer).digest('hex')
  writeFileSync(join(blobsDir, bodyHash), buffer)
  const requestId = `synthetic.chunk.${syntheticIndex}`
  const url = `${baseUrl}/_next/${encodeChunkPath(chunkPath)}`
  const isCss = chunkPath.endsWith('.css')
  const mimeType = isCss ? 'text/css' : 'application/javascript'
  const tBase = 1.001 + syntheticIndex * 0.0001
  const seqBase = 900000 + syntheticIndex * 4
  const rows = [
    { seq: seqBase, tMono: tBase, phase: 'request', extra: { url, method: 'GET', headers: {}, resourceType: isCss ? 'Stylesheet' : 'Script' } },
    { seq: seqBase + 1, tMono: tBase + 0.00001, phase: 'response', extra: { url, status: 200, mimeType, headers: { 'content-type': `${mimeType}; charset=UTF-8` } } },
    { seq: seqBase + 2, tMono: tBase + 0.00002, phase: 'body', extra: { bodyHash, bodySize: buffer.length, base64Encoded: false } },
    { seq: seqBase + 3, tMono: tBase + 0.00003, phase: 'finished', extra: { encodedBytes: buffer.length } },
  ]
  for (const row of rows) {
    appended += JSON.stringify({ seq: row.seq, tMono: row.tMono, tWall: 0, lane: 'network', payload: { phase: row.phase, requestId, ...row.extra } }) + '\n'
  }
  console.log('backfilled:', chunkPath, `(${buffer.length}B)`)
  syntheticIndex += 1
}
appendFileSync(lanePath, appended)
console.log(`done: ${backfillEntries.length} chunks appended (backup: ${backupPath})`)

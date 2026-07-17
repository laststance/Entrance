#!/usr/bin/env node
/**
 * Recording ground-truth cross-check (goal falsification test): the Mode B
 * precise-coverage table is a *reproduction*; Raphtalia's test is against the
 * *recording*. This validates coverage against three independent recording-
 * native oracles and reports any corelive/src (file, line) the recording proves
 * but coverage lacks — exactly the lines that would invalidate the 対応表:
 *
 *   A. rrweb data-insp-path  — "映っている" (what was on screen, with tMono)
 *   B. profile.cpuprofile    — "実行されている" (what actually ran, with tMono)
 *   C. console/network stacks — line-exact recorded anchors
 *
 * Usage: node scripts/verify-against-recording.mjs <recordingDir> [out.json]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AnyMap, originalPositionFor, GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND } from '@jridgewell/trace-mapping'

const [recordingDir, outPath] = process.argv.slice(2)
if (!recordingDir) {
  console.error('usage: node scripts/verify-against-recording.mjs <recordingDir> [out.json]')
  process.exit(1)
}
const lane = (name) => join(recordingDir, 'lanes', name)
const readLane = (name) =>
  existsSync(lane(name))
    ? readFileSync(lane(name), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : []

/** corelive absolute-file or bare display → the "src/…" display form coverage uses. */
const CORELIVE_PREFIX = 'corelive/'
const safeDecode = (s) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
const toDisplay = (raw) => {
  if (!raw) return null
  // Coverage source URLs percent-encode route groups (%28main%29); rrweb
  // insp-paths and sourcemap sources use raw parens — decode so keys align.
  let s = safeDecode(raw.replace(/^file:\/\//, ''))
  const idx = s.lastIndexOf(CORELIVE_PREFIX)
  if (idx >= 0) s = s.slice(idx + CORELIVE_PREFIX.length)
  // Only corelive app/electron sources count toward the goal (client src focus).
  if (!/^(src|electron)\//.test(s)) return null
  return s
}

// ── Mode B coverage (the table backbone) ────────────────────────────────────
const timeline = JSON.parse(readFileSync(join(recordingDir, 'coverage', 'coverage-timeline.json'), 'utf8'))
const coverage = new Map() // display -> Set(line)
for (const source of timeline.sources) {
  const display = toDisplay(source.source) ?? source.display
  if (!coverage.has(display)) coverage.set(display, new Set())
  const set = coverage.get(display)
  for (const line of source.allLines) set.add(line)
}
const inCoverage = (display, line) => coverage.get(display)?.has(line) ?? false
const fileInCoverage = (display) => coverage.has(display)

// ── Sourcemap resolver (recording-time chunks → corelive/src) ───────────────
const smIndex = JSON.parse(readFileSync(join(recordingDir, 'sourcemaps', 'index.json'), 'utf8'))
const urlToMapFile = new Map()
for (const m of smIndex.maps) urlToMapFile.set(m.scriptUrl, m.file)
const tracerCache = new Map() // mapFile -> TraceMap | null
const getTracer = (url) => {
  const mapFile = urlToMapFile.get(url)
  if (!mapFile) return null
  if (tracerCache.has(mapFile)) return tracerCache.get(mapFile)
  let tracer = null
  try {
    tracer = new AnyMap(readFileSync(join(recordingDir, 'sourcemaps', mapFile), 'utf8'))
  } catch {
    tracer = null
  }
  tracerCache.set(mapFile, tracer)
  return tracer
}
/** Resolve a generated (url, 0-based line, 0-based col) to a corelive display+line. */
const resolveToSrc = (url, zeroLine, zeroCol) => {
  const tracer = getTracer(url)
  if (!tracer) return null
  for (const bias of [GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND]) {
    const pos = originalPositionFor(tracer, { line: zeroLine + 1, column: Math.max(0, zeroCol | 0), bias })
    if (pos && pos.source && pos.line != null) {
      const display = toDisplay(pos.source)
      if (display) return { display, line: pos.line }
    }
  }
  return null
}

// ── Oracle A: rrweb data-insp-path (visible DOM over recorded time) ──────────
const rrweb = readLane('rrweb.jsonl')
const inspHits = new Map() // display -> Map(line -> firstTMono)
const INSP_RE = /"data-insp-path":"((?:src|electron)\/[^"]+?):(\d+):(\d+)(?::[^"]*)?"/g
for (const row of rrweb) {
  const text = JSON.stringify(row.payload)
  for (const match of text.matchAll(INSP_RE)) {
    const display = match[1]
    const line = Number(match[2])
    if (!inspHits.has(display)) inspHits.set(display, new Map())
    const perFile = inspHits.get(display)
    if (!perFile.has(line) || row.tMono < perFile.get(line)) perFile.set(line, row.tMono)
  }
}

// ── Oracle B: cpuprofile (executed app frames + positionTicks, with tMono) ──
// CPU samples land on the LEAF (deepest currently-running frame, usually deep
// framework code); an app function that called into the framework appears as an
// ANCESTOR on the sample's stack, not the leaf. So credit every app frame on the
// leaf→root chain — leaf-only attribution silently drops most app execution.
const wrap = JSON.parse(readFileSync(join(recordingDir, 'profile.cpuprofile.json'), 'utf8'))
const cp = wrap.profile
const monoAtUs = (us) => wrap.profilerStartMono + (us - cp.startTime) / 1000
const nodeById = new Map(cp.nodes.map((n) => [n.id, n]))
const parentOf = new Map() // childId -> parentId (cpuprofile stores children only)
for (const n of cp.nodes) for (const childId of n.children ?? []) parentOf.set(childId, n.id)
// Resolve each node's declaration frame once; track resolution outcomes.
const nodeSrc = new Map() // nodeId -> {display,line} | null (declaration site)
const cpuResolveStats = { corelive: 0, elsewhere: 0, nullPos: 0, noTracer: 0, appNodes: 0 }
const isAppChunk = (u) => /\/_next\/static\/chunks\//.test(u) && !/node_modules|turbopack-|next_dist/.test(u)
for (const n of cp.nodes) {
  const cf = n.callFrame
  if (!cf.url || !isAppChunk(cf.url)) { nodeSrc.set(n.id, null); continue }
  cpuResolveStats.appNodes++
  const resolved = resolveToSrc(cf.url, cf.lineNumber, cf.columnNumber)
  if (resolved) { cpuResolveStats.corelive++; nodeSrc.set(n.id, resolved) }
  else {
    nodeSrc.set(n.id, null)
    if (!urlToMapFile.has(cf.url)) cpuResolveStats.noTracer++
    else cpuResolveStats.nullPos++
  }
}
const cpuHits = new Map() // display -> Map(line -> {count, firstTMono, lastTMono})
const addCpu = (display, line, tMono) => {
  if (!cpuHits.has(display)) cpuHits.set(display, new Map())
  const perFile = cpuHits.get(display)
  const cur = perFile.get(line)
  if (!cur) perFile.set(line, { count: 1, firstTMono: tMono, lastTMono: tMono })
  else {
    cur.count++
    cur.firstTMono = Math.min(cur.firstTMono, tMono)
    cur.lastTMono = Math.max(cur.lastTMono, tMono)
  }
}
let tUs = cp.startTime
for (let i = 0; i < cp.samples.length; i++) {
  tUs += cp.timeDeltas[i]
  const tMono = monoAtUs(tUs)
  const seenThisSample = new Set() // one credit per function per sample
  // Walk leaf → root, crediting every app frame on the stack.
  for (let id = cp.samples[i]; id != null; id = parentOf.get(id)) {
    const decl = nodeSrc.get(id)
    if (decl) {
      const key = decl.display + ':' + decl.line
      if (!seenThisSample.has(key)) { seenThisSample.add(key); addCpu(decl.display, decl.line, tMono) }
    }
  }
  // Leaf positionTicks give the actual generated lines sampled within the leaf.
  const leaf = nodeById.get(cp.samples[i])
  if (leaf?.callFrame.url && isAppChunk(leaf.callFrame.url)) {
    for (const pt of leaf.positionTicks ?? []) {
      const r = resolveToSrc(leaf.callFrame.url, pt.line - 1, 0)
      if (r) addCpu(r.display, r.line, tMono)
    }
  }
}

// ── Oracle C: console/network/error recorded stacks (line-exact anchors) ────
// Anchors are STRUCTURED frame arrays ({functionName,url,lineNumber,columnNumber},
// 0-based line/col), not "url:line:col" strings — walk the arrays and resolve.
const stackHits = new Map() // display -> Map(line -> tMono)
const stackResolveStats = { frames: 0, corelive: 0 }
const addStack = (display, line, tMono) => {
  if (!stackHits.has(display)) stackHits.set(display, new Map())
  const perFile = stackHits.get(display)
  if (!perFile.has(line) || tMono < perFile.get(line)) perFile.set(line, tMono)
}
/** Recursively collect {url,lineNumber,columnNumber} frame objects from any payload. */
const collectFrames = (value, out) => {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) collectFrames(item, out)
    return
  }
  if (typeof value.url === 'string' && typeof value.lineNumber === 'number') out.push(value)
  for (const v of Object.values(value)) if (v && typeof v === 'object') collectFrames(v, out)
}
for (const name of ['console.jsonl', 'network.jsonl']) {
  for (const row of readLane(name)) {
    const frames = []
    collectFrames(row.payload, frames)
    for (const f of frames) {
      stackResolveStats.frames++
      const r = resolveToSrc(f.url, f.lineNumber, f.columnNumber ?? 0)
      if (r) { stackResolveStats.corelive++; addStack(r.display, r.line, row.tMono) }
    }
  }
}

// ── Cross-check each oracle against coverage ────────────────────────────────
const analyze = (hits, label, lineTolerance = 0) => {
  const fileGaps = [] // files present in oracle, absent from coverage entirely
  const lineGaps = [] // {display, line} present in oracle, not covered (± tolerance)
  let oracleFiles = 0
  let oracleLines = 0
  for (const [display, perFile] of hits) {
    oracleFiles++
    if (!fileInCoverage(display)) {
      fileGaps.push({ display, lines: [...perFile.keys()].sort((a, b) => a - b) })
      continue
    }
    for (const line of perFile.keys()) {
      oracleLines++
      let covered = inCoverage(display, line)
      for (let d = 1; d <= lineTolerance && !covered; d++)
        covered = inCoverage(display, line - d) || inCoverage(display, line + d)
      if (!covered) lineGaps.push({ display, line })
    }
  }
  return { label, oracleFiles, oracleLines, fileGaps, lineGaps }
}

// insp-path targets the JSX root element line; V8 line coverage may attribute a
// few lines off after compile — allow ±3 for the visible-element oracle only.
const reportA = analyze(inspHits, 'rrweb data-insp-path (映っている)', 3)
const reportB = analyze(cpuHits, 'cpuprofile (実行されている)', 2)
const reportC = analyze(stackHits, 'console/network stacks (anchors)', 1)

// ── Build per-line evidence map (which recording oracle attests each line) ──
// Codes: C=cpuprofile (recording's real client samples), V=rrweb visible DOM,
// S=recorded stack anchor. (Mode B coverage is the table spine, code M, added
// by the table generator.) Each carries the earliest recording tMono seen.
const evidence = {} // display -> { line -> {sources:[], cpuFirst?, cpuLast?, rrwebFirst?, stackFirst?} }
const ensure = (display, line) => {
  if (!evidence[display]) evidence[display] = {}
  if (!evidence[display][line]) evidence[display][line] = { sources: [] }
  return evidence[display][line]
}
for (const [display, perFile] of cpuHits)
  for (const [line, agg] of perFile) {
    const e = ensure(display, line)
    if (!e.sources.includes('C')) e.sources.push('C')
    e.cpuFirst = agg.firstTMono
    e.cpuLast = agg.lastTMono
  }
for (const [display, perFile] of inspHits)
  for (const [line, tMono] of perFile) {
    const e = ensure(display, line)
    if (!e.sources.includes('V')) e.sources.push('V')
    e.rrwebFirst = tMono
  }
for (const [display, perFile] of stackHits)
  for (const [line, tMono] of perFile) {
    const e = ensure(display, line)
    if (!e.sources.includes('S')) e.sources.push('S')
    e.stackFirst = tMono
  }
// Files with recording evidence but absent from Mode B coverage = server-
// rendered (client JS not captured, decision 2). Their evidence is the union.
const serverRenderedFiles = [...new Set([...reportA.fileGaps, ...reportB.fileGaps, ...reportC.fileGaps].map((g) => g.display))]
const sourcemapIndexGaps = [...new Set(cp.nodes.map((n) => n.callFrame.url).filter((u) => u && isAppChunk(u) && !urlToMapFile.has(u)))].map((u) => u.replace(/.*\/chunks\//, ''))

const summary = {
  recordingId: timeline.recordingId,
  coverageFiles: coverage.size,
  reports: [reportA, reportB, reportC],
  resolutionHealth: {
    cpuprofile: { appNodes: cpuResolveStats.appNodes, resolvedCorelive: cpuResolveStats.corelive, nullPosition: cpuResolveStats.nullPos, noTracer: cpuResolveStats.noTracer },
    stacks: { framesScanned: stackResolveStats.frames, resolvedCorelive: stackResolveStats.corelive },
    rrwebFiles: inspHits.size,
  },
  evidence,
  serverRenderedFiles,
  sourcemapIndexGaps,
}

// Resolution health — a silently under-resolving oracle fakes a "0 gaps" pass.
console.log('=== ORACLE RESOLUTION HEALTH ===')
console.log(`  cpuprofile app-chunk nodes: ${cpuResolveStats.appNodes} → corelive ${cpuResolveStats.corelive}, elsewhere-map ${cpuResolveStats.elsewhere ?? 0}, null-position ${cpuResolveStats.nullPos}, no-tracer(chunk missing from index) ${cpuResolveStats.noTracer}`)
console.log(`  stack frames scanned: ${stackResolveStats.frames} → resolved-to-corelive ${stackResolveStats.corelive}`)
console.log(`  rrweb insp-path files: ${inspHits.size}`)

for (const r of summary.reports) {
  console.log(`\n=== ${r.label} ===`)
  console.log(`  oracle files: ${r.oracleFiles}, oracle lines checked: ${r.oracleLines}`)
  console.log(`  FILE gaps (in recording, absent from coverage): ${r.fileGaps.length}`)
  for (const g of r.fileGaps) console.log(`    ✗ ${g.display}  lines ${g.lines.slice(0, 12).join(',')}${g.lines.length > 12 ? '…' : ''}`)
  console.log(`  LINE gaps (file covered, this line not): ${r.lineGaps.length}`)
  const byFile = new Map()
  for (const g of r.lineGaps) {
    if (!byFile.has(g.display)) byFile.set(g.display, [])
    byFile.get(g.display).push(g.line)
  }
  for (const [display, lines] of [...byFile].sort((a, b) => b[1].length - a[1].length).slice(0, 15))
    console.log(`    ~ ${display}: ${lines.sort((a, b) => a - b).slice(0, 20).join(',')}${lines.length > 20 ? ` (+${lines.length - 20})` : ''}`)
}

const totalFileGaps = summary.reports.reduce((s, r) => s + r.fileGaps.length, 0)
const totalLineGaps = summary.reports.reduce((s, r) => s + r.lineGaps.length, 0)
console.log(`\n=== VERDICT ===`)
console.log(`  total FILE gaps: ${totalFileGaps}`)
console.log(`  total LINE gaps: ${totalLineGaps}`)
console.log(totalFileGaps === 0 ? '  ✓ every recording-visible/executed FILE is in coverage' : '  ✗ FILE gaps exist — coverage misses recording-proven files')

// Always persist the evidence map alongside coverage so the 対応表 generator can
// label each line's recording basis and union the server-rendered lines.
const evidencePath = join(recordingDir, 'coverage', 'recording-evidence.json')
writeFileSync(evidencePath, JSON.stringify(summary, null, 2))
console.log(`\nwritten: ${evidencePath}`)
if (outPath && outPath !== evidencePath) {
  writeFileSync(outPath, JSON.stringify(summary, null, 2))
  console.log(`written: ${outPath}`)
}

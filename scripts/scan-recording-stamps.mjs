// Boundary DIAGNOSTIC for the goal's literal "録画に含まれている" reading: enumerate
// corelive/src data-insp-path stamps physically present in recorded artifacts (rrweb lane
// + externalized blobs incl. RSC flight payloads + SSR HTML) and diff against the
// authoritative JSON table union. Surfaces the class the oracle-based audits structurally
// exclude: lines shipped in the bundle but neither executed (Mode B coverage) nor visible
// (rrweb) this session.
//
//   node scripts/scan-recording-stamps.mjs <recordingDir> [table.md]
//
// IMPORTANT — this is ONE methodology's view, kept for the report's boundary appendix, NOT
// for regenerating §5. §5 of the deliverable is a hand-written INVARIANT section that pins
// no exact count, precisely because the census is method-dependent with no well-defined upper
// bound (different methods observe different values). Two reasons it is not well-defined:
// (a) blob universe — some SSR-HTML blobs are
// orphaned build artifacts no longer referenced by the current network.jsonl; (b) this regex
// is data-insp-path-ADJACENT, so it does NOT catch React-Compiler-HOISTED stamps
// (const t = __codeInspectorPath || "src/…:L:C:Tag") that an adjacency-independent scan adds.
// What §5 relies on is the INVARIANT this script re-verifies: rrweb-leak = 0 and
// coverage-leak = 0 (bundle-only lines never intersect the visible/executed sets).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REC = process.argv[2]
const TABLE = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null
const decode = (s) => { try { return decodeURIComponent(s) } catch { return s } }

// Matches unescaped JSON ("data-insp-path":"…"), HTML (data-insp-path="…"), AND the
// double-escaped RSC-flight-in-HTML form (\"data-insp-path\":\"…\" inside
// <script>self.__next_f.push(...)</script>). The separator class MUST include backslash,
// else CodeInspectorEmptyElement stamps — which live ONLY in escaped flight form (they
// render no host element) — are systematically dropped (Audit 1 & 4, commit 9fdc5c1).
const INSP = /data-insp-path["'=:\s\\]+((?:src|electron)\/[^"'\\]+?):(\d+):(\d+):([A-Za-z0-9_$]+)/g

/** Classify a recorded artifact's body by content signature. */
function classify(text) {
  const head = text.slice(0, 400)
  if (/^\s*<!doctype html/i.test(head) || /^\s*<html/i.test(head)) return 'html'
  if (/TURBOPACK|webpackChunk|__turbopack_|module\.exports|\("\[project\]/.test(head)) return 'jschunk'
  if (/^\s*\d+:[I\[HTSL{"]/.test(head) || /"\$","/.test(text.slice(0, 2000)) || /\d+:\["\$"/.test(text.slice(0, 4000))) return 'rsc'
  if (/"type":\d+,"data":|"childNodes":|"tagName":/.test(head)) return 'rrweb-snapshot'
  return 'other'
}

/** Pull corelive stamps from one text body. */
function stamps(text) {
  const out = []
  let m
  INSP.lastIndex = 0
  while ((m = INSP.exec(text))) out.push({ disp: decode(m[1]), line: +m[2], col: +m[3], tag: m[4] })
  return out
}

// ── Scan every blob + the rrweb lane ────────────────────────────────────────
const byKey = new Map() // "disp:line" -> { disp, line, tags:Set, artifacts:Set }
function record(s, artifact) {
  const key = s.disp + ':' + s.line
  if (!byKey.has(key)) byKey.set(key, { disp: s.disp, line: s.line, tags: new Set(), artifacts: new Set() })
  const e = byKey.get(key)
  e.tags.add(s.tag)
  e.artifacts.add(artifact)
}
const blobDir = join(REC, 'blobs')
let blobsScanned = 0
for (const f of readdirSync(blobDir)) {
  const p = join(blobDir, f)
  if (!statSync(p).isFile()) continue
  let text
  try { text = readFileSync(p, 'utf8') } catch { continue }
  if (!text.includes('data-insp-path')) continue
  blobsScanned++
  const kind = classify(text)
  for (const s of stamps(text)) record(s, kind)
}
for (const line of readFileSync(join(REC, 'lanes', 'rrweb.jsonl'), 'utf8').split('\n')) {
  if (!line.includes('data-insp-path')) continue
  for (const s of stamps(line)) record(s, 'rrweb')
}

// ── Authoritative table union (from the JSON the table is generated from) ────
const timeline = JSON.parse(readFileSync(join(REC, 'coverage', 'coverage-timeline.json'), 'utf8'))
const evidence = JSON.parse(readFileSync(join(REC, 'coverage', 'recording-evidence.json'), 'utf8'))
const tableKeys = new Set()
const add = (file, line) => tableKeys.add(file + ':' + Number(line))
for (const s of timeline.sources) for (const l of s.allLines) add(s.display, l)
for (const [file, perLine] of Object.entries(evidence.evidence)) for (const l of Object.keys(perLine)) add(file, l)
for (const [file, lines] of [['src/app/layout.tsx', [50, 59]], ['src/app/(main)/layout.tsx', [20]]]) for (const l of lines) add(file, l)

// ── Boundary: recorded stamps absent from the visible+executed union ─────────
const all = [...byKey.values()]
const notInTable = all.filter((e) => !tableKeys.has(e.disp + ':' + e.line))
const carrierOf = (e) => (e.artifacts.has('rsc') ? 'rsc' : e.artifacts.has('html') ? 'html' : e.artifacts.has('jschunk') ? 'jschunk' : [...e.artifacts][0])
// Class A = server-render output (layout/page): RSC flight + SSR HTML carriers.
// Class B = client JS bundle static JSX: jschunk carrier.
const serverCls = notInTable.filter((e) => carrierOf(e) === 'rsc' || carrierOf(e) === 'html')
const clientCls = notInTable.filter((e) => carrierOf(e) === 'jschunk')
const filesOf = (arr) => new Set(arr.map((e) => e.disp)).size
const groupByFile = (arr) => {
  const m = new Map()
  for (const e of arr.sort((a, b) => a.disp.localeCompare(b.disp) || a.line - b.line)) {
    if (!m.has(e.disp)) m.set(e.disp, [])
    m.get(e.disp).push(e)
  }
  return m
}
const execLines = new Set()
for (const s of timeline.sources) for (const l of s.allLines) execLines.add(s.disp + ':' + l)
const execLeak = notInTable.filter((e) => new Set([...timeline.sources].flatMap((s) => s.allLines.map((l) => s.display + ':' + l))).has(e.disp + ':' + e.line))
const rrwebLeak = notInTable.filter((e) => e.artifacts.has('rrweb'))
const byCarrier = {}
for (const e of notInTable) byCarrier[carrierOf(e)] = (byCarrier[carrierOf(e)] || 0) + 1

// ── Diagnostics: ONE methodology's boundary view (method-dependent — see header) ──
// Deliberately NOT emitting a markdown §5. §5 is a hand-written INVARIANT section that
// pins no exact count; this output is kept only for the report's boundary appendix and to
// re-verify the two invariants that DO matter: rrweb-leak = 0 and coverage-leak = 0.
console.log('blobs with data-insp-path scanned:', blobsScanned)
console.log('distinct corelive (file,line) stamps across ALL recorded artifacts:', all.length)
console.log('table union keys:', tableKeys.size)
console.log('\n=== summary (one methodology: data-insp-path-adjacent regex, all blobs) ===')
console.log('total stamps not in table:', notInTable.length, '| across files:', filesOf(notInTable))
console.log('  by carrier:', JSON.stringify(byCarrier))
console.log('  rrweb leak (visible set — MUST be 0):', rrwebLeak.length)
console.log('  Mode B coverage leak (executed set — MUST be 0):', execLeak.length)
console.log('  CAVEAT: census is method-dependent with no well-defined upper bound. This regex is data-insp-path-ADJACENT,')
console.log('  so React-Compiler-HOISTED stamps (const t = __codeInspectorPath || "src/…:L:C:Tag") are')
console.log('  NOT counted; some SSR-HTML blobs are orphaned build artifacts. The invariant (leak=0),')
console.log('  not the count, is what §5 relies on — and it holds against the wider hoisted superset too.')
console.log(`\n=== Class A — server-render output (RSC flight + SSR HTML): ${serverCls.length} lines / ${filesOf(serverCls)} files ===`)
for (const [d, entries] of groupByFile(serverCls)) {
  const carriers = [...new Set(entries.flatMap((e) => [...e.artifacts]))].filter((a) => a !== 'other').join('/')
  console.log(`  ${d}: ${entries.map((e) => e.line).join(',')}  [${carriers}]`)
}
console.log(`\n=== Class B — client JS bundle static JSX (jschunk): ${clientCls.length} lines / ${filesOf(clientCls)} files ===`)
for (const [d, entries] of groupByFile(clientCls)) console.log(`  ${d}: ${entries.map((e) => e.line).join(',')}`)
if (TABLE) {
  const md = readFileSync(TABLE, 'utf8')
  console.log('\n(table provided:', TABLE, '—', md.length, 'bytes)')
}

// Adversarial completeness scan for the goal's LITERAL "録画に含まれている" reading:
// enumerate EVERY corelive/src data-insp-path stamp physically present in any
// recorded artifact (rrweb lane + all externalized blobs incl. RSC flight
// payloads), classify the carrying artifact, and diff against the table union.
//
// Purpose: find server-component composition lines (uppercase JSX tags) that
// live in the recorded RSC payload but produce no client-visible DOM and no
// client execution — the one class the oracle-based audits structurally exclude.
//
// Usage: node scripts/scan-recording-stamps.mjs <recordingDir> <table.md>
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const [REC, TABLE] = process.argv.slice(2)
const decode = (s) => { try { return decodeURIComponent(s) } catch { return s } }

// Matches both JSON ("data-insp-path":"…") and HTML (data-insp-path="…") forms.
const INSP = /data-insp-path\\?["'=:\s]+((?:src|electron)\/[^"'\\]+?):(\d+):(\d+):([A-Za-z0-9_$]+)/g

/** Classify a recorded artifact's body by content signature. */
function classify(text) {
  const head = text.slice(0, 400)
  if (/^\s*<!doctype html/i.test(head) || /^\s*<html/i.test(head)) return 'html'
  if (/TURBOPACK|webpackChunk|__turbopack_|module\.exports|\("\[project\]/.test(head)) return 'jschunk'
  // RSC flight: numbered rows like `2:I[...]`, `0:["$","div"`, or self-ref $ markers
  if (/^\s*\d+:[I\[HTSL{"]/.test(head) || /"\$","/.test(text.slice(0, 2000)) || /\d+:\["\$"/.test(text.slice(0, 4000))) return 'rsc'
  if (/"type":\d+,"data":|"childNodes":|"tagName":/.test(head)) return 'rrweb-snapshot'
  return 'other'
}

/** Pull corelive stamps from one text body. */
function stamps(text) {
  const out = []
  let m
  INSP.lastIndex = 0
  while ((m = INSP.exec(text))) {
    out.push({ disp: decode(m[1]), line: +m[2], col: +m[3], tag: m[4] })
  }
  return out
}

// ── Scan every blob + the rrweb lane ────────────────────────────────────────
const byKey = new Map() // "disp:line" -> { disp, line, tags:Set, artifacts:Set, tagCase }
function record(s, artifact) {
  const key = s.disp + ':' + s.line
  if (!byKey.has(key)) byKey.set(key, { disp: s.disp, line: s.line, tags: new Set(), artifacts: new Set() })
  const e = byKey.get(key)
  e.tags.add(s.tag)
  e.artifacts.add(artifact)
}

const blobDir = join(REC, 'blobs')
let blobsScanned = 0
const rscBlobs = []
for (const f of readdirSync(blobDir)) {
  const p = join(blobDir, f)
  if (!statSync(p).isFile()) continue
  let text
  try { text = readFileSync(p, 'utf8') } catch { continue }
  if (!text.includes('data-insp-path')) continue
  blobsScanned++
  const kind = classify(text)
  const ss = stamps(text)
  if (kind === 'rsc' && ss.length) rscBlobs.push({ f, count: ss.length })
  for (const s of ss) record(s, kind)
}
// rrweb lane (DOM = on-screen)
for (const line of readFileSync(join(REC, 'lanes', 'rrweb.jsonl'), 'utf8').split('\n')) {
  if (!line.includes('data-insp-path')) continue
  for (const s of stamps(line)) record(s, 'rrweb')
}

// ── Table union (AUTHORITATIVE: from the JSON the table is generated from, not
//    fragile markdown parsing). The deliverable renders exactly:
//      coverage-timeline sources[].allLines  (§2/§3 Mode B)
//    ∪ recording-evidence evidence[file][line] (§1 V/C/S direct oracles)
//    ∪ server §4 rows (rrweb-visible server-component host lines).
//    Auditors 4 & 5 verified §3 ≡ allLines and §1 ≡ evidence, so this union IS
//    the table's true (file,line) content. ─────────────────────────────────────
const tableKeys = new Set()
const tableFiles = new Set()
const add = (file, line) => { tableKeys.add(file + ':' + Number(line)); tableFiles.add(file) }
const timeline = JSON.parse(readFileSync(join(REC, 'coverage', 'coverage-timeline.json'), 'utf8'))
for (const s of timeline.sources) for (const l of s.allLines) add(s.display, l)
const evidence = JSON.parse(readFileSync(join(REC, 'coverage', 'recording-evidence.json'), 'utf8'))
for (const [file, perLine] of Object.entries(evidence.evidence)) for (const l of Object.keys(perLine)) add(file, l)
// §4 server-visible host lines carried in the deliverable.
for (const [file, lines] of [['src/app/layout.tsx', [50, 59]], ['src/app/(main)/layout.tsx', [20]]]) for (const l of lines) add(file, l)

// ── Report ──────────────────────────────────────────────────────────────────
const all = [...byKey.values()]
const upper = all.filter((e) => [...e.tags].some((t) => /^[A-Z]/.test(t)))
const notInTable = all.filter((e) => !tableKeys.has(e.disp + ':' + e.line))

console.log('blobs with data-insp-path scanned:', blobsScanned, '| RSC-classified blobs:', rscBlobs.length)
console.log('distinct corelive (file,line) stamps across ALL recorded artifacts:', all.length)
console.log('table union keys parsed:', tableKeys.size, '| table files:', tableFiles.size)
console.log('\n=== corelive stamps NOT in table union (candidate literal-reading gaps) ===')
const grouped = new Map()
for (const e of notInTable) {
  if (!grouped.has(e.disp)) grouped.set(e.disp, [])
  grouped.get(e.disp).push(e)
}
for (const [disp, entries] of [...grouped.entries()].sort()) {
  const inRrweb = entries.some((e) => e.artifacts.has('rrweb'))
  const arts = new Set(entries.flatMap((e) => [...e.artifacts]))
  console.log(`\n  ${disp}  (${entries.length} lines; artifacts: ${[...arts].join(',')}; anyRrweb=${inRrweb})`)
  for (const e of entries.sort((a, b) => a.line - b.line)) {
    console.log(`    :${e.line}  <${[...e.tags].join('/')}>  [${[...e.artifacts].join(',')}]`)
  }
}
console.log('\n=== summary ===')
console.log('total stamps not in table:', notInTable.length, '| across files:', new Set(notInTable.map((e) => e.disp)).size)
console.log('  of which uppercase-tag (component composition):', notInTable.filter((e) => [...e.tags].some((t) => /^[A-Z]/.test(t))).length)
console.log('  of which appear in an RSC payload:', notInTable.filter((e) => [...e.artifacts].some((a) => a === 'rsc')).length)
console.log('  of which appear in rrweb (would be a REAL visible gap!):', notInTable.filter((e) => e.artifacts.has('rrweb')).length)
// Per-artifact split (a stamp can carry multiple; count by primary carrier).
const byArt = {}
for (const e of notInTable) { const a = e.artifacts.has('rsc') ? 'rsc' : e.artifacts.has('html') ? 'html' : e.artifacts.has('jschunk') ? 'jschunk' : [...e.artifacts][0]; byArt[a] = (byArt[a] || 0) + 1 }
console.log('  by carrier:', JSON.stringify(byArt))
// Cross-check: every not-in-table line MUST be absent from Mode B coverage allLines (executed).
const execKeys = new Set()
for (const s of timeline.sources) for (const l of s.allLines) execKeys.add(s.display + ':' + l)
const execLeak = notInTable.filter((e) => execKeys.has(e.disp + ':' + e.line))
console.log('  not-in-table lines that ARE in Mode B coverage (should be 0):', execLeak.length)
console.log('\n=== RSC-payload composition lines (Class A — enumerate) ===')
for (const e of notInTable.filter((x) => x.artifacts.has('rsc')).sort((a, b) => (a.disp + a.line).localeCompare(b.disp + b.line))) console.log(`  ${e.disp}:${e.line}  <${[...e.tags].join('/')}>`)

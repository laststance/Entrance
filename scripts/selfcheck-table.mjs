// Self-falsification pass before the subagent audit:
//  1. corelive/src files referenced by recorded script/network lanes whose
//     sourcemap resolves to corelive but which are absent from the table.
//  2. table (file,line) whose line exceeds the corelive source file's length.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { AnyMap, eachMapping } from '@jridgewell/trace-mapping'

const dir = process.argv[2]
const CORELIVE = '/Users/ryotamurakami/laststance/corelive'
const timeline = JSON.parse(readFileSync(join(dir, 'coverage', 'coverage-timeline.json'), 'utf8'))
const evidence = JSON.parse(readFileSync(join(dir, 'coverage', 'recording-evidence.json'), 'utf8'))
const idx = JSON.parse(readFileSync(join(dir, 'sourcemaps', 'index.json'), 'utf8'))

// Union of every display in coverage + evidence = the table's file set.
const tableFiles = new Set(timeline.sources.map((s) => s.display))
for (const d of Object.keys(evidence.evidence)) tableFiles.add(d)
for (const d of evidence.serverRenderedFiles) tableFiles.add(d)

// (1) Every corelive/src source name appearing in ANY recorded chunk's sourcemap.
const decode = (s) => { try { return decodeURIComponent(s) } catch { return s } }
const toDisplay = (raw) => { let s = decode(String(raw).replace(/^file:\/\//, '')); const i = s.lastIndexOf('corelive/'); if (i >= 0) s = s.slice(i + 9); return /^(src|electron)\//.test(s) ? s : null }
const allMapSources = new Set()
for (const m of idx.maps) {
  if (/node_modules|turbopack-|next_dist/.test(m.scriptUrl)) continue // app chunks only
  try {
    const map = new AnyMap(readFileSync(join(dir, 'sourcemaps', m.file), 'utf8'))
    // AnyMap exposes resolved sources via .sources after flattening sections
    for (const src of map.sources ?? []) { const d = toDisplay(src); if (d) allMapSources.add(d) }
  } catch {}
}
console.log('=== (1) corelive/src in app-chunk sourcemaps but NOT in table ===')
const loadedNotInTable = [...allMapSources].filter((d) => !tableFiles.has(d)).sort()
console.log('app-chunk source files total:', allMapSources.size, '| in table:', [...allMapSources].filter((d) => tableFiles.has(d)).length)
if (loadedNotInTable.length === 0) console.log('  ✓ none — every app-chunk-bundled corelive source is in the table')
else loadedNotInTable.forEach((d) => console.log('  ? bundled-but-absent:', d))

// (2) Line-bound sanity for every table line.
console.log('=== (2) table lines exceeding source file length ===')
let checked = 0, phantom = 0
const fileLen = new Map()
const lenOf = (display) => {
  if (fileLen.has(display)) return fileLen.get(display)
  const abs = join(CORELIVE, display)
  const n = existsSync(abs) ? readFileSync(abs, 'utf8').split('\n').length : -1
  fileLen.set(display, n)
  return n
}
for (const src of timeline.sources) {
  const n = lenOf(src.display)
  if (n < 0) { console.log('  !! source file missing on disk:', src.display); continue }
  for (const line of src.allLines) { checked++; if (line > n) { phantom++; console.log(`  !! ${src.display}:${line} exceeds file length ${n}`) } }
}
for (const [display, perLine] of Object.entries(evidence.evidence)) {
  const n = lenOf(display); if (n < 0) continue
  for (const line of Object.keys(perLine).map(Number)) { checked++; if (line > n) { phantom++; console.log(`  !! (evidence) ${display}:${line} exceeds ${n}`) } }
}
console.log(`  checked ${checked} table lines; phantom (out-of-bounds): ${phantom}`)
console.log(phantom === 0 ? '  ✓ every table line exists within its source file' : '  ✗ phantom lines found')

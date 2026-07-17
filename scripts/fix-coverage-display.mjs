// One-shot: re-derive the `display` convenience field in coverage-timeline.json
// from the authoritative `source` URL, after the formatSourcePath electron/ fix.
// `display` is a pure function of `source`; the run-26 execution data (lines,
// buckets, timings) is untouched. Backs up the original.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
const path = join(dir, 'coverage', 'coverage-timeline.json')
const tl = JSON.parse(readFileSync(path, 'utf8'))

const safeDecode = (s) => { try { return decodeURIComponent(s) } catch { return s } }
const ANCHORS = new Set(['app', 'src', 'electron', 'pages', 'components', 'lib', 'actions', 'hooks', 'utils', 'styles'])
const formatSourcePath = (sourcePath) => {
  const decoded = safeDecode(String(sourcePath).replace(/^file:\/\//, ''))
  const segments = decoded.split('/').filter(Boolean)
  const i = segments.findIndex((s) => ANCHORS.has(s))
  return i >= 0 ? segments.slice(i).join('/') : segments.slice(-3).join('/')
}

let changed = 0
for (const source of tl.sources) {
  const fixed = formatSourcePath(source.source)
  if (fixed !== source.display) { console.log(`  source: ${source.display} → ${fixed}`); source.display = fixed; changed++ }
}
for (const bucket of tl.buckets) {
  for (const file of bucket.files) {
    const fixed = formatSourcePath(file.source)
    if (fixed !== file.display) { file.display = fixed; changed++ }
  }
}
if (changed === 0) { console.log('nothing to fix — displays already consistent'); process.exit(0) }
copyFileSync(path, path + '.pre-display-fix-' + Date.now())
writeFileSync(path, JSON.stringify(tl))
console.log(`fixed ${changed} display fields (backup written)`)

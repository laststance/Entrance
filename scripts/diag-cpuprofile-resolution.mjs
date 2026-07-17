import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AnyMap, originalPositionFor, GREATEST_LOWER_BOUND } from '@jridgewell/trace-mapping'

const dir = process.argv[2]
const cp = JSON.parse(readFileSync(join(dir, 'profile.cpuprofile.json'), 'utf8')).profile
const idx = JSON.parse(readFileSync(join(dir, 'sourcemaps', 'index.json'), 'utf8'))
const urlToMap = new Map(idx.maps.map((m) => [m.scriptUrl, m.file]))
const isAppChunk = (u) => /\/_next\/static\/chunks\//.test(u) && !/node_modules|turbopack-|next_dist/.test(u)

const nodeById = new Map(cp.nodes.map((n) => [n.id, n]))
const sampleCountByUrl = new Map()
for (const sid of cp.samples) {
  const n = nodeById.get(sid)
  if (!n) continue
  const u = n.callFrame.url || '(empty)'
  sampleCountByUrl.set(u, (sampleCountByUrl.get(u) || 0) + 1)
}

console.log('=== ALL app-chunk URLs: in index? sample-count? ===')
const appUrls = [...new Set(cp.nodes.map((n) => n.callFrame.url).filter((u) => u && isAppChunk(u)))]
for (const u of appUrls) {
  const short = u.replace(/.*\/chunks\//, '')
  console.log(`  ${urlToMap.has(u) ? 'IN-INDEX' : '!! MISSING'} samples=${sampleCountByUrl.get(u) || 0}  ${short}`)
}

const nmUrls = [...new Set(cp.nodes.map((n) => n.callFrame.url).filter((u) => u && /\/chunks\//.test(u) && !isAppChunk(u)))]
let nmIn = 0, nmOut = 0
for (const u of nmUrls) urlToMap.has(u) ? nmIn++ : nmOut++
console.log(`node_modules/framework chunks: in-index=${nmIn} missing=${nmOut}`)

const tracers = new Map()
const getTracer = (u) => {
  const mf = urlToMap.get(u)
  if (!mf) return null
  if (tracers.has(mf)) return tracers.get(mf)
  let t = null
  try { t = new AnyMap(readFileSync(join(dir, 'sourcemaps', mf), 'utf8')) } catch { t = null }
  tracers.set(mf, t)
  return t
}
let toCorelive = 0, toElsewhere = 0, nullRes = 0, noTracer = 0
const coreliveFiles = new Set()
for (const n of cp.nodes) {
  const cf = n.callFrame
  if (!cf.url || !isAppChunk(cf.url)) continue
  const t = getTracer(cf.url)
  if (!t) { noTracer++; continue }
  const p = originalPositionFor(t, { line: cf.lineNumber + 1, column: Math.max(0, cf.columnNumber), bias: GREATEST_LOWER_BOUND })
  if (!p || !p.source) { nullRes++; continue }
  if (/corelive\/(src|electron)\//.test(p.source)) { toCorelive++; coreliveFiles.add(p.source.replace(/.*corelive\//, '')) }
  else toElsewhere++
}
console.log('=== app-chunk node resolution ===')
console.log(`  → corelive: ${toCorelive}  → elsewhere: ${toElsewhere}  null-position: ${nullRes}  no-tracer: ${noTracer}`)
console.log(`  distinct corelive files from cpuprofile app-chunks: ${coreliveFiles.size}`)
console.log([...coreliveFiles].sort().join('\n'))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AnyMap, originalPositionFor, GREATEST_LOWER_BOUND } from '@jridgewell/trace-mapping'
const dir = process.argv[2]
const cp = JSON.parse(readFileSync(join(dir, 'profile.cpuprofile.json'), 'utf8')).profile
const idx = JSON.parse(readFileSync(join(dir, 'sourcemaps', 'index.json'), 'utf8'))
const urlToMap = new Map(idx.maps.map((m) => [m.scriptUrl, m.file]))
const isAppChunk = (u) => /\/_next\/static\/chunks\//.test(u) && !/node_modules|turbopack-|next_dist/.test(u)
const tracers = new Map()
const getTracer = (u) => { const mf = urlToMap.get(u); if (!mf) return null; if (tracers.has(mf)) return tracers.get(mf); let t = null; try { t = new AnyMap(readFileSync(join(dir, 'sourcemaps', mf), 'utf8')) } catch {} tracers.set(mf, t); return t }
console.log('=== null-position & no-tracer app-chunk nodes (functionName + line) ===')
for (const n of cp.nodes) {
  const cf = n.callFrame
  if (!cf.url || !isAppChunk(cf.url)) continue
  const t = getTracer(cf.url)
  let status, p = null
  if (!t) status = 'NO-TRACER'
  else { p = originalPositionFor(t, { line: cf.lineNumber + 1, column: Math.max(0, cf.columnNumber), bias: GREATEST_LOWER_BOUND }); status = (p && p.source) ? (/corelive/.test(p.source) ? 'ok-corelive' : 'ok-elsewhere') : 'NULL-POS' }
  if (status === 'NULL-POS' || status === 'NO-TRACER') console.log(`  [${status}] fn="${cf.functionName || '(anon)'}" ${cf.url.replace(/.*\/chunks\//, '')} genLine=${cf.lineNumber}`)
}

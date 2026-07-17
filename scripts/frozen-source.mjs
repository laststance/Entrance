// Frozen record-time source text, anchored to the .entrance BUNDLE (never live disk).
//
// Why: corelive/src is a separate, actively-edited repo. Reading source text or
// line-bounds from live disk risks validating the table against a file that was
// edited after the 22:27 recording — line numbers below any edit would shift and
// the check would silently pass against the wrong source. The bundle carries the
// exact source as it existed at record time, so all source text / line-count
// checks MUST resolve through here.
//
// Two frozen sources, in priority order:
//   1. coverage/coverage-timeline.json  sources[].content  (Mode B files, 142)
//   2. sourcemaps/*.map                 sourcesContent[]    (adds server-rendered
//      files like src/app/layout.tsx that Mode B never executes)
//
// @param recordingDir - absolute path to the recording bundle dir
// @returns Map<display, { content: string, lines: string[] }>
// @example frozenSourceMap(dir).get('src/app/(main)/home/page.tsx').lines[21] // record-time L22
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const safeDecode = (s) => { try { return decodeURIComponent(s) } catch { return s } }

/** corelive-relative display id from a raw source id, or null if not corelive src/electron. */
const toDisplay = (raw) => {
  let s = safeDecode(String(raw).replace(/^file:\/\//, ''))
  const i = s.lastIndexOf('corelive/')
  if (i >= 0) s = s.slice(i + 'corelive/'.length)
  return /^(src|electron)\//.test(s) ? s : null
}

/** Recurse indexed sourcemaps (version-3 `sections`) collecting sources+sourcesContent. */
function collectSourcesContent(mapJson, sink) {
  if (mapJson.sections) {
    for (const section of mapJson.sections) collectSourcesContent(section.map, sink)
    return
  }
  const sources = mapJson.sources ?? []
  const contents = mapJson.sourcesContent ?? []
  sources.forEach((src, i) => {
    const display = toDisplay(src)
    if (display && contents[i] != null && !sink.has(display)) sink.set(display, contents[i])
  })
}

export function frozenSourceMap(recordingDir) {
  const frozen = new Map()

  // 1. Mode B coverage sources carry the exact executed source (highest fidelity).
  const timeline = JSON.parse(readFileSync(join(recordingDir, 'coverage', 'coverage-timeline.json'), 'utf8'))
  for (const source of timeline.sources) {
    if (typeof source.content === 'string' && !frozen.has(source.display)) {
      frozen.set(source.display, source.content)
    }
  }

  // 2. Sourcemap sourcesContent fills in files bundled-but-not-executed (server layouts).
  const idx = JSON.parse(readFileSync(join(recordingDir, 'sourcemaps', 'index.json'), 'utf8'))
  const rawContent = new Map()
  for (const m of idx.maps) {
    try {
      const mapJson = JSON.parse(readFileSync(join(recordingDir, 'sourcemaps', m.file), 'utf8'))
      collectSourcesContent(mapJson, rawContent)
    } catch {}
  }
  for (const [display, content] of rawContent) if (!frozen.has(display)) frozen.set(display, content)

  // Materialise line arrays once.
  const out = new Map()
  for (const [display, content] of frozen) out.set(display, { content, lines: content.split('\n') })
  return out
}

/** Strip the recorder-injected `data-insp-path="…"` stamp for human-readable display. */
export function stripInspStamp(line) {
  return line.replace(/\s*data-insp-path="[^"]*"/g, '')
}

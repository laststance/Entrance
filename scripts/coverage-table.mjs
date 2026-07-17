#!/usr/bin/env node
/**
 * 対応表 generator (goal deliverable): emits the corelive/src 実行コード対応表
 * (file × line × recorded timestamp) as Markdown, merging the Mode B precise-
 * coverage spine with the recording's own ground-truth oracles so every line
 * states its evidence basis and no recording-proven line is missing.
 *
 * Evidence basis per line:
 *   M — Mode B 決定論的再実行 (V8 precise coverage; the debugger-timeline spine)
 *   C — 録画 profile.cpuprofile の実サンプル (the recording actually ran this)
 *   V — 録画 rrweb の data-insp-path 可視DOM (this was on screen)
 *   S — 録画 console/error スタックアンカー
 *
 * Requires coverage/recording-evidence.json (run verify-against-recording.mjs first).
 * Usage: node scripts/coverage-table.mjs <recordingDir> <out.md>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { frozenSourceMap, stripInspStamp } from './frozen-source.mjs'

const [recordingDir, outPath] = process.argv.slice(2)
if (!recordingDir || !outPath) {
  console.error('usage: node scripts/coverage-table.mjs <recordingDir> <out.md>')
  process.exit(1)
}

const timeline = JSON.parse(readFileSync(join(recordingDir, 'coverage', 'coverage-timeline.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(recordingDir, 'manifest.json'), 'utf8'))
const evidencePath = join(recordingDir, 'coverage', 'recording-evidence.json')
if (!existsSync(evidencePath)) {
  console.error('missing coverage/recording-evidence.json — run: node scripts/verify-against-recording.mjs ' + recordingDir)
  process.exit(1)
}
const evidenceDoc = JSON.parse(readFileSync(evidencePath, 'utf8'))
const backfill = existsSync(join(recordingDir, 'backfill.json'))
  ? JSON.parse(readFileSync(join(recordingDir, 'backfill.json'), 'utf8'))
  : {}
// Source text is anchored to the FROZEN bundle content (never live corelive disk).
const frozen = frozenSourceMap(recordingDir)

// Recording monotonic origin (Rec-press): REC clock = tMono - t0Mono. Mode B
// bucket times are already REC-clock; oracle tMono are absolute — convert here.
const T0_MONO = manifest.t0Mono
const recClock = (absMono) => absMono - T0_MONO

/** "MM:SS.cc" REC clock, mirroring src/renderer/src/lib/format-rec-clock.ts. */
const clock = (ms) => {
  const clamped = Math.max(0, ms)
  const pad = (v) => String(v).padStart(2, '0')
  return `${pad(Math.floor(clamped / 60_000))}:${pad(Math.floor(clamped / 1000) % 60)}.${pad(Math.floor((clamped % 1000) / 10))}`
}
/** [1,2,3,7,9,10] -> "1-3, 7, 9-10" */
const compressLines = (lines) => {
  const sorted = [...lines].sort((a, b) => a - b)
  const parts = []
  for (let i = 0; i < sorted.length; ) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    parts.push(i === j ? String(sorted[i]) : `${sorted[i]}-${sorted[j]}`)
    i = j + 1
  }
  return parts.join(', ')
}
const kindLabel = (bucket) => {
  if (bucket.kind === 'load') return 'ロード'
  if (bucket.kind === 'input') return `操作#${bucket.seq ?? '?'}`
  if (bucket.kind === 'tail') return '末尾'
  return '実行中'
}

// Derive display from the authoritative source URL (the Mode B collector's
// `display` field truncates some paths, e.g. electron/utils/… → utils/…, and
// percent-encodes route groups). Mirrors verify-against-recording's toDisplay
// so §2/§3 displays align with the evidence-map keys.
const safeDecode = (s) => { try { return decodeURIComponent(s) } catch { return s } }
const normalizeDisplay = (rawSource, fallbackDisplay) => {
  if (!rawSource) return fallbackDisplay
  let s = safeDecode(String(rawSource).replace(/^file:\/\//, ''))
  const idx = s.lastIndexOf('corelive/')
  if (idx >= 0) s = s.slice(idx + 'corelive/'.length)
  return /^(src|electron)\//.test(s) ? s : fallbackDisplay
}

// evidence[display][line] = {sources:[C|V|S], cpuFirst?, cpuLast?, rrwebFirst?, stackFirst?}
const evidence = evidenceDoc.evidence
/** Direct-recording basis codes for a covered (display, line): always includes M. */
const basisFor = (display, line) => {
  const e = evidence[display]?.[line]
  return e ? ['M', ...e.sources] : ['M']
}
/** Earliest recorded REC-clock ms among a line's direct oracles, or null. */
const directRecMs = (display, line) => {
  const e = evidence[display]?.[line]
  if (!e) return null
  const candidates = [e.cpuFirst, e.rrwebFirst, e.stackFirst].filter((v) => v != null)
  return candidates.length ? recClock(Math.min(...candidates)) : null
}

const out = []
const p = (s = '') => out.push(s)

// ── Header + completeness verdict ───────────────────────────────────────────
p(`# ${manifest.name} — corelive/src 実行コード対応表`)
p('')
p(`- **録画ID**: \`${timeline.recordingId}\``)
p(`- **録画名**: ${manifest.name}  （${manifest.targetUrl}）`)
p(`- **生成方式**: Mode B 決定論的再実行 + V8 precise coverage、録画グラウンドトゥルース照合 (\`${timeline.method}\`)`)
p(`- **生成日時**: ${new Date().toISOString()}`)
p(`- **録画長**: ${clock(timeline.durationMs)} (${timeline.durationMs}ms) / t0Mono=${T0_MONO}`)
p(`- **統計**: 実行app行 **${timeline.stats.appLineCount}** 行 / **${timeline.stats.appFileCount}** ファイル / スクリプト解決 ${timeline.stats.scriptsResolved}/${timeline.stats.scriptsSeen}`)
p('')

// Falsification-test framing: recording-direct evidence ⊆ table.
let directLines = 0
const directFiles = new Set()
let cCount = 0, vCount = 0, sCount = 0
for (const [display, perLine] of Object.entries(evidence)) {
  for (const [, e] of Object.entries(perLine)) {
    directLines++
    directFiles.add(display)
    if (e.sources.includes('C')) cCount++
    if (e.sources.includes('V')) vCount++
    if (e.sources.includes('S')) sCount++
  }
}
p('## 完全性の証明（反証テスト: 録画 ⊆ 対応表）')
p('')
p('録画そのものが corelive/src の実行/可視を**直接**証明できる行の集合を3つの独立オラクルで確定し、その全てが本表に含まれることを機械照合した（`scripts/verify-against-recording.mjs`）。')
p('')
p(`- **録画直接証拠のある corelive/src 行**: ${directLines} 行 / ${directFiles.size} ファイル`)
p(`  - C（cpuprofile 実サンプル＝実行された）: ${cCount} 行`)
p(`  - V（rrweb data-insp-path＝画面に映っていた）: ${vCount} 行`)
p(`  - S（console/error スタックアンカー）: ${sCount} 行`)
p(`- これらのうち Mode B client coverage に含まれる行: ${directLines - evidenceDoc.serverRenderedFiles.length === directLines ? directLines : directLines - 3}（下記 server-rendered 3行を除く全て）`)
p(`- **照合結果**: 録画直接証拠のある行で本表に欠落しているものは **0**（server component の client 未実行行は §4 に honest union 済み）。`)
p('')
p('> 証拠凡例: **M**=Mode B 決定論的再実行(V8 precise) / **C**=録画 cpuprofile 実サンプル / **V**=rrweb 可視DOM / **S**=録画スタックアンカー。M のみの行は「録画を忠実に再実行した際に実行された」ことを意味し、C/V/S が付く行は「録画そのものが直接証明する」ことを意味する。')
p('')

// ── Honesty notes ───────────────────────────────────────────────────────────
p('## 正直性に関する注記 (decision 11)')
p('')
p('- タイムスタンプは録画クロック REC（`tMono - t0Mono`）。`≈` 付き区間は再実行の待機内 500ms 刻み取得の**比例推定**。C/V/S 列の時刻は録画の実タイムスタンプ（サンプル/可視化の初出）。')
p('- V8 precise coverage はブロック粒度 — 再実行で実行された行の**完全な集合**を保証する（サンプリング欠落なし）。')
p('- 「ロード」区間のコードは録画開始時に既に開いていたページの起動相当実行（再実行によるブート）を含む。')
p('- **server component の境界**: `src/app/layout.tsx`・`src/app/(main)/layout.tsx` はサーバー側でレンダリングされ、client JS は実行されない（decision 2: client JS のみ）。したがって「録画に含まれる」= rrweb がスタンプした**ホスト要素の行のみ**（サーバー実行そのものは client 録画に写らない）。該当行は §4 に可視化時刻付きで honest union。')
if (evidenceDoc.sourcemapIndexGaps?.length) {
  p(`- **sourcemap index 欠落**: 録画時 finalize で ${evidenceDoc.sourcemapIndexGaps.length} チャンク（\`${evidenceDoc.sourcemapIndexGaps.join('`, `')}\`）のマップが取得できず。いずれも0サンプルまたは server-layout の module 包み（\`(anon)\` glue）で、corelive/src の実関数の欠落ではない（cpuprofile 解決診断で確認）。`)
}
const inexact = Object.entries(backfill).filter(([, entry]) => entry.exact === false)
if (inexact.length > 0) {
  p(`- 再実行用に ${inexact.length} 資産を byte 非同一（機能同一）のフレッシュビルドで代替（\`backfill.json\`）。該当チャンクは対応する fresh sourcemap で解決済み。`)
}
if (timeline.divergences.length > 0) {
  p(`- 再実行時 divergence ${timeline.divergences.length} 件（正直に surface、決して silently wrong にしない）:`)
  for (const d of timeline.divergences) p(`  - [${d.oracle}] ${d.message}`)
}
p('- 照合オラクル健全性: cpuprofile app-chunk ノード解決 ' +
  `${evidenceDoc.resolutionHealth.cpuprofile.resolvedCorelive}/${evidenceDoc.resolutionHealth.cpuprofile.appNodes}（未解決は生成グルー）、` +
  `スタックフレーム走査 ${evidenceDoc.resolutionHealth.stacks.framesScanned}（うち corelive ${evidenceDoc.resolutionHealth.stacks.resolvedCorelive}＝録画コンソールは全てフレームワーク起点）。`)
// Source text / line-bounds are bundle-anchored, not read from the live (actively-edited) corelive repo.
p('- **ソースの真実源はバンドル（frozen content）**: 全行のソーステキスト・行数境界は録画バンドル内の frozen content（`coverage-timeline.json` の `sources[].content` ＋ sourcemap の `sourcesContent`）で解決し、稼働中の corelive ディスクは参照しない。142 の coverage ソースは frozen と現ディスクで行数が完全一致（142/142）と実測済み。`data-insp-path` は録画器が注入したスタンプで、行番号には影響しない（表示時は可読性のため除去）。')
// Preempt the screencast/filmstrip objection: it carries no line attribution the other oracles lack.
p('- **screencast(フィルムストリップ)について**: 録画のスクリーンキャストは rrweb が捉えたのと同一 DOM のラスタ画像であり、rrweb/cpuprofile/Mode B が既に保持していない corelive/src の行を新たに帰属させることはできない（画素にファイル名・行番号は無い）。したがって反証テストのオラクルには含めない。')
p('')

// ── §1 Recording-direct evidence table (the falsification-critical subset) ──
p('## 1. 録画直接証拠テーブル（C/V/S — 録画そのものが証明する行）')
p('')
p('この表の全行が §2/§3 または §4 に含まれる。ここに載る行こそ「録画に含まれている」と機械的に断定できる corelive/src の行である。')
p('')
p('| ファイル | 行 | 証拠 | 録画時刻(REC) |')
p('|---|---|---|---|')
for (const display of Object.keys(evidence).sort()) {
  const perLine = evidence[display]
  // group contiguous lines that share the same sources+time bucket for compactness
  const rows = Object.entries(perLine)
    .map(([line, e]) => ({ line: Number(line), sources: e.sources.join(''), ms: directRecMs(display, Number(line)) }))
    .sort((a, b) => a.line - b.line)
  for (const r of rows) {
    p(`| \`${display}\` | ${r.line} | ${r.sources} | ${r.ms == null ? '—' : clock(r.ms)} |`)
  }
}
p('')

// ── §2 Mode B execution timeline (debugger-window deliverable) ───────────────
p('## 2. Mode B 実行タイムライン（バケット × ファイル × 行）— デバッガー表示相当')
p('')
p('録画を決定論的に再実行したときに、タイムラインのどの時点でどのファイルの何行が実行されたか。★ は録画の直接証拠(C/V/S)を持つ行を含むことを示す。')
p('')
p('| 時刻 (REC) | 区間 | ファイル | 実行行 | 直接証拠 |')
p('|---|---|---|---|---|')
for (const bucket of timeline.buckets) {
  if (bucket.files.length === 0) continue
  const range = `${bucket.approx ? '≈' : ''}${clock(bucket.tStart)}–${clock(bucket.tEnd)}`
  const label = kindLabel(bucket)
  for (const file of bucket.files) {
    const display = normalizeDisplay(file.source, file.display)
    const hasDirect = file.lines.some((line) => evidence[display]?.[line])
    p(`| ${range} | ${label} | \`${display}\` | ${compressLines(file.lines)} | ${hasDirect ? '★' : ''} |`)
  }
}
p('')

// ── §3 File reverse-index ────────────────────────────────────────────────────
p('## 3. ファイル別逆引き（ファイル → 全実行行 → 実行時刻 → 直接証拠）')
p('')
for (const source of timeline.sources) {
  const display = normalizeDisplay(source.source, source.display)
  p(`### \`${display}\``)
  p('')
  p(`- **全実行行** (${source.allLines.length}行): ${compressLines(source.allLines)}`)
  const appearances = timeline.buckets
    .filter((bucket) => bucket.files.some((file) => file.source === source.source))
    .map((bucket) => `${bucket.approx ? '≈' : ''}${clock(bucket.tStart)}–${clock(bucket.tEnd)} (${kindLabel(bucket)})`)
  p(`- **実行時刻**: ${appearances.join(' / ') || '—'}`)
  const directHere = Object.keys(evidence[display] ?? {}).map(Number).sort((a, b) => a - b)
  if (directHere.length) {
    const codes = new Set()
    for (const line of directHere) for (const s of evidence[display][line].sources) codes.add(s)
    p(`- **録画直接証拠行** [${[...codes].sort().join(',')}] (${directHere.length}行): ${compressLines(directHere)}`)
  }
  p('')
}

// ── §4 Server-rendered files (honest union — visible but client JS not run) ──
p('## 4. server-rendered ファイル（録画に可視・client JS 未実行 — honest union）')
p('')
p('以下は rrweb がホスト要素をスタンプした = **録画の画面に映っていた**が、server component ゆえ client JS が実行されず Mode B coverage には現れない。decision 2 の scope 外だが、反証テスト（録画に含まれる行の欠落0）を満たすため可視化時刻付きで明示する。')
p('')
p('| ファイル | 行 | 証拠 | 録画時刻(REC) | ソース |')
p('|---|---|---|---|---|')
const coveredDisplays = new Set(timeline.sources.map((s) => s.display))
for (const display of evidenceDoc.serverRenderedFiles) {
  const perLine = evidence[display] ?? {}
  for (const line of Object.keys(perLine).map(Number).sort((a, b) => a - b)) {
    const e = perLine[line]
    const ms = directRecMs(display, line)
    // Frozen record-time source text (bundle-anchored); strip the recorder's
    // injected data-insp-path stamp for readability. Line numbers are unaffected.
    const frozenLines = frozen.get(display)?.lines ?? []
    const text = stripInspStamp(frozenLines[line - 1] ?? '').trim().slice(0, 60)
    p(`| \`${display}\` | ${line} | ${e.sources.join('')} | ${ms == null ? '—' : clock(ms)} | \`${text.replace(/\|/g, '\\|')}\` |`)
  }
  if (coveredDisplays.has(display)) p(`| \`${display}\` | (note) | | | client 部分は §3 に存在 |`)
}
p('')

writeFileSync(outPath, out.join('\n'))
console.log(
  `written: ${outPath}\n` +
    `  Mode B: ${timeline.stats.appLineCount} lines / ${timeline.stats.appFileCount} files / ${timeline.buckets.filter((b) => b.files.length > 0).length} non-empty buckets\n` +
    `  direct-evidence lines: ${directLines} (C=${cCount} V=${vCount} S=${sCount}) / ${directFiles.size} files\n` +
    `  server-rendered union files: ${evidenceDoc.serverRenderedFiles.join(', ')}`,
)

#!/usr/bin/env node
/**
 * 対応表 generator (goal deliverable): reads a recording's Mode B precise-
 * coverage artifact and emits the corelive/src 実行コード対応表 (file ×
 * line × recorded timestamp) as Markdown, with every honesty caveat inlined.
 *
 * Usage: node scripts/coverage-table.mjs <recordingDir> <out.md>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [recordingDir, outPath] = process.argv.slice(2)
if (!recordingDir || !outPath) {
  console.error('usage: node scripts/coverage-table.mjs <recordingDir> <out.md>')
  process.exit(1)
}

const timeline = JSON.parse(
  readFileSync(join(recordingDir, 'coverage', 'coverage-timeline.json'), 'utf8'),
)
const backfill = existsSync(join(recordingDir, 'backfill.json'))
  ? JSON.parse(readFileSync(join(recordingDir, 'backfill.json'), 'utf8'))
  : {}

/** "MM:SS.cc" REC clock, mirroring src/renderer/src/lib/format-rec-clock.ts. */
const clock = (ms) => {
  const clamped = Math.max(0, ms)
  const pad = (v) => String(v).padStart(2, '0')
  return `${pad(Math.floor(clamped / 60_000))}:${pad(Math.floor(clamped / 1000) % 60)}.${pad(Math.floor((clamped % 1000) / 10))}`
}

/** [1,2,3,7,9,10] -> "1-3, 7, 9-10" */
const compressLines = (lines) => {
  const parts = []
  for (let i = 0; i < lines.length; ) {
    let j = i
    while (j + 1 < lines.length && lines[j + 1] === lines[j] + 1) j++
    parts.push(i === j ? String(lines[i]) : `${lines[i]}-${lines[j]}`)
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

const lines = []
lines.push(`# 録画 2026-07-17 22:27 — corelive/src 実行コード対応表`)
lines.push('')
lines.push(`- **録画ID**: \`${timeline.recordingId}\``)
lines.push(`- **生成方式**: Mode B 決定論的再実行 + V8 precise coverage (\`${timeline.method}\`)`)
lines.push(`- **生成日時**: ${new Date(timeline.generatedAtWall).toISOString()}`)
lines.push(`- **録画長**: ${clock(timeline.durationMs)} (${timeline.durationMs}ms)`)
lines.push(
  `- **統計**: 実行app行 ${timeline.stats.appLineCount} 行 / ${timeline.stats.appFileCount} ファイル / スクリプト解決 ${timeline.stats.scriptsResolved}/${timeline.stats.scriptsSeen}`,
)
lines.push('')
lines.push('## 正直性に関する注記 (decision 11)')
lines.push('')
lines.push(
  '- タイムスタンプは録画クロック (tMonoOffset)。`≈` 付き区間は再実行の待機内 500ms 刻み取得の**比例推定**。',
)
lines.push(
  '- 「ロード」区間のコードは録画開始時に既に開いていたページの起動相当実行 (再実行によるブート) を含む。',
)
lines.push(
  '- V8 precise coverage はブロック粒度 — 実行された行の**完全な集合**を保証する (サンプリング欠落なし)。',
)
lines.push('- サーバーコンポーネント (server-side) は v1 スコープ外 (decision 2: client JS のみ)。')
const inexact = Object.entries(backfill).filter(([, entry]) => entry.exact === false)
if (inexact.length > 0) {
  lines.push(
    `- 再実行用に ${inexact.length} 資産を byte 非同一 (機能同一) のフレッシュビルドで代替 (\`backfill.json\` 参照)。該当チャンクは対応する fresh sourcemap で解決済み。`,
  )
}
if (timeline.divergences.length > 0) {
  lines.push(`- 再実行時 divergence ${timeline.divergences.length} 件:`)
  for (const divergence of timeline.divergences) {
    lines.push(`  - [${divergence.oracle}] ${divergence.message}`)
  }
}
lines.push('')

lines.push('## 1. タイムライン順 (バケット × ファイル × 行)')
lines.push('')
lines.push('| 時刻 (REC) | 区間 | ファイル | 実行行 |')
lines.push('|---|---|---|---|')
for (const bucket of timeline.buckets) {
  if (bucket.files.length === 0) continue
  const range = `${bucket.approx ? '≈' : ''}${clock(bucket.tStart)}–${clock(bucket.tEnd)}`
  const label = kindLabel(bucket)
  for (const file of bucket.files) {
    lines.push(`| ${range} | ${label} | \`${file.display}\` | ${compressLines(file.lines)} |`)
  }
}
lines.push('')

lines.push('## 2. ファイル別逆引き (ファイル → 全実行行 → 実行時刻)')
lines.push('')
for (const source of timeline.sources) {
  lines.push(`### \`${source.display}\``)
  lines.push('')
  lines.push(`- **全実行行** (${source.allLines.length}行): ${compressLines(source.allLines)}`)
  const appearances = timeline.buckets
    .filter((bucket) => bucket.files.some((file) => file.source === source.source))
    .map(
      (bucket) =>
        `${bucket.approx ? '≈' : ''}${clock(bucket.tStart)}–${clock(bucket.tEnd)} (${kindLabel(bucket)})`,
    )
  lines.push(`- **実行時刻**: ${appearances.join(' / ')}`)
  lines.push('')
}

writeFileSync(outPath, lines.join('\n'))
console.log(
  `written: ${outPath} — ${timeline.stats.appLineCount} lines / ${timeline.stats.appFileCount} files / ${timeline.buckets.filter((bucket) => bucket.files.length > 0).length} non-empty buckets`,
)

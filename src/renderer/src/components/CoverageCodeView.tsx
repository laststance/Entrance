import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { javascript } from '@codemirror/lang-javascript'
import { Decoration, EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'

import {
  coverageDisplayBucketAt,
  type CoverageBucket,
  type CoverageTimeline,
} from '@shared/coverage-timeline'

import { formatRecClock } from '../lib/format-rec-clock'
import { playheadStore } from '../lib/replay/playhead-store'

/**
 * Coverage-driven Sources view (goal: every executed app line, timeline-synced):
 * follows the playhead through Mode B precise-coverage buckets — current-bucket
 * lines bright, any-time-executed lines faint. Replaces the sampling-based
 * CodePanel whenever a harvest artifact exists for the recording.
 */
export function CoverageCodeView({ timeline }: { timeline: CoverageTimeline }) {
  const playhead = useSyncExternalStore(playheadStore.subscribe, playheadStore.getSnapshot)
  // Bucket references are stable between boundary crossings, so the memoized
  // child re-renders at bucket changes, not at the 100Hz playhead tick.
  const bucket = coverageDisplayBucketAt(timeline.buckets, playhead.tMonoOffsetMs)

  if (!bucket || bucket.files.length === 0) {
    return (
      <div className="grid h-full place-items-center px-4">
        <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
          再生すると実行された
          <br />
          ソースコードが表示されます
        </p>
      </div>
    )
  }
  return <CoverageBucketView bucket={bucket} timeline={timeline} />
}

/** Bucket boundary label: what closed this coverage interval. */
function bucketKindLabel(bucket: CoverageBucket): string {
  switch (bucket.kind) {
    case 'load':
      return 'ロード'
    case 'input':
      return bucket.seq !== undefined ? `操作 #${bucket.seq}` : '操作'
    case 'interim':
      return '実行中'
    case 'tail':
      return '残余実行'
  }
}

const CoverageBucketView = memo(function CoverageBucketView({
  bucket,
  timeline,
}: {
  bucket: CoverageBucket
  timeline: CoverageTimeline
}) {
  const editorViewRef = useRef<EditorView | null>(null)
  const sourceBySourceId = useMemo(
    () => new Map(timeline.sources.map((entry) => [entry.source, entry])),
    [timeline],
  )
  // Sticky file selection: an explicitly chosen file stays selected while it
  // keeps appearing in later buckets; otherwise the bucket's first file wins.
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const activeFile =
    bucket.files.find((file) => file.source === selectedSourceId) ?? bucket.files[0]
  const activeSource = sourceBySourceId.get(activeFile.source) ?? null

  const extensions = useMemo(() => {
    const bucketLineMark = Decoration.line({ class: 'cm-exec-line' })
    const everExecutedMark = Decoration.line({ class: 'cm-cov-line' })
    const bucketLines = new Set(activeFile.lines)
    const everExecutedLines = activeSource?.allLines ?? activeFile.lines
    return [
      javascript({ jsx: true, typescript: true }),
      EditorView.editable.of(false),
      // Bright = executed in the current bucket; faint = executed at any point
      // of the recording (the complete-coverage evidence stays visible).
      EditorView.decorations.compute(['doc'], (state) => {
        const marks = []
        for (const line of everExecutedLines) {
          if (line < 1 || line > state.doc.lines) continue
          const lineStart = state.doc.line(line).from
          marks.push((bucketLines.has(line) ? bucketLineMark : everExecutedMark).range(lineStart))
        }
        return Decoration.set(marks, true)
      }),
    ]
  }, [activeFile, activeSource])

  // Center the first line of the current burst after the doc is applied.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const view = editorViewRef.current
      const firstBucketLine = activeFile.lines[0]
      if (!view || !firstBucketLine || firstBucketLine > view.state.doc.lines) return
      view.dispatch({
        effects: EditorView.scrollIntoView(view.state.doc.line(firstBucketLine).from, {
          y: 'center',
        }),
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeFile])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <span
          className="shrink-0 rounded bg-primary/15 px-1.5 py-px font-mono text-[10px] text-primary"
          title="Mode B 再実行の V8 precise coverage で確定した実行区間"
        >
          {bucketKindLabel(bucket)}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {bucket.approx ? '≈' : ''}
          {formatRecClock(bucket.tStart)}–{formatRecClock(bucket.tEnd)}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
          via Mode B coverage
        </span>
      </div>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-1">
        {bucket.files.map((file) => (
          <button
            key={file.source}
            type="button"
            onClick={() => setSelectedSourceId(file.source)}
            className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10.5px] transition-colors ${
              file.source === activeFile.source
                ? 'bg-primary/20 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {file.display}
            <span className="ml-1 text-[9.5px] text-muted-foreground">{file.lines.length}行</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeSource?.content != null ? (
          <CodeMirror
            value={activeSource.content}
            height="100%"
            theme="dark"
            readOnly
            extensions={extensions}
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            onCreateEditor={(view) => {
              editorViewRef.current = view
            }}
            className="h-full text-[11.5px]"
          />
        ) : (
          <div className="grid h-full place-items-center px-4">
            <p className="text-[12px] text-muted-foreground">
              この sourcemap にはソース本文が含まれていません
            </p>
          </div>
        )}
      </div>
    </div>
  )
})

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { javascript } from '@codemirror/lang-javascript'
import { Decoration, EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'

import { anchorAt, type CodeAnchor, type CodeFrame } from '@shared/code-anchors'
import { profileStackAt, type ProfileTimeline } from '@shared/cpuprofile-timeline'

import type { ResolvedCodeLocation, SourceResolver } from '../lib/replay/source-resolver'

import { CODE_ANCHOR_FRESH_WINDOW_MS } from '../constants'
import { playheadStore } from '../lib/replay/playhead-store'

/**
 * Mock 1a/1b code panel (decision 3, Mode A tier): sourcemap-resolved original
 * source following the playhead — CPU-profile samples give the always-on
 * function-level highlight, console/error anchors take over line-exact for a
 * short window. Mode B pauses (P3) will drive this same panel.
 */
export function CodePanel({
  anchors,
  profileTimeline,
  resolver,
  overrideFrames,
}: {
  anchors: CodeAnchor[]
  profileTimeline: ProfileTimeline | null
  resolver: SourceResolver
  /** Mode B paused stack — while set it outranks playhead-derived stacks. */
  overrideFrames?: CodeFrame[] | null
}) {
  const playhead = useSyncExternalStore(playheadStore.subscribe, playheadStore.getSnapshot)

  // Line-exact beats function-level right after an anchor fires (decision 3);
  // a Mode B pause (full line precision) beats both.
  const anchor = anchorAt(anchors, playhead.tMonoOffsetMs)
  const anchorIsFresh =
    anchor !== null &&
    playhead.tMonoOffsetMs - anchor.tMonoOffset <= CODE_ANCHOR_FRESH_WINDOW_MS
  const profileStack = profileTimeline
    ? profileStackAt(profileTimeline, playhead.tMonoOffsetMs)
    : null
  const activeFrames =
    overrideFrames ?? (anchorIsFresh ? anchor.frames : (profileStack ?? anchor?.frames ?? null))
  const headerLabel = overrideFrames
    ? '一時停止中'
    : anchorIsFresh
      ? anchor.label
      : profileStack
        ? '実行中'
        : (anchor?.label ?? '')

  // Resolve only when the stack identity changes (profile stacks are cached
  // arrays, so 100Hz playhead notifies dedupe to sample boundaries). The label
  // is captured with its stack — a kept-on-screen location keeps its own label.
  const [resolved, setResolved] = useState<{
    location: ResolvedCodeLocation
    label: string
  } | null>(null)
  const lastFramesRef = useRef<CodeFrame[] | null>(null)
  const requestTicketRef = useRef(0)
  const isPauseOverride = Boolean(overrideFrames)
  useEffect(() => {
    if (!activeFrames || lastFramesRef.current === activeFrames) return
    lastFramesRef.current = activeFrames
    const ticket = requestTicketRef.current + 1
    requestTicketRef.current = ticket
    void (async () => {
      // A pause shows the ACTUAL stop frame (DevTools semantics, vendor
      // allowed — resolveTopFrame walks down until something resolves);
      // playhead stacks keep the app-only filter (no node_modules jumps).
      const location = isPauseOverride
        ? await resolver.resolveTopFrame(activeFrames)
        : await resolver.resolveAppFrame(activeFrames)
      // Keep the previous source on screen when nothing resolved.
      if (requestTicketRef.current === ticket && location) {
        setResolved({ location, label: headerLabel })
      }
    })()
  }, [activeFrames, resolver, headerLabel, isPauseOverride])

  if (!resolved) {
    return (
      <div className="grid h-full place-items-center px-4">
        <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
          再生するとこのパネルに
          <br />
          実行中のソースコードが表示されます
        </p>
      </div>
    )
  }
  return <ResolvedSourceView location={resolved.location} headerLabel={resolved.label} />
}

function ResolvedSourceView({
  location,
  headerLabel,
}: {
  location: ResolvedCodeLocation
  headerLabel: string
}) {
  const editorViewRef = useRef<EditorView | null>(null)

  const extensions = useMemo(() => {
    const executingLine = Decoration.line({ class: 'cm-exec-line' })
    return [
      javascript({ jsx: true, typescript: true }),
      EditorView.editable.of(false),
      // Recomputed when the doc swaps files; highlights the resolved line.
      EditorView.decorations.compute(['doc'], (state) =>
        location.line >= 1 && location.line <= state.doc.lines
          ? Decoration.set([executingLine.range(state.doc.line(location.line).from)])
          : Decoration.none,
      ),
    ]
  }, [location.line])

  // Center the highlighted line after the (possibly new) doc is applied.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const view = editorViewRef.current
      if (!view || location.line < 1 || location.line > view.state.doc.lines) return
      view.dispatch({
        effects: EditorView.scrollIntoView(view.state.doc.line(location.line).from, {
          y: 'center',
        }),
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [location])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <span className="min-w-0 truncate font-mono text-[11.5px] font-medium text-primary">
          {location.displayPath}
        </span>
        <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
          L{location.line}
        </span>
        {headerLabel && (
          <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-px font-mono text-[10px] text-muted-foreground">
            {headerLabel}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">via sourcemap</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {location.content !== null ? (
          <CodeMirror
            value={location.content}
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
}

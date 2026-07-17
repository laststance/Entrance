import { memo, useMemo, useState, useSyncExternalStore } from 'react'

import { Virtuoso } from 'react-virtuoso'

import type { CodeAnchor, CodeFrame } from '@shared/code-anchors'
import type { CoverageTimeline } from '@shared/coverage-timeline'
import type { ProfileTimeline } from '@shared/cpuprofile-timeline'
import type { ReplayLaneEvent } from '@shared/replay'
import type { TranscriptItem } from '@shared/transcript-items'
import { transcriptIndexAt } from '@shared/transcript-items'

import type { SourceResolver } from '../lib/replay/source-resolver'

import { formatRecClock } from '../lib/format-rec-clock'
import { playheadStore } from '../lib/replay/playhead-store'
import { CodePanel } from './CodePanel'
import { CoverageCodeView } from './CoverageCodeView'
import { RedebugPanel } from './RedebugPanel'

/**
 * Mock 1a right inspector — Sources (sourcemap code panel) / Console / Network
 * tabs over the recorded lanes, playhead-synced (rows after the playhead are
 * dimmed "not yet happened").
 */

type DebugTab = 'sources' | 'console' | 'network'

const TABS: Array<{ id: DebugTab; label: string }> = [
  { id: 'sources', label: 'Sources' },
  { id: 'console', label: 'Console' },
  { id: 'network', label: 'Network' },
]

/** Console row accent per severity (DevTools-ish). */
const CONSOLE_TITLE_COLORS: Record<string, string> = {
  'console.error': 'text-[#ff5c5c]',
  uncaught: 'text-[#ff5c5c]',
  'console.warn': 'text-warn',
}

export function DebugSidePanel({
  items,
  anchors,
  profileTimeline,
  coverageTimeline,
  resolver,
  recordingId,
  t0Mono,
  inputLane,
  onSeekAction,
}: {
  items: TranscriptItem[]
  anchors: CodeAnchor[]
  profileTimeline: ProfileTimeline | null
  /** Mode B precise-coverage artifact — when present it replaces the sampling code view. */
  coverageTimeline: CoverageTimeline | null
  resolver: SourceResolver
  recordingId: string
  t0Mono: number
  inputLane: ReplayLaneEvent[]
  onSeekAction: (tMonoOffsetMs: number) => void
}) {
  const [tab, setTab] = useState<DebugTab>('sources')
  // Mode B paused stack overrides the playhead-driven code view (decision 3).
  const [pauseFrames, setPauseFrames] = useState<CodeFrame[] | null>(null)

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border">
      <div className="flex shrink-0 gap-1 border-b border-border px-2 pt-2">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            type="button"
            onClick={() => setTab(tabDef.id)}
            className={`rounded-t-md border-b-2 px-3 py-1.5 text-[12px] transition-colors ${
              tab === tabDef.id
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabDef.label}
          </button>
        ))}
      </div>
      {/* Sources stays MOUNTED across tab switches (CSS-hidden): unmounting
          RedebugPanel fires its cleanup redebugStop(), destroying a live
          paused Mode B session the user only meant to glance away from. */}
      <div className={tab === 'sources' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <RedebugPanel
          recordingId={recordingId}
          t0Mono={t0Mono}
          inputLane={inputLane}
          anchors={anchors}
          onPauseFramesChangeAction={setPauseFrames}
        />
        {/* Priority (decision 3 + coverage goal): Mode B pause frames > precise
            coverage timeline > sampling/anchor CodePanel. */}
        {pauseFrames || !coverageTimeline ? (
          <CodePanel
            anchors={anchors}
            profileTimeline={profileTimeline}
            resolver={resolver}
            overrideFrames={pauseFrames}
          />
        ) : (
          <CoverageCodeView timeline={coverageTimeline} />
        )}
      </div>
      {tab !== 'sources' && <DebugLaneTab tab={tab} items={items} onSeekAction={onSeekAction} />}
    </div>
  )
}

/** Console/Network tab body — subscribes to the playhead for future-row dimming. */
function DebugLaneTab({
  tab,
  items,
  onSeekAction,
}: {
  tab: 'console' | 'network'
  items: TranscriptItem[]
  onSeekAction: (tMonoOffsetMs: number) => void
}) {
  const playhead = useSyncExternalStore(playheadStore.subscribe, playheadStore.getSnapshot)

  const consoleItems = useMemo(
    () => items.filter((item) => item.kind === 'console' || item.kind === 'error'),
    [items],
  )
  const networkItems = useMemo(() => items.filter((item) => item.kind === 'fetch'), [items])

  const tabItems = tab === 'console' ? consoleItems : networkItems
  // Rows after this index haven't "happened" yet at the current playhead.
  const reachedIndex = transcriptIndexAt(tabItems, playhead.tMonoOffsetMs)

  return <DebugRowList tabItems={tabItems} reachedIndex={reachedIndex} onSeekAction={onSeekAction} />
}

/** Memoized so 100Hz playhead notifies re-render only at row boundaries. */
const DebugRowList = memo(function DebugRowList({
  tabItems,
  reachedIndex,
  onSeekAction,
}: {
  tabItems: TranscriptItem[]
  reachedIndex: number
  onSeekAction: (tMonoOffsetMs: number) => void
}) {
  if (tabItems.length === 0) {
    return (
      <div className="grid flex-1 place-items-center px-4">
        <p className="text-[12px] text-muted-foreground">この録画に該当する行はありません</p>
      </div>
    )
  }

  return (
    <Virtuoso
      data={tabItems}
      className="min-h-0 flex-1"
      itemContent={(index, item) => (
        <button
          type="button"
          onClick={() => onSeekAction(item.tMonoOffset)}
          className={`block w-full px-3 py-1.5 text-left transition-opacity hover:bg-white/[0.03] ${
            index > reachedIndex ? 'opacity-35' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`min-w-0 flex-1 truncate font-mono text-[11.5px] ${
                CONSOLE_TITLE_COLORS[item.title] ?? 'text-foreground/90'
              }`}
            >
              {item.title}
            </span>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
              {formatRecClock(item.tMonoOffset)}
            </span>
          </div>
          {item.subtitle && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">{item.subtitle}</p>
          )}
        </button>
      )}
    />
  )
})

import { memo, useMemo, useState, useSyncExternalStore } from 'react'

import { Virtuoso } from 'react-virtuoso'

import type { TranscriptItem } from '@shared/transcript-items'
import { transcriptIndexAt } from '@shared/transcript-items'

import { formatRecClock } from '../lib/format-rec-clock'
import { playheadStore } from '../lib/replay/playhead-store'

/**
 * Mock 1a right inspector — Console / Network tabs over the recorded lanes,
 * playhead-synced (rows after the playhead are dimmed "not yet happened").
 * Sources tab (CodeMirror + sourcemaps) joins in slice E.
 */

type DebugTab = 'console' | 'network'

const TABS: Array<{ id: DebugTab; label: string }> = [
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
  onSeekAction,
}: {
  items: TranscriptItem[]
  onSeekAction: (tMonoOffsetMs: number) => void
}) {
  const [tab, setTab] = useState<DebugTab>('console')
  const playhead = useSyncExternalStore(playheadStore.subscribe, playheadStore.getSnapshot)

  const consoleItems = useMemo(
    () => items.filter((item) => item.kind === 'console' || item.kind === 'error'),
    [items],
  )
  const networkItems = useMemo(() => items.filter((item) => item.kind === 'fetch'), [items])

  const tabItems = tab === 'console' ? consoleItems : networkItems
  // Rows after this index haven't "happened" yet at the current playhead.
  const reachedIndex = transcriptIndexAt(tabItems, playhead.tMonoOffsetMs)

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
      <DebugRowList tabItems={tabItems} reachedIndex={reachedIndex} onSeekAction={onSeekAction} />
    </div>
  )
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

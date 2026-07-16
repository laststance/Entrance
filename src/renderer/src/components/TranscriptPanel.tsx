import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'

import type { TranscriptItem, TranscriptFilterGroup } from '@shared/transcript-items'
import { transcriptIndexAt } from '@shared/transcript-items'

import { formatRecClock } from '../lib/format-rec-clock'
import { playheadStore } from '../lib/replay/playhead-store'

/**
 * Mock 1b left panel — numbered event transcript with filter chips
 * (すべて/操作/Network/エラー), playhead-following current-row highlight,
 * and click-to-seek. Rendered by ReplayScreen next to the player.
 */

type TranscriptFilter = 'all' | TranscriptFilterGroup

const FILTER_CHIPS: Array<{ id: TranscriptFilter; label: string }> = [
  { id: 'all', label: 'すべて' },
  { id: 'action', label: '操作' },
  { id: 'network', label: 'Network' },
  { id: 'error', label: 'エラー' },
]

/** Row dot colors — same palette as the timeline lanes (mock 1a legend). */
const KIND_DOT_COLORS: Record<TranscriptItem['kind'], string> = {
  route: '#a78bfa',
  click: '#4da3ff',
  input: '#4da3ff',
  fetch: '#34d399',
  console: '#fbbf24',
  error: '#ff5c5c',
}

interface NumberedItem {
  item: TranscriptItem
  /** Position in the unfiltered transcript — numbering stays stable across filters. */
  number: number
}

export function TranscriptPanel({
  items,
  durationMs,
  onSeekAction,
}: {
  items: TranscriptItem[]
  durationMs: number
  onSeekAction: (tMonoOffsetMs: number) => void
}) {
  const [filter, setFilter] = useState<TranscriptFilter>('all')
  const playhead = useSyncExternalStore(playheadStore.subscribe, playheadStore.getSnapshot)

  const numberedItems = useMemo<NumberedItem[]>(
    () => items.map((item, index) => ({ item, number: index + 1 })),
    [items],
  )
  const visibleItems = useMemo(
    () =>
      filter === 'all'
        ? numberedItems
        : numberedItems.filter(({ item }) => item.filterGroup === filter),
    [numberedItems, filter],
  )
  // Current row = last visible row at/before the playhead (binary search per notify).
  const visibleTranscript = useMemo(() => visibleItems.map(({ item }) => item), [visibleItems])
  const currentIndex = transcriptIndexAt(visibleTranscript, playhead.tMonoOffsetMs)

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border">
      <div className="shrink-0 space-y-2.5 px-3 pt-3 pb-2.5">
        <p className="text-[12px] font-semibold text-foreground">
          イベント <span className="font-mono">{items.length}</span>
          <span className="font-mono text-muted-foreground"> · {formatRecClock(durationMs)}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                filter === chip.id
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
      <TranscriptRowList
        visibleItems={visibleItems}
        currentIndex={currentIndex}
        isPlaying={playhead.isPlaying}
        onSeekAction={onSeekAction}
      />
    </div>
  )
}

/** Memoized so 100Hz playhead notifies re-render the list only at row boundaries. */
const TranscriptRowList = memo(function TranscriptRowList({
  visibleItems,
  currentIndex,
  isPlaying,
  onSeekAction,
}: {
  visibleItems: NumberedItem[]
  currentIndex: number
  isPlaying: boolean
  onSeekAction: (tMonoOffsetMs: number) => void
}) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  // Follow the playhead during playback; manual browsing while paused stays put.
  useEffect(() => {
    if (isPlaying && currentIndex >= 0) {
      virtuosoRef.current?.scrollIntoView({ index: currentIndex, behavior: 'auto' })
    }
  }, [currentIndex, isPlaying])

  if (visibleItems.length === 0) {
    return (
      <div className="grid flex-1 place-items-center px-4">
        <p className="text-[12px] text-muted-foreground">イベントはありません</p>
      </div>
    )
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={visibleItems}
      className="min-h-0 flex-1"
      itemContent={(index, { item, number }) => (
        <TranscriptRow
          item={item}
          number={number}
          isCurrent={index === currentIndex}
          isPaused={index === currentIndex && !isPlaying}
          onSeekAction={onSeekAction}
        />
      )}
    />
  )
})

function TranscriptRow({
  item,
  number,
  isCurrent,
  isPaused,
  onSeekAction,
}: {
  item: TranscriptItem
  number: number
  isCurrent: boolean
  isPaused: boolean
  onSeekAction: (tMonoOffsetMs: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSeekAction(item.tMonoOffset)}
      className={`block w-full border-l-2 px-3 py-2 text-left transition-colors ${
        isCurrent
          ? 'border-primary bg-primary/10'
          : 'border-transparent hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="w-4 shrink-0 font-mono text-[10px] text-muted-foreground/70">
          {String(number).padStart(2, '0')}
        </span>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: KIND_DOT_COLORS[item.kind] }}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-medium text-foreground">
          {item.title}
        </span>
        {isPaused && (
          <span className="shrink-0 rounded bg-warn/15 px-1.5 py-px text-[10px] font-medium text-warn">
            停止中
          </span>
        )}
        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {formatRecClock(item.tMonoOffset)}
        </span>
      </div>
      {item.subtitle && (
        <p className="mt-0.5 truncate pl-[42px] font-mono text-[11px] text-muted-foreground">
          {item.subtitle}
        </p>
      )}
    </button>
  )
}

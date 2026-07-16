import { Suspense, use, useEffect, useRef, useState } from 'react'

import { MoreHorizontal, Play, Plus, Search } from 'lucide-react'

import type { GroupSummary, RecordingSummary, StorageUsage } from '@shared/ipc'

import { Button } from '../components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { formatDateTime } from '../lib/format-date-time'
import { formatDurationBadge } from '../lib/format-duration-badge'
import { formatGigabytes } from '../lib/format-gigabytes'
import { newRecordingRequested, replayOpened } from '../store/appSlice'
import { useAppDispatch } from '../store'

/**
 * Screen 1e — recording library, the app's home: grouped named recordings with
 * search, storage meter, rename/regroup/delete. Rendered by App when
 * screen === 'library'; play on a card opens the replay screen (1a/1b).
 */

interface LibraryData {
  recordings: RecordingSummary[]
  groups: GroupSummary[]
  storage: StorageUsage
}

function loadLibraryData(): Promise<LibraryData> {
  return Promise.all([
    window.entrance.listRecordings(),
    window.entrance.listGroups(),
    window.entrance.storageUsage(),
  ]).then(([recordings, groups, storage]) => ({ recordings, groups, storage }))
}

/** Sidebar selection: every recording, one group, or the ungrouped bucket. */
type GroupFilter = 'all' | 'ungrouped' | { groupId: string }

export function LibraryScreen() {
  const [dataPromise, setDataPromise] = useState<Promise<LibraryData>>(loadLibraryData)
  return (
    <div className="flex h-full flex-col">
      <Suspense fallback={<div className="flex-1" />}>
        <LibraryBody dataPromise={dataPromise} onRefreshAction={() => setDataPromise(loadLibraryData())} />
      </Suspense>
    </div>
  )
}

export default LibraryScreen

function LibraryBody({
  dataPromise,
  onRefreshAction,
}: {
  dataPromise: Promise<LibraryData>
  onRefreshAction: () => void
}) {
  const { recordings, groups, storage } = use(dataPromise)
  const dispatch = useAppDispatch()
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  // null = no search active; [] = search with zero hits.
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTicketRef = useRef(0)

  // ⌘K focuses the search box, per mock 1e's shortcut chip.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const runSearch = (query: string): void => {
    setSearchQuery(query)
    const ticket = searchTicketRef.current + 1
    searchTicketRef.current = ticket
    if (query.trim() === '') {
      setMatchedIds(null)
      return
    }
    void window.entrance.searchRecordings({ query }).then((ids) => {
      // Only the latest keystroke's result may land — stale responses are dropped.
      if (searchTicketRef.current === ticket) setMatchedIds(ids)
    })
  }

  const visibleRecordings =
    matchedIds === null ? recordings : recordings.filter((recording) => matchedIds.includes(recording.id))
  const sections = buildSections(groupFilter, groups, visibleRecordings)

  return (
    <>
      {/* Toolbar: logo + library badge | search | new-recording (mock 1e top bar) */}
      <div className="app-drag flex h-12 shrink-0 items-center gap-3 border-b border-border pr-4 pl-[84px]">
        <div className="flex items-center gap-2.5">
          <span className="relative inline-block h-6 w-6 rounded-[8px] border-2 border-primary">
            <span className="absolute top-[4px] right-[4px] h-1 w-1 rounded-full bg-rec" />
          </span>
          <span className="text-[14px] font-bold tracking-tight">Entrance</span>
          <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            ライブラリ
          </span>
        </div>
        <div className="app-no-drag mx-auto flex h-8 w-full max-w-[560px] items-center gap-2 rounded-lg border border-border bg-sunken px-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => runSearch(event.target.value)}
            placeholder="録画を検索 ─ 名前 / URL"
            className="h-full w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-px font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>
        <Button
          size="sm"
          className="app-no-drag bg-rec text-white hover:bg-rec/85"
          onClick={() => dispatch(newRecordingRequested())}
        >
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-white" />
          新規録画
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Group sidebar + storage meter (mock 1e left rail) */}
        <aside className="flex w-[264px] shrink-0 flex-col border-r border-border p-4">
          <p className="px-2 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground">グループ</p>
          <nav className="flex flex-col gap-0.5">
            <GroupRow
              label="すべて"
              count={recordings.length}
              isSelected={groupFilter === 'all'}
              onSelectAction={() => setGroupFilter('all')}
            />
            {groups.map((group) => (
              <GroupRow
                key={group.id}
                label={group.name}
                count={group.recordingCount}
                isSelected={typeof groupFilter === 'object' && groupFilter.groupId === group.id}
                onSelectAction={() => setGroupFilter({ groupId: group.id })}
              />
            ))}
            <GroupRow
              label="未分類"
              count={recordings.filter((recording) => recording.groupId === null).length}
              isSelected={groupFilter === 'ungrouped'}
              onSelectAction={() => setGroupFilter('ungrouped')}
            />
            <NewGroupRow onCreatedAction={onRefreshAction} />
          </nav>
          <div className="flex-1" />
          <StorageMeter storage={storage} />
        </aside>

        {/* Grouped card grid */}
        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          {sections.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">
              {matchedIds === null ? '録画がありません' : '検索に一致する録画がありません'}
            </p>
          ) : (
            sections.map((section) => (
              <section key={section.key} className="mb-9">
                <div className="mb-3.5 flex items-baseline gap-2.5">
                  <h2 className="text-[15px] font-bold tracking-tight">{section.title}</h2>
                  <span className="text-[11.5px] text-muted-foreground">{section.recordings.length}件</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 2xl:max-w-[1220px]">
                  {section.recordings.map((recording) => (
                    <RecordingCard
                      key={recording.id}
                      recording={recording}
                      groups={groups}
                      onOpenAction={() => dispatch(replayOpened({ recordingId: recording.id }))}
                      onChangedAction={onRefreshAction}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </div>
    </>
  )
}

interface CardSection {
  key: string
  title: string
  recordings: RecordingSummary[]
}

/**
 * Groups visible recordings into mock-1e sections: "すべて" shows one section
 * per non-empty group plus 未分類; a specific filter shows only that bucket.
 * @param filter - sidebar selection
 * @param groups - all sidebar groups
 * @param recordings - recordings already filtered by search
 * @returns ordered sections, empty ones dropped
 * @example buildSections('all', [{id:'g1',…}], recs) // => [{key:'g1',…}, {key:'ungrouped',…}]
 */
function buildSections(
  filter: GroupFilter,
  groups: GroupSummary[],
  recordings: RecordingSummary[],
): CardSection[] {
  const ungrouped: CardSection = {
    key: 'ungrouped',
    title: '未分類',
    recordings: recordings.filter((recording) => recording.groupId === null),
  }
  if (filter === 'ungrouped') return ungrouped.recordings.length > 0 ? [ungrouped] : []
  const groupSections: CardSection[] = groups.map((group) => ({
    key: group.id,
    title: group.name,
    recordings: recordings.filter((recording) => recording.groupId === group.id),
  }))
  if (typeof filter === 'object') {
    return groupSections.filter((section) => section.key === filter.groupId && section.recordings.length > 0)
  }
  return [...groupSections, ungrouped].filter((section) => section.recordings.length > 0)
}

function GroupRow({
  label,
  count,
  isSelected,
  onSelectAction,
}: {
  label: string
  count: number
  isSelected: boolean
  onSelectAction: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelectAction}
      className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors ${
        isSelected ? 'bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-white/4'
      }`}
    >
      <span className={`h-2 w-2 rounded-sm ${isSelected ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <span className="text-[11.5px] tabular-nums text-muted-foreground">{count}</span>
    </button>
  )
}

function NewGroupRow({ onCreatedAction }: { onCreatedAction: () => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')

  const submit = (): void => {
    const trimmed = name.trim()
    setIsEditing(false)
    setName('')
    if (trimmed === '') return
    void window.entrance.createGroup({ name: trimmed }).then(onCreatedAction)
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') {
            setName('')
            setIsEditing(false)
          }
        }}
        placeholder="グループ名"
        className="mt-1 h-9 rounded-lg border border-border bg-sunken px-3 text-[13px] outline-none focus:border-primary"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-[12.5px] text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
    >
      <Plus className="h-3.5 w-3.5" />
      新しいグループ
    </button>
  )
}

function StorageMeter({ storage }: { storage: StorageUsage }) {
  const usedRatio = storage.quotaBytes > 0 ? Math.min(1, storage.usedBytes / storage.quotaBytes) : 0
  return (
    <div className="rounded-xl border border-border bg-raised p-3.5">
      <p className="pb-2.5 text-[11.5px] font-medium text-muted-foreground">ストレージ</p>
      <div className="h-1 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-primary" style={{ width: `${usedRatio * 100}%` }} />
      </div>
      <p className="pt-2 font-mono text-[11px] text-muted-foreground">
        {formatGigabytes(storage.usedBytes)} / {formatGigabytes(storage.quotaBytes)} ・{' '}
        {storage.recordingCount} 録画
      </p>
    </div>
  )
}

function RecordingCard({
  recording,
  groups,
  onOpenAction,
  onChangedAction,
}: {
  recording: RecordingSummary
  groups: GroupSummary[]
  onOpenAction: () => void
  onChangedAction: () => void
}) {
  const isPartial = recording.endReason !== 'user-stop'
  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-raised transition-colors hover:border-muted-foreground/40">
      {/* Preview: first screencast frame, else the mock's hatched placeholder */}
      <button type="button" onClick={onOpenAction} className="relative block aspect-[16/10] w-full">
        {recording.thumbnailUrl ? (
          <img
            src={recording.thumbnailUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : (
          <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.04)_0px,rgba(255,255,255,0.04)_2px,transparent_2px,transparent_14px)]" />
        )}
        <span className="absolute top-2.5 left-3 font-mono text-[10.5px] text-muted-foreground">
          app preview
        </span>
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-black/55 transition-transform group-hover:scale-105">
            <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
          </span>
        </span>
        {isPartial && (
          <span className="absolute bottom-2.5 left-3 rounded bg-warn/15 px-1.5 py-0.5 text-[10.5px] font-medium text-warn">
            部分録画
          </span>
        )}
        <span className="absolute right-3 bottom-2.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">
          {formatDurationBadge(recording.durationMs)}
        </span>
      </button>

      <div className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-start gap-2">
          <RecordingName recording={recording} onRenamedAction={onChangedAction} />
          <CardMenu recording={recording} groups={groups} onChangedAction={onChangedAction} />
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {formatDateTime(recording.createdAtWall)} ・ {displayUrl(recording.targetUrl)}
        </p>
        <div className="flex items-center gap-1.5 pt-1">
          <CountChip color="bg-primary" label={`${recording.counts.click} click`} />
          <CountChip color="bg-ok" label={`${recording.counts.fetch} fetch`} />
          <CountChip
            color={recording.counts.error > 0 ? 'bg-rec' : 'bg-muted-foreground/50'}
            label={`${recording.counts.error} error`}
            isAlert={recording.counts.error > 0}
          />
        </div>
      </div>
    </article>
  )
}

/** Card title with click-to-rename (updates DB + FTS via updateRecordingMeta). */
function RecordingName({
  recording,
  onRenamedAction,
}: {
  recording: RecordingSummary
  onRenamedAction: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(recording.name)

  const submit = (): void => {
    setIsEditing(false)
    const trimmed = draftName.trim()
    if (trimmed === '' || trimmed === recording.name) return
    void window.entrance
      .updateRecordingMeta({ recordingId: recording.id, name: trimmed })
      .then(onRenamedAction)
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') {
            setDraftName(recording.name)
            setIsEditing(false)
          }
        }}
        className="h-6 min-w-0 flex-1 rounded border border-primary bg-sunken px-1.5 text-[13.5px] font-semibold outline-none"
      />
    )
  }
  return (
    <button
      type="button"
      title="クリックして名前を変更"
      onClick={() => {
        setDraftName(recording.name)
        setIsEditing(true)
      }}
      className="min-w-0 flex-1 truncate text-left text-[13.5px] font-semibold hover:underline"
    >
      {recording.name}
    </button>
  )
}

/** ⋯ menu: move to group / delete (two-step confirm). */
function CardMenu({
  recording,
  groups,
  onChangedAction,
}: {
  recording: RecordingSummary
  groups: GroupSummary[]
  onChangedAction: () => void
}) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const moveToGroup = (groupId: string | null): void => {
    void window.entrance.updateRecordingMeta({ recordingId: recording.id, groupId }).then(onChangedAction)
  }

  return (
    <Popover onOpenChange={() => setIsConfirmingDelete(false)}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="録画メニュー"
            className="shrink-0 text-muted-foreground"
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-52 gap-0 p-1.5">
        <p className="px-2 pt-1 pb-1.5 text-[11px] text-muted-foreground">グループへ移動</p>
        {groups.map((group) => (
          <MenuButton
            key={group.id}
            label={group.name}
            isCurrent={recording.groupId === group.id}
            onClickAction={() => moveToGroup(group.id)}
          />
        ))}
        <MenuButton
          label="未分類"
          isCurrent={recording.groupId === null}
          onClickAction={() => moveToGroup(null)}
        />
        <div className="my-1.5 h-px bg-border" />
        <button
          type="button"
          onClick={() => {
            if (!isConfirmingDelete) {
              setIsConfirmingDelete(true)
              return
            }
            void window.entrance.deleteRecording({ recordingId: recording.id }).then(onChangedAction)
          }}
          className="rounded-md px-2 py-1.5 text-left text-[12.5px] text-rec transition-colors hover:bg-rec/10"
        >
          {isConfirmingDelete ? 'クリックで完全に削除' : 'この録画を削除…'}
        </button>
      </PopoverContent>
    </Popover>
  )
}

function MenuButton({
  label,
  isCurrent,
  onClickAction,
}: {
  label: string
  isCurrent: boolean
  onClickAction: () => void
}) {
  return (
    <button
      type="button"
      disabled={isCurrent}
      onClick={onClickAction}
      className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-white/6 disabled:text-muted-foreground"
    >
      <span className="truncate">{label}</span>
      {isCurrent && <span className="text-[10.5px] text-muted-foreground">現在</span>}
    </button>
  )
}

function CountChip({ color, label, isAlert }: { color: string; label: string; isAlert?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10.5px] ${
        isAlert ? 'bg-rec/12 text-rec' : 'bg-white/4 text-muted-foreground'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

/** "localhost:3000/dashboard" from a full URL (mock 1e card subtitle). */
function displayUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return rawUrl
  }
}

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { ChevronLeft, ChevronRight, Layers, LibraryBig, RotateCw, Square, X } from 'lucide-react'

import type { CdpEventSummary } from '@shared/ipc'

import { EmbeddedTarget, type EmbeddedTargetHandle } from '../components/EmbeddedTarget'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { REC_CLOCK_TICK_MS, REC_TOAST_MAX_ROWS } from '../constants'
import { cdpLogStore } from '../lib/cdp-log-store'
import { formatRecClock } from '../lib/format-rec-clock'
import { recStatusStore, type RecStatusSnapshot } from '../lib/rec-status-store'
import { cdpAttached, disconnectTargetThunk, goToLibraryThunk, targetGone } from '../store/appSlice'
import { useAppDispatch, useAppSelector } from '../store'

/**
 * Browser shell: toolbar + embedded target + live feed. Idle it shows the CDP
 * log panel; while recording it becomes screen 1d — browser full-bleed, REC
 * pill, event toasts bottom-right, one-line status bar (panels folded).
 */
export function BrowserShell() {
  const dispatch = useAppDispatch()
  const target = useAppSelector((state) => state.app.target)
  const { isRecording } = useRecClock()
  const embedRef = useRef<EmbeddedTargetHandle | null>(null)
  const [currentUrl, setCurrentUrl] = useState(target?.url ?? '')

  // Control-plane push subscriptions (CDP events / target loss / rec status) — live for the shell's lifetime.
  useEffect(() => {
    const unsubscribeCdp = window.entrance.onCdpEvent((event) => cdpLogStore.push(event))
    const unsubscribeGone = window.entrance.onTargetGone(() => dispatch(targetGone()))
    const unsubscribeRecStatus = window.entrance.onRecStatus((status) =>
      recStatusStore.set(status),
    )
    const unsubscribeAutoStopped = window.entrance.onRecAutoStopped(({ reason }) =>
      // Surface the honest auto-stop in the live log (decision 25).
      cdpLogStore.push({
        ts: Date.now(),
        domain: 'Recorder',
        method: 'rec.autoStopped',
        kind: 'other',
        summary: `録画を自動停止しました (${reason})`,
      }),
    )
    return () => {
      unsubscribeCdp()
      unsubscribeGone()
      unsubscribeRecStatus()
      unsubscribeAutoStopped()
      cdpLogStore.clear()
      recStatusStore.reset()
    }
  }, [dispatch])

  if (!target) return null

  const frameworkBadge =
    target.framework && target.framework !== 'unknown'
      ? `${target.framework === 'nextjs' ? 'Next.js' : target.framework === 'vite' ? 'Vite' : 'Storybook'} · dev`
      : null

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar — draggable window chrome; every control opts out via app-no-drag */}
      <div className="app-drag flex h-12 shrink-0 items-center gap-2.5 border-b border-border pr-4 pl-[84px]">
        <div className="app-no-drag flex items-center gap-1">
          <ToolbarIconButton label="戻る" onClick={() => embedRef.current?.goBack()}>
            <ChevronLeft className="h-4 w-4" />
          </ToolbarIconButton>
          <ToolbarIconButton label="進む" onClick={() => embedRef.current?.goForward()}>
            <ChevronRight className="h-4 w-4" />
          </ToolbarIconButton>
          <ToolbarIconButton label="再読み込み" onClick={() => embedRef.current?.reload()}>
            <RotateCw className="h-3.5 w-3.5" />
          </ToolbarIconButton>
        </div>

        {/* URL readout with attach status + framework badge */}
        <div className="app-no-drag flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-sunken px-3 max-w-[560px]">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${target.isCdpAttached ? 'bg-live' : 'bg-muted-foreground'}`}
          />
          <span className="truncate font-mono text-[11.5px] text-foreground/90">{currentUrl}</span>
          {frameworkBadge && (
            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
              {frameworkBadge}
            </span>
          )}
        </div>

        {/* P0 overlay smoke probe — opt-in via VITE_ENTRANCE_SMOKE_UI=1; the mock 1d toolbar has no such control */}
        {import.meta.env.VITE_ENTRANCE_SMOKE_UI === '1' && (
          <div className="app-no-drag">
            <OverlaySmokePopover />
          </div>
        )}

        <div className="flex-1" />

        <button
          type="button"
          disabled={isRecording}
          title={isRecording ? '録画中はライブラリへ移動できません' : 'ライブラリへ'}
          onClick={() => void dispatch(goToLibraryThunk())}
          className="app-no-drag flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground disabled:opacity-40"
        >
          <LibraryBig className="h-3.5 w-3.5" />
          ライブラリ
        </button>

        <button
          type="button"
          onClick={() => void dispatch(disconnectTargetThunk())}
          className="app-no-drag flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          切断
        </button>

        <RecHud />
      </div>

      {target.isGone && (
        <div className="flex h-9 items-center gap-2 border-b border-border bg-rec/10 px-4 text-[12px] text-rec">
          ターゲットが終了しました。devサーバーの状態を確認して「切断」から再接続してください。
        </div>
      )}

      {/* Embedded target viewport */}
      <div className="relative flex-1 bg-black">
        <EmbeddedTarget
          key={new URL(target.url).host}
          ref={embedRef}
          url={target.url}
          className="absolute inset-0 h-full w-full"
          onAttachReady={(webContentsId) => {
            void window.entrance
              .attachTarget({
                webContentsId,
                framework: target.framework,
                variant: target.variant,
              })
              .then((result) => dispatch(cdpAttached({ ok: result.ok })))
          }}
          onNavigated={setCurrentUrl}
        />
        {isRecording && <LiveEventToasts />}
      </div>

      {/* Recording folds the log panel into the one-line 1d status bar */}
      {isRecording ? <RecStatusBar /> : <CdpEventLog />}
    </div>
  )
}

/**
 * Recording clock shared by the HUD pieces: subscribes to rec:status pushes and
 * interpolates between them so the mock's centisecond REC clock keeps moving.
 */
function useRecClock(): { isRecording: boolean; elapsedMs: number; snapshot: RecStatusSnapshot } {
  const snapshot = useSyncExternalStore(recStatusStore.subscribe, recStatusStore.getSnapshot)
  const isRecording = snapshot.status.state === 'recording'
  const [clock, setClock] = useState<{ recordingId: string; ms: number } | null>(null)
  useEffect(() => {
    if (!isRecording) return
    // Interpolation happens on ticks only (render must stay pure — no Date.now there).
    const interval = setInterval(() => {
      const current = recStatusStore.getSnapshot()
      if (current.status.state !== 'recording' || !current.status.recordingId) return
      setClock({
        recordingId: current.status.recordingId,
        ms: current.status.elapsedMs + (Date.now() - current.receivedAt),
      })
    }, REC_CLOCK_TICK_MS)
    return () => clearInterval(interval)
  }, [isRecording])
  // Interpolated value counts only for the CURRENT recording; otherwise use the raw push.
  const isClockCurrent = clock !== null && clock.recordingId === snapshot.status.recordingId
  const elapsedMs = isRecording
    ? isClockCurrent
      ? Math.max(clock.ms, snapshot.status.elapsedMs)
      : snapshot.status.elapsedMs
    : 0
  return { isRecording, elapsedMs, snapshot }
}

/** REC pill + stop control (mock 1d top-right); a plain Rec button while idle. */
function RecHud() {
  const { isRecording, elapsedMs, snapshot } = useRecClock()
  const [lastError, setLastError] = useState<string | null>(null)

  const handleStart = (): void => {
    setLastError(null)
    void window.entrance.recStart().then((result) => {
      if (!result.ok) setLastError(result.error ?? '録画を開始できませんでした')
    })
  }
  const handleStop = (): void => {
    void window.entrance.recStop().then((result) => {
      if (!result.ok) setLastError(result.error ?? '停止に失敗しました')
    })
  }

  if (!isRecording) {
    return (
      <div className="app-no-drag flex items-center gap-2.5">
        {lastError && (
          <span className="max-w-[240px] truncate text-[11px] text-rec">{lastError}</span>
        )}
        <button
          type="button"
          onClick={handleStart}
          className="flex h-8 items-center gap-2 rounded-lg border border-border bg-sunken px-4 text-[13px] font-semibold transition-colors hover:bg-white/[0.05]"
        >
          <span className="h-2 w-2 rounded-full bg-rec" />
          Rec
        </button>
      </div>
    )
  }

  return (
    <div className="app-no-drag flex items-center gap-2">
      {snapshot.status.pressure === 'warn' && (
        <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10.5px] text-yellow-400">
          容量残りわずか
        </span>
      )}
      <span className="flex h-8 items-center gap-2 rounded-lg border border-rec/60 bg-rec/15 px-3 font-mono text-[12.5px] font-bold tracking-wide text-rec">
        <span className="h-2 w-2 animate-pulse rounded-full bg-rec" />
        REC {formatRecClock(elapsedMs)}
      </span>
      <button
        type="button"
        onClick={handleStop}
        title="録画を停止"
        className="grid h-8 w-8 place-items-center rounded-lg border border-rec/60 bg-rec/10 text-rec transition-colors hover:bg-rec/25"
      >
        <Square className="h-3 w-3 fill-current" />
      </button>
    </div>
  )
}

/** Bottom-right stack of recent meaningful events while recording (mock 1d toasts). */
function LiveEventToasts() {
  const rows = useSyncExternalStore(cdpLogStore.subscribe, cdpLogStore.getSnapshot)
  const { status, receivedAt } = useSyncExternalStore(
    recStatusStore.subscribe,
    recStatusStore.getSnapshot,
  )
  // Rec start in epoch ms — mock 1d right-aligns each toast's offset into the recording.
  const recStartEpoch = status.state === 'recording' ? receivedAt - status.elapsedMs : null
  const recentRows = rows.filter(isMeaningfulRecEvent).slice(-REC_TOAST_MAX_ROWS)
  if (recentRows.length === 0) return null
  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-10 flex w-[360px] flex-col gap-1.5">
      {recentRows.map((row, index) => (
        <div
          key={`${row.ts}-${index}`}
          className="flex items-center gap-2 rounded-lg border border-border bg-sunken/95 px-3 py-1.5 font-mono text-[11px] shadow-lg"
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TOAST_DOT_CLASS[row.kind]}`} />
          <span className="min-w-0 flex-1 truncate text-foreground/85">
            <span className={`mr-1.5 font-semibold ${KIND_TEXT_CLASS[row.kind]}`}>
              {toastLabel(row)}
            </span>
            {toastBody(row)}
          </span>
          {recStartEpoch !== null && (
            <span className="shrink-0 text-muted-foreground">
              {formatRecClock(Math.max(0, row.ts - recStartEpoch))}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/** One-line live status bar replacing the log panel while recording (mock 1d bottom). */
function RecStatusBar() {
  const { elapsedMs, snapshot } = useRecClock()
  const rows = useSyncExternalStore(cdpLogStore.subscribe, cdpLogStore.getSnapshot)
  const recentRows = rows.filter(isMeaningfulRecEvent).slice(-REC_TOAST_MAX_ROWS)
  const { counts, totalEvents } = snapshot.status
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 overflow-hidden border-t border-border bg-sunken px-3 font-mono text-[11px]">
      <span className="flex shrink-0 items-center gap-1.5 font-bold text-rec">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rec" />
        REC {formatRecClock(elapsedMs)}
      </span>
      <span className="h-3.5 w-px shrink-0 bg-border" />
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {recentRows.map((row, index) => (
          <span
            key={`${row.ts}-${index}`}
            className="flex min-w-0 shrink items-center gap-1.5 whitespace-nowrap text-muted-foreground"
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TOAST_DOT_CLASS[row.kind]}`} />
            <span className="truncate">
              <span className={KIND_TEXT_CLASS[row.kind]}>{toastLabel(row)}</span>{' '}
              {toastBody(row)}
            </span>
          </span>
        ))}
      </div>
      <span className="shrink-0 text-muted-foreground">
        {totalEvents} events · {counts.click} click · {counts.fetch} fetch
      </span>
    </div>
  )
}

/** Small square toolbar button. */
function ToolbarIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
    >
      {children}
    </button>
  )
}

/**
 * Popover that intentionally overlaps the webview to prove DOM overlays win
 * (spike #5). Smoke-test UI, not product UI — rendered only when
 * VITE_ENTRANCE_SMOKE_UI=1 so the normal workspace matches mock 1d.
 */
function OverlaySmokePopover() {
  const [overlayClickCount, setOverlayClickCount] = useState(0)
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <Layers className="h-3.5 w-3.5" />
            パネル
          </button>
        }
      />
      <PopoverContent align="end" className="w-64">
        <div className="flex flex-col gap-2 text-[12px]">
          <p className="font-medium">オーバーレイ検証</p>
          <p className="text-muted-foreground">
            このポップオーバーが埋め込みページの上に見えていて、下のボタンが押せれば合格。
          </p>
          <button
            type="button"
            onClick={() => setOverlayClickCount((count) => count + 1)}
            className="h-8 rounded-lg bg-primary text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            クリックできる ({overlayClickCount})
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** P0 CDP live log — proves the attach smoke test end-to-end; hidden while recording. */
function CdpEventLog() {
  const rows = useSyncExternalStore(cdpLogStore.subscribe, cdpLogStore.getSnapshot)
  // Collapsed by default: the embedded target is the hero (mock 1d) — the feed expands on demand.
  const [isCollapsed, setIsCollapsed] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  // Pin to bottom as rows stream in.
  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [rows])

  const countsByKind = rows.reduce(
    (acc, row) => {
      if (row.kind === 'network') acc.network += 1
      else if (row.kind === 'error') acc.error += 1
      else if (row.kind === 'console') acc.console += 1
      return acc
    },
    { network: 0, console: 0, error: 0 },
  )

  return (
    <div className="shrink-0 border-t border-border bg-sunken">
      <div className="flex h-8 items-center gap-3 px-3 text-[11px] text-muted-foreground">
        <span className="font-medium tracking-[0.06em]">CDPイベント</span>
        <span className="font-mono">{rows.length}</span>
        <span className="font-mono text-primary/80">net {countsByKind.network}</span>
        <span className="font-mono">console {countsByKind.console}</span>
        <span className="font-mono text-rec/90">error {countsByKind.error}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => cdpLogStore.clear()}
          className="rounded px-1.5 py-0.5 transition-colors hover:bg-white/[0.05] hover:text-foreground"
        >
          クリア
        </button>
        <button
          type="button"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          className="rounded px-1.5 py-0.5 transition-colors hover:bg-white/[0.05] hover:text-foreground"
        >
          {isCollapsed ? '展開' : '折りたたみ'}
        </button>
      </div>
      {!isCollapsed && (
        <div
          ref={scrollContainerRef}
          className="h-40 overflow-y-auto px-3 pb-2 font-mono text-[11px] leading-5"
        >
          {rows.length === 0 ? (
            <p className="text-muted-foreground/70">
              まだイベントがありません — 埋め込みページを操作すると、ここにネットワーク/コンソールイベントが流れます。
            </p>
          ) : (
            rows.map((row, index) => <CdpEventRow key={`${row.ts}-${index}`} row={row} />)
          )}
        </div>
      )}
    </div>
  )
}

const KIND_TEXT_CLASS: Record<CdpEventSummary['kind'], string> = {
  network: 'text-[#7cb8ff]',
  console: 'text-foreground/70',
  error: 'text-rec',
  page: 'text-chart-5',
  input: 'text-primary',
  other: 'text-muted-foreground',
}

const TOAST_DOT_CLASS: Record<CdpEventSummary['kind'], string> = {
  network: 'bg-live',
  console: 'bg-yellow-400',
  error: 'bg-rec',
  page: 'bg-chart-5',
  input: 'bg-primary',
  other: 'bg-muted-foreground',
}

/** Only events a person recording cares about reach the 1d toasts/status bar. */
function isMeaningfulRecEvent(row: CdpEventSummary): boolean {
  if (row.kind === 'input' || row.kind === 'error' || row.kind === 'page') return true
  if (row.subtype === 'fetch-api') return true
  return (
    row.kind === 'console' &&
    (row.summary.startsWith('console.warn') || row.summary.startsWith('console.error'))
  )
}

/** Leading chip word per mock 1d ("click" / "fetch" / "warn" / "route" ...). */
function toastLabel(row: CdpEventSummary): string {
  if (row.kind === 'input') return 'click'
  if (row.subtype === 'fetch-api') return 'fetch'
  if (row.kind === 'page') return 'route'
  if (row.kind === 'error') return 'error'
  if (row.kind === 'console') return row.summary.startsWith('console.warn') ? 'warn' : 'error'
  return row.kind
}

/** Body text after the chip word — the summary minus its own prefix. */
function toastBody(row: CdpEventSummary): string {
  if (row.kind === 'input') return row.summary.replace(/^click /, '')
  if (row.kind === 'page') return row.summary.replace(/^navigated: /, '')
  if (row.kind === 'console') return row.summary.replace(/^console\.(warn|error): /, '')
  return row.summary
}

function CdpEventRow({ row }: { row: CdpEventSummary }) {
  const time = new Date(row.ts)
  const timestampLabel = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}.${String(time.getMilliseconds()).padStart(3, '0')}`
  return (
    <div className="flex gap-2 whitespace-nowrap">
      <span className="text-muted-foreground/60">{timestampLabel}</span>
      <span className={`w-14 shrink-0 ${KIND_TEXT_CLASS[row.kind]}`}>{row.kind}</span>
      <span className="truncate text-foreground/85">{row.summary}</span>
    </div>
  )
}

export default BrowserShell

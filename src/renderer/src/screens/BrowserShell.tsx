import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { ChevronLeft, ChevronRight, Layers, RotateCw, X } from 'lucide-react'

import type { CdpEventSummary } from '@shared/ipc'

import { EmbeddedTarget, type EmbeddedTargetHandle } from '../components/EmbeddedTarget'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cdpLogStore } from '../lib/cdp-log-store'
import { formatElapsed } from '../lib/format-elapsed'
import { recStatusStore } from '../lib/rec-status-store'
import { cdpAttached, disconnectTargetThunk, targetGone } from '../store/appSlice'
import { useAppDispatch, useAppSelector } from '../store'

/**
 * Browser shell: toolbar + embedded target + CDP live log (P0 skeleton of the
 * recorder window; the log panel grows into screen 1d's live feed in P1).
 * Rendered by App once a target is connected.
 */
export function BrowserShell() {
  const dispatch = useAppDispatch()
  const target = useAppSelector((state) => state.app.target)
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
      // Surface the honest auto-stop in the live log (proper 1d toast lands in Slice E).
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

        {/* P0 acceptance: a Base UI popover must render ABOVE the webview and receive clicks */}
        <div className="app-no-drag">
          <OverlaySmokePopover />
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => void dispatch(disconnectTargetThunk())}
          className="app-no-drag flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          切断
        </button>

        <RecButton />
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
      </div>

      <CdpEventLog />
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

/** Rec toggle + live HUD (elapsed/counts) — grows into the full screen-1d HUD in Slice E. */
function RecButton() {
  const status = useSyncExternalStore(recStatusStore.subscribe, recStatusStore.getSnapshot)
  const [lastError, setLastError] = useState<string | null>(null)
  const isRecording = status.state === 'recording'

  const handleToggle = (): void => {
    setLastError(null)
    if (isRecording) {
      void window.entrance.recStop().then((result) => {
        if (!result.ok) setLastError(result.error ?? '停止に失敗しました')
      })
    } else {
      void window.entrance.recStart().then((result) => {
        if (!result.ok) setLastError(result.error ?? '録画を開始できませんでした')
      })
    }
  }

  return (
    <div className="app-no-drag flex items-center gap-2.5">
      {lastError && <span className="max-w-[240px] truncate text-[11px] text-rec">{lastError}</span>}
      {isRecording && (
        <span className="flex items-center gap-2 font-mono text-[11.5px] text-muted-foreground">
          <span className="text-foreground/90">{formatElapsed(status.elapsedMs)}</span>
          <span>
            fetch {status.counts.fetch} · console {status.counts.console} · error{' '}
            {status.counts.error}
          </span>
        </span>
      )}
      <button
        type="button"
        onClick={handleToggle}
        className={`flex h-8 items-center gap-2 rounded-lg border px-4 text-[13px] font-semibold transition-colors ${
          isRecording
            ? 'border-rec/60 bg-rec/10 text-rec hover:bg-rec/20'
            : 'border-border bg-sunken hover:bg-white/[0.05]'
        }`}
      >
        <span className={`h-2 w-2 rounded-full bg-rec ${isRecording ? 'animate-pulse' : ''}`} />
        {isRecording ? '停止' : 'Rec'}
      </button>
    </div>
  )
}

/** Popover that intentionally overlaps the webview to prove DOM overlays win (spike #5). */
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

/** P0 CDP live log — proves the attach smoke test end-to-end; becomes 1d's live feed. */
function CdpEventLog() {
  const rows = useSyncExternalStore(cdpLogStore.subscribe, cdpLogStore.getSnapshot)
  const [isCollapsed, setIsCollapsed] = useState(false)
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
  other: 'text-muted-foreground',
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

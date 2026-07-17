import { useEffect, useState } from 'react'

import { ArrowDown, ArrowUp, Bug, Pause, Play, Redo, Square } from 'lucide-react'

import type { CodeAnchor, CodeFrame } from '@shared/code-anchors'
import type { RedebugScope, RedebugStatus } from '@shared/redebug'
import type { ReplayLaneEvent } from '@shared/replay'
import { anchorAt } from '@shared/code-anchors'

import { CODE_ANCHOR_FRESH_WINDOW_MS } from '../constants'
import { playheadStore } from '../lib/replay/playhead-store'

/**
 * Mode B controls (completes mock 1a's right inspector): start re-execution up
 * to the current playhead, then pause/step with real SCOPE + CALL STACK from
 * the hidden debugger. Divergence findings render as honest banners
 * (decision 4) — Mode A playback underneath is never affected.
 */
export function RedebugPanel({
  recordingId,
  t0Mono,
  inputLane,
  anchors,
  onPauseFramesChangeAction,
}: {
  recordingId: string
  t0Mono: number
  inputLane: ReplayLaneEvent[]
  anchors: CodeAnchor[]
  /** Paused stack → CodePanel override (null when not paused). */
  onPauseFramesChangeAction: (frames: CodeFrame[] | null) => void
}) {
  const [status, setStatus] = useState<RedebugStatus | null>(null)

  useEffect(() => window.entrance.onRedebugStatus(setStatus), [])
  // Leaving the screen kills the hidden window.
  useEffect(
    () => () => {
      void window.entrance.redebugStop()
    },
    [],
  )

  const pausedFrames = status?.phase === 'paused' ? (status.pause?.callFrames ?? null) : null
  useEffect(() => {
    onPauseFramesChangeAction(pausedFrames)
  }, [pausedFrames, onPauseFramesChangeAction])

  const startRedebug = (): void => {
    const playheadMs = playheadStore.peek().tMonoOffsetMs
    const playheadTMono = t0Mono + playheadMs
    // Event boundary = last recorded input at/before the playhead (decision 30b).
    let runToSeq = 0
    for (const event of inputLane) {
      if (event.tMono <= playheadTMono) runToSeq = Math.max(runToSeq, event.seq)
    }
    // Line-exact when the playhead sits on a console/error anchor.
    const anchor = anchorAt(anchors, playheadMs)
    const anchorIsFresh =
      anchor !== null && playheadMs - anchor.tMonoOffset <= CODE_ANCHOR_FRESH_WINDOW_MS
    const topFrame = anchorIsFresh ? anchor.frames[0] : undefined
    setStatus({ phase: 'starting', divergences: [] })
    void window.entrance.redebugStart({
      recordingId,
      runToSeq,
      breakpoint: topFrame ? { url: topFrame.url, lineNumber: topFrame.lineNumber } : undefined,
    })
  }

  const stopRedebug = (): void => {
    void window.entrance.redebugStop()
    setStatus(null)
  }

  if (!status) {
    return (
      <div className="shrink-0 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={startRedebug}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <Bug className="h-3.5 w-3.5" />
          この位置で再現実行(モードB)
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 shrink-0 flex-col border-b border-border">
      <RedebugStatusBar status={status} onStopAction={stopRedebug} />
      {status.divergences.length > 0 && (
        <div className="max-h-24 shrink-0 space-y-1 overflow-y-auto border-t border-warn/30 bg-warn/10 px-3 py-1.5">
          {status.divergences.map((divergence, index) => (
            <p key={index} className="text-[10.5px] leading-snug text-warn">
              ⚠ 再現できない差分({divergence.oracle}): {divergence.message}
            </p>
          ))}
        </div>
      )}
      {status.phase === 'paused' && status.pause && (
        <div className="min-h-0 overflow-y-auto">
          <ScopeSection scopes={status.pause.scopes} />
          <CallStackSection callFrames={status.pause.callFrames} />
        </div>
      )}
    </div>
  )
}

function RedebugStatusBar({
  status,
  onStopAction,
}: {
  status: RedebugStatus
  onStopAction: () => void
}) {
  const phaseText: Record<RedebugStatus['phase'], string> = {
    starting: '準備中…',
    booting: '録画から起動中…',
    'replaying-inputs': '操作を再現中…',
    paused: `Paused on ${status.pause?.reason ?? 'pause'}`,
    running: '実行中…',
    finished: '完了',
    failed: status.error ?? '失敗しました',
  }
  const isPaused = status.phase === 'paused'

  const step = (action: 'resume' | 'stepOver' | 'stepInto' | 'stepOut' | 'pause'): void => {
    void window.entrance.redebugStep({ action })
  }

  return (
    <div className="flex shrink-0 items-center gap-1 px-2 py-1.5">
      {isPaused ? (
        <>
          <StepButton label="再開" onClickAction={() => step('resume')}>
            <Play className="h-3 w-3 fill-current" />
          </StepButton>
          <StepButton label="ステップオーバー" onClickAction={() => step('stepOver')}>
            <Redo className="h-3 w-3" />
          </StepButton>
          <StepButton label="ステップイン" onClickAction={() => step('stepInto')}>
            <ArrowDown className="h-3 w-3" />
          </StepButton>
          <StepButton label="ステップアウト" onClickAction={() => step('stepOut')}>
            <ArrowUp className="h-3 w-3" />
          </StepButton>
        </>
      ) : (
        status.phase === 'running' && (
          <StepButton label="一時停止" onClickAction={() => step('pause')}>
            <Pause className="h-3 w-3 fill-current" />
          </StepButton>
        )
      )}
      <span
        className={`min-w-0 flex-1 truncate px-1 font-mono text-[11px] ${
          status.phase === 'failed'
            ? 'text-[#ff5c5c]'
            : isPaused
              ? 'text-warn'
              : 'text-muted-foreground'
        }`}
      >
        {phaseText[status.phase]}
      </span>
      <StepButton label="再現実行を終了" onClickAction={onStopAction}>
        <Square className="h-3 w-3" />
      </StepButton>
    </div>
  )
}

function StepButton({
  label,
  onClickAction,
  children,
}: {
  label: string
  onClickAction: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClickAction}
      className="grid h-6 w-6 shrink-0 place-items-center rounded border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      {children}
    </button>
  )
}

function ScopeSection({ scopes }: { scopes: RedebugScope[] }) {
  return (
    <div className="border-t border-border px-3 py-2">
      <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground">SCOPE</p>
      {scopes.length === 0 && (
        <p className="text-[11px] text-muted-foreground">変数はありません</p>
      )}
      {scopes.map((scope, scopeIndex) => (
        <div key={scopeIndex} className="mb-1.5">
          <p className="text-[11px] font-medium text-foreground/90 capitalize">
            {scope.type}
            {scope.name ? ` (${scope.name})` : ''}
          </p>
          {scope.variables.map((variable) => (
            <p key={variable.name} className="truncate pl-3 font-mono text-[11px] leading-relaxed">
              <span className="text-[#4da3ff]">{variable.name}</span>
              <span className="text-muted-foreground"> : </span>
              <span className="text-foreground/80">{variable.preview}</span>
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}

function CallStackSection({
  callFrames,
}: {
  callFrames: Array<{ callFrameId: string; functionName: string; url: string; lineNumber: number }>
}) {
  return (
    <div className="border-t border-border px-3 py-2">
      <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground">
        CALL STACK
      </p>
      {callFrames.map((frame) => (
        <div key={frame.callFrameId} className="flex items-baseline gap-2 py-0.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90">
            {frame.functionName}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {lastPathSegment(frame.url)}:{frame.lineNumber + 1}
          </span>
        </div>
      ))}
    </div>
  )
}

/** "chunk.js" from a generated URL (call-stack right column). */
function lastPathSegment(rawUrl: string): string {
  try {
    const segments = new URL(rawUrl).pathname.split('/').filter(Boolean)
    return segments[segments.length - 1] ?? rawUrl
  } catch {
    return rawUrl.split('/').pop() ?? rawUrl
  }
}

import { Suspense, use, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { ArrowLeft, Pause, Play } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'

import { buildCodeAnchors } from '@shared/code-anchors'
import { buildProfileTimeline } from '@shared/cpuprofile-timeline'
import { buildTimelineMarkers } from '@shared/timeline-markers'
import { buildTranscriptItems } from '@shared/transcript-items'

import type { LoadedRecording } from '../lib/replay/load-recording'

import { DebugSidePanel } from '../components/DebugSidePanel'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { RrwebPlayer, type RrwebPlayerHandle } from '../components/RrwebPlayer'
import { TimelineCanvas } from '../components/TimelineCanvas'
import { TranscriptPanel } from '../components/TranscriptPanel'
import {
  REPLAY_DEBUG_PANEL_DEFAULT_PCT,
  REPLAY_DEBUG_PANEL_MIN_PCT,
  REPLAY_TRANSCRIPT_PANEL_DEFAULT_PCT,
  REPLAY_TRANSCRIPT_PANEL_MIN_PCT,
} from '../constants'
import { formatRecClock } from '../lib/format-rec-clock'
import { loadRecording } from '../lib/replay/load-recording'
import { playheadStore } from '../lib/replay/playhead-store'
import { createSourceResolver } from '../lib/replay/source-resolver'
import { replayClosed } from '../store/appSlice'
import { useAppDispatch, useAppSelector } from '../store'

/**
 * Screens 1a/1b — replay + debugger. Mode A: rrweb passive replay between the
 * 1b transcript (left) and the Console/Network inspector (right), multi-lane
 * timeline + transport below. Slice E adds the sourcemap code panel.
 */
export function ReplayScreen() {
  const recordingId = useAppSelector((state) => state.app.replayRecordingId)
  // One load per screen entry; use() suspends below.
  const [loadPromise] = useState<Promise<LoadedRecording> | null>(() =>
    recordingId ? loadRecording(recordingId) : null,
  )

  // Every use() consumer sits inside the boundary — a corrupt bundle must
  // degrade to the error body, never blank the window.
  return (
    <div className="flex h-full flex-col">
      <ErrorBoundary
        fallback={
          <>
            <ReplayTopBar />
            <div className="grid flex-1 place-items-center">
              <p className="text-[13px] text-muted-foreground">録画データを読み込めませんでした</p>
            </div>
          </>
        }
      >
        <Suspense
          fallback={
            <>
              <ReplayTopBar />
              <div className="grid flex-1 place-items-center">
                <p className="font-mono text-[12px] text-muted-foreground">読み込み中…</p>
              </div>
            </>
          }
        >
          {loadPromise ? <ReplayLoaded loadPromise={loadPromise} /> : <ReplayTopBar />}
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export default ReplayScreen

/** Top bar (mock 1a/1b): back to library + target URL readout + 再生中 badge once loaded. */
function ReplayTopBar({ manifest }: { manifest?: LoadedRecording['manifest'] }) {
  const dispatch = useAppDispatch()
  return (
    <div className="app-drag flex h-12 shrink-0 items-center gap-3 border-b border-border pr-4 pl-[84px]">
      <button
        type="button"
        onClick={() => dispatch(replayClosed())}
        className="app-no-drag flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        ライブラリ
      </button>
      {manifest && (
        <>
          <div className="app-no-drag flex h-8 min-w-0 items-center gap-2 rounded-lg border border-border bg-sunken px-3 max-w-[420px]">
            <span className="truncate font-mono text-[11.5px] text-foreground/90">
              {displayUrl(manifest.targetUrl)}
            </span>
          </div>
          <span className="flex h-8 items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 text-[12px] font-medium text-primary">
            <Play className="h-3 w-3 fill-primary" />
            再生中 · {manifest.name}
          </span>
          {manifest.endReason !== 'user-stop' && (
            <span className="rounded bg-warn/15 px-2 py-1 text-[11px] font-medium text-warn">部分録画</span>
          )}
        </>
      )}
    </div>
  )
}

function ReplayLoaded({ loadPromise }: { loadPromise: Promise<LoadedRecording> }) {
  const recording = use(loadPromise)
  const playerRef = useRef<RrwebPlayerHandle>(null)
  const hasReplayableDom = recording.rrwebEvents.length >= 2
  const markers = useMemo(
    () => buildTimelineMarkers(recording.lanes, recording.manifest.t0Mono),
    [recording],
  )
  const transcriptItems = useMemo(
    () =>
      buildTranscriptItems(recording.lanes, recording.manifest.t0Mono, recording.manifest.targetUrl),
    [recording],
  )
  const codeAnchors = useMemo(
    () => buildCodeAnchors(recording.lanes, recording.manifest.t0Mono),
    [recording],
  )
  const profileTimeline = useMemo(
    () =>
      recording.cpuProfile
        ? buildProfileTimeline(recording.cpuProfile, recording.manifest.t0Mono)
        : null,
    [recording],
  )
  const sourceResolver = useMemo(
    () => createSourceResolver(recording.manifest.recordingId, recording.sourcemapIndex),
    [recording],
  )
  const seekTo = (tMonoOffsetMs: number): void => playerRef.current?.seekTo(tMonoOffsetMs)

  return (
    <>
      <ReplayTopBar manifest={recording.manifest} />
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel
          defaultSize={`${REPLAY_TRANSCRIPT_PANEL_DEFAULT_PCT}%`}
          minSize={`${REPLAY_TRANSCRIPT_PANEL_MIN_PCT}%`}
          className="h-full"
        >
          <TranscriptPanel
            items={transcriptItems}
            durationMs={recording.manifest.durationMs}
            onSeekAction={seekTo}
          />
        </Panel>
        <Separator className="w-px bg-border transition-colors hover:bg-primary/60 active:bg-primary" />
        <Panel className="h-full">
          <div className="relative h-full bg-black">
            {hasReplayableDom ? (
              <RrwebPlayer
                ref={playerRef}
                events={recording.rrwebEvents}
                anchors={recording.timeAnchors}
                durationMs={recording.manifest.durationMs}
              />
            ) : (
              <div className="grid h-full place-items-center">
                <p className="text-[13px] text-muted-foreground">
                  この録画には再生できる画面データがありません
                </p>
              </div>
            )}
          </div>
        </Panel>
        <Separator className="w-px bg-border transition-colors hover:bg-primary/60 active:bg-primary" />
        <Panel
          defaultSize={`${REPLAY_DEBUG_PANEL_DEFAULT_PCT}%`}
          minSize={`${REPLAY_DEBUG_PANEL_MIN_PCT}%`}
          className="h-full"
        >
          <DebugSidePanel
            items={transcriptItems}
            anchors={codeAnchors}
            profileTimeline={profileTimeline}
            resolver={sourceResolver}
            onSeekAction={seekTo}
          />
        </Panel>
      </Group>
      {/* Multi-lane timeline (mock 1a bottom panel; 1c filmstrip folded in as a lane) */}
      <div className="shrink-0 border-t border-border bg-sunken">
        <TimelineCanvas
          recordingId={recording.manifest.recordingId}
          durationMs={recording.manifest.durationMs}
          markers={markers}
          screencastLane={recording.lanes.screencast ?? []}
          t0Mono={recording.manifest.t0Mono}
          onSeekAction={(tMonoOffsetMs) => playerRef.current?.seekTo(tMonoOffsetMs)}
        />
      </div>
      <TransportBar durationMs={recording.manifest.durationMs} playerRef={playerRef} />
    </>
  )
}

/** Bottom transport per mock 1b: play toggle, clock, seek bar, speed. */
function TransportBar({
  durationMs,
  playerRef,
}: {
  durationMs: number
  playerRef: React.RefObject<RrwebPlayerHandle | null>
}) {
  const playhead = useSyncExternalStore(playheadStore.subscribe, playheadStore.getSnapshot)

  return (
    <div className="flex h-14 shrink-0 items-center gap-4 border-t border-border px-4">
      <button
        type="button"
        aria-label={playhead.isPlaying ? '一時停止' : '再生'}
        onClick={() => playerRef.current?.togglePlay()}
        className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        {playhead.isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        )}
      </button>
      <span className="shrink-0 font-mono text-[12px] tabular-nums">
        <span className="text-foreground">{formatRecClock(playhead.tMonoOffsetMs)}</span>
        <span className="text-muted-foreground"> / {formatRecClock(durationMs)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(durationMs))}
        step={10}
        value={Math.round(playhead.tMonoOffsetMs)}
        onChange={(event) => playerRef.current?.seekTo(Number(event.target.value))}
        aria-label="シークバー"
        className="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
      />
      <SpeedButton playerRef={playerRef} speed={playhead.speed} />
    </div>
  )
}

const SPEED_STEPS = [1, 1.5, 2] as const

function SpeedButton({
  playerRef,
  speed,
}: {
  playerRef: React.RefObject<RrwebPlayerHandle | null>
  speed: number
}) {
  const nextSpeed = (): number => {
    const index = SPEED_STEPS.findIndex((step) => step === speed)
    return SPEED_STEPS[(index + 1) % SPEED_STEPS.length]
  }
  return (
    <button
      type="button"
      onClick={() => playerRef.current?.setSpeed(nextSpeed())}
      className="shrink-0 rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {speed.toFixed(1)}×
    </button>
  )
}

/** "localhost:3000/dashboard" from a full URL (header readout). */
function displayUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return rawUrl
  }
}

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'

import { Replayer } from '@rrweb/replay'
import '@rrweb/replay/dist/style.css'
import type { eventWithTime } from '@rrweb/types'

import { toRrwebOffset, toTMonoOffset, type RrwebTimeAnchor } from '@shared/rrweb-time-map'

import { playheadStore } from '../lib/replay/playhead-store'

/**
 * Mode A passive replay surface (spec decision 2): mounts the rrweb Replayer
 * (sandboxed iframe — recorded snapshots are rebuilt, page JS never executes),
 * scales it to fit, and drives playheadStore on the canonical clock. The
 * recording's duration usually outlives the last DOM mutation, so playback has
 * two phases: 'rrweb' (Replayer-driven) and 'tail' (wall-clock-driven over the
 * frozen last frame) — like a video whose picture stops changing.
 */

export interface RrwebPlayerHandle {
  /** Jump to a canonical-clock position; keeps the current play/pause state. */
  seekTo(tMonoOffsetMs: number): void
  togglePlay(): void
  setSpeed(speed: number): void
}

/** Minimum structure the Replayer needs; TS cannot narrow unknown lane payloads on its own. */
function isRrwebEventShaped(value: unknown): value is eventWithTime {
  if (typeof value !== 'object' || value === null) return false
  if (!('type' in value) || typeof value.type !== 'number') return false
  return 'timestamp' in value && typeof value.timestamp === 'number'
}

interface TransportState {
  isPlaying: boolean
  speed: number
  /** 'rrweb' = Replayer clock is authoritative; 'tail' = we advance past the last DOM event. */
  phase: 'rrweb' | 'tail'
  /** performance.now() of the previous tail frame (dt integration). */
  lastFrameAt: number
}

export function RrwebPlayer({
  ref,
  events,
  anchors,
  durationMs,
}: {
  ref: Ref<RrwebPlayerHandle>
  /** rrweb lane payloads (unknown until shape-checked). */
  events: unknown[]
  anchors: RrwebTimeAnchor[]
  durationMs: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const replayerRef = useRef<Replayer | null>(null)
  const transportRef = useRef<TransportState>({
    isPlaying: false,
    speed: 1,
    phase: 'rrweb',
    lastFrameAt: 0,
  })
  const animationFrameRef = useRef(0)

  // Where the rrweb lane ends on each clock — the rrweb→tail boundary.
  const lastAnchor = anchors.length > 0 ? anchors[anchors.length - 1] : null
  const lastRrwebTMono = lastAnchor?.tMonoOffset ?? 0
  const lastRrwebOffset = lastAnchor?.rrwebOffset ?? 0

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const validEvents = events.filter(isRrwebEventShaped)
    // Replayer needs a Meta + FullSnapshot pair at minimum.
    if (validEvents.length < 2) return

    const replayer = new Replayer(validEvents, {
      root: container,
      mouseTail: false,
      pauseAnimation: true,
      useVirtualDom: true,
      speed: 1,
    })
    replayerRef.current = replayer
    replayer.disableInteract()

    // Fit the recorded viewport into the container, centered, aspect preserved.
    let contentWidth = 0
    let contentHeight = 0
    const applyScale = (): void => {
      if (contentWidth === 0 || contentHeight === 0) return
      const scale = Math.min(
        container.clientWidth / contentWidth,
        container.clientHeight / contentHeight,
      )
      const wrapper = replayer.wrapper
      wrapper.style.position = 'absolute'
      wrapper.style.left = '50%'
      wrapper.style.top = '50%'
      wrapper.style.transformOrigin = 'center center'
      wrapper.style.transform = `translate(-50%, -50%) scale(${scale})`
    }
    replayer.on('resize', (payload) => {
      if (typeof payload === 'object' && payload !== null && 'width' in payload && 'height' in payload) {
        if (typeof payload.width === 'number' && typeof payload.height === 'number') {
          contentWidth = payload.width
          contentHeight = payload.height
          applyScale()
        }
      }
    })
    const containerObserver = new ResizeObserver(applyScale)
    containerObserver.observe(container)

    // The DOM stream ended — if the recording is longer, keep rolling as 'tail'.
    replayer.on('finish', () => {
      const transport = transportRef.current
      if (!transport.isPlaying) return
      if (lastRrwebTMono < durationMs) {
        transport.phase = 'tail'
        transport.lastFrameAt = performance.now()
      } else {
        transport.isPlaying = false
        playheadStore.set({ tMonoOffsetMs: durationMs, isPlaying: false, speed: transport.speed })
      }
    })

    // Open paused on the first frame (the t0 FullSnapshot).
    replayer.pause(0)
    playheadStore.set({ tMonoOffsetMs: 0, isPlaying: false, speed: 1 })

    const transport = transportRef.current
    return () => {
      cancelAnimationFrame(animationFrameRef.current)
      containerObserver.disconnect()
      replayer.destroy()
      replayerRef.current = null
      transport.isPlaying = false
      transport.phase = 'rrweb'
      playheadStore.reset()
    }
    // events/anchors are stable per loaded recording (derived from one use() result).
  }, [events, anchors, durationMs, lastRrwebTMono])

  useImperativeHandle(ref, () => {
    const publish = (tMonoOffsetMs: number): void => {
      const transport = transportRef.current
      playheadStore.set({
        tMonoOffsetMs: Math.max(0, Math.min(tMonoOffsetMs, durationMs)),
        isPlaying: transport.isPlaying,
        speed: transport.speed,
      })
    }

    const frameTick = (): void => {
      const replayer = replayerRef.current
      const transport = transportRef.current
      if (!replayer || !transport.isPlaying) return
      if (transport.phase === 'rrweb') {
        publish(toTMonoOffset(anchors, replayer.getCurrentTime()))
      } else {
        // Tail: no DOM events left — advance on the wall clock at play speed.
        const now = performance.now()
        const nextMs = playheadStore.peek().tMonoOffsetMs + (now - transport.lastFrameAt) * transport.speed
        transport.lastFrameAt = now
        if (nextMs >= durationMs) {
          transport.isPlaying = false
          publish(durationMs)
          return
        }
        publish(nextMs)
      }
      animationFrameRef.current = requestAnimationFrame(frameTick)
    }
    const startFrameLoop = (): void => {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = requestAnimationFrame(frameTick)
    }

    return {
      seekTo(tMonoOffsetMs: number): void {
        const replayer = replayerRef.current
        if (!replayer) return
        const transport = transportRef.current
        const clamped = Math.max(0, Math.min(tMonoOffsetMs, durationMs))
        if (clamped <= lastRrwebTMono) {
          transport.phase = 'rrweb'
          const rrwebOffset = toRrwebOffset(anchors, clamped)
          if (transport.isPlaying) replayer.play(rrwebOffset)
          else replayer.pause(rrwebOffset)
        } else {
          // Past the last DOM event: show the final frame, run the tail clock.
          transport.phase = 'tail'
          transport.lastFrameAt = performance.now()
          replayer.pause(lastRrwebOffset)
        }
        publish(clamped)
        if (transport.isPlaying) startFrameLoop()
      },
      togglePlay(): void {
        const replayer = replayerRef.current
        if (!replayer) return
        const transport = transportRef.current
        if (transport.isPlaying) {
          transport.isPlaying = false
          cancelAnimationFrame(animationFrameRef.current)
          if (transport.phase === 'rrweb') replayer.pause()
          publish(
            transport.phase === 'rrweb'
              ? toTMonoOffset(anchors, replayer.getCurrentTime())
              : playheadStore.peek().tMonoOffsetMs,
          )
          return
        }
        transport.isPlaying = true
        // Play from the end restarts from the top, like a video player.
        const startAt = playheadStore.peek().tMonoOffsetMs >= durationMs ? 0 : playheadStore.peek().tMonoOffsetMs
        if (startAt <= lastRrwebTMono) {
          transport.phase = 'rrweb'
          replayer.play(toRrwebOffset(anchors, startAt))
        } else {
          transport.phase = 'tail'
          transport.lastFrameAt = performance.now()
        }
        publish(startAt)
        startFrameLoop()
      },
      setSpeed(speed: number): void {
        const replayer = replayerRef.current
        if (!replayer) return
        replayer.setConfig({ speed })
        transportRef.current.speed = speed
        publish(playheadStore.peek().tMonoOffsetMs)
      },
    }
  }, [anchors, durationMs, lastRrwebTMono, lastRrwebOffset])

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />
}

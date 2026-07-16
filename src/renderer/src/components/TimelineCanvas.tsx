import { useEffect, useRef } from 'react'

import { z } from 'zod'

import type { ReplayLaneEvent } from '@shared/replay'
import type { TimelineMarker, TimelineMarkerKind } from '@shared/timeline-markers'

import {
  TIMELINE_FILMSTRIP_HEIGHT_PX,
  TIMELINE_FILMSTRIP_MAX_FRAMES,
  TIMELINE_LABEL_WIDTH_PX,
  TIMELINE_LANE_HEIGHT_PX,
  TIMELINE_RULER_HEIGHT_PX,
  TIMELINE_SCRUB_THROTTLE_MS,
} from '../constants'
import { formatRecClock } from '../lib/format-rec-clock'
import { playheadStore } from '../lib/replay/playhead-store'

/**
 * Hand-rolled Canvas-2D timeline (spec decision 15): filmstrip lane (1c folded
 * into 1a), one row per marker lane, ruler, and a playhead redrawn every
 * animation frame from playheadStore.peek() — playhead position never touches
 * React state. Click/drag scrubs via onSeekAction.
 */

/** Lane rows top-to-bottom; colors mirror index.css tokens (canvas can't read CSS vars cheaply). */
const LANE_ROWS: Array<{ kind: TimelineMarkerKind; label: string; color: string }> = [
  { kind: 'click', label: '操作', color: '#4da3ff' },
  { kind: 'fetch', label: 'fetch', color: '#34d399' },
  { kind: 'console', label: 'console', color: '#fbbf24' },
  { kind: 'error', label: 'エラー', color: '#ff5c5c' },
  { kind: 'route', label: 'route', color: '#a78bfa' },
]

const SURFACE_COLOR = '#111417'
const HAIRLINE_COLOR = 'rgba(255, 255, 255, 0.07)'
const TEXT_MUTED_COLOR = '#5f6975'
const PLAYHEAD_COLOR = '#4da3ff'

const screencastPayloadSchema = z.looseObject({ bodyHash: z.string() })

export function TimelineCanvas({
  recordingId,
  durationMs,
  markers,
  screencastLane,
  t0Mono,
  onSeekAction,
}: {
  recordingId: string
  durationMs: number
  markers: TimelineMarker[]
  screencastLane: ReplayLaneEvent[]
  t0Mono: number
  onSeekAction: (tMonoOffsetMs: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const framesRef = useRef<Array<{ tMonoOffset: number; bitmap: ImageBitmap }>>([])
  const hoverRef = useRef<number | null>(null)
  const isScrubbingRef = useRef(false)
  const lastScrubAtRef = useRef(0)

  // Decode an evenly sampled subset of screencast frames for the filmstrip.
  useEffect(() => {
    let isDisposed = false
    const sampled = sampleFrames(screencastLane, t0Mono)
    framesRef.current = []
    void Promise.all(
      sampled.map(async ({ tMonoOffset, bodyHash }) => {
        try {
          const response = await fetch(`entrance://recording/${recordingId}/blobs/${bodyHash}`)
          if (!response.ok) return
          const bitmap = await createImageBitmap(await response.blob())
          if (isDisposed) return
          framesRef.current.push({ tMonoOffset, bitmap })
          framesRef.current.sort((a, b) => a.tMonoOffset - b.tMonoOffset)
        } catch {
          // A missing frame leaves a hatched gap — never breaks the timeline.
        }
      }),
    )
    return () => {
      isDisposed = true
      framesRef.current = []
    }
  }, [recordingId, screencastLane, t0Mono])

  // Draw loop: full redraw per animation frame (a few hundred rects — cheap),
  // reading the playhead via peek() so scrubbing/playback never re-renders React.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let animationFrame = 0
    const draw = (): void => {
      const parent = canvas.parentElement
      if (parent) {
        const devicePixels = window.devicePixelRatio || 1
        const width = parent.clientWidth
        const height = timelineHeight()
        if (canvas.width !== width * devicePixels || canvas.height !== height * devicePixels) {
          canvas.width = width * devicePixels
          canvas.height = height * devicePixels
          canvas.style.width = `${width}px`
          canvas.style.height = `${height}px`
        }
        context.setTransform(devicePixels, 0, 0, devicePixels, 0, 0)
        paintTimeline(context, {
          width,
          durationMs,
          markers,
          frames: framesRef.current,
          playheadMs: playheadStore.peek().tMonoOffsetMs,
          hoverMs: hoverRef.current,
        })
      }
      animationFrame = requestAnimationFrame(draw)
    }
    animationFrame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animationFrame)
  }, [durationMs, markers])

  const msFromPointer = (event: React.PointerEvent<HTMLCanvasElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect()
    const trackWidth = rect.width - TIMELINE_LABEL_WIDTH_PX
    const ratio = (event.clientX - rect.left - TIMELINE_LABEL_WIDTH_PX) / Math.max(1, trackWidth)
    return Math.max(0, Math.min(1, ratio)) * durationMs
  }

  return (
    <canvas
      ref={canvasRef}
      className="block w-full cursor-crosshair"
      style={{ height: timelineHeight() }}
      onPointerDown={(event) => {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Capture is best-effort — synthetic/test pointer ids may not exist.
        }
        isScrubbingRef.current = true
        lastScrubAtRef.current = performance.now()
        onSeekAction(msFromPointer(event))
      }}
      onPointerMove={(event) => {
        hoverRef.current = msFromPointer(event)
        if (!isScrubbingRef.current) return
        // Scrub preview: each seek rebuilds the rrweb DOM, so pace the calls.
        const now = performance.now()
        if (now - lastScrubAtRef.current >= TIMELINE_SCRUB_THROTTLE_MS) {
          lastScrubAtRef.current = now
          onSeekAction(msFromPointer(event))
        }
      }}
      onPointerUp={(event) => {
        if (isScrubbingRef.current) {
          isScrubbingRef.current = false
          onSeekAction(msFromPointer(event))
        }
      }}
      onPointerLeave={() => {
        hoverRef.current = null
      }}
    />
  )
}

function timelineHeight(): number {
  return (
    TIMELINE_FILMSTRIP_HEIGHT_PX + LANE_ROWS.length * TIMELINE_LANE_HEIGHT_PX + TIMELINE_RULER_HEIGHT_PX
  )
}

/** Evenly samples up to TIMELINE_FILMSTRIP_MAX_FRAMES screencast frames. */
function sampleFrames(
  screencastLane: ReplayLaneEvent[],
  t0Mono: number,
): Array<{ tMonoOffset: number; bodyHash: string }> {
  const usable = screencastLane.flatMap((event) => {
    const payload = screencastPayloadSchema.safeParse(event.payload)
    return payload.success ? [{ tMonoOffset: event.tMono - t0Mono, bodyHash: payload.data.bodyHash }] : []
  })
  if (usable.length <= TIMELINE_FILMSTRIP_MAX_FRAMES) return usable
  const step = usable.length / TIMELINE_FILMSTRIP_MAX_FRAMES
  return Array.from({ length: TIMELINE_FILMSTRIP_MAX_FRAMES }, (_, i) => usable[Math.floor(i * step)])
}

interface PaintInput {
  width: number
  durationMs: number
  markers: TimelineMarker[]
  frames: Array<{ tMonoOffset: number; bitmap: ImageBitmap }>
  playheadMs: number
  hoverMs: number | null
}

function paintTimeline(context: CanvasRenderingContext2D, input: PaintInput): void {
  const { width, durationMs, markers, frames, playheadMs, hoverMs } = input
  const height = timelineHeight()
  const trackLeft = TIMELINE_LABEL_WIDTH_PX
  const trackWidth = Math.max(1, width - trackLeft)
  const xOf = (ms: number): number => trackLeft + (Math.max(0, Math.min(ms, durationMs)) / Math.max(1, durationMs)) * trackWidth

  context.clearRect(0, 0, width, height)
  context.fillStyle = SURFACE_COLOR
  context.fillRect(0, 0, width, height)

  // Filmstrip: frame image covers [its time, next frame's time).
  const stripTop = 0
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]
    const startX = xOf(frame.tMonoOffset)
    const endX = index + 1 < frames.length ? xOf(frames[index + 1].tMonoOffset) : trackLeft + trackWidth
    const cellWidth = Math.max(1, endX - startX)
    // object-fit: cover — crop the source to the cell's aspect ratio.
    const cellAspect = cellWidth / TIMELINE_FILMSTRIP_HEIGHT_PX
    const sourceAspect = frame.bitmap.width / frame.bitmap.height
    let sourceWidth = frame.bitmap.width
    let sourceHeight = frame.bitmap.height
    if (sourceAspect > cellAspect) sourceWidth = frame.bitmap.height * cellAspect
    else sourceHeight = frame.bitmap.width / cellAspect
    context.drawImage(
      frame.bitmap,
      (frame.bitmap.width - sourceWidth) / 2,
      (frame.bitmap.height - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      startX,
      stripTop,
      cellWidth,
      TIMELINE_FILMSTRIP_HEIGHT_PX,
    )
    context.strokeStyle = HAIRLINE_COLOR
    context.strokeRect(startX + 0.5, stripTop + 0.5, cellWidth - 1, TIMELINE_FILMSTRIP_HEIGHT_PX - 1)
  }

  // Marker lane rows with left labels.
  const lanesTop = TIMELINE_FILMSTRIP_HEIGHT_PX
  context.font = '9.5px "JetBrains Mono", monospace'
  context.textBaseline = 'middle'
  for (let rowIndex = 0; rowIndex < LANE_ROWS.length; rowIndex += 1) {
    const row = LANE_ROWS[rowIndex]
    const rowTop = lanesTop + rowIndex * TIMELINE_LANE_HEIGHT_PX
    context.fillStyle = TEXT_MUTED_COLOR
    context.fillText(row.label, 8, rowTop + TIMELINE_LANE_HEIGHT_PX / 2)
    context.strokeStyle = HAIRLINE_COLOR
    context.beginPath()
    context.moveTo(trackLeft, rowTop + 0.5)
    context.lineTo(width, rowTop + 0.5)
    context.stroke()
  }
  for (const marker of markers) {
    const rowIndex = LANE_ROWS.findIndex((row) => row.kind === marker.kind)
    if (rowIndex === -1) continue
    const rowTop = lanesTop + rowIndex * TIMELINE_LANE_HEIGHT_PX
    context.fillStyle = LANE_ROWS[rowIndex].color
    context.beginPath()
    context.arc(xOf(marker.tMonoOffset), rowTop + TIMELINE_LANE_HEIGHT_PX / 2, 2.5, 0, Math.PI * 2)
    context.fill()
  }

  // Ruler: a tick every ~5s scaled to keep labels readable.
  const rulerTop = lanesTop + LANE_ROWS.length * TIMELINE_LANE_HEIGHT_PX
  context.strokeStyle = HAIRLINE_COLOR
  context.beginPath()
  context.moveTo(0, rulerTop + 0.5)
  context.lineTo(width, rulerTop + 0.5)
  context.stroke()
  const tickStepMs = pickTickStep(durationMs, trackWidth)
  context.fillStyle = TEXT_MUTED_COLOR
  for (let tick = 0; tick <= durationMs; tick += tickStepMs) {
    const x = xOf(tick)
    context.fillRect(x, rulerTop, 1, 4)
    context.fillText(formatRulerLabel(tick), x + 3, rulerTop + TIMELINE_RULER_HEIGHT_PX / 2 + 2)
  }

  // Hover ghost line.
  if (hoverMs !== null) {
    context.strokeStyle = 'rgba(230, 233, 238, 0.25)'
    context.beginPath()
    context.moveTo(xOf(hoverMs) + 0.5, 0)
    context.lineTo(xOf(hoverMs) + 0.5, height)
    context.stroke()
  }

  // Playhead line + time chip (mock 1c's 00:12.48 flag).
  const playheadX = xOf(playheadMs)
  context.strokeStyle = PLAYHEAD_COLOR
  context.lineWidth = 1.5
  context.beginPath()
  context.moveTo(playheadX, 0)
  context.lineTo(playheadX, height)
  context.stroke()
  context.lineWidth = 1
  const label = formatRecClock(playheadMs)
  context.font = '10px "JetBrains Mono", monospace'
  const labelWidth = context.measureText(label).width + 10
  const chipX = Math.max(trackLeft, Math.min(playheadX - labelWidth / 2, width - labelWidth))
  context.fillStyle = PLAYHEAD_COLOR
  context.fillRect(chipX, 2, labelWidth, 14)
  context.fillStyle = '#ffffff'
  context.fillText(label, chipX + 5, 9)
}

/** Tick spacing that keeps ruler labels ≥ ~64px apart. */
function pickTickStep(durationMs: number, trackWidth: number): number {
  const candidates = [1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000]
  for (const candidate of candidates) {
    if ((candidate / durationMs) * trackWidth >= 64) return candidate
  }
  return candidates[candidates.length - 1]
}

/** "0:05" style ruler label (mock 1c cell captions). */
function formatRulerLabel(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

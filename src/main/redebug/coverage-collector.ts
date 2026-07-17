import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { AnyMap, eachMapping, sourceContentFor, type TraceMap } from '@jridgewell/trace-mapping'
import { z } from 'zod'

import {
  buildLineStarts,
  COVERAGE_TIMELINE_FILE,
  flattenExecutedSegments,
  offsetToLineCol,
  type CoverageBucket,
  type CoverageTimeline,
  type V8ScriptCoverage,
} from '@shared/coverage-timeline'
import { formatSourcePath } from '@shared/format-source-path'
import { isAppSourcePath } from '@shared/is-app-source-path'

/**
 * Harvest-mode coverage engine (goal: every executed app line on the recorded
 * timeline): stores Profiler.takePreciseCoverage deltas per event boundary
 * during a Mode B run, then resolves executed byte ranges → generated lines →
 * original app lines through the bundle's sourcemaps and writes
 * coverage/coverage-timeline.json. Owned by RedebugSession when harvest=true.
 */

type CdpSend = (method: string, params?: unknown) => Promise<unknown>

export interface CoverageBoundary {
  kind: CoverageBucket['kind']
  seq?: number
  /** Recorded-clock bucket bounds (tMonoOffset ms). */
  tStart: number
  tEnd: number
  approx?: boolean
}

const coverageTakeSchema = z.object({
  result: z.array(
    z.object({
      scriptId: z.string(),
      url: z.string().catch(''),
      functions: z.array(
        z.object({
          functionName: z.string().catch(''),
          isBlockCoverage: z.boolean().catch(false),
          ranges: z.array(
            z.object({
              startOffset: z.number(),
              endOffset: z.number(),
              count: z.number(),
            }),
          ),
        }),
      ),
    }),
  ),
})

const scriptSourceSchema = z.object({ scriptSource: z.string() })

/** sourcemaps/index.json rows (same shape the renderer resolver reads). */
const sourcemapIndexSchema = z.object({
  maps: z.array(
    z.looseObject({
      scriptUrl: z.string(),
      file: z.string().optional(),
      bodyHash: z.string().optional(),
    }),
  ),
})

/** backfill.json rows — inexact backfilled chunks carry the map matching the served body. */
const backfillSchema = z.record(
  z.string(),
  z.looseObject({ freshMapFile: z.string().optional() }),
)

/** One sourcemap mapping in flat generated order (0-based line/column). */
interface FlatMapping {
  generatedLine: number
  generatedColumn: number
  source: string
  originalLine: number
}

export class CoverageCollector {
  /** Raw per-boundary deltas — resolved only once at finalize (takes stay fast). */
  private readonly deltas: Array<{ boundary: CoverageBoundary; scripts: V8ScriptCoverage[] }> = []
  private readonly scriptUrlById = new Map<string, string>()
  /** scriptUrl → absolute sourcemap path (backfill overrides recorded harvest). */
  private readonly mapPathByScriptUrl = new Map<string, string>()

  constructor(private readonly recordingDirPath: string) {
    try {
      const index = sourcemapIndexSchema.parse(
        JSON.parse(readFileSync(join(recordingDirPath, 'sourcemaps', 'index.json'), 'utf8')),
      )
      for (const entry of index.maps) {
        if (entry.file) {
          this.mapPathByScriptUrl.set(
            entry.scriptUrl,
            join(recordingDirPath, 'sourcemaps', entry.file),
          )
        } else if (entry.bodyHash) {
          this.mapPathByScriptUrl.set(entry.scriptUrl, join(recordingDirPath, 'blobs', entry.bodyHash))
        }
      }
    } catch {
      /* no harvested sourcemaps — coverage resolves nothing, artifact stays honest */
    }
    try {
      const backfill = backfillSchema.parse(
        JSON.parse(readFileSync(join(recordingDirPath, 'backfill.json'), 'utf8')),
      )
      // A backfilled body is the FRESH build — its offsets only match the fresh map.
      for (const [scriptUrl, entry] of Object.entries(backfill)) {
        if (entry.freshMapFile) {
          this.mapPathByScriptUrl.set(
            scriptUrl,
            join(recordingDirPath, 'sourcemaps', entry.freshMapFile),
          )
        }
      }
    } catch {
      /* no backfill sidecar — recorded maps only */
    }
  }

  /** Enables block-precise counting before the page boots (counts reset on every take). */
  async attach(send: CdpSend): Promise<void> {
    await send('Profiler.enable')
    await send('Profiler.startPreciseCoverage', { callCount: true, detailed: true })
  }

  /** Keeps eval'd scripts resolvable — coverage entries for them carry an empty url. */
  onScriptParsed(scriptId: string, url: string): void {
    if (scriptId && url) this.scriptUrlById.set(scriptId, url)
  }

  /**
   * Snapshots the coverage delta since the previous take into one bucket.
   * @param boundary - recorded-clock bounds this delta is attributed to
   * @param send - CDP command sender of the harvest window
   */
  async take(boundary: CoverageBoundary, send: CdpSend): Promise<void> {
    const parsed = coverageTakeSchema.safeParse(await send('Profiler.takePreciseCoverage'))
    if (!parsed.success) return
    // Drop never-executed entries now — finalize touches only real work.
    const scripts = parsed.data.result.filter((script) =>
      script.functions.some((fn) => fn.ranges.some((range) => range.count > 0)),
    )
    this.deltas.push({ boundary, scripts })
  }

  /**
   * Resolves all stored deltas to original app lines and writes the artifact.
   * Must run while the harvest window is still alive (getScriptSource needs it).
   * @param send - CDP command sender of the harvest window
   * @param meta - recording id / duration / divergences observed during the run
   * @returns the written CoverageTimeline
   */
  async finalize(
    send: CdpSend,
    meta: {
      recordingId: string
      durationMs: number
      divergences: Array<{ oracle: string; message: string }>
      misses: string[]
    },
  ): Promise<CoverageTimeline> {
    await send('Profiler.stopPreciseCoverage').catch(() => {})

    // Line-start index per executed script (source text fetched once from V8).
    const lineStartsByScriptId = new Map<string, number[] | null>()
    const loadLineStarts = async (scriptId: string): Promise<number[] | null> => {
      const cached = lineStartsByScriptId.get(scriptId)
      if (cached !== undefined) return cached
      let starts: number[] | null
      try {
        const source = scriptSourceSchema.parse(
          await send('Debugger.getScriptSource', { scriptId }),
        )
        starts = buildLineStarts(source.scriptSource)
      } catch {
        starts = null
      }
      lineStartsByScriptId.set(scriptId, starts)
      return starts
    }

    // Flat app-source mappings per script url (vendor-only maps skipped whole).
    const mappingsByUrl = new Map<string, FlatMapping[] | null>()
    // Kept for sourcesContent extraction when the artifact is assembled.
    const traceMapByUrl = new Map<string, TraceMap>()
    const loadMappings = (url: string): FlatMapping[] | null => {
      const cached = mappingsByUrl.get(url)
      if (cached !== undefined) return cached
      let flat: FlatMapping[] | null = null
      const mapPath = this.mapPathByScriptUrl.get(url)
      if (mapPath) {
        try {
          const traceMap: TraceMap = new AnyMap(JSON.parse(readFileSync(mapPath, 'utf8')))
          // A map with zero app sources (react-dom, clerk…) can never contribute.
          if (traceMap.sources.some((source) => isAppSourcePath(source ?? ''))) {
            traceMapByUrl.set(url, traceMap)
            const collected: FlatMapping[] = []
            eachMapping(traceMap, (mapping) => {
              if (mapping.source === null || mapping.originalLine === null) return
              if (!isAppSourcePath(mapping.source)) return
              collected.push({
                // eachMapping generated lines are 1-based; normalize to 0-based.
                generatedLine: mapping.generatedLine - 1,
                generatedColumn: mapping.generatedColumn,
                source: mapping.source,
                originalLine: mapping.originalLine,
              })
            })
            collected.sort(
              (a, b) => a.generatedLine - b.generatedLine || a.generatedColumn - b.generatedColumn,
            )
            flat = collected
          }
        } catch {
          flat = null
        }
      }
      mappingsByUrl.set(url, flat)
      return flat
    }

    // Position-ordered comparison for binary searching the flat mapping list.
    const compare = (mapping: FlatMapping, line: number, column: number): number =>
      mapping.generatedLine - line || mapping.generatedColumn - column
    const lastIndexAtOrBefore = (mappings: FlatMapping[], line: number, column: number): number => {
      let low = -1
      let high = mappings.length - 1
      while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        if (compare(mappings[mid], line, column) <= 0) low = mid
        else high = mid - 1
      }
      return low
    }

    const buckets: CoverageBucket[] = []
    const allLinesBySource = new Map<string, Set<number>>()
    let scriptsSeen = 0
    let scriptsResolved = 0
    const seenScriptIds = new Set<string>()

    for (const delta of this.deltas) {
      const linesBySource = new Map<string, Set<number>>()
      for (const script of delta.scripts) {
        if (!seenScriptIds.has(script.scriptId)) {
          seenScriptIds.add(script.scriptId)
          scriptsSeen++
        }
        const url = script.url || this.scriptUrlById.get(script.scriptId) || ''
        // React's about:// fake scripts exist for SERVER-component stack
        // attribution; counting them would claim server code executed in the
        // browser (v1 scope is client JS only — decision 2).
        if (url.startsWith('about://')) continue
        const mappings = loadMappings(url)
        if (!mappings || mappings.length === 0) continue
        const lineStarts = await loadLineStarts(script.scriptId)
        if (!lineStarts) continue
        scriptsResolved++

        const segments = flattenExecutedSegments(script.functions.flatMap((fn) => fn.ranges))
        for (const [startOffset, endOffset] of segments) {
          if (endOffset <= startOffset) continue
          const start = offsetToLineCol(lineStarts, startOffset)
          // endOffset is exclusive — the last executed byte defines the end position.
          const end = offsetToLineCol(lineStarts, endOffset - 1)
          // The mapping ACTIVE at the segment start still covers it, so include
          // it (lastIndexAtOrBefore), then every mapping up to the segment end.
          let index = lastIndexAtOrBefore(mappings, start.line, start.column)
          if (index < 0) index = 0
          for (; index < mappings.length; index++) {
            const mapping = mappings[index]
            if (compare(mapping, end.line, end.column) > 0) break
            const lines = linesBySource.get(mapping.source) ?? new Set<number>()
            lines.add(mapping.originalLine)
            linesBySource.set(mapping.source, lines)
            const unionLines = allLinesBySource.get(mapping.source) ?? new Set<number>()
            unionLines.add(mapping.originalLine)
            allLinesBySource.set(mapping.source, unionLines)
          }
        }
      }

      buckets.push({
        tStart: delta.boundary.tStart,
        tEnd: delta.boundary.tEnd,
        kind: delta.boundary.kind,
        ...(delta.boundary.seq !== undefined && { seq: delta.boundary.seq }),
        ...(delta.boundary.approx && { approx: true }),
        files: [...linesBySource.entries()]
          .map(([source, lines]) => ({
            source,
            display: formatSourcePath(source),
            lines: [...lines].sort((a, b) => a - b),
          }))
          .sort((a, b) => a.display.localeCompare(b.display)),
      })
    }

    // Union rows with original text so the renderer panel is self-contained.
    const sources = [...allLinesBySource.entries()]
      .map(([source, lines]) => {
        let content: string | null = null
        for (const traceMap of traceMapByUrl.values()) {
          try {
            content = sourceContentFor(traceMap, source)
          } catch {
            content = null
          }
          if (content !== null) break
        }
        return {
          source,
          display: formatSourcePath(source),
          content,
          allLines: [...lines].sort((a, b) => a - b),
        }
      })
      .sort((a, b) => a.display.localeCompare(b.display))

    const timeline: CoverageTimeline = {
      schemaVersion: 1,
      recordingId: meta.recordingId,
      generatedAtWall: Date.now(),
      method: 'modeB-precise-coverage',
      durationMs: meta.durationMs,
      buckets,
      sources,
      divergences: meta.divergences,
      misses: meta.misses,
      stats: {
        scriptsSeen,
        scriptsResolved,
        appFileCount: allLinesBySource.size,
        appLineCount: [...allLinesBySource.values()].reduce((sum, lines) => sum + lines.size, 0),
      },
    }

    const coverageDir = join(this.recordingDirPath, 'coverage')
    mkdirSync(coverageDir, { recursive: true })
    writeFileSync(
      join(this.recordingDirPath, COVERAGE_TIMELINE_FILE),
      JSON.stringify(timeline),
    )
    return timeline
  }
}

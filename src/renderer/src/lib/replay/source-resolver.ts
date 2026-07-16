import {
  AnyMap,
  originalPositionFor,
  sourceContentFor,
  type TraceMap,
} from '@jridgewell/trace-mapping'
import { z } from 'zod'

import type { CodeFrame } from '@shared/code-anchors'

import { formatSourcePath } from '../format-source-path'
import { isAppSourcePath } from '../is-app-source-path'

/**
 * Maps recorded CDP frames (generated chunk + 0-based line/column) to original
 * TS/TSX positions using the sourcemaps harvested into the bundle at finalize.
 * One resolver per opened recording; the code panel calls it per stack change.
 */

/** sourcemaps/index.json rows written by the main-process harvest. */
export const sourcemapIndexSchema = z.object({
  maps: z.array(
    z.looseObject({
      scriptUrl: z.string(),
      file: z.string().optional(),
      bodyHash: z.string().optional(),
      error: z.string().optional(),
    }),
  ),
})
export type SourcemapIndexEntry = z.infer<typeof sourcemapIndexSchema>['maps'][number]

export interface ResolvedCodeLocation {
  /** Raw sourcemap source id — app-frame checks key off this. */
  sourcePath: string
  /** Short label for the panel tab, e.g. "app/guestbook/page.tsx". */
  displayPath: string
  /** 1-based original line to highlight. */
  line: number
  /** Original source text (null when the map has no sourcesContent). */
  content: string | null
}

export interface SourceResolver {
  resolveAppFrame: (frames: CodeFrame[]) => Promise<ResolvedCodeLocation | null>
}

/**
 * Builds the per-recording resolver over the entrance:// bulk read plane.
 * @param recordingId - bundle directory name
 * @param entries - parsed sourcemaps/index.json rows
 * @returns resolver whose resolveAppFrame returns the deepest app-code frame of
 *   a stack, or null when the stack is vendor-only (the panel then keeps its
 *   previous app location instead of jumping into node_modules internals)
 * @example (await resolver.resolveAppFrame(anchor.frames))?.displayPath // => 'app/page.tsx'
 */
export function createSourceResolver(
  recordingId: string,
  entries: SourcemapIndexEntry[],
): SourceResolver {
  // scriptUrl → bundled map location (harvested file or inline-blob hash).
  const mapUrlByScriptUrl = new Map<string, string>()
  for (const entry of entries) {
    if (entry.file) {
      mapUrlByScriptUrl.set(
        entry.scriptUrl,
        `entrance://recording/${recordingId}/sourcemaps/${entry.file}`,
      )
    } else if (entry.bodyHash) {
      mapUrlByScriptUrl.set(
        entry.scriptUrl,
        `entrance://recording/${recordingId}/blobs/${entry.bodyHash}`,
      )
    }
  }

  // Parsed-map cache: HMR chunks repeat across frames and playhead positions.
  const traceMapCache = new Map<string, Promise<TraceMap | null>>()
  const loadTraceMap = (scriptUrl: string): Promise<TraceMap | null> => {
    const cached = traceMapCache.get(scriptUrl)
    if (cached) return cached
    const mapUrl = mapUrlByScriptUrl.get(scriptUrl)
    const loading: Promise<TraceMap | null> = mapUrl
      ? fetch(mapUrl)
          .then(async (response) => (response.ok ? new AnyMap(await response.json()) : null))
          .catch(() => null)
      : Promise.resolve(null)
    traceMapCache.set(scriptUrl, loading)
    return loading
  }

  const resolveFrame = async (frame: CodeFrame): Promise<ResolvedCodeLocation | null> => {
    const traceMap = await loadTraceMap(frame.url)
    if (!traceMap) return null
    // CDP lines are 0-based; trace-mapping expects 1-based lines.
    const position = originalPositionFor(traceMap, {
      line: frame.lineNumber + 1,
      column: frame.columnNumber,
    })
    if (!position.source) return null
    return {
      sourcePath: position.source,
      displayPath: formatSourcePath(position.source),
      line: position.line ?? 1,
      content: sourceContentFor(traceMap, position.source),
    }
  }

  return {
    async resolveAppFrame(frames) {
      // Leaf-first: the first app match is the deepest app function executing.
      for (const frame of frames) {
        const location = await resolveFrame(frame)
        if (location && isAppSourcePath(location.sourcePath)) return location
      }
      return null
    },
  }
}

import { useEffect, useState } from 'react'

import type { CoverageTimeline } from '@shared/coverage-timeline'
import type { RedebugStatus } from '@shared/redebug'

import { loadCoverageTimeline } from './load-recording'

/**
 * Auto-runs a Mode B coverage harvest when a recording opens without coverage
 * (fixes "new recording shows an empty Sources panel"), then swaps the fresh
 * artifact in live. Mounted once per replay screen by ReplayLoaded; the
 * progress status renders as DebugSidePanel's banner.
 * @param recordingId - bundle directory name
 * @param initialCoverage - coverage from the initial bundle load (null pre-harvest)
 * @returns
 * - coverageTimeline: freshest artifact (initial, or the one just harvested)
 * - autoHarvest: live harvest status for the banner (null when idle or a manual session took over)
 * @example const { coverageTimeline, autoHarvest } = useAutoHarvest(id, recording.coverageTimeline)
 */
export function useAutoHarvest(
  recordingId: string,
  initialCoverage: CoverageTimeline | null,
): { coverageTimeline: CoverageTimeline | null; autoHarvest: RedebugStatus | null } {
  const [harvestedCoverage, setHarvestedCoverage] = useState<CoverageTimeline | null>(null)
  const [harvestStatus, setHarvestStatus] = useState<RedebugStatus | null>(null)

  // Once coverage exists (either source) there is nothing left to collect.
  const needsHarvest = initialCoverage === null && harvestedCoverage === null

  useEffect(() => {
    if (!needsHarvest) return
    // Subscribe BEFORE asking main to start — a fast harvest must not finish unheard.
    const unsubscribe = window.entrance.onRedebugStatus((status) => {
      if (status.mode !== 'harvest') {
        // A user-started Mode B session replaced the harvest — drop the stale banner.
        setHarvestStatus(null)
        return
      }
      setHarvestStatus(status)
      if (status.phase === 'finished') {
        void loadCoverageTimeline(recordingId).then((timeline) => {
          if (timeline) setHarvestedCoverage(timeline)
        })
      }
    })
    void window.entrance.redebugEnsureHarvest({ recordingId }).then((result) => {
      // Coverage appeared after the bundle load (e.g. a headless harvest) — self-heal.
      if (!result.started && result.reason === 'coverage-exists') {
        void loadCoverageTimeline(recordingId).then((timeline) => {
          if (timeline) setHarvestedCoverage(timeline)
        })
      }
    })
    return unsubscribe
  }, [needsHarvest, recordingId])

  return {
    coverageTimeline: harvestedCoverage ?? initialCoverage,
    autoHarvest: harvestStatus,
  }
}

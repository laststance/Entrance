import { describe, expect, it } from 'vitest'

import { buildProfileTimeline, cpuProfileFileSchema, profileStackAt } from './cpuprofile-timeline'

/** Synthetic profile: root → appFn → innerFn, plus an idle node. */
const profileFile = cpuProfileFileSchema.parse({
  profilerStartMono: 1500,
  profilerStopMono: 9999,
  profile: {
    startTime: 44_000_000,
    endTime: 44_060_000,
    nodes: [
      { id: 1, callFrame: { functionName: '(root)', url: '', lineNumber: -1, columnNumber: -1 }, children: [2, 4] },
      {
        id: 2,
        callFrame: { functionName: 'appFn', url: 'http://localhost:3000/chunks/page.js', lineNumber: 10, columnNumber: 2 },
        children: [3],
      },
      {
        id: 3,
        callFrame: { functionName: 'innerFn', url: 'http://localhost:3000/chunks/page.js', lineNumber: 20, columnNumber: 4 },
      },
      { id: 4, callFrame: { functionName: '(idle)', url: '', lineNumber: -1, columnNumber: -1 } },
    ],
    // Samples at +10ms, +30ms, +50ms after profiler start (deltas in µs).
    samples: [2, 3, 4],
    timeDeltas: [10_000, 20_000, 20_000],
  },
})

describe('cpuprofile timeline (decision 3 function-level highlight)', () => {
  it('maps V8 sample times onto the canonical clock via the calibration pair', () => {
    // Arrange — t0Mono 1000, profiler started at 1500 → samples at 510/530/550ms
    const timeline = buildProfileTimeline(profileFile, 1000)

    // Act + Assert
    expect(timeline.sampleOffsets).toEqual([510, 530, 550])
  })

  it('reports the executing stack leaf-first and strips V8 meta frames', () => {
    // Arrange
    const timeline = buildProfileTimeline(profileFile, 1000)

    // Act
    const stack = profileStackAt(timeline, 540)

    // Assert — sample 2 (node 3): innerFn on top, appFn below, (root) dropped
    expect(stack?.map((frame) => frame.functionName)).toEqual(['innerFn', 'appFn'])
  })

  it('returns null before the first sample and during idle samples', () => {
    // Arrange
    const timeline = buildProfileTimeline(profileFile, 1000)

    // Act + Assert
    expect(profileStackAt(timeline, 100)).toBeNull()
    expect(profileStackAt(timeline, 999)).toBeNull()
  })
})

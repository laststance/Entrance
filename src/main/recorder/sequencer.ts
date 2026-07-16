import type { Lane, LaneEvent } from '@shared/envelope'

/**
 * The single per-session sequencer (spec decision 13): stamps every lane event
 * with {seq, tMono, tWall} at main-process receipt. tMono is the sole canonical
 * clock — source-native timestamps stay inside payloads. Created by TargetSession;
 * outlives navigations/HMR so the axis never resets mid-session.
 */
export class Sequencer {
  private nextSeq = 0
  /** hrtime origin so tMono starts near 0 at session attach (readable in JSONL). */
  private readonly originNs = process.hrtime.bigint()

  /** Current canonical time in ms since session attach. */
  nowMono(): number {
    return Number(process.hrtime.bigint() - this.originNs) / 1e6
  }

  /**
   * Wrap a payload in the canonical envelope.
   * @param lane - which lane the event belongs to
   * @param payload - lane-specific body (source timestamps stay in here)
   * @example sequencer.stamp('console', { type: 'log', text: 'hi' })
   *          // => { seq: 41, tMono: 1523.4, tWall: 1784262000000, lane: 'console', payload: {…} }
   */
  stamp<TPayload>(lane: Lane, payload: TPayload): LaneEvent<TPayload> {
    return {
      seq: this.nextSeq++,
      tMono: this.nowMono(),
      tWall: Date.now(),
      lane,
      payload,
    }
  }
}

import { describe, expect, test } from 'vitest'

import { Sequencer } from './sequencer'

describe('Sequencer (canonical clock, spec decision 13)', () => {
  test('stamps strictly increasing seq across lanes so cross-lane order never ties', () => {
    // Arrange
    const sequencer = new Sequencer()

    // Act
    const first = sequencer.stamp('network', { phase: 'request' })
    const second = sequencer.stamp('console', { type: 'log' })
    const third = sequencer.stamp('network', { phase: 'response' })

    // Assert
    expect(first.seq).toBe(0)
    expect(second.seq).toBe(1)
    expect(third.seq).toBe(2)
  })

  test('stamps tMono as non-decreasing ms since session attach (replay sort axis)', () => {
    // Arrange
    const sequencer = new Sequencer()

    // Act
    const earlier = sequencer.stamp('page', { kind: 'load' })
    const later = sequencer.stamp('page', { kind: 'navigated' })

    // Assert
    expect(earlier.tMono).toBeGreaterThanOrEqual(0)
    expect(later.tMono).toBeGreaterThanOrEqual(earlier.tMono)
  })

  test('keeps the payload and lane untouched inside the envelope', () => {
    // Arrange
    const sequencer = new Sequencer()
    const payload = { type: 'error', args: ['boom'] }

    // Act
    const event = sequencer.stamp('console', payload)

    // Assert
    expect(event.lane).toBe('console')
    expect(event.payload).toBe(payload)
  })
})

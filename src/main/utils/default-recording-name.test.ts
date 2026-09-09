import { describe, expect, test } from 'vitest'

import { defaultRecordingName } from './default-recording-name'

describe('defaultRecordingName (1d save dialog pre-fill)', () => {
  test('pre-fills "録画 YYYY-MM-DD HH:mm" with zero-padded fields', () => {
    // Arrange
    const recPressedAt = new Date(2026, 6, 17, 9, 5)

    // Act
    const name = defaultRecordingName(recPressedAt)

    // Assert
    expect(name).toBe('録画 2026-07-17 09:05')
  })
})

import { describe, expect, test } from 'vitest'

import { decideEnsureHarvest } from './ensure-harvest-decision'

/**
 * Auto-harvest policy on opening a recording (P5b). A wrong verdict here either
 * leaves the Sources panel permanently empty (skip when we should start) or
 * kills a user's paused Mode B session mid-inspection (start when we should skip).
 */
describe('録画を開いたときの自動カバレッジ収集の開始判定', () => {
  test('カバレッジ未生成でモードB枠が空いていれば収集を開始する', () => {
    // Arrange
    const coverageExists = false

    // Act
    const decision = decideEnsureHarvest(coverageExists, 'none')

    // Assert
    expect(decision).toEqual({ action: 'start' })
  })

  test('カバレッジが既にバンドルにあれば再収集しない(画面を開き直すたびにモードBが走らない)', () => {
    // Arrange
    const coverageExists = true

    // Act
    const decision = decideEnsureHarvest(coverageExists, 'none')

    // Assert
    expect(decision).toEqual({ action: 'skip', reason: 'coverage-exists' })
  })

  test('ユーザーのモードBデバッグ実行中は絶対に奪わない(pause中のセッションが消えるバグの回帰)', () => {
    // Arrange
    const coverageExists = false

    // Act
    const decision = decideEnsureHarvest(coverageExists, 'debug')

    // Assert
    expect(decision).toEqual({ action: 'skip', reason: 'debug-session-active' })
  })

  test('同じ録画の収集が進行中なら二重起動しない', () => {
    // Arrange
    const coverageExists = false

    // Act
    const decision = decideEnsureHarvest(coverageExists, 'harvest-same-recording')

    // Assert
    expect(decision).toEqual({ action: 'skip', reason: 'already-harvesting' })
  })

  test('別の録画の収集が残っていても、いま開いた録画の収集で置き換える', () => {
    // Arrange
    const coverageExists = false

    // Act
    const decision = decideEnsureHarvest(coverageExists, 'harvest-other-recording')

    // Assert
    expect(decision).toEqual({ action: 'start' })
  })

  test('カバレッジ済みならデバッグ実行中でも理由は coverage-exists を優先する(バナー文言の安定)', () => {
    // Arrange
    const coverageExists = true

    // Act
    const decision = decideEnsureHarvest(coverageExists, 'debug')

    // Assert
    expect(decision).toEqual({ action: 'skip', reason: 'coverage-exists' })
  })
})

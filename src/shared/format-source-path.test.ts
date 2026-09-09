import { describe, expect, test } from 'vitest'

import { formatSourcePath } from './format-source-path'

describe('code panel tab label (source path shortening)', () => {
  test('shows the project-relative path from the anchor directory', () => {
    // Arrange + Act + Assert
    expect(formatSourcePath('file:///Users/w/laststance/next-play/app/guestbook/page.tsx')).toBe(
      'app/guestbook/page.tsx',
    )
    expect(formatSourcePath('file:///Users/w/proj/components/ui/button.tsx')).toBe(
      'components/ui/button.tsx',
    )
  })

  test('falls back to the last segments when no anchor directory exists', () => {
    // Arrange + Act + Assert
    expect(formatSourcePath('file:///Users/w/proj/scripts/build/task.ts')).toBe(
      'proj/scripts/build/task.ts'.split('/').slice(-3).join('/'),
    )
  })

  test('keeps the electron/ root instead of truncating to a nested anchor dir', () => {
    // Arrange + Act + Assert
    // Regression: `utils` is an anchor too, so the outer `electron` root must be
    // listed or the label collapses to `utils/electron-client.ts` (wrong file).
    expect(
      formatSourcePath('file:///Users/w/laststance/corelive/electron/utils/electron-client.ts'),
    ).toBe('electron/utils/electron-client.ts')
  })

  test('decodes percent-encoded names from Turbopack sources', () => {
    // Arrange + Act + Assert
    expect(formatSourcePath('file:///w/proj/app/favicon.ico.mjs%20%28image%29')).toBe(
      'app/favicon.ico.mjs (image)',
    )
  })
})

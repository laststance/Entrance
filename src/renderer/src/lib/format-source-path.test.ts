import { describe, expect, it } from 'vitest'

import { formatSourcePath } from './format-source-path'

describe('code panel tab label (source path shortening)', () => {
  it('shows the project-relative path from the anchor directory', () => {
    // Arrange + Act + Assert
    expect(formatSourcePath('file:///Users/w/laststance/next-play/app/guestbook/page.tsx')).toBe(
      'app/guestbook/page.tsx',
    )
    expect(formatSourcePath('file:///Users/w/proj/components/ui/button.tsx')).toBe(
      'components/ui/button.tsx',
    )
  })

  it('falls back to the last segments when no anchor directory exists', () => {
    // Arrange + Act + Assert
    expect(formatSourcePath('file:///Users/w/proj/scripts/build/task.ts')).toBe(
      'proj/scripts/build/task.ts'.split('/').slice(-3).join('/'),
    )
  })

  it('decodes percent-encoded names from Turbopack sources', () => {
    // Arrange + Act + Assert
    expect(formatSourcePath('file:///w/proj/app/favicon.ico.mjs%20%28image%29')).toBe(
      'app/favicon.ico.mjs (image)',
    )
  })
})

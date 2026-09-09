import { describe, expect, test } from 'vitest'

import { isAppSourcePath } from './is-app-source-path'

describe('app frame picking (code panel skips vendor frames)', () => {
  test('accepts project sources and rejects vendor/internal ones', () => {
    // Arrange + Act + Assert
    expect(isAppSourcePath('file:///w/next-play/app/guestbook/page.tsx')).toBe(true)
    expect(isAppSourcePath('file:///w/next-play/node_modules/next/src/client.ts')).toBe(false)
    expect(
      isAppSourcePath('file:///w/next-play/components/guestbook.tsx/__nextjs-internal-proxy.mjs'),
    ).toBe(false)
    expect(isAppSourcePath('')).toBe(false)
  })

  test('rejects Next.js pre-bundled and Turbopack virtual sources (no node_modules marker)', () => {
    // Arrange + Act + Assert — real shapes seen in Turbopack dev bundles
    expect(isAppSourcePath('webpack://next/./dist/compiled/scheduler/cjs/scheduler.production.js')).toBe(false)
    expect(isAppSourcePath('turbopack:///[next]/internal/font/google/geist_a71539c9.js')).toBe(false)
    expect(isAppSourcePath('turbopack:///[turbopack]/browser/dev/hmr-client/hmr-client.ts')).toBe(false)
    // Webpack-mode user app code stays accepted.
    expect(isAppSourcePath('webpack://_N_E/./app/dashboard/page.tsx')).toBe(true)
  })
})

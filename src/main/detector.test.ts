import { describe, expect, it } from 'vitest'

import { fingerprint } from './detector'

/** Spec decision 11: framework fingerprints distinguish Next.js (webpack/Turbopack), Vite, Storybook. */
describe('dev-server fingerprint (screen 1f labels)', () => {
  it('labels a Next.js webpack dev server "Next.js — dev" from X-Powered-By and _next assets', () => {
    // Arrange
    const probe = {
      status: 200,
      headers: { 'x-powered-by': 'Next.js' },
      body: '<html><body><div id="__next"></div><script src="/_next/static/chunks/main.js"></script></body></html>',
    }
    // Act
    const result = fingerprint(probe)
    // Assert
    expect(result).toEqual({ framework: 'nextjs', variant: 'webpack', label: 'Next.js — dev' })
  })

  it('labels a Turbopack dev server "Next.js (Turbopack) — dev" when chunks carry turbopack markers', () => {
    // Arrange
    const probe = {
      status: 200,
      headers: { 'x-powered-by': 'Next.js' },
      body: '<script src="/_next/static/chunks/%5Bturbopack%5D_runtime.js"></script>',
    }
    // Act
    const result = fingerprint(probe)
    // Assert
    expect(result).toEqual({
      framework: 'nextjs',
      variant: 'turbopack',
      label: 'Next.js (Turbopack) — dev',
    })
  })

  it('labels a Vite dev server "Vite — dev" from the injected /@vite/client script', () => {
    // Arrange
    const probe = {
      status: 200,
      headers: {},
      body: '<html><head><script type="module" src="/@vite/client"></script></head></html>',
    }
    // Act
    const result = fingerprint(probe)
    // Assert
    expect(result).toEqual({ framework: 'vite', label: 'Vite — dev' })
  })

  it('labels a Storybook manager "Storybook"', () => {
    // Arrange
    const probe = {
      status: 200,
      headers: {},
      body: '<html><body><div id="storybook-root"></div></body></html>',
    }
    // Act
    const result = fingerprint(probe)
    // Assert
    expect(result).toEqual({ framework: 'storybook', label: 'Storybook' })
  })

  it('falls back to "HTTPサーバー" for a live but unrecognized server (any HTTP status = alive)', () => {
    // Arrange
    const probe = { status: 404, headers: {}, body: '<html>not found</html>' }
    // Act
    const result = fingerprint(probe)
    // Assert
    expect(result).toEqual({ framework: 'unknown', label: 'HTTPサーバー' })
  })
})

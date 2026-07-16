import { record } from '@rrweb/record'

import { cssPath } from './css-path'

/**
 * Entrance page agent (spec decisions 23/27/29/32a): runs inside the recorded
 * page. Input listeners stream always (main drops them while idle); the rrweb
 * recorder starts/stops on main's command so its FullSnapshot lands at Rec t0
 * — agent lanes are recording-only. Injected by TargetSession on every new
 * document via the __entranceEmit CDP binding.
 */

declare global {
  interface Window {
    __entranceEmit?: (json: string) => void
    __entranceAgentInstalled?: boolean
    __entranceRecStart?: () => void
    __entranceRecStop?: () => void
  }
}

/** Scroll positions matter for replay feel, but not at wheel-event frequency. */
const SCROLL_THROTTLE_MS = 100

;(() => {
  // addScriptToEvaluateOnNewDocument + the attach-time Runtime.evaluate can both
  // run on the same document — install exactly once.
  if (window.__entranceAgentInstalled) return
  window.__entranceAgentInstalled = true

  function emit(lane: 'rrweb' | 'input' | 'agent', payload: unknown): void {
    try {
      window.__entranceEmit?.(JSON.stringify({ lane, payload }))
    } catch {
      /* binding gone (session detached) or unserializable payload — drop */
    }
  }

  // DOM lane (decision 32a: inputs masked at capture). Started by main at Rec
  // so the FullSnapshot lands at t0; restarted on each new document while recording.
  let stopRrweb: (() => void) | undefined
  let isStartRequested = false

  window.__entranceRecStart = () => {
    if (isStartRequested) return
    isStartRequested = true
    const begin = (): void => {
      if (!isStartRequested || stopRrweb) return
      stopRrweb = record({
        emit: (event) => emit('rrweb', event),
        maskAllInputs: true,
      })
    }
    // Snapshotting a still-loading document wastes events — wait for the DOM.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', begin, { once: true })
    } else {
      begin()
    }
  }

  window.__entranceRecStop = () => {
    isStartRequested = false
    stopRrweb?.()
    stopRrweb = undefined
  }

  // Input lane (decision 29): trusted-input evidence for Mode B re-dispatch.
  window.addEventListener(
    'click',
    (ev) => {
      emit('input', {
        kind: 'click',
        x: ev.clientX,
        y: ev.clientY,
        button: ev.button,
        selector: cssPath(ev.target instanceof Element ? ev.target : null),
      })
    },
    { capture: true },
  )

  window.addEventListener(
    'keydown',
    (ev) => {
      const modifiers = { ctrl: ev.ctrlKey, meta: ev.metaKey, alt: ev.altKey, shift: ev.shiftKey }
      // Single-character keys are potential secrets: the readable lane gets a masked
      // shell; main moves the real key into the enclave (decision 32d).
      if (ev.key.length === 1) {
        emit('input', {
          kind: 'key',
          code: ev.code,
          keyClass: 'character',
          masked: true,
          modifiers,
          secret: { key: ev.key },
        })
      } else {
        emit('input', { kind: 'key', code: ev.code, keyClass: 'control', key: ev.key, modifiers })
      }
    },
    { capture: true },
  )

  let lastScrollEmitAt = 0
  window.addEventListener(
    'scroll',
    () => {
      const now = Date.now()
      if (now - lastScrollEmitAt < SCROLL_THROTTLE_MS) return
      lastScrollEmitAt = now
      emit('input', { kind: 'scroll', x: window.scrollX, y: window.scrollY })
    },
    { capture: true, passive: true },
  )

  // Tell main this document's agent is live — if a recording is running (e.g.
  // mid-recording navigation), main immediately re-arms rrweb here.
  emit('agent', { kind: 'ready' })
})()

import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'

import type { WebviewTag } from 'electron'

/** Imperative surface BrowserShell uses for toolbar navigation. */
export interface EmbeddedTargetHandle {
  goBack: () => void
  goForward: () => void
  reload: () => void
}

interface EmbeddedTargetProps {
  url: string
  className?: string
  ref?: Ref<EmbeddedTargetHandle>
  /** Fires once per underlying webContents with its id, so main can attach CDP. */
  onAttachReady?: (webContentsId: number) => void
  /** Fires on every top-level / in-page navigation with the new URL. */
  onNavigated?: (url: string) => void
}

/**
 * Abstraction over the embedding technology (spec decision 5): today an Electron
 * <webview>, swappable for WebContentsView without touching callers. Rendered by
 * BrowserShell; reports its webContentsId so main attaches its CDP debugger.
 */
export function EmbeddedTarget({
  url,
  className,
  ref,
  onAttachReady,
  onNavigated,
}: EmbeddedTargetProps) {
  const webviewRef = useRef<WebviewTag | null>(null)
  const lastReportedWebContentsIdRef = useRef<number | null>(null)
  // Latest-callback refs: subscribe to webview events once, never re-attach listeners.
  const callbacksRef = useRef({ onAttachReady, onNavigated })
  useEffect(() => {
    callbacksRef.current = { onAttachReady, onNavigated }
  })

  // Per-target isolated persistent session (spec decision 21). Fixed for the
  // element's lifetime — BrowserShell keys this component by host.
  const partition = useMemo(() => `persist:target-${new URL(url).host}`, [url])

  useImperativeHandle(ref, () => ({
    goBack: () => webviewRef.current?.goBack(),
    goForward: () => webviewRef.current?.goForward(),
    reload: () => webviewRef.current?.reload(),
  }))

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleDomReady = (): void => {
      const webContentsId = webview.getWebContentsId()
      // dom-ready fires on every navigation; only report a NEW webContents.
      if (lastReportedWebContentsIdRef.current === webContentsId) return
      lastReportedWebContentsIdRef.current = webContentsId
      callbacksRef.current.onAttachReady?.(webContentsId)
    }
    const handleNavigation = (event: Event): void => {
      const navigatedUrl = (event as Event & { url?: string }).url
      if (navigatedUrl) callbacksRef.current.onNavigated?.(navigatedUrl)
    }

    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('did-navigate', handleNavigation)
    webview.addEventListener('did-navigate-in-page', handleNavigation)
    return () => {
      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('did-navigate', handleNavigation)
      webview.removeEventListener('did-navigate-in-page', handleNavigation)
    }
  }, [])

  return (
    <webview
      ref={webviewRef}
      src={url}
      partition={partition}
      className={className}
      // Recorded content is hostile (spec decision 21): fully sandboxed, no popups.
      webpreferences="contextIsolation=yes,sandbox=yes,nodeIntegration=no"
    />
  )
}

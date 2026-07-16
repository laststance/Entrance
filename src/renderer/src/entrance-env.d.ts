import type { EntranceApi } from '@shared/ipc'
import type { WebviewTag } from 'electron'

/** Renderer-side globals: the preload bridge and the <webview> JSX intrinsic. */
declare global {
  interface Window {
    entrance: EntranceApi
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      /** Electron <webview> — typed so EmbeddedTarget can render it from TSX. */
      webview: React.DetailedHTMLProps<React.HTMLAttributes<WebviewTag>, WebviewTag> & {
        src?: string
        partition?: string
        allowpopups?: string
        webpreferences?: string
      }
    }
  }
}

export {}

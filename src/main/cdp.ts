import { webContents, type WebContents } from 'electron'

import { PUSH, type CdpEventSummary } from '@shared/ipc'

/**
 * P0 CDP smoke pipeline (spec decision 8: Entrance is the SOLE CDP client).
 * Why: proves webContents.debugger attach + event streaming on the embedded
 * target before the P1 recorder is built on the same session; called by the
 * target:attach IPC handler. Grows into the recorder's lane sources in P1.
 */

interface AttachedTarget {
  contents: WebContents
  detach: () => void
}

let current: AttachedTarget | null = null

/** Turn a raw CDP event into the one-line summary the renderer log shows. */
function summarize(method: string, params: Record<string, unknown>): CdpEventSummary | null {
  const ts = Date.now()
  if (method === 'Network.requestWillBeSent') {
    const req = params.request as { method?: string; url?: string } | undefined
    return { ts, domain: 'Network', method, kind: 'network', summary: `→ ${req?.method ?? ''} ${req?.url ?? ''}` }
  }
  if (method === 'Network.responseReceived') {
    const res = params.response as { status?: number; url?: string } | undefined
    return { ts, domain: 'Network', method, kind: 'network', summary: `← ${res?.status ?? ''} ${res?.url ?? ''}` }
  }
  if (method === 'Runtime.consoleAPICalled') {
    const type = String(params.type ?? 'log')
    const args = (params.args as Array<{ value?: unknown; description?: string }> | undefined) ?? []
    const text = args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)
    return { ts, domain: 'Runtime', method, kind: type === 'error' ? 'error' : 'console', summary: `console.${type}: ${text}` }
  }
  if (method === 'Runtime.exceptionThrown') {
    const details = params.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined
    const text = details?.exception?.description ?? details?.text ?? 'exception'
    return { ts, domain: 'Runtime', method, kind: 'error', summary: text.split('\n')[0]?.slice(0, 200) ?? 'exception' }
  }
  if (method === 'Page.frameNavigated') {
    const frame = params.frame as { url?: string; parentId?: string } | undefined
    if (frame?.parentId) return null // only top-frame navigations are interesting in the log
    return { ts, domain: 'Page', method, kind: 'page', summary: `navigated: ${frame?.url ?? ''}` }
  }
  return null
}

/**
 * Attach Entrance's debugger to the embedded target and stream summarized events
 * to the app window (P0 acceptance: CDP attach smoke test).
 * @param targetId - webContents id reported by the <webview> after dom-ready
 * @param appWindow - the single app window that receives cdp:event pushes
 */
export async function attachCdp(targetId: number, appWindow: WebContents): Promise<{ ok: boolean; error?: string }> {
  const target = webContents.fromId(targetId)
  if (!target || target.isDestroyed()) return { ok: false, error: 'target webContents not found' }

  // Re-attach after in-app navigation to a different target: drop the old session first.
  detachCdp()

  try {
    target.debugger.attach('1.3')
  } catch (err) {
    return { ok: false, error: `debugger attach failed: ${String(err)}` }
  }

  const onMessage = (_ev: unknown, method: string, params: Record<string, unknown>): void => {
    const summary = summarize(method, params)
    if (summary && !appWindow.isDestroyed()) appWindow.send(PUSH.cdpEvent, summary)
  }
  const onDetach = (): void => {
    current = null
    if (!appWindow.isDestroyed()) appWindow.send(PUSH.targetGone)
  }

  target.debugger.on('message', onMessage)
  target.debugger.once('detach', onDetach)
  target.once('destroyed', onDetach)

  // Concurrent domain enables on one session — this exact combination is the spike-#1 smoke.
  await target.debugger.sendCommand('Network.enable')
  await target.debugger.sendCommand('Runtime.enable')
  await target.debugger.sendCommand('Page.enable')

  current = {
    contents: target,
    detach: () => {
      target.debugger.removeListener('message', onMessage)
      try {
        if (target.debugger.isAttached()) target.debugger.detach()
      } catch {
        /* target already gone */
      }
    },
  }
  return { ok: true }
}

/** Drop the current CDP session (target switch or window close). */
export function detachCdp(): void {
  current?.detach()
  current = null
}

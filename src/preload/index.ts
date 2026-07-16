import { contextBridge, ipcRenderer } from 'electron'

import {
  IPC,
  PUSH,
  type EntranceApi,
  type ConnectRequest,
  type AttachRequest,
  type CdpEventSummary,
} from '@shared/ipc'

/**
 * Context-bridged control-plane API (spec decision 12). Only these typed calls
 * cross the boundary; the renderer never touches ipcRenderer directly.
 */
const api: EntranceApi = {
  detectServers: () => ipcRenderer.invoke(IPC.detectServers),
  connectTarget: (req: ConnectRequest) => ipcRenderer.invoke(IPC.connectTarget, req),
  attachTarget: (req: AttachRequest) => ipcRenderer.invoke(IPC.attachTarget, req),
  detachTarget: () => ipcRenderer.invoke(IPC.detachTarget),
  onCdpEvent: (cb: (ev: CdpEventSummary) => void) => {
    const listener = (_ev: unknown, payload: CdpEventSummary): void => cb(payload)
    ipcRenderer.on(PUSH.cdpEvent, listener)
    return () => ipcRenderer.removeListener(PUSH.cdpEvent, listener)
  },
  onTargetGone: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(PUSH.targetGone, listener)
    return () => ipcRenderer.removeListener(PUSH.targetGone, listener)
  },
}

contextBridge.exposeInMainWorld('entrance', api)

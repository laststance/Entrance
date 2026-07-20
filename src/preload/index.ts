import { contextBridge, ipcRenderer } from 'electron'

import {
  IPC,
  PUSH,
  type AttachRequest,
  type CdpEventSummary,
  type ConnectRequest,
  type CreateGroup,
  type EntranceApi,
  type RecordingIdRequest,
  type RecStatus,
  type SearchRecordings,
  type UpdateRecordingMeta,
} from '@shared/ipc'
import type {
  EnsureHarvestRequest,
  RedebugStatus,
  RedebugStepRequest,
  StartRedebugRequest,
} from '@shared/redebug'

/**
 * Context-bridged control-plane API (spec decision 12). Only these typed calls
 * cross the boundary; the renderer never touches ipcRenderer directly.
 */

/** Subscribe to a main→renderer push channel; returns the unsubscribe. */
function onPush<TPayload>(channel: string, cb: (payload: TPayload) => void): () => void {
  const listener = (_ev: unknown, payload: TPayload): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: EntranceApi = {
  detectServers: () => ipcRenderer.invoke(IPC.detectServers),
  connectTarget: (req: ConnectRequest) => ipcRenderer.invoke(IPC.connectTarget, req),
  attachTarget: (req: AttachRequest) => ipcRenderer.invoke(IPC.attachTarget, req),
  detachTarget: () => ipcRenderer.invoke(IPC.detachTarget),
  recStart: () => ipcRenderer.invoke(IPC.recStart),
  recStop: () => ipcRenderer.invoke(IPC.recStop),
  updateRecordingMeta: (req: UpdateRecordingMeta) =>
    ipcRenderer.invoke(IPC.updateRecordingMeta, req),
  listRecordings: () => ipcRenderer.invoke(IPC.listRecordings),
  deleteRecording: (req: RecordingIdRequest) => ipcRenderer.invoke(IPC.deleteRecording, req),
  searchRecordings: (req: SearchRecordings) => ipcRenderer.invoke(IPC.searchRecordings, req),
  listGroups: () => ipcRenderer.invoke(IPC.listGroups),
  createGroup: (req: CreateGroup) => ipcRenderer.invoke(IPC.createGroup, req),
  storageUsage: () => ipcRenderer.invoke(IPC.storageUsage),
  redebugStart: (req: StartRedebugRequest) => ipcRenderer.invoke(IPC.redebugStart, req),
  redebugStep: (req: RedebugStepRequest) => ipcRenderer.invoke(IPC.redebugStep, req),
  redebugStop: () => ipcRenderer.invoke(IPC.redebugStop),
  redebugEnsureHarvest: (req: EnsureHarvestRequest) =>
    ipcRenderer.invoke(IPC.redebugEnsureHarvest, req),
  onCdpEvent: (cb) => onPush<CdpEventSummary>(PUSH.cdpEvent, cb),
  onTargetGone: (cb) => onPush<undefined>(PUSH.targetGone, () => cb()),
  onRecStatus: (cb) => onPush<RecStatus>(PUSH.recStatus, cb),
  onRecAutoStopped: (cb) =>
    onPush<{ reason: string; recordingId: string }>(PUSH.recAutoStopped, cb),
  onRedebugStatus: (cb) => onPush<RedebugStatus>(PUSH.redebugStatus, cb),
}

contextBridge.exposeInMainWorld('entrance', api)

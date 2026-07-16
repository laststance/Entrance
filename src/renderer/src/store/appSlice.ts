import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { BundlerVariant, DetectedServer, Framework } from '@shared/ipc'

/**
 * App-level state of the single window: which screen is visible and which
 * target is connected (spec decision 7 — state of record lives in main; this
 * slice mirrors only what the UI needs).
 */

export interface ConnectedTarget {
  url: string
  /** 1f row label when the target came from detection, e.g. "Next.js — dev" */
  label?: string
  framework?: Framework
  variant?: BundlerVariant
  /** True once main confirmed its CDP debugger is attached to the webview. */
  isCdpAttached: boolean
  /** True when the target webContents died or detached unexpectedly. */
  isGone: boolean
}

export interface AppState {
  screen: 'empty' | 'shell' | 'library' | 'replay'
  servers: DetectedServer[]
  isDetecting: boolean
  connectError: string | null
  target: ConnectedTarget | null
  /** Recording open on the replay screen (1a/1b); null everywhere else. */
  replayRecordingId: string | null
}

const initialState: AppState = {
  screen: 'empty',
  servers: [],
  isDetecting: false,
  connectError: null,
  target: null,
  replayRecordingId: null,
}

/** Probe localhost for dev servers (fills the 1f list). */
export const detectServersThunk = createAsyncThunk('app/detectServers', async () => {
  return window.entrance.detectServers()
})

/** Validate + open a target URL in the embedded browser (1f → shell transition). */
export const connectTargetThunk = createAsyncThunk(
  'app/connectTarget',
  async (args: { url: string; server?: DetectedServer }, { rejectWithValue }) => {
    const result = await window.entrance.connectTarget({ url: args.url })
    if (!result.ok) return rejectWithValue(result.error ?? '接続に失敗しました')
    return { url: result.url, server: args.server }
  },
)

/** Tear down the CDP session and go back to the empty screen. */
export const disconnectTargetThunk = createAsyncThunk('app/disconnectTarget', async () => {
  await window.entrance.detachTarget()
})

/** Pick the launch screen: the library is home once any recording exists (mock 1e), 1f otherwise. */
export const bootstrapScreenThunk = createAsyncThunk('app/bootstrapScreen', async () => {
  const recordings = await window.entrance.listRecordings()
  return { hasRecordings: recordings.length > 0 }
})

/** Leave the recorder for the library — detaches the CDP session with the webview. */
export const goToLibraryThunk = createAsyncThunk('app/goToLibrary', async () => {
  await window.entrance.detachTarget()
})

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    cdpAttached(state, action: PayloadAction<{ ok: boolean }>) {
      if (state.target) state.target.isCdpAttached = action.payload.ok
    },
    targetGone(state) {
      if (state.target) {
        state.target.isGone = true
        state.target.isCdpAttached = false
      }
    },
    /** 1e card play → replay screen (1a/1b). */
    replayOpened(state, action: PayloadAction<{ recordingId: string }>) {
      state.screen = 'replay'
      state.replayRecordingId = action.payload.recordingId
    },
    /** Replay back button → library. */
    replayClosed(state) {
      state.screen = 'library'
      state.replayRecordingId = null
    },
    /** 1e 新規録画 → 1f server picker. */
    newRecordingRequested(state) {
      state.screen = 'empty'
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(detectServersThunk.pending, (state) => {
        state.isDetecting = true
      })
      .addCase(detectServersThunk.fulfilled, (state, action) => {
        state.isDetecting = false
        state.servers = action.payload
      })
      .addCase(detectServersThunk.rejected, (state) => {
        state.isDetecting = false
      })
      .addCase(connectTargetThunk.fulfilled, (state, action) => {
        state.connectError = null
        state.screen = 'shell'
        state.target = {
          url: action.payload.url,
          label: action.payload.server?.label,
          framework: action.payload.server?.framework,
          variant: action.payload.server?.variant,
          isCdpAttached: false,
          isGone: false,
        }
      })
      .addCase(connectTargetThunk.rejected, (state, action) => {
        state.connectError =
          typeof action.payload === 'string' ? action.payload : '接続に失敗しました'
      })
      .addCase(disconnectTargetThunk.fulfilled, (state) => {
        state.screen = 'empty'
        state.target = null
      })
      .addCase(bootstrapScreenThunk.fulfilled, (state, action) => {
        // Only steer the launch screen — never yank the user out of a live session.
        if (state.screen === 'empty' && action.payload.hasRecordings) state.screen = 'library'
      })
      .addCase(goToLibraryThunk.fulfilled, (state) => {
        state.screen = 'library'
        state.target = null
      })
  },
})

export const { cdpAttached, targetGone, replayOpened, replayClosed, newRecordingRequested } =
  appSlice.actions
export const appReducer = appSlice.reducer

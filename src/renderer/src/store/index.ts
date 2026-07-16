import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux'

import { appReducer } from './appSlice'

/** Single RTK store for app state; high-frequency streams (CDP log, later the playhead) stay out of Redux by design. */
export const store = configureStore({
  reducer: {
    app: appReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

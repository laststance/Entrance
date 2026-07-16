import { ArrowLeft } from 'lucide-react'

import { replayClosed } from '../store/appSlice'
import { useAppDispatch, useAppSelector } from '../store'

/**
 * Screens 1a/1b — replay + debugger. P2 slice A ships the shell (route +
 * back navigation); the rrweb player, timeline, and code panel land in the
 * following slices. Rendered by App when screen === 'replay'.
 */
export function ReplayScreen() {
  const dispatch = useAppDispatch()
  const recordingId = useAppSelector((state) => state.app.replayRecordingId)

  return (
    <div className="flex h-full flex-col">
      <div className="app-drag flex h-12 shrink-0 items-center gap-3 border-b border-border pr-4 pl-[84px]">
        <button
          type="button"
          onClick={() => dispatch(replayClosed())}
          className="app-no-drag flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          ライブラリ
        </button>
      </div>
      <div className="grid flex-1 place-items-center">
        <p className="font-mono text-[12px] text-muted-foreground">
          リプレイを準備中… ({recordingId ?? 'unknown'})
        </p>
      </div>
    </div>
  )
}

export default ReplayScreen

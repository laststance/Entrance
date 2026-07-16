import { useEffect, useState } from 'react'

import { ChevronRight } from 'lucide-react'

import type { DetectedServer } from '@shared/ipc'

import { SERVER_POLL_INTERVAL_MS } from '../constants'
import { connectTargetThunk, detectServersThunk } from '../store/appSlice'
import { useAppDispatch, useAppSelector } from '../store'

/**
 * Screen 1f — first launch / empty state: dev-server auto-detection list and
 * the 3-step onboarding line, per design mock. Rendered by App while no
 * target is connected.
 */
export function EmptyState() {
  const dispatch = useAppDispatch()
  const servers = useAppSelector((state) => state.app.servers)
  const isDetecting = useAppSelector((state) => state.app.isDetecting)
  const connectError = useAppSelector((state) => state.app.connectError)
  const [urlInput, setUrlInput] = useState('http://localhost:3000')

  // Keep the 1f list fresh while visible: probe now, then on an interval.
  useEffect(() => {
    void dispatch(detectServersThunk())
    const pollTimer = setInterval(() => void dispatch(detectServersThunk()), SERVER_POLL_INTERVAL_MS)
    return () => clearInterval(pollTimer)
  }, [dispatch])

  const connectToUrl = (url: string, server?: DetectedServer): void => {
    void dispatch(connectTargetThunk({ url, server }))
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar strip: draggable, traffic lights sit in the inset (hiddenInset chrome) */}
      <div className="app-drag flex h-12 shrink-0 items-center gap-3 border-b border-border pr-4 pl-[84px]">
        <div className="flex h-8 w-full max-w-[560px] items-center rounded-lg border border-border bg-sunken px-3">
          <span className="font-mono text-[11.5px] text-muted-foreground">http://localhost: …</span>
        </div>
      </div>

      {/* Centered hero, radial glow per mock */}
      <div className="grid flex-1 place-items-center overflow-y-auto bg-[radial-gradient(ellipse_50%_45%_at_50%_42%,rgba(77,163,255,0.07),transparent)]">
        <div className="flex w-[560px] flex-col items-center gap-6 py-10">
          {/* App mark: blue rounded-square outline with the Rec dot */}
          <div className="relative h-14 w-14 rounded-[16px] border-[2.5px] border-primary">
            <span className="absolute top-[13px] right-[13px] h-2 w-2 rounded-full bg-rec" />
          </div>

          <div className="flex flex-col items-center gap-3">
            <h1 className="text-[28px] font-bold tracking-tight">Entrance</h1>
            <p className="text-center text-[13px] leading-6 text-muted-foreground">
              ローカルのdevサーバーを開いて操作を記録。
              <br />
              時間を巻き戻しながら、そのとき実行されていたコードをデバッグ。
            </p>
          </div>

          {/* URL connect row */}
          <form
            className="flex w-full gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              connectToUrl(urlInput.trim())
            }}
          >
            <input
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              spellCheck={false}
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-sunken px-4 font-mono text-[13px] text-foreground outline-none select-text placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/60"
              placeholder="http://localhost:3000"
              aria-label="devサーバーURL"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-lg bg-primary px-[18px] text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              接続して開く
            </button>
          </form>
          {connectError && <p className="w-full text-[12px] text-rec">{connectError}</p>}

          {/* Detected dev servers */}
          <div className="w-full overflow-hidden rounded-[10px] border border-border bg-sunken">
            <div className="border-b border-border px-4 py-3 text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
              検出されたDEVサーバー
            </div>
            {servers.length === 0 ? (
              <div className="px-4 py-5 text-[12px] text-muted-foreground">
                {isDetecting
                  ? '検出中…'
                  : 'devサーバーが見つかりません。起動してから戻るか、URLを入力して接続してください。'}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {servers.map((server) => (
                  <li key={server.url}>
                    <button
                      type="button"
                      onClick={() => connectToUrl(server.url, server)}
                      className="flex h-[46px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${server.framework === 'unknown' ? 'bg-muted-foreground' : 'bg-live'}`}
                      />
                      <span className="flex-1 text-[12.5px] font-medium">{server.label}</span>
                      <span className="font-mono text-[11.5px] text-muted-foreground">
                        {server.url}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 3-step onboarding line */}
          <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
            <StepChip number={1} />
            <span>接続</span>
            <span className="text-muted-foreground/50">→</span>
            <StepChip number={2} />
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rec" />
              <span className="font-mono">Rec</span> で記録
            </span>
            <span className="text-muted-foreground/50">→</span>
            <StepChip number={3} />
            <span>巻き戻してデバッグ</span>
          </div>

          <p className="text-[10.5px] text-muted-foreground/80">
            録画には操作・DOM・ネットワーク・コンソールが含まれます。データはローカルにのみ保存。
          </p>
        </div>
      </div>
    </div>
  )
}

/** Small numbered chip for the 3-step line. */
function StepChip({ number }: { number: number }) {
  return (
    <span className="grid h-4 w-4 place-items-center rounded bg-secondary text-[10px] font-semibold text-secondary-foreground">
      {number}
    </span>
  )
}

export default EmptyState

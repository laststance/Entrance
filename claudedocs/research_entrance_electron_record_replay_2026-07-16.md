# Entrance — Technology Research Report

> Deep research for building "Entrance": an Electron dev-tool whose main window is a browser that opens a local dev server, records sessions (Rec button), replays them like a video with a seek bar, and provides a source-map-powered debugger panel (executing-code highlight, variable inspection, stepping) synced to the playhead. Recordings are named, grouped, and saved locally.
>
> - **Date**: 2026-07-16
> - **Depth**: exhaustive (4 parallel deep-research agents)
> - **Design reference**: `/Users/ryotamurakami/Downloads/Entrance (standalone).html` (6 screens, analyzed below)
> - **Status**: COMPLETE — all 4 agent reports integrated; overall synthesis & roadmap in §5.

**Executive summary (TL;DR)**

1. **Feasible, with one hard problem.** Every feature in the brief is buildable with today's stack except one — live pause / variable inspection / stepping *inside a replay* — which no passive recording can provide (rrweb replay executes no page JS). The answer is a **two-mode hybrid**: rrweb-based passive replay for the video/seek experience (**Mode A**, always correct), plus **on-demand deterministic re-execution** of the recorded session in a hidden webContents with a **real CDP debugger attached** (**Mode B**) for pause/scopes/stepping.
2. **Recording** = `@rrweb/record` 2.1.0 (DOM + interactions) + CDP `Network`/`Runtime`/`Log` (response bodies, console, errors with source-mapped stacks) + CDP `Page.startScreencast` (filmstrip) — all multiplexed over one `webContents.debugger` session per target.
3. **Code highlight synced to the playhead** is two-tier: a cheap always-on **function-level** time→code index from CPU-profiler sampling plus exact anchors (console/error/network initiator stacks); exact line/statement fidelity at anchors or during Mode B pauses.
4. **Source maps**: harvest via `Debugger.scriptParsed`, parse with `@jridgewell/trace-mapping`; Next.js dev serves usable maps under both webpack (`eval-source-map`) and Turbopack (real `.map` files, `sourcesContent` embedded).
5. **Shell & stack**: Electron 43 · `<webview>` embed (Radix-portal clipping makes WebContentsView painful; reversible decision) · electron-vite + electron-builder · better-sqlite3 12 + Drizzle + FTS5 (blobs as external zstd files) · CodeMirror 6 · hand-rolled Canvas-2D timeline · Zod-validated IPC.
6. **Main risk** = re-execution determinism (timers, `Date`/random, server state). Mitigate with full network replay via `Fetch.fulfillRequest`, Date/random/timer shims, and an honest "divergence detected" UX. Replay.io's custom-browser approach proves perfect fidelity requires engine-level recording — out of scope; the hybrid is the pragmatic middle.

---

## 0. Design Mock Analysis (from the standalone HTML)

The mock is titled **"Entrance — 初回探索: メイン3レイアウト + 録画中 / ライブラリ / 空状態"**. Premise noted on the mock: macOS · Electron (`hiddenInset`, traffic lights in toolbar) / target is a Next.js SaaS dashboard "Pulseboard" on `localhost:3000` / all replay screens show the same scenario ("investigating an exception originating from a `#export-btn` click at 00:12.48 of a 00:41.20 recording"). Tweaks toggle for dark⇄light + accent color.

| Screen | Layout | Key elements |
|---|---|---|
| **1a** Replay+Debugger — Classic | Bottom multi-lane timeline + right inspector | Browser chrome (back/forward, URL `localhost:3000/dashboard`, "Next.js · dev" badge, "再生中 · export-bug #3" pill, red **Rec** button). Right DevTools panel: tabs **Sources/Console/Network**, file tabs `useMetrics.ts` / `dashboard/page.tsx` labeled **"via source map"**, debugger controls (resume/step-over/step-into/step-out), "Paused on `fetchMetrics`", code viewer with line numbers + breakpoint dot + current-line highlight (line 9: `const res = await fetchMetrics(range)`), **SCOPE** tree (Local: `range:'30d'`, `cancelled:false`, `res:Response{status:200,…}`, `this:undefined`; Closure(useMetrics); Global Window), **CALL STACK** (`load @ useMetrics` → `useEffect callback` → `commitHookEffectListMount` react-dom → `flushPassiveEffects` react-dom). Bottom: play button, prev/next event, speed `1.0×`, `00:12.48 / 00:41.20`, time ruler 0:00–0:35, lanes **操作 / NETWORK / CONSOLE / ERROR** with colored dots/bars, draggable playhead with time bubble, legend chips (操作・fetch・console…). |
| **1b** Replay+Debugger — Transcript | Left event list + minimal seek bar | Left: "イベント 24 · 00:41.20", filter chips (すべて/操作/Network/エラー), numbered rows: `route / → /dashboard`, `click #range-select`, `fetch·200 GET /api/metrics?range=30d`, `input .search → "conversion"`, `click .tab-reports`, **`click #export-btn` (停止中 badge, selected)**, `fetch·pending POST /api/export`, `console.warn export payload > 5MB`, `uncaught TypeError: rows is undefined`, `click .retry-btn` — each with timestamps. Right: debugger paused on `await exportCSV` in `dashboard/page.tsx` (SCOPE: `rows: Array(1204)`, `range:'30d'`, `blob:undefined`; CALL STACK: `handleExport` → `onClick` → `invokeGuardedCallback`). Bottom: thin seek bar with event dots colored by type. |
| **1c** Replay+Debugger — Timeline-forward | Top filmstrip + bottom console | Top: playback controls + **filmstrip of page thumbnails** (hatched placeholders) with per-frame time labels, event dot strips under each thumbnail, playhead line + time bubble. Right: source `lib/filters.ts` with line highlight. Bottom panel: **Console / Network tabs** — timestamped log rows incl. `warn export payload > 5.2MB — consider pagination` and `× 00:18.9 Uncaught TypeError: rows is undefined at exportCSV (lib/export.ts:41:13)` (source-mapped stack), `[retry] scheduled attempt 2/3 in 4,000ms`. |
| **1d** Recording | Panels collapsed, full-bleed browser + live feed | Bottom-right **live event toast feed** (`click #export-btn`, `fetch POST /api/export · 200 · 412ms`, `warn export payload > 5MB`, `route /dashboard → /reports`). Bottom status bar: `● REC 00:18.42`, recent-event chips, running counters `18 events · 6 click · 5 fetch · 1 …`. |
| **1e** Library | Dedicated home | Header: app logo **Entrance**, ライブラリ badge, global search "録画を検索 — 名前 / URL / イベント" (⌘K), red 新規録画 button. Left sidebar: groups すべて(7) / Dashboard perf(3) / Export bugs(2) / Auth flow(2) / 未分類(0), `+新しいグループ`, **storage meter `1.9 GB / 5 GB · 7 録画`**. Card grid per group: thumbnail (app preview + play), duration badge (`01:24`), name (e.g. "export-bug #3 — rows undefined"), datetime · URL, chips `6 click · 5 fetch · 1 error`. |
| **1f** First-run / Empty | Centered onboarding | Logo + tagline: 「ローカルのdevサーバーを開いて操作を記録。時間を巻き戻しながら、そのとき実行されていたコードをデバッグ。」 URL input (`http://localhost:3000`) + 「接続して開く」. **検出されたDEVサーバー list: Next.js 15.3 — dev `http://localhost:3000` / Vite 6.1 `http://localhost:5173` / Storybook 8 `http://localhost:6006`** (auto-detection with live/idle status dots). 3 steps: 接続 → ●Rec で記録 → 巻き戻してデバッグ. Note: 「録画には操作・DOM・ネットワーク・コンソールが含まれます。データはローカルにのみ保存。」 |

Design implications for the tech stack:
- The debugger panel shows **real V8 semantics** (react-dom internal frames in the call stack, `Response{}` previews) → demands a real CDP `Debugger.paused`, not just recorded traces (see §3).
- Timeline has **three interchangeable presentations** (multi-lane / transcript / filmstrip) over one event model → design a single time-indexed event store with lane projections.
- Library implies **local persistence with groups, names, search, storage quota + eviction**.
- Empty state implies **localhost port scanning + framework fingerprinting**.

---

## 1. Electron Shell & Embedded Browser Foundation

*(Agent report — verified against releases.electronjs.org, Electron docs, GitHub issues, npm registry as of July 2026. The agent purged all library version numbers it could not verify against a primary source.)*

> **Version-frame correction (high):** as of July 2026 the supported line is **Electron 41 / 42 / 43**; **43.0.0 is latest stable** (Jun 30 2026 · Chromium **150** · Node **24.17**; 43.1.1 = 2026-07-15 → Node 24.18). Electron 38 hit EOL Mar 2026, 35 in Sep 2025 (new major every ~8 weeks; latest 3 supported). **Target Electron 43.** [releases.electronjs.org][endoflife.date/electron]

### 1a. Executive summary

1. **Embed with `WebContentsView`… on paper.** `BrowserView` is deprecated (since Electron 30); `<webview>` is officially "not recommended" — but for *this* product the call is genuinely close (see #3). [electronjs.org/docs/latest/tutorial/web-embeds]
2. **Overlay reality (the crux):** app-chrome DOM *can* visually layer over embedded content (z-order = `addChildView` order; transparent views supported), **but interactive click-through in transparent regions is NOT supported** — open feature request electron/electron **#49039** (Nov 2025, no fix). `setIgnoreMouseEvents` is window-level, not per-view.
3. **The load-bearing UI decision:** with a WebContentsView over the content rectangle, **shadcn/Radix portals (Select / DropdownMenu / Popover / Tooltip / ContextMenu) that overhang the embedded viewport are composited *behind* the native view and clipped**. `<webview>` (in-DOM) makes them trivial. The CDP recording pipeline is **identical either way** (`<webview>.getWebContentsId()` → `webContents.fromId()` → `debugger.attach()`), so the fork is purely UI compositing + process isolation — and reversible.
4. **One CDP client per WebContents:** `webContents.debugger` and built-in DevTools are **mutually exclusive** — the `'detach'` event fires when "DevTools is invoked for the attached webContents" (reason `'target closed'`). Entrance must own the sole CDP connection and ship its own inspector (which the product wants anyway). [electronjs.org/docs/latest/api/debugger]
5. **Two distinct replay subsystems** (independently re-derived by this agent; matches §2/§3): (A) cheap video-scrub replay = rrweb DOM reconstruction + screencast filmstrip + recorded event lanes (no live JS); (B) source-level debugging = **deterministic re-execution** against the dev server with input + network replayed and the CDP Debugger attached. (B) is the hardest problem in the product.
6. **Input:** capture keyboard at shell level via `before-input-event` (keyboard-only, preventable; there is no "before-mouse-event") and interactions via rrweb in the renderer; **replay via CDP `Input.dispatchMouseEvent/dispatchKeyEvent`** — documented **CSS-pixel** coords and **`isTrusted: true`** in the page (can trigger focus/navigation/default actions; rrweb's JS re-dispatch cannot). Avoid `sendInputEvent` (coordinate units undocumented, historical high-DPI ambiguity).
7. **Frame capture:** **CDP `Page.startScreencast`** (`{format:'jpeg', quality, maxWidth/Height, everyNthFrame}` → `screencastFrame` + ack) drives the filmstrip — GPU-composited and multiplexed on the *same* CDP session as Network/Input/Debugger. `capturePage()` for one-off thumbnails. Offscreen rendering is **inappropriate** (it forces the page off-screen; the user watches the live page). Caveat: screencast captures the **visible viewport only**.
8. **Network:** CDP Network domain for requests + bodies (`Network.getResponseBody` after `loadingFinished`; buffer caps `maxTotalBufferSize`/`maxResourceBufferSize`; **`enableDurableMessages: true`** survives cross-process navigation; `streamResourceContent` for large/streaming bodies). `session.webRequest` = headers only, **no bodies** — insufficient. Deterministic replay/mocking via **Fetch domain** (`requestPaused` → `fulfillRequest`/`continueRequest`/`failRequest`; legacy `Network.*Intercepted` is deprecated).
9. **Security:** keep all defaults ON (`contextIsolation:true`, `sandbox:true`, `nodeIntegration:false`); one **`persist:` session partition per recorded target**; default-deny `setPermissionRequestHandler` **and** `setPermissionCheckHandler`; navigation allowlist + `setWindowOpenHandler(() => ({action:'deny'}))`; all privileged work (SQLite, debugger, fs) in **main** behind **Zod-validated typed IPC**; treat recorded localhost content as **hostile** (stored-XSS-into-Electron is the failure mode — never eval recorded strings; sanitize on render).
10. **Build/stack (verified):** **electron-vite 5.0.0** + **electron-builder 26.x** (or Electron Forge 7.11.2); **better-sqlite3 12.12.0** (ships Electron 42/43 prebuilds; E43 Linux needs glibc ≥ 2.41) + **Drizzle 0.45.2**; **@electron/rebuild 4.2.0**; **@electron/notarize 3.1.1** (notarytool); pnpm requires **`node-linker=hoisted`** + `asarUnpack` for the native `.node`.

### 1b. Embedding the browser: WebContentsView vs `<webview>` vs BrowserView (Q1)

`WebContentsView` (+ `BaseWindow`) is the officially recommended API; `BrowserView` is deprecated; `<webview>` is discouraged ("undergoes dramatic architectural changes"). But WebContentsViews are **not DOM elements** — positioned via `view.setBounds({x,y,w,h})` (DIP coords) from main, with **no `setAutoResize`** (re-`setBounds` on every layout change) and known **repaint lag during live resize** on macOS (#22174). Z-order = `addChildView` order (re-adding raises to top); a transparent top view visually composites but **captures all mouse events in its bounds** (#49039 — no click-through holes). Escape hatches for a WebContentsView build: native `Menu.popup()` for menus, borderless child windows per transient overlay, constrain popover placement, CDP `Overlay` domain for in-page element highlight.

| Dimension | `WebContentsView` (recommended by Electron) | `<webview>` (discouraged) | `BrowserView` |
|---|---|---|---|
| Status (2026) | Recommended, future-proof | "Not recommended", slow churn | **Deprecated** — do not use |
| In DOM? | No (native; `setBounds` from main) | **Yes** (CSS layout, auto-resize) | No |
| Radix/portal overlays over content | **Clipped** (workarounds needed) | **Just work** (z-index) | Clipped |
| Resize | Manual `setBounds`, repaint lag | Automatic via CSS, no lag | Manual |
| Process isolation | Strong (separate renderer) | Guest process (separate, some limits) | Separate |
| CDP recording | `view.webContents.debugger` | `fromId(getWebContentsId()).debugger` — **same** | same |
| UI/state complexity | Higher (main↔renderer bounds sync, IPC per overlay) | **Lower** (single React tree) | n/a |

**Verdict → §1e:** default **`<webview>`** behind an abstraction; documented flip-gate to WebContentsView.

### 1c. CDP access, input, frames, network (Q2–Q5)

- **`webContents.debugger`** (Q2): `attach('1.3')` / `sendCommand(method, params[, sessionId])` / `on('message')` — an **in-process** CDP transport in main with the **full page-level CDP** of Chromium 150 (`Debugger, Runtime, Network, Fetch, Page, DOM, CSS, Overlay, Input, Log, Profiler, HeapProfiler, Performance, Emulation…`; browser-level domains like `Target`/`Browser` are limited). Mutually exclusive with built-in DevTools (see 1a-4). External alternative: `--remote-debugging-port` + `connectOverCDP` (Playwright/puppeteer-core) — works, but adds an attack surface; both paths share the target's `DevToolsAgentHost`, so **don't combine two clients on one target** (medium confidence; modern flat-session CDP *may* allow it — needs-testing). **Recommendation: in-process debugger only.** No extra macOS entitlement needed.
- **Input (Q3):** `before-input-event` fires before page `keydown`/`keyup` and is preventable — keyboard only. Mouse capture happens in-page (rrweb). Replay: CDP `Input.dispatch*` = **trusted, CSS-pixel** events — a major fidelity win over rrweb JS re-dispatch (`isTrusted:false`). Because replayed input is *trusted*, it can cause **real side effects** (navigation, form posts) → during re-execution, mock the network (Fetch) and restrict navigation. Record coordinates in CSS px so replay needs no scaling.
- **Frames (Q4):** `Page.startScreencast` at low fps (JPEG q≈50–70, small `maxWidth/Height`, `everyNthFrame`) for the filmstrip; `capturePage([rect], {stayHidden, stayAwake})` for discrete thumbnails (works when occluded; no built-in throttle). OSR (`webPreferences.offscreen`, `'paint'`, `setFrameRate`, `useSharedTexture`) is for headless pipelines — not this app.
- **Network (Q5):** `Network.enable` (+buffer params) → `requestWillBeSent / responseReceived / loadingFinished / loadingFailed`; bodies via `getResponseBody` (evictable! → `enableDurableMessages`, `streamResourceContent`, or capture at Fetch-interception time). Replay via `Fetch.fulfillRequest` from recorded bodies; higher-level `page.routeFromHAR` (Playwright over CDP) exists but replays polling/stateful GETs imperfectly (PW #22869/#18288) — **a bespoke Fetch-domain matcher keyed on method+URL+ordinal gives more control**.

### 1d. macOS chrome & dev-server detection (Q6–Q7)

- **Title bar:** `titleBarStyle:'hiddenInset'` (traffic lights inset, matches mock) + `trafficLightPosition:{x,y}` constructor option; runtime `setWindowButtonPosition()` / `setWindowButtonVisibility()`. Draggable regions: `app-region: drag` (`style={{WebkitAppRegion:'drag'}}` in JSX) — interactive toolbar controls **must** set `no-drag`. Vibrancy: `vibrancy:'sidebar'|'under-window'` etc. + `visualEffectState`; the embedded view needs `setBackgroundColor('#00000000')` for it to show through; respect macOS "Reduce Transparency".
- **Multi-window:** Library window + Recorder window as separate `BrowserWindow`s; renderers share nothing → **main-process store as source of truth + IPC broadcast**. Batteries-included option: **`@zubridge/electron`** (bridges a main store to all renderers; supports Redux and Zustand — verify current version before pinning).
- **Dev-server detection (Q7):** liveness ≠ free port — `detect-port`/`get-port` find *free* ports (the opposite); the robust probe is a **direct HTTP GET from main** (Node fetch/undici — no CORS in main) to `http://127.0.0.1:<port>` **and `::1`** (servers may bind only one family); **any response, even 404, means alive**. Fingerprints: Next.js = `X-Powered-By: Next.js`, `/_next/static`, `__NEXT_DATA__` (Pages) vs `self.__next_f.push` (App Router); Vite = `<script type="module" src="/@vite/client">` (GET `/@vite/client` returns JS); Storybook = `/iframe.html` + `/index.json` (or legacy `/stories.json`). Pitfalls: self-signed HTTPS dev (`rejectUnauthorized:false` agent, try https on same port), path-specific servers (200 only on framework paths), debounce/rescan the well-known ports (3000/5173/6006/4321/8080…), distinguish dev from prod via dev-only markers (HMR endpoints, `/@vite/client`).

### 1e. Recommended shell architecture (agent's synthesis)

- **Windows:** Library window (`hiddenInset`, vibrancy `'sidebar'`) + Recorder window (`hiddenInset`, dark); main-process store + `@zubridge/electron` (Redux mode) or hand-rolled typed-IPC sync.
- **Embed — default `<webview>`, with a decision gate.** Radix/shadcn-dense DevTools UI + identical CDP pipeline ⇒ `<webview>` for the MVP (portals, CSS resize, one React tree all just work). **Isolate behind a thin `EmbeddedTarget` abstraction** so the choice is reversible. **Flip to WebContentsView if:** stronger process isolation becomes critical, `<webview>` stability/roadmap bites, or floating overlays over the viewport turn out unnecessary — then keep the content view in a rectangle no portal overhangs and use native menus/child windows for the exceptions.
- **CDP layer (main, single client per target):** enable `Network`(+durable) · `Page`(screencast) · `Runtime`+`Log` · `Debugger`(scriptParsed/source maps) · `DOM/CSS/Overlay` · `Fetch`(replay) · `Input`(replay); stream to renderer via throttled Zod-typed IPC; never open built-in DevTools on a recorded target.
- **Recording pipeline:** rrweb (preload-injected) → CDP Network/Runtime/Log → screencast JPEG → better-sqlite3 (main, Drizzle).
- **Replay:** Mode A (rrweb player + screencast frames + lanes; no live JS; fast) / Mode B (deterministic re-execution: reload, `Input.dispatch*`, `Fetch.fulfillRequest` from recording, `Debugger` attach, drive to seek point, then pause/step/scopes; source highlight via `scriptParsed.sourceMapURL` + `paused.callFrames[].location`).
- **Toolchain:** electron 43.x · electron-vite 5.0.0 + electron-builder 26.x · better-sqlite3 12.12.0 + drizzle-orm 0.45.2 · @electron/rebuild 4.2.0 · @electron/notarize 3.1.1 (Hardened Runtime + `allow-jit` + `allow-unsigned-executable-memory` entitlements — required by V8 regardless) · zod 4 · pnpm `node-linker=hoisted`.

### 1f. Risks & open questions (shell)

Risks: Radix portals clipped over WebContentsView (#49039 — prefer `<webview>`, else native menus/child windows) · WebContentsView resize lag (#22174) · debugger↔DevTools mutual exclusion (own inspector; handle `'detach'`) · `getResponseBody` eviction (durable messages/stream/Fetch-time capture) · re-execution nondeterminism (Fetch replay + Date/random/timer shims + `Emulation.setVirtualTimePolicy` — caveated: "may not advance with pending fetches", headless-oriented) · trusted-input side effects (mock network, block navigation) · `sendInputEvent` coordinate ambiguity (use CDP Input, CSS px) · hostile recorded content (sanitize; never eval) · pnpm+native packaging (hoisted, asarUnpack, rebuild) · `<webview>` "not recommended" status (abstract, monitor, keep migration path) · screencast = viewport only (accept; rrweb covers full page).

Open (shell): does the design truly need floating UI over the embedded viewport? (settle first; reversible) · multi-client CDP on one target in E43 (needs-testing) · how much nondeterminism to virtualize vs honestly surface · `setVirtualTimePolicy` on a live interactive page (needs-testing) · scrub-highlight without full re-execution (answered by §3: sampled profiler tier) · `@zubridge/electron` maturity check · rrweb coverage gaps (canvas, cross-origin iframes, shadow DOM) against real target apps.

---

## 2. Session Recording & Replay Technology

*(Agent report — verified against npm registry + GitHub as of July 2026.)*

### 2a. Executive summary

- **rrweb shipped stable 2.0 in mid-2026** (2.0.0 = Jun 1, 2026; **2.1.0 = Jun 27, 2026 is `latest`** for `@rrweb/all`, `@rrweb/record`, `@rrweb/replay`, `@rrweb/packer`, `rrdom`, `rrweb-player`). The old monolithic `rrweb` package is **deprecated** in favor of the scoped `@rrweb/*` split. Project healthy (~19.9k stars, MIT, sponsored by Sentry/PostHog/Datadog/Amplitude). [registry.npmjs.org/@rrweb/all][github.com/rrweb-io/rrweb] — high
- **rrweb replay is passive DOM reconstruction — the page's JavaScript does NOT run.** Perfect video-like scrubbing, but *no live variables, call stack, or stepping*. The single most important architectural fact for Entrance. — high
- **A real debugger "paused at time T" fundamentally requires re-execution.** No stock-Chromium API rewinds JS. Replay.io records the runtime at libc/syscall level in a **custom browser build**; Meticulous built a **custom Chromium deterministic scheduler**. Neither drops into stock Electron. — high
- **Recommended: Hybrid** — rrweb 2.x for video/scrub/filmstrip/transcript + **on-demand re-execution in a hidden `webContents`** (seed time/RNG, mock network from recorded bodies, re-dispatch input, attach real CDP `Debugger`) to power "pause + inspect + step". rrweb = always-correct ground truth; re-execution = best-effort with graceful fallback. — medium-high
- **Capture network + console via CDP from the Electron shell, not in-page patching.** CDP `Network.Initiator.stack` gives JS call stacks per request (maps requests to original source via source maps); `Runtime.consoleAPICalled` / `Runtime.exceptionThrown` give console/errors with stacks. `session.webRequest` can't read response bodies. — high
- **Clock correlation solvable:** CDP events carry both `timestamp` (monotonic) and `wallTime` (epoch); rrweb stamps wall-clock ms. Anchor both on a `t0` at Rec-start; order by monotonic. — high
- **rrweb has an official console plugin but NO first-party OSS network plugin** (`@rrweb/rrweb-plugin-network-record` → npm 404; roadmap lists fetch/XHR/GraphQL as *planned*) → network lane must come from CDP anyway. — high
- **Playwright Trace Viewer is the best format/UI precedent and is Apache-2.0.** `trace.zip` = `trace.trace` (JSONL incl. `screencast-frame`, `frame-snapshot`), `trace.network` (HAR), `trace.stacks` (call stacks→source), `resources/` (SHA-1 content-addressed). Copy this shape. — high
- **Chrome DevTools Recorder / `@puppeteer/replay`** define a clean user-flow JSON schema (steps + ranked selectors incl. `aria/`, `text/`, `pierce/`) — a good model for the semantic transcript + re-execution input script. — high
- **Recommended data format: event-sourced JSONL spine + content-addressed blobs** (`.entrance` bundle). — medium

### 2b. rrweb deep dive

**Versions/health (high).** `latest` = **2.1.0 (2026-06-27)** across the monorepo; 2.0.0 stable 2026-06-01 ended the multi-year alpha. Use `@rrweb/record` + `@rrweb/replay` (or `@rrweb/all`), plus `@rrweb/packer`, `@rrweb/types`, `rrdom`, `rrweb-snapshot`; Svelte `rrweb-player` also 2.1.0. Monolithic `rrweb` deprecated. ESM-first.

**Record API (high).** `record({ emit, ... })` emits `FullSnapshot` + `IncrementalSnapshot` (mutations, mousemove, interaction, input, scroll, viewport, media), `Meta`, `Custom`, `Plugin`. Key options: `checkoutEveryNth` / **`checkoutEveryNms`** (periodic full snapshots — bounds seek cost), `packFn` (per-event fflate), `sampling` (throttle mousemove/scroll/input, canvas fps), `recordCanvas` + `dataURLOptions`, `recordCrossOriginIframes`, `inlineStylesheet`, `plugins`, privacy suite (`maskAllInputs` default **off**).

**Replayer & seeking (high).** `new Replayer(events, {...})`; `play(timeOffset)`, `pause(timeOffset)`, `setConfig({speed})`, `skipInactive` (`inactivePeriodThreshold` default 10s). **Seeking = rebuild from nearest preceding FullSnapshot + re-apply all increments to target** (backward seek always rebuilds). Mitigations: **`useVirtualDom`/rrdom (default on)** applies fast-forward mutations to a virtual DOM and flushes once; **`checkoutEveryNms` ~10–30s** bounds the re-apply window for scrub-bar dragging. For Entrance's custom UI, drive `Replayer` directly rather than embedding `rrweb-player`.

**Plugins (high).** Official console record/replay plugin (`getRecordConsolePlugin()`) — hooks all 19 console methods, parses stacks via ErrorStackParser, configurable stringify limits (default 1000-record cap). Canvas-over-WebRTC plugins exist. **No first-party network plugin** (404 on npm; roadmap "planned").

**Fidelity gotchas (medium).**
- Canvas: `recordCanvas` (2D/WebGL) heavy + lossy; replay needs `UNSAFE_replayCanvas` (removes replay sandbox).
- iframes: same-origin native; cross-origin needs `recordCrossOriginIframes` + cooperating child recorders.
- Shadow DOM: supported via `Mirror` across shadow roots.
- **adoptedStyleSheets / CSSOM (Next.js+Tailwind/CSS-in-JS gotcha):** rrweb tracks constructed stylesheets (`styleMirror`) and `styleSheetRule`/`styleDeclaration` (insertRule) mutations; under `useVirtualDom` applied at flush. Styles injected purely via CSSOM (styled-components) or `adoptedStyleSheets` can be missed/mis-ordered; Tailwind JIT `<style>` text mutations are captured. **Validate against the actual target stack.**
- Web workers / OffscreenCanvas: out of scope (main-document DOM only).
- Privacy: `maskAllInputs` off by default — dev apps contain tokens; consider default-masking.

**Size/compression (medium — vendor figures).** ~200 KB/min typical compressed; ~5 MB/session normal ceiling (rrweb-cloud fair-use). `@rrweb/packer` = fflate per event; whole-session deflate/zstd compresses better; plus `sampling`, `blockClass`, CSS dedup.

### 2c. Transcript & multi-lane timeline mapping

- **Semantic events:** rrweb incremental events carry the mirror node `id` → resolve via `Mirror` → synthesize stable CSS selector (`#id` > `data-testid` > aria > structural fallback — the Chrome Recorder "ranked selectors" idea). Map `MouseInteraction`(Click/DblClick/ContextMenu), `Input`, `Scroll` → transcript rows (`click #export-btn`).
- **SPA routes:** rrweb records full reloads (`Meta`) but **client-side route changes are not first-class** → patch `history.pushState`/`replaceState`/`hashchange` as rrweb custom events, or use CDP `Page.navigatedWithinDocument` / `Page.frameNavigated` → `route / → /dashboard` rows. — medium
- **Clock alignment (high):** store `t0` anchor (wall + CDP monotonic pair) at Rec-start; convert CDP monotonic→wall via an early event's `(timestamp, wallTime)` pair; order by a single monotonic source; use wallTime for display only.

### 2d. Network & console capture comparison

| Approach | Bodies | Timing | Initiator stack → source | Notes |
|---|---|---|---|---|
| **CDP `Network`/`Runtime`/`Log` (shell)** | ✅ `getResponseBody` (base64 flag) | ✅ monotonic + wallTime, full lifecycle | **✅ `Network.Initiator.stack` (requires Debugger domain enabled)** | Also `Runtime.consoleAPICalled`(+stack), `Runtime.exceptionThrown`, `Log.entryAdded`. **Recommended.** |
| In-page fetch/XHR patch | ✅ (own wrapper) | partial (Resource Timing) | ❌ (scrape `new Error().stack`, brittle) | Bypassable when libs cache native refs (Meticulous warns); misses document/WS. |
| Electron `session.webRequest` | **❌ no response bodies** | coarse | ❌ | URL/headers/blocking only. |

**Verdict:** CDP is the only option yielding initiator call stacks that later source-map to original code — central to the executing-code-highlight feature. Enable `Network`, `Runtime`, `Log`, `Debugger` on the embedded page's CDP connection.

### 2e. Systems to learn from

- **Chrome DevTools Recorder + `@puppeteer/replay` (high):** user-flow JSON (steps: navigate/click/change/keyDown… each with ranked selectors `aria/`, `text/`, XPath, `pierce/`; assertions `waitForElement/Expression`); supports breakpoints + step-through during replay. Model for transcript schema + deterministic input script.
- **Playwright Trace Viewer (high):** `trace.zip` = `trace.trace` JSONL (`context-options`, `screencast-frame`, `before/input/action/after`, `console`, `log`, `resource-snapshot`, `frame-snapshot`, `error`) + `trace.network` (HAR) + `trace.stacks` (stacks→source) + SHA-1 `resources/`. Viewer reconstructs DOM via double-iframe, renders `FilmStrip` from screencast frames, highlights source line per action. **Apache-2.0 → format & React viewer legally reusable.** Playwright 1.59 added headless `npx playwright trace` CLI.
- **LogRocket / Sentry Session Replay (high):** rrweb-based; breadcrumbs timeline correlating network (bodies+headers), console, memory, source-mapped errors. Confirms the product pattern; still passive.
- **OpenReplay (OSS, high):** self-hosted (Postgres+ClickHouse+Redis); DevTools panel = network, JS errors with source-mapped stacks, **state/store plugins (Redux/Zustand/…)**, GraphQL, 40+ metrics. Closest OSS analog; still passive replay + recorded traces. Good reference for a Redux lane.
- **Meticulous.ai (high):** records sessions → **deterministic re-execution** across a cluster, **network mocked by default** (record at record-time, replay at replay-time), snapshot after each dispatched event for visual diffs; **"built from the Chromium level up with a deterministic scheduling engine"** (they forked Chromium because stock isn't deterministic enough); selector fuzziness for hashed class names.
- **Replay.io (high):** records runtime nondeterminism at libc/syscall level (~1 MB/s, ~3% overhead, inline-asm interposition) in a custom browser; re-executes deterministically in cloud. Protocol: run-to-point, pause-at-point, evaluate; parallelism via process fork/snapshot. Proves the capability Entrance wants requires custom runtime **or** on-demand re-execution.

### 2f. THE core question — replay strategy for a real debugger at time T

Stock CDP `Debugger` pauses/steps **forward only**; rrweb never executes JS. Realistic options:

**(b) Live re-execution + real CDP debugger (high mechanism / medium determinism):**
1. Reload the dev app in a **hidden secondary `webContents`**.
2. **Determinism shim** via `Page.addScriptToEvaluateOnNewDocument`: freeze `Date`/`performance.now()` to recorded clock; seed `Math.random` + `crypto.getRandomValues`; wrap `setTimeout`/`setInterval`/`requestAnimationFrame` to the recorded schedule.
3. **Mock network** via `Fetch.enable` + `Fetch.fulfillRequest` serving recorded bodies (HAR-style).
4. **Re-dispatch input** via CDP `Input.dispatch*` (trusted `isTrusted` events).
5. **"Run until event N then pause"**: replay to N → CDP `Debugger.paused` gives call frames + scopes; `Runtime.getProperties` reads variables; `stepOver/Into/Out` real stepping; source maps resolve display.
6. `Emulation.setVirtualTimePolicy` (`advance`/`pause`/`pauseIfNetworkFetchesPending`, `budget`, `initialVirtualTime`) as a **fast-forward assist, not the determinism mechanism** — experimental, designed for headless rendering; composition with interactive input replay + stepping is **unproven → prototype spike**.

**(c) Hybrid — RECOMMENDED.** rrweb for instant, always-correct scrubbing + transcript/lanes; on user "inspect/step here", spin up (b) on demand up to N. Checkpoint at rrweb full-snapshot boundaries. **Diff re-executed DOM vs rrweb ground truth at N; on divergence show "best-effort" banner and fall back to passive trace inspection.**

**Determinism failure modes & mitigations (medium/low — reasoned):** clocks/RNG (seed — most tractable); network (record&replay bodies; **WebSockets** nastiest — replay frames on schedule); rAF/animations (pin to virtual/recorded time); **Next.js dev HMR websocket + Fast Refresh will fire during replay → disable HMR / serve frozen build for re-execution, block/replay the HMR socket**; RSC/server actions = server-side nondeterminism → mock responses; React concurrent scheduler (residual nondeterminism — why Meticulous forked Chromium; expect occasional divergence). Always keep rrweb as ground truth; degrade gracefully.

### 2g. Strategy comparison

| Dimension | (a) Passive DOM replay (rrweb) | (b) Live re-execution + CDP Debugger | (c) Hybrid |
|---|---|---|---|
| Video fidelity | High (canvas/media/CSSOM caveats) | Medium (re-render may diverge visually) | **High** (visible video = rrweb) |
| Scrub speed | **Excellent** (snapshots+rrdom+checkouts) | Poor (execute forward; seconds+) | **Excellent**; slower only entering debug |
| Debugger realism | None (no live JS) | **High** (real frames/scopes/stepping) | **High on demand** |
| Determinism risk | N/A | **High** | **Medium** (fallback to ground truth) |
| Implementation cost | Low | Very high | High |

### 2h. Recommended recording+replay architecture

**Record path (visible main webContents):**
- DOM/video: `@rrweb/record` 2.1.0, `checkoutEveryNms≈15000`, `sampling` throttles, `inlineStylesheet:true`, `recordCanvas` only if needed. Pack via `@rrweb/packer` or whole-session compression.
- Console/errors: console plugin and/or CDP `Runtime.consoleAPICalled` + `exceptionThrown` + `Log.entryAdded` (richer stacks).
- Network: CDP `Network` via `webContents.debugger` — `requestWillBeSent` (**Initiator.stack**, wallTime+monotonic), `responseReceived`, `loadingFinished`, `getResponseBody`. Enable `Debugger` domain so initiator stacks populate.
- Transcript: rrweb interaction events (mirror id→selector) + history patch / `Page.navigatedWithinDocument` for routes.
- Clock: `t0` anchor (wall + monotonic) at Rec-start.
- Source maps: snapshot dev build's maps + original sources keyed by build hash at Rec-start.

**Replay path:**
- Scrub/inspect (default): `@rrweb/replay` 2.1.0 driving custom multi-lane timeline + filmstrip; source panel highlights recorded frames via initiator/console/error stacks through stored source maps.
- Debug at T (on demand): hidden webContents → determinism shim → `Fetch.fulfillRequest` mocks → `Input.dispatch*` replay → optional virtual-time fast-forward → real CDP `Debugger` pause/step. DOM-diff vs ground truth; graceful divergence banner.

**`.entrance` bundle format:**
```
manifest.json        # ids, app URL, build/sourcemap hash, clock anchors (t0 wall+monotonic), versions, checkout offsets
events.jsonl         # rrweb events (video/DOM spine), optionally packed per line
transcript.jsonl     # {t, kind: click|input|route|…, selector, mirrorId}
network.jsonl        # {t, method, url, status, timings, initiator.stack, bodyRef}
bodies/<sha1>        # request/response bodies, content-addressed (dedup)
console.jsonl        # {t, level, args, stackTrace}
errors.jsonl         # {t, message, stackTrace}
sourcemaps/<hash>/   # maps + original sources, once per build hash
thumbnails/<t>.jpg   # filmstrip frames
```
JSONL streams during Rec (crash-safe append), seekable via small timestamp index; content-addressing dedups bodies; chunk `events.jsonl` at checkout boundaries so scrubbing is O(window). ≈ "Playwright trace.zip adapted to rrweb spine + CDP lanes".

### 2i. Risks & open questions (recording layer)

Risks: rrweb passive-replay gotchas (canvas/media/cross-origin/CSSOM — test against real stack); determinism divergence (HMR/WS/rAF/scheduler — freeze build, replay frames, pin clocks, fallback); **Electron single-CDP-client constraint: `webContents.debugger.attach()` conflicts with an open DevTools — Entrance must own the sole CDP connection to the visible page and run step-debugging against a separate hidden webContents**; source-map drift across HMR rebuilds (pin by build hash); long-session seek cost (checkouts + chunking); secrets in recordings (consider masking).

Open: does `Emulation.setVirtualTimePolicy` compose with trusted input replay + stepping in stock Electron? (spike needed); on-demand re-exec latency acceptable for "pause and step" UX?; how to freeze the exact dev build for re-execution (HMR moves underneath — snapshot served modules vs production build of same commit); server-side nondeterminism (RSC/server actions) — is response mocking sufficient?; checkpoint granularity benchmarks.

---

## 3. Time-Travel Debugging & Source-Map Infrastructure

*(Agent report — CDP/V8/Next.js/TC39 sources as of July 2026.)*

### 3a. Executive summary

1. **The mocked UX = two mechanically different features glued to one playhead:** scrub-highlight = cheap always-on **time→code index**; "pause → live `Response{...}` scope + react-dom call stack + stepping" = **real CDP debugger pause**. No single mechanism delivers both → hybrid.
2. **The react-dom frames in the mock (`commitHookEffectListMount`, `flushPassiveEffects`) are the tell:** they fall out of a real V8 stack for free when breaking inside a `useEffect` body; instrumentation cannot synthesize them (can't transform node_modules react-dom). The mock's paused state is a **genuine `Debugger.paused`**.
3. **Entrance is CDP over a live Next.js app — NOT a deterministic replay engine.** Replay.io does "pause at any past instant" only via libc-level nondeterminism recording (~400 calls, ~3% overhead) + cloud re-execution. Over plain CDP, "re-run to past event N and break" is reliable **only for deterministic flows**.
4. **Post-mortem SCOPE values at arbitrary past time without re-execution requires eager value-logging instrumentation** (ODB/Jalangi/Wallaby model): heavy (26×–300× naive; Wallaby bounds via `maxTraceSteps`). → **v2 / focused-region**, not v1-always-on.
5. **Recommended v1 = hybrid with honest split:** (i) always-on = sampled CPU profile (function-level highlight) + cheap source-mapped anchors (network initiators, console, exceptions, DOM events); (ii) money feature = live CDP pause via "inspect/step from here" re-executing deterministic flows. Omniscient value-trace deferred to v2.
6. **Time→code cheap tier:** CDP `Profiler` sampling (default 1000µs, lowerable ~100µs) = function-level; Chrome tracing category `disabled-by-default-v8.cpu_profiler` additionally emits per-sample **`lines[]`** = **line-level, time-resolved** highlight. Sampling cannot stitch async causality → bridge with anchors.
7. **Source maps solved-enough for v1.** Next.js dev ships maps by default: webpack dev = `eval-source-map` (inline data-URL per eval module); **Turbopack dev = real `.map` files** (`turbopack://[project]/…` normalized). **Both embed `sourcesContent`** → render original TS/TSX with zero disk access. Harvest via `Debugger.scriptParsed.sourceMapURL`; parse with **`@jridgewell/trace-mapping`** (no WASM, ~5.2MB for 2.1M-segment map vs ~391MB for source-map@0.6, bidirectional).
8. **Original variable names in SCOPE:** today = source map `names` + AST heuristic (Chrome DevTools `NamesResolver`). **TC39 "Source Maps with Scopes" = Stage 3 / ECMA-426** (`scopes` field: `originalScopes` + `generatedRanges`), implemented in DevTools behind `USE_SOURCE_MAP_SCOPES` experiment. Feature-detect and prefer when present.
9. **Replay.io July 2026 status (corrected):** pivoted to AI as two products — nut.new (AI app builder, a 2025 phase, now stale) and **Replay QA (current flagship, AI testing on the same engine)**. Time-travel engine alive, commercially supported, repackaged as infra (Replay QA / Replay-for-CI / Replay-MCP). OSS `replayio/devtools` (719★) not archived, lightly maintained (Apr 2026); Chromium/V8 forks pushed same day as research.
10. **`restartFrame` ≠ reverse execution:** V8 2026 re-implementation requires `mode:'StepInto'`, continues and re-pauses at frame start, gated by `canBeRestarted`, **does not roll back side effects**. "Re-run this call", not step-back.

### 3b. "What code was executing at time T" — technique evaluation

- **(a) CDP `Profiler` sampling (high):** `setSamplingInterval(µs)` → `start`/`stop` → `Profile{nodes[], startTime, endTime, samples[], timeDeltas[]}`; `ProfileNode.callFrame{functionName, scriptId, url, line, column}`. samples+timeDeltas = **function-level time series** → map playhead T to top-of-stack function. `positionTicks` = per-node line *histogram* (aggregate, not time-resolved). Default 1000µs, can lower ~100µs (cost↑).
- **(b) Chrome Tracing / `contentTracing` (high):** category `disabled-by-default-v8.cpu_profiler` (+`.hires`) emits `Profile`/`ProfileChunk` trace events; `ProfileChunk.args.data` carries `cpuProfile{nodes,samples}`, `timeDeltas`, **and `lines[]` per sample** = **line-level, time-resolved** — the best cheap always-on source for scrub-highlight. Drive via Electron main `contentTracing.startRecording`.
- **(c) Build-time instrumentation (high mechanism / medium Turbopack ergonomics):** statement-level deterministic tracing + value capture. Injection points under Next 16/Turbopack: (1) `turbopack.rules` custom loaders (webpack-loader-compatible); (2) `experimental.swcPlugins` (SWC Wasm, version-pinned); (3) webpack fallback `next dev --webpack` (custom webpack config now fails `next build` without `--webpack`). Must compose source maps through the transform. Prior art: istanbul `programVisitor`, OpenTelemetry, Wallaby (private engine). Cost: naive value logging 26×–300×.
- **(d) CDP Debugger cheap anchors (high):** `Network.requestWillBeSent.initiator.stack` ("set for Script only; requires Debugger domain enabled") = exact JS call site of every fetch; `Runtime.consoleAPICalled` / `Runtime.exceptionThrown` carry stacks (this is literally the mock's `TypeError … at exportCSV (lib/export.ts:41:13)`); `DOMDebugger`/`EventBreakpoints` for user-event anchors. Near-zero cost source-mapped waterfall.
- **Async causality limitation (high):** sampled profiles can't reconstruct async causal stacks (continuation after `await` = fresh stack). `Debugger.setAsyncCallStackDepth` stitches async parents **only at a debugger pause** (`StackTrace.parent/parentId`). → samples for on-CPU timeline; anchors bridge async in the UI.

### 3c. Replay.io architecture (conceptual reference)

Records only **sources of nondeterminism** (network, input, file reads, thread interleavings) via ~400 libc interceptions (inline asm), ~3% overhead; "effective determinism" (JS/DOM-observable state matches); everything in DevTools computed at replay time in cloud. **Record Replay Protocol** (JSON-RPC, modeled on CDP) concepts worth stealing: **execution points** (opaque totally-ordered index; `Session.getPointNearTime(T)`), **Pauses** (`Session.createPause(point)` → side-effect-sandboxed snapshot; evaluations don't leak between pauses), inspection (`Pause.getAllFrames/getScope/getObjectPreview` with `none|noProperties|canOverflow|full` levels + `PauseData` piggybacking), **bidirectional stepping as protocol primitives** (`findReverseStepOverTarget`, `findRewindTarget`), scalability via `Session.findPoints` + `Session.runEvaluation` (one expression at many points) bounded by a **focus window**. Source maps first-class: `MappedLocation`, `getScopeMap` (generated→original names), `Frame.originalScopeChain`, `evaluateInFrame({useOriginalScopes})`, `mapExpressionToGeneratedScope`. "Jump to code at T" = `getPointNearTime → createPause → getAllFrames → top MappedLocation → open original line`. OSS client `replayio/devtools` = React app on the protocol (`packages/replay-next` + `packages/protocol`), embeds React DevTools + Redux DevTools viewable at any timeline point.

### 3d. Live-debugger mechanics over CDP

- **Breakpoints:** `setBreakpointByUrl({url|urlRegex, lineNumber, columnNumber, condition})` (survives navigation/HMR by URL) or `setBreakpoint({scriptId,…})`. **No native hit-count — only `condition`** → break on Nth invocation via counter expression (`++window.__ec>=N`) or auto-resume N−1 times. `getPossibleBreakpointLocations` snaps to valid statement starts.
- **Pause payload:** `Debugger.paused` → `callFrames[]{callFrameId, functionName, location, scopeChain[], this, returnValue, canBeRestarted}`; scope types `global|local|with|closure|catch|block|script|eval|module|wasm-*`; read via `Runtime.getProperties(objectId,{ownProperties, generatePreview})` → `PropertyDescriptor`. `res: Response{...}` one-liner = `RemoteObject.preview`/`ObjectPreview` (no deep serialization).
- **Stepping:** `stepOver/stepInto/stepOut/pause/resume`; `setPauseOnExceptions(none|caught|uncaught|all)`; `setBlackboxPatterns`/`setBlackboxedRanges` to fold (or deliberately keep) library frames like react-dom.
- **`restartFrame` (V8 2026):** requires `mode:'StepInto'`; continues + re-pauses at frame start; `canBeRestarted` "very likely" not guaranteed; **no side-effect rollback** — forward re-run only.
- **Async stacks:** `setAsyncCallStackDepth(maxDepth)` → `Debugger.paused` includes async parents (`StackTrace.parent/parentId`) → pause inside async `load()` shows `useEffect`-callback ancestry (matches mock).
- **Replay-inputs-then-break:** CDP `Input.dispatchMouseEvent/dispatchKeyEvent/insertText/dispatchDragEvent/synthesizeScrollGesture…` dispatch trusted events → arm persistent `setBreakpointByUrl` (+counter condition) → replay inputs → pause fires at reconstructed moment. (Methods high; full-sequence fidelity medium.)
- **Passive-effect pausing (mock's exact scenario):** breaking inside a `useEffect` body naturally yields `commitHookEffectListMount` → `flushPassiveEffects` react-dom frames **for free** on the sync stack. Hard part = disambiguating the Nth effect run (counter/condition + anchor correlation). Confirms mock = real pause.

### 3e. Source maps in Next.js dev (July 2026: Next 16.2 stable, Turbopack default)

- **Webpack dev** = `eval-source-map`: each module `eval()`ed with inline `data:` URL map → per-module `Debugger.scriptParsed.sourceMapURL` (decode inline base64).
- **Turbopack dev** = real `.map` files, `turbopack://[project]/…` URIs (→ normalized to `file://` in dev), served by source-map middleware; supports `turbopack: { debugIds: true }`.
- **Both embed `sourcesContent`** → original TS/TSX displayable with no disk access. (DevTools shows "(source not available)" only when sourcesContent absent.)
- **Harvest:** enable `Debugger`; on `scriptParsed` collect `{scriptId, url, sourceMapURL, debugId, hash, isModule}`; webpack → decode data URL; Turbopack → fetch `.map` (`Network.getResponseBody` or `file://` read; `Debugger.getScriptSource` for generated body). `Debugger.setInstrumentationBreakpoint('beforeScriptWithSourceMapExecution')` catches maps deterministically before first execution.
- **Parsing lib:** **`@jridgewell/trace-mapping`** — `originalPositionFor` (display), `generatedPositionFor`/`allGeneratedPositionsFor` (breakpoint placement), `sourceContentFor`, `AnyMap` (sectioned); no WASM, tiny memory, fast; the mapping core bundlers already use. Avoid `source-map@0.6` (memory/init). Neither decodes `scopes` yet.
- **Bidirectional:** display = generated→original; breakpoints = original→generated (column precision matters for eval/bundled code).
- **Names/scopes:** now = `names` array + AST resolver (Chrome `NamesResolver`: `computeScopeTree`/`allVariablesAtPosition`); future = **ECMA-426 Stage 3 `scopes`** (originalScopes + generatedRanges; DevTools behind `USE_SOURCE_MAP_SCOPES`) — feature-detect, prefer when present, fall back to names+AST.
- **RSC caveat:** `dashboard/page.tsx` may be a Server Component → server-side maps (`serverSourceMaps`, Turbopack server `file://` maps) + separate Node inspector session. Scope decision: client-only for v1?

### 3f. SCOPE without re-execution (pure-trace mode) + literature

**Governing constraint:** every scalable debugger *defers* deep inspection because it can re-obtain the object (CDP live `getProperties`; Replay/rr/McFly re-execute). Pure-trace has neither → **serialize eagerly & bounded at capture**; **snapshot, never alias** (live refs let later mutation rewrite the past); bounded eager preview (top-N props, depth≤k, array/string caps, cycle markers, stable object ids).

- **ODB (Lewis 2003):** instrument every assignment/call; per-variable `HistoryList` of (timestamp, value); RAM-bound ("~10M events; at 2µs/event, 20s fills 2GB"); slowdown 7×–300×.
- **Jalangi/jalangi2:** source rewrite to `J$.*` callbacks with static `iid`; shadow values; **selective instrumentation** (skip node_modules — "operates even if certain files are not instrumented"); trace-size reduction via value encoding + string interning; ~26× record / ~30× replay.
- **McFly (correction):** checkpoint + record-replay, framework-agnostic — heap snapshot via engine GC traversal + serialized DOM every ~2s + nondeterminism log; step-back ~3.8s. Lesson: full-DOM snapshots only affordable at engine level on an interval. (True React/Redux lineage = Redux DevTools: record action stream, re-run pure reducers.)
- **Pernosco:** UX reference — execution as queryable database; **reverse dataflow** (click a value → jump to where it was created, distinguishing creation from copies) — feasible on a pure value-trace; strong differentiator.
- **Wallaby.js:** instruments source; records focused test run once; forward/back navigation ("Run to Active Line"); select expression → recorded value; **`maxTraceSteps` caps recorded steps** — the concrete answer to bounding an omniscient trace.
- **Serialization to adopt:** CDP preview shape with repointed handle (`{type, subtype, className, description, preview{properties, overflow}, id→blob-store}`); Node `util.inspect` defaults as knobs (depth 2, maxArrayLength 100, maxStringLength 10k, `[Circular *n]`); graded serializer (fast JSON / cycle-aware / rich types) + sanitizers placeholding `Response`/DOM/`Blob`/functions; intern + structural-share immutable React/Redux subtrees (store only changed subtrees — biggest cost-saver).

### 3g. Playhead↔highlight sync model

Timeline of timestamped **execution points**, each resolvable to a source location:
- **Function-level (always-on):** playhead T → bracket sample via `startTime + Σ timeDeltas` → node `callFrame` → source-map → highlight function (line-level with tracing `lines[]`).
- **Statement/column-exact (at pause):** real `Debugger.paused` top frame → source-map → exact original line+column (mock's highlighted `const res = await fetchMetrics(range)` + breakpoint dot).
- Replay.io composition as reference: `getPointNearTime → createPause → getAllFrames → top MappedLocation → open line`; Entrance analogue: `T → nearest sample/anchor → callFrame → trace-mapping → line`.
- **v1 granularity:** function-level during scrub; column-exact only at pause. Don't promise per-statement time-resolved highlight from sampling (sub-ms functions missed; async not causal). Index the model by execution point/sample id (not wall-clock) so it serves both tiers + future omniscient trace.

### 3h. Decision matrix (capabilities the mock demands)

(1) scrub highlight · (2) live-looking SCOPE · (3) real CALL STACK incl. react-dom · (4) stepping

| Capability | Trace-only (samples + value-logging) | Re-execution debugger (live CDP pause) | **Hybrid (recommended)** |
|---|---|---|---|
| (1) Scrub highlight | Strong (always-on, no determinism needed) | Weak for scrub | **Strong** (samples/anchors) |
| (2) SCOPE values | Partial, costly (bounded snapshots; Response/DOM placeholders; 26×–300×) | **Strong** (live getProperties, original names) *if* moment reachable | **Strong** (live at pause; snapshots fallback) |
| (3) Call stack incl. react-dom | Weak (can't synthesize library internals) | **Strong** (free on real pause; async via setAsyncCallStackDepth) | **Strong** |
| (4) Stepping | Weak (pseudo-stepping over trace) | **Strong** (real step, restartFrame forward re-run) | **Strong** |
| Determinism requirement | None | High | Gated to opt-in pause path |
| Overhead/storage | High (RAM-bound like ODB) | Low continuous (~3–10% sampling); cost at pause | Low always-on; heavy on demand |

**Verdict: Hybrid.** v1 = (always-on) function-level scrub highlight + source-mapped console/exception/network anchors + cheap per-anchor stack markers; (gated) "inspect/step from here" = re-execute deterministic flow → real live pause. v2 = focused-region omniscient value trace (Wallaby/ODB-style, `maxTraceSteps`-bounded).

### 3i. Source-map pipeline design (concrete)

Libraries: `@jridgewell/trace-mapping` (+ `@jridgewell/sourcemap-codec` if hand-decoding `scopes`), AST pass (acorn/@babel/parser) for names-based scope resolution until `scopes` lands.

1. `Debugger.enable` (+ optional `setInstrumentationBreakpoint('beforeScriptWithSourceMapExecution')`).
2. On `scriptParsed`: record `{scriptId,url,sourceMapURL,debugId,hash,isModule}`; decode data-URL maps inline (webpack) or fetch `.map` (Turbopack; normalize `turbopack://[project]/…`).
3. Build one `TraceMap` per scriptId (or debugId); extract `sourcesContent` → original-source cache.
4. UI queries: `originalPositionFor` (highlight/stack/console display); `generatedPositionFor`/`allGeneratedPositionsFor` → `setBreakpointByUrl` (breakpoints).
5. Names: `names`+AST now; feature-detect ECMA-426 `scopes`.
6. Cache by scriptId + debugId/hash; **invalidate on HMR** (new scriptParsed for same url supersedes); LRU cap; cache original→generated resolutions per (source,line).

### 3j. Risks & open questions (debugger layer)

Risks: nondeterminism breaks re-execution (record+replay network via Fetch interception; seed Date/Math.random/crypto; classify segments; honest "can't re-reach" state) · Nth-invocation ambiguity (counter conditions; anchor correlation) · instrumentation fragility under Turbopack (turbopack.rules loaders; pinned SWC plugin; `--webpack` fallback; source-map composition) · sampling misses sub-ms/async (function-level only; anchors; setAsyncCallStackDepth at pauses) · pure-trace storage explosion (caps, sanitizers, interning, structural sharing, focused-region) · `restartFrame` mislabeled (call it "re-run this call"; disable when !canBeRestarted) · Turbopack map quirks (URI normalization; getResponseBody; feature-detect debugIds/scopes) · aliasing corruption (deep-copy at capture) · react-dom frame names not API (don't hardcode; blackbox/x_google_ignoreList generically) · overhead perception (sampling + anchors only by default; heavy capture opt-in; analysis off the hot path).

Open: determinism strategy (record&replay nondeterminism vs restrict pauses to deterministic segments) · live-in-session pause vs re-execution pause (mock implies the latter = hard path) · RSC/server-side in scope? (server maps + Node inspector = larger surface; client-only v1?) · function-level scrub-highlight acceptable, or does the video metaphor demand per-statement (forces instrumentation)? · value-capture depth policy defaults · ECMA-426 `scopes` adoption timeline in Turbopack · reuse `replayio/devtools` / DevTools frontend vs bespoke panel.

---

## 4. UI Implementation Stack & Local Persistence

*(Agent report — all versions/dates pulled live from npm registry/downloads APIs, GitHub API, and vendor docs on 2026-07-15/16; confidence tagged per claim. One widely-repeated "fact" was found stale and corrected against primary sources — see 4d.)*

### 4a. Executive summary

1. **Code viewer → CodeMirror 6, not Monaco.** Decisive evidence: every purpose-built replay/time-travel debugger uses CodeMirror, none use Monaco — **Chrome DevTools Sources = CM6** (implements all four of Entrance's decorations, incl. inline values via `Decoration.widget` → `cm-variableValues`), **replayio/devtools = CM6** (verified in `packages/replay-next/package.json`), **Playwright trace viewer = CodeMirror v5**. Monaco ships ~2–5 MB + a ~6.7 MiB TS worker with real Electron worker/CSP friction for zero benefit in a read-only pane. — high
2. **Timeline → hand-rolled React + layered Canvas 2D + DOM overlay.** No off-the-shelf React timeline lib fits a dense multi-lane event track (vis-timeline = calendar-oriented; react-calendar-timeline = Gantt/beta; Pixi/Konva = overkill). Copy **Playwright's filmstrip frame-selection math** (Apache-2.0); imitate **Chrome DevTools' canvas-flame-chart + absolutely-positioned DOM overlay + binary-search hit-testing**. WebGL unnecessary — the timeline is static between interactions. — high
3. **Playhead sync (60fps) → keep it OUT of Redux.** Transient playhead lives in a module-level ref/emitter advanced by one `rAF` loop, read by leaf widgets via `useSyncExternalStore`; the timeline cursor draws imperatively on canvas; only **coarse** state (`currentEventIndex` on boundary crossing, `isPlaying`, rate, tab, layout) commits to RTK. This is **Remotion Player's** documented model — no new state library required. (react-redux v9 reads via `useSyncExternalStore`, whose updates are synchronous and cannot be `startTransition`-deprioritized → per-frame dispatches = jank.) — high
4. **Layout → `react-resizable-panels` (shadcn Resizable) + shadcn Tabs.** Entrance is a fixed 4-region shell, not a docking problem; RRP is shadcn-native and very active (4.12.2, 2026-07-03, 33.4M/wk). Escalate to **Dockview 7** only if true drag-to-dock/floating/serialized layouts become a requirement. — high
5. **Lists → `react-virtuoso`** 4.18.10 (transcript/console/network: variable heights, sticky group headers, imperative `scrollToIndex` seek-follow — **not** `followOutput`, which only tails appends) **+ `@tanstack/react-virtual`** 3.14.6 for the horizontal filmstrip. — high
6. **Object inspector → `react-arborist`** 3.13.2 (headless, virtualized, controlled lazy async expansion) mapped to CDP's lazy `Runtime.getProperties`/`RemoteObject` model, styled with shadcn; **`react-inspector` 9** is the quick DevTools-look alternative if scopes are shallow. Avoid the dead `@devtools-ds/*` (2022) and original `react-json-view` (2021). — high
7. **Typed IPC → hand-rolled Zod + `ipcRenderer.invoke` behind `contextBridge`.** Both dedicated libs are stale (electron-trpc 0.7.1 = 2024-12, tRPC v10; @egoist/tipc = 2024-07) and drag in a tRPC/react-query paradigm that clashes with the Zod+RTK stack. One Zod schema per channel; `.parse()` in every `ipcMain.handle` (trust-boundary validation = security requirement); `z.infer` types the renderer wrapper. — high
8. **Persistence → hybrid: better-sqlite3 + Drizzle for metadata + FTS5; heavy event streams & thumbnails as external zstd/JPEG files in `userData`.** better-sqlite3 wins on stability + stable tooling + controlled build; macOS-first shrinks its only downside to one ABI. — high
9. **Corrected currency finding:** "node:sqlite has no FTS5" is **stale** — Node PR **#57621** (merged 2025-04-04) compiled FTS5 in; shipped Node 24.0.0, backported 22.16.0 → Electron 43's Node 24.18 **has** node:sqlite FTS5. FTS5 is no longer the differentiator; better-sqlite3 still wins on stability (node:sqlite = Stability 1.2 RC; Drizzle migrations for it only in `drizzle@1.0-rc`). **Revisit node:sqlite at Stability 2 + drizzle 1.0 GA.** — high
10. **License cliff:** **OpenReplay is AGPL-3.0** (per its own ToS; the `Apache-2.0` in `frontend/package.json` is unreliable boilerplate) — **do not copy its code** (clean-room ideas only). Playwright (Apache-2.0), rrweb (MIT), Chrome DevTools (BSD-3) are copy-safe; **replayio/devtools is dual MPL-2.0 + BSD-3** (MPL files = file-level copyleft — keep isolated, disclose changes). — high

### 4b. Code viewer (Q1)

Decoration-API fit (the discriminating axis): (a) full-line exec highlight = `Decoration.line` from a `StateField` (CM) vs `isWholeLine` decoration (Monaco) — tie, CM cleaner for replay-state-driven; (b) clickable breakpoint gutter = `gutter()` + `GutterMarker` + `domEventHandlers` — **CM6 wins**; (c) inline after-line value widget = `Decoration.widget({side:1})` → arbitrary DOM, exactly Chrome DevTools' approach — **CM6 wins** (Monaco needs fiddly content-widgets/view-zones or debug-only APIs); (d) dim skipped code = `Decoration.mark` + CSS opacity — tie. Bundle: CM6 read-only ≈ 50–120 KB gz, pure ESM, **no workers**; Monaco ≈ 2–5 MB + worker loader config that fights Vite/Electron `file://`/CSP (Bundlephobia's "20.8 KB" measures only the entry re-export). Wrappers: `@uiw/react-codemirror` 4.25.11 (2026-07-08, React 19 ✅) as shell, dropping to raw `EditorView.dispatch` for decoration effects. Shiki 4.3.1 gives VS-Code-identical coloring but you'd hand-build gutter/exec-line/widgets/dimming/virtualization — fallback only if pixel-exact coloring is a hard requirement; CM6's Lezer (`@codemirror/lang-javascript` 6.2.5, `{typescript:true, jsx:true}`) is what Chrome/Replay ship.

### 4c. Timeline, layout, lists, state, IPC (Q2/Q3/Q5)

**OSS timeline survey:** Playwright trace viewer = plain divs + `timeToPosition()`, no canvas/virtualization (works only because traces are sparse; its `setState`-per-`mousemove` playhead is the anti-pattern); its **filmstrip math** (`frameCount = width/tileSize` + `upperBound()` binary search) is directly reusable, Apache-2.0. Chrome devtools-frontend perf panel = **canvas flame chart + DOM overlays + math hit-testing + `TimelineMiniMap` density strips** — the pattern to imitate, too coupled to extract (BSD-3). rrweb-player = Svelte divs; port its seek/inactive-period/event-dot logic to React (MIT).

**Recommended 3-layer timeline:** ① static content canvas (lanes/dots/bars/ruler; redraw only on data/zoom/pan/resize; `devicePixelRatio`-scaled) ② dynamic overlay (playhead line + time bubble as absolutely-positioned DOM or thin 2nd canvas, moved via ref + `translateX` in one rAF loop — never React state) ③ React owns structure/legend/speed/committed selection. Hit-testing: one canvas listener → x→time, y→lane → binary-search the lane's sorted array. Filmstrip: screencast JPEGs → downscaled tiles → object-URLs (revoked on unmount), horizontal `@tanstack/react-virtual`. Density strips: per-lane time-bucket histograms precomputed per zoom level. Playhead drag: Pointer Events + `setPointerCapture`, commit on `pointerup` (or ~60–120 ms throttle for detail panes).

**Layout/shortcuts/lists (versions verified 2026-07):** react-resizable-panels 4.12.2 (2026-07-03, 33.4M/wk, React 19 ✅ — `collapsible`/`collapsedSize`/`ImperativePanelHandle`/`autoSaveId`) · allotment 1.20.5 (alive, slower — no advantage here) · dockview 7.0.2 (tabs/dock/float/serialize — escalation path) · react-hotkeys-hook 5.3.3 (space=play/pause, arrows=step) · cmdk 1.1.1 (⌘K; maintained-but-quiet, shadcn Command backbone) · react-virtuoso 4.18.10 · @tanstack/react-virtual 3.14.6.

**State & IPC:** playhead outside React (ref + emitter + `useSyncExternalStore` in leaf widgets adjacent to — not wrapping — the player, per Remotion's rule); coarse state → RTK + reselect. Optional sugar: a zustand vanilla store with transient updates — same result, not required. IPC: hand-rolled Zod v4 + `invoke`/`handle` behind `contextBridge` (see 4a-7); electron-trpc only if routers are truly wanted (treat as low-maintenance).

### 4d. Scope-tree inspector (Q4) & persistence (Q6)

**Inspector:** CDP returns `Runtime.getProperties(objectId)` → `PropertyDescriptor[]` of `RemoteObject{type, subtype, className, value, description, objectId, preview}` — **lazy, string-preview-based, expand-on-demand**. This favors a controlled async tree: **react-arborist** 3.13.2 (2026-07-05, 677K/wk, React 19 ✅, virtualized) where each node holds a `RemoteObject` and children resolve from recorded/live `getProperties` on expand; style with shadcn. **react-inspector** 9.0.0 (2.22M/wk) = instant DevTools look if scopes are shallow enough to materialize. Dead: `@devtools-ds/object-inspector` (2022), original `react-json-view` (2021). `chii`/`chobitsu` are CDP plumbing, not UI — not needed.

**Persistence foundations:** Electron 43.1.1 → Node 24.18 / Chromium 150. Engine matrix: **better-sqlite3 12.12.0** (2026-07-15, 7.6M/wk; E42/43 prebuilds; `@electron/rebuild` auto-runs `prebuild-install`; bundled SQLite 3.53.3 with FTS5; stable Drizzle `drizzle-kit` 0.31.10) ✅ recommended · node:sqlite (Node 24.18: **has FTS5** since the #57621 correction; zero native dep; but Stability 1.2 RC + Drizzle migrations only in pre-release — future default, not yet) · WASM sql.js/wa-sqlite (unfit for main-process multi-GB) · plain files (this IS the disk tier for streams).

Design specifics (all high confidence unless noted):
- **Hybrid BLOB strategy** (SQLite's own guidance: external files win above ~100 KB): event streams (10s–100s of MB) → external files always; thumbnails (5–40 KB) → external too (renderer loads via `file://`/custom-protocol path, no IPC blob bytes; DB stays low-MB). SQLite holds metadata + FTS index only. Layout: `userData/recordings/<id>/stream.jsonl.zst` + `…/thumbs/*.jpg` + `userData/library.db` (+`-wal`/`-shm`).
- **FTS5:** external-content (contentless) FTS5 table beside `recordings`; `event_text` distilled at finalize (console text/URLs/errors/DOM text); `bm25()` ranking; trigger-synced.
- **Crash-safe writes:** append **uncompressed** JSONL during capture; `fd.sync()` every N events/~1–2 s; on restart truncate a torn trailing line and replay counts; SQLite WAL (`journal_mode=WAL, synchronous=NORMAL`); **finalize** = stream→zstd, fsync, atomic rename, delete plaintext.
- **Compression:** `node:zlib` built-in **zstd** (`createZstdCompress`, native since Node 23.8/22.15 — no native dep; expected 70–88% on repetitive rrweb/CDP JSON — medium, benchmark). Caveat: node:zlib zstd is itself Stability 1 → **brotli (stable since Node 11.7) as conservative archival fallback**. Do NOT add `@mongodb-js/zstd` (reintroduces the rebuild tax).
- **Quota (mock: `1.9 GB / 5 GB · 7 録画`):** persist `size_bytes` per recording → `SUM(size_bytes)` is O(1); reconcile via `stat` lazily on startup. Soft warn 80% / hard 95%; sort-by-size + oldest-first eviction UI with byte labels; preview-before-delete; never auto-delete; optional partial evict (keep metadata+thumb, drop stream).
- **Export:** `.zip` + versioned `manifest.json` (Playwright `trace.zip` precedent). Node has no built-in zip container → **archiver 8.0.0** (create, streaming) + **yauzl/unzipper** (extract); avoid adm-zip for GB bundles; add already-zstd streams **stored** (no re-compress).
- **Settings:** electron-store 11.0.2 (pure ESM, fine in main) — but its `migrations` feature is author-documented as buggy → **hand-roll settings migrations**; keep library data out of it.

### 4e. Reference implementations & licenses (mine these)

| Product | Key paths | Viewer / timeline | License (verified) | Copy? |
|---|---|---|---|---|
| Playwright Trace Viewer | `packages/trace-viewer/src/ui/` (`timeline.tsx`, `filmStrip.tsx`, `workbench.tsx`) | CM v5 / DOM divs | Apache-2.0 | **YES** (keep NOTICE) — best filmstrip math + layout |
| replayio/devtools | `src/ui/components/Timeline/`, `packages/replay-next/components/{sources,inspector,console}` | CM6 / DOM scrubber | **dual MPL-2.0 + BSD-3** | **PARTLY** — MPL files stay MPL + disclose; check headers |
| OpenReplay | `frontend/app/components/Session_/Player/Controls/Timeline.tsx` | custom (rrweb) | **AGPL-3.0** (ToS; pkg.json boilerplate wrong) | **NO — clean-room only** |
| rrweb / rrweb-player | `packages/rrweb-player/` | Svelte divs `.rr-progress*` | MIT | **YES** — port logic to React |
| Chrome devtools-frontend | `front_end/panels/timeline/`, `ui/legacy/components/perf_ui/` | CM6 / canvas+overlay | BSD-3 | license YES, practically imitate-only |

### 4f. Stack → design-screen mapping, risks, open questions

| Design element | Stack mapping |
|---|---|
| **1a** bottom multi-lane timeline | hand-rolled Canvas 2D + DOM overlay playhead; Pointer Events + rAF; binary-search hit-testing; density histograms; playhead in ref/`useSyncExternalStore`, coarse index → RTK |
| **1b** transcript + mini seek bar | react-virtuoso (`scrollToIndex` + user-scroll guard); shadcn Toggle/Badge chips; DOM/SVG seek track with event dots (rrweb-player logic ported) |
| **1c** filmstrip + console/network panel | @tanstack/react-virtual horizontal strip over screencast JPEG tiles; react-virtuoso panels in shadcn Tabs |
| **1d** recording mode | live `<webview>`; sonner toasts; REC timer via ref+`useSyncExternalStore`; **append-only JSONL + fsync** while recording |
| **1e** library | shadcn Card/Sidebar/Badge; cmdk ⌘K over **FTS5 `bm25()`**; storage meter = `SUM(size_bytes)` vs quota; virtualized grid if large |
| **1f** empty state | plain shadcn Input/Button/Card; dev-server list ← main-process probe (§1d) |

Risks: better-sqlite3 rebuild on ~8-week Electron bumps (prebuilds + one macOS ABI + CI smoke test; node:sqlite escape hatch) · hand-rolled canvas timeline = biggest build cost (reuse Playwright math; MVP may start DOM/SVG at low density) · 60fps re-render storms (playhead out of RTK) · CM6 widget scale (viewport-only decorations, recompute per frame not per keystroke) · AGPL/MPL contamination (no OpenReplay code; isolate MPL) · node:zlib zstd experimental (brotli fallback) · electron-store migrations buggy (hand-roll).

Open (UI/persistence): replay mechanism for the "browser" pane — **answered by §2/§3/§5: rrweb Replayer (Mode A) + hidden re-execution (Mode B)** · export-bundle cross-version/machine portability policy (manifest schema-version + migrations) · thumbnail cadence/resolution (drives storage + quota math) · max events per recording (sets DOM→canvas threshold + FTS distillation aggressiveness) · VS-Code-exact coloring a hard requirement? (default: CM6 Lezer suffices) · pop-out panels wanted? (→ Dockview escalation) · CDP object-graph depth (tunes arborist lazy-expansion/memory).

---

## 5. Synthesis: Recommended Architecture & Roadmap

### 5a. The convergent conclusion

All four independent research streams arrived at the same spine, from different directions:

- §2 (recording): rrweb replay is a DOM reconstruction — **no page JS ever executes** → passive replay alone can never power a debugger.
- §3 (debugging): the mock's CALL STACK shows react-dom internals (`commitHookEffectListMount`, `flushPassiveEffects`) → only a **real `Debugger.paused`** produces that; recorded traces can't synthesize library internals.
- §1 (shell): independently derived "two distinct replay subsystems" as the architecture's spine; CDP gives trusted input replay + Fetch-domain network mocking — exactly the ingredients re-execution needs.
- §4 (UI): every serious replay debugger (Chrome DevTools, replayio, Playwright) already separates the scrub surface from the execution surface.

**Therefore: Entrance is two products sharing one timeline.**

- **Mode A — "the video" (always available, always correct):** rrweb passive replay + screencast filmstrip + recorded lanes (network/console/error from CDP). Seek is instant (FullSnapshot checkouts + rrdom virtual-dom). Code panel highlight during scrub comes from the **cheap always-on index**: CPU-profiler samples (function-level) + exact anchors (console/error/network initiator stacks) resolved through source maps.
- **Mode B — "enter the debugger" (on demand, per pause-point):** deterministic re-execution in a **hidden webContents**: determinism shims injected via `Page.addScriptToEvaluateOnNewDocument` (freeze `Date`/`performance.now`, seed `Math.random`/crypto, wrap timers/rAF), network served from the recording via `Fetch.fulfillRequest`, inputs re-dispatched via CDP `Input.dispatch*` (trusted, CSS px), **real `Debugger`** attached → pause/scopes/stepping exactly as in screen 1a. Divergence is detected (DOM checksum vs the rrweb spine) and surfaced honestly ("再現できない区間") rather than silently lied about.

This split also resolves §4's pivotal open question (what is the "browser" pane during replay): it is the **rrweb Replayer in a sandboxed iframe**, with the live `<webview>` used only while recording and the hidden webContents only for Mode B.

### 5b. Process architecture

```
┌─ MAIN PROCESS ───────────────────────────────────────────────────────────┐
│ CDP Orchestrator — one webContents.debugger client per target            │
│   record : Network(+durable bodies) · Runtime/Log · Page.screencast      │
│            Debugger.scriptParsed (source-map harvest) · Profiler samples │
│   replay : Fetch.fulfillRequest (mock) · Input.dispatch* (trusted)       │
│            Debugger (pause/step/scopes) — Mode B only                    │
│ Persistence — better-sqlite3+Drizzle (WAL, FTS5) · JSONL/zstd blob store │
│ Dev-server detector — HTTP probe 127.0.0.1+::1 + framework fingerprints  │
│ Store of record (library/groups/settings) → broadcast to windows         │
│ Zod-validated IPC surface (every ipcMain.handle .parse()s input)         │
├─ APP RENDERER (React 19 · Tailwind 4 · shadcn) ──────────────────────────┤
│ Library (1e) · Empty state (1f) · Recorder chrome (1d)                   │
│ Timeline: Canvas 2D lanes + rAF playhead overlay (1a/1b/1c projections)  │
│ CodeMirror 6 source pane · react-arborist SCOPE/CALL STACK               │
│ rrweb Replayer (sandboxed iframe) = the Mode A screen                    │
├─ <webview> partition=persist:target-N = LIVE TARGET (record time only) ──┤
│ preload: @rrweb/record → batched IPC                                     │
├─ hidden webContents = MODE B SANDBOX (on demand) ────────────────────────┤
│ determinism shims · mocked network · re-dispatched input · real debugger │
└──────────────────────────────────────────────────────────────────────────┘
```

Data flows into one **time-indexed event store** (`.entrance` bundle, §2f): `manifest.json` + `events.jsonl` (rrweb spine) + `transcript.jsonl` + `network.jsonl` + `bodies/<sha1>` + `console.jsonl` + `errors.jsonl` + `profile.jsonl` + `sourcemaps/<hash>/` + `thumbs/`. The three replay layouts (1a/1b/1c) are pure projections of this store.

### 5c. Unified stack (final picks)

| Concern | Pick | Verified version (2026-07) |
|---|---|---|
| Runtime | Electron | 43.x (Chromium 150 / Node 24.18) |
| Scaffold/build | electron-vite + electron-builder; pnpm `node-linker=hoisted` | 5.0.0 / 26.x |
| Signing | @electron/rebuild · @electron/notarize (+ allow-jit entitlements) | 4.2.0 / 3.1.1 |
| Embed | `<webview>` behind `EmbeddedTarget` abstraction (flip-gate → WebContentsView) | — |
| DOM record/replay | @rrweb/record · @rrweb/replay · @rrweb/packer · rrdom | 2.1.0 |
| Net/console/frames | CDP Network(+durable) · Runtime/Log · Page.startScreencast | proto 1.3 |
| Time→code index | CDP Profiler sampling (always-on) · Tracing `v8.cpu_profiler` lines[] (opt-in) | — |
| Debugger (Mode B) | hidden webContents + Fetch.fulfillRequest + Input.dispatch* + Debugger + shims | — |
| Source maps | @jridgewell/trace-mapping (harvest via Debugger.scriptParsed) | — |
| Code viewer | CodeMirror 6 via @uiw/react-codemirror (raw dispatch for decorations) | CM view 6.43.6 / wrapper 4.25.11 |
| Scope tree | react-arborist (lazy RemoteObject tree) | 3.13.2 |
| Timeline | hand-rolled Canvas 2D + rAF DOM overlay (Playwright filmstrip math, Apache-2.0) | — |
| Lists | react-virtuoso · @tanstack/react-virtual | 4.18.10 / 3.14.6 |
| Layout / shortcuts / ⌘K / toasts | react-resizable-panels + shadcn Tabs · react-hotkeys-hook · cmdk · sonner | 4.12.2 / 5.3.3 / 1.1.1 |
| State | RTK + reselect (coarse) · ref+`useSyncExternalStore` playhead (60fps) | — |
| IPC | contextBridge + invoke + **Zod 4** schemas (hand-rolled) | — |
| DB | better-sqlite3 + drizzle-orm/kit · WAL · FTS5 `bm25()` | 12.12.0 / 0.45.2 / 0.31.10 |
| Blobs | userData files: `stream.jsonl` → zstd (node:zlib; brotli fallback) · JPEG thumbs | — |
| Export | `.entrance` zip — archiver (write) · yauzl (read) · versioned manifest | 8.0.0 |
| Settings | electron-store (hand-rolled migrations) | 11.0.2 |

### 5d. Cross-agent conflict resolutions

1. **`<webview>` vs WebContentsView** — resolved to **`<webview>` default** (§1): Radix-portal clipping over a native view (electron#49039, no per-view click-through) breaks a shadcn-dense DevTools UI, while the CDP pipeline is identical either way. Reversible via the `EmbeddedTarget` abstraction; flip-gate criteria documented in §1e.
2. **Cross-window state**: §1 suggested `@zubridge/electron`; §4 recommended nothing new. **Start hand-rolled** (main-process store + typed-IPC broadcast — small surface, no dependency risk); adopt zubridge only if boilerplate demonstrably hurts. Non-negotiable either way: the 60fps playhead never touches Redux (§4a-3).
3. **Filmstrip source**: §4 assumed `capturePage()` polling; §1 showed `Page.startScreencast` is GPU-composited, throttleable, and rides the same CDP session. **Screencast is primary**; `capturePage` only for library-card thumbnails.
4. **tRPC-style IPC**: §1 allowed it for complex surfaces; §4 showed both libs are stale. **Skip** — hand-rolled Zod channels only.
5. **rrweb network plugin**: §2 confirmed it does not exist as first-party OSS → network capture is **CDP-only**, which is also strictly better (bodies + initiator stacks).
6. **Console capture**: prefer CDP `Runtime.consoleAPICalled`/`exceptionThrown` over the rrweb console plugin (same channel as everything else, real stack traces for source-mapping), keeping rrweb purely for DOM/interaction.

### 5e. Feature feasibility verdict (vs the original brief)

| Brief requirement | Verdict | How |
|---|---|---|
| Electron app whose main window is a browser | ✅ straightforward | `<webview>` + hiddenInset chrome (§1) |
| Open local dev server (Next.js etc.) | ✅ straightforward | probe + fingerprint auto-detection (§1d), screen 1f |
| Rec → record arbitrary operations | ✅ solid | rrweb + CDP capture pipeline (§2) |
| Replay like a video, unlimited times | ✅ solid | Mode A: rrweb replay, checkout-based instant seek (§2) |
| Seek-bar UI to jump anywhere | ✅ solid | canvas timeline + rrweb `play(offset)` w/ virtual-dom (§2/§4) |
| Source-map'd code panel, highlight synced to playback | 🟡 two-tier | always-on: function-level (profiler) + exact at anchors; line-exact everywhere requires Mode B or v2 instrumentation (§3) |
| Pause → inspect variables, step through code | 🟠 hardest — feasible | Mode B deterministic re-execution + real CDP Debugger; honest-divergence UX (§1/§2/§3) |
| Recordings grouped, named, saved without limit | ✅ straightforward | SQLite+FTS5+quota+blob store (§4), screen 1e |

### 5f. Validation spikes (do these before committing the architecture)

1. **CDP smoke test**: attach `webContents.debugger` to a `<webview>`-hosted Next.js app; enable Network+Runtime+Debugger+screencast concurrently; measure overhead & event volume. *(Validates §1; kills the project early if the single-client model fights back.)*
2. **Determinism rate**: record a 60-second session on a demo Next.js dashboard; re-execute with Fetch mock + shims ×20; measure DOM-checksum divergence per segment. *(Sets honest expectations for Mode B; decides how prominent "re-run from here" can be in the UI.)*
3. **Anchor-highlight pipeline end-to-end**: console/error/network stacks → `@jridgewell/trace-mapping` → CM6 line decoration, against both webpack and Turbopack dev servers. *(Validates §3's cheap tier — this is most of the perceived "magic" during scrubbing.)*
4. **rrweb 2.1 fidelity** on App Router + streaming SSR + a canvas widget + a shadow-DOM component. *(§2 risk list.)*
5. **Radix-over-`<webview>`**: confirm portals/popovers/context-menus render above the guest and receive input on macOS. *(Guards the §5d-1 decision.)*

### 5g. Phased roadmap

- **P0 — Walking skeleton**: electron-vite scaffold · library/recorder windows (hiddenInset, vibrancy) · `<webview>` embed + `EmbeddedTarget` · CDP attach + detach handling · dev-server detection · screen **1f**. *(Spikes 1 & 5 fold in here.)*
- **P1 — Record (screen 1d)**: rrweb preload + batched IPC · CDP Network/Runtime/Log capture · screencast thumbnails · crash-safe JSONL writer + fsync cadence · stop → finalize `.entrance` (zstd, manifest, FTS distillation) · live toast feed + REC status bar.
- **P2 — Replay Mode A (screens 1b, 1c, 1e + most of 1a)**: rrweb Replayer pane · canvas timeline (may start DOM/SVG at low density) · transcript with seek-follow · filmstrip · console/network panels · CM6 source pane with **anchor-based highlight** (source-mapped error/console/network stacks) · library with groups, ⌘K FTS5 search, storage meter/eviction · export/import.
- **P3 — Debugger Mode B (completes 1a)**: hidden-webContents re-execution harness (shims, Fetch mock, input re-dispatch, run-to-anchor) · pause/step/scopes UI (react-arborist over `Runtime.getProperties`) · breakpoints incl. Nth-hit via conditional counters · divergence detection + honest UX · always-on profiler tier for scrub highlight.
- **P4 — v2**: line-level time index via Tracing `lines[]` · focused-region omniscient value tracing (Wallaby-style bounded) · ECMA-426 scopes adoption · multi-target/simultaneous recordings · light theme + Tweaks · Playwright-driven QA of the app itself.

**v1 = P0–P3.** P2 alone already ships a genuinely useful product (video-like replay + source-mapped anchors); P3 is the differentiator and the riskiest — keep it strictly behind the Mode A safety net so the app never *depends* on re-execution succeeding.

### 5h. Consolidated top risks

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| 1 | Mode B nondeterminism (timers/random/server state/WS) | 🔴 | Fetch replay + shims; segment classification; divergence detection; honest UX; spike #2 gates scope |
| 2 | Scrub-highlight expectation vs function-level reality | 🟠 | anchor-exact + function-level default; set UX language ("実行中の関数"); v2 line index |
| 3 | Radix clipping / embed choice regret | 🟠 | `<webview>` default + `EmbeddedTarget` abstraction + spike #5; documented flip-gate |
| 4 | rrweb coverage gaps (canvas/iframe/shadow DOM) | 🟠 | spike #4; screencast filmstrip as visual fallback lane |
| 5 | CDP single-client + DevTools detach | 🟡 | own inspector; suppress DevTools on targets; `'detach'` recovery |
| 6 | Body eviction / storage explosion | 🟡 | durable messages, size caps + sha-1 dedupe, quota/eviction UI |
| 7 | Native-module × Electron cadence | 🟡 | prebuilds, one macOS ABI, CI smoke per bump, node:sqlite escape hatch |
| 8 | License contamination (AGPL OpenReplay / MPL replayio) | 🟡 | copy only Apache/MIT/BSD sources; clean-room elsewhere |

### 5i. Open questions (user decisions)

1. **v1 scope of the debugger**: is Mode B (pause/variables/stepping) required for the first release, or does P2 (video replay + anchor-exact code highlight) ship first? *(Biggest schedule lever.)*
2. **Highlight granularity**: during scrubbing, is always-on **function-level** highlight acceptable (line-exact at anchors/pauses only), or is per-line the bar — which forces v2 instrumentation earlier?
3. **Client-only v1?** RSC/server-side code debugging (Node inspector, server source maps) is a much larger surface — recommend explicitly out of scope for v1.
4. **Floating overlays over the embedded viewport** — needed (locks `<webview>`) or avoidable (reopens WebContentsView)?
5. **Export portability**: must `.entrance` bundles open across machines/versions from day one (manifest migrations, sourcemap bundling policy)?
6. **Target apps beyond Next.js** for v1 (Vite/Storybook appear in mock 1f) — affects fingerprinting, source-map handling, and QA matrix breadth.

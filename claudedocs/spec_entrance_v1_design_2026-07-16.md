# Entrance v1 — Record & Replay Debugger for Local Dev Servers (Design Doc)

> Spec synthesized 2026-07-16 from the ratified grilling-session decisions (14 decisions, do not re-litigate) and the research report `claudedocs/research_entrance_electron_record_replay_2026-07-16.md` (§5 first). Design mock: `Entrance (standalone).html` — screens 1a (replay+debugger), 1b (transcript), 1c (filmstrip), 1d (recording), 1e (library), 1f (empty state).
>
> Triage: `ready-for-agent`

## Problem Statement

Frontend bugs die with the moment that produced them. Today, when something goes wrong in a dev server session, the developer must notice it live, then reproduce it under a debugger — but transient bugs (race conditions, effect-order surprises, one-off API responses, input-timing issues) rarely reproduce on demand. Console output scrolls away, network responses are gone, and the DOM state at the failing instant no longer exists. Screen recordings capture pixels but not variables. Session-replay tools (rrweb-style) can show the DOM again, but you cannot pause *into the code*: no call stack, no scopes, no stepping, because replay never executes the page's JavaScript.

The result: developers re-run flows over and over hoping to catch the bug live, or give up and add speculative logging. The runtime context — *what exactly was my code doing at that moment, with what data* — is unrecoverable.

## Solution

Entrance is an Electron app whose main window **is** a browser. The developer opens their local dev server in it (Next.js first-class, Vite best-effort), hits **Rec**, and uses their app normally. Afterwards they replay the session **like a video with a seek bar** — DOM, network requests with bodies, console output, errors, and a screencast filmstrip, all indexed on one timeline — while a source-map-powered debugger panel highlights the code that was executing at the playhead.

When video-style replay is not enough, one click switches to a **real debugger on the recorded moment**: Entrance deterministically re-executes the session in a hidden browser context (network answered from the recording, inputs re-dispatched as trusted events, time and randomness pinned) and attaches a genuine debugger — pause, inspect real variables and closures, walk the full call stack (including framework-internal frames), and step. When a segment cannot be reproduced deterministically, Entrance says so honestly and falls back to video replay — it never silently shows wrong state.

Recordings are named, grouped, searchable, stored locally under a quota, and exportable as portable `.entrance` bundles.

## User Stories

**Getting started (screen 1f)**

1. As a frontend developer, I want Entrance to auto-detect dev servers already running on my machine and list them, so that I can start without typing URLs or configuration.
2. As a frontend developer, I want to open a detected dev server inside Entrance's browser viewport with one click, so that my normal develop-in-browser workflow is unchanged.
3. As a frontend developer, I want a clear empty state that explains what Entrance does and shows detected servers, so that first launch is self-explanatory.
4. As a Next.js developer, I want my dev server recognized as Next.js (webpack dev and Turbopack alike), so that source maps and framework specifics work without setup.
5. As a Vite user, I want my dev server to work on a best-effort basis, so that Entrance is still useful outside Next.js.

**Recording (screen 1d)**

6. As a frontend developer, I want recording to start only when I explicitly press **Rec**, so that nothing is captured without my intent.
7. As a frontend developer, I want a visible recording indicator with elapsed time while recording, so that I always know capture is active.
8. As a frontend developer, I want the recording to capture DOM changes, my mouse/keyboard inputs, network requests **including response bodies**, console output, uncaught errors, and periodic screen frames, so that replay is complete enough to debug from.
9. As a frontend developer, I want to keep interacting with my app at full speed while recording, so that recording never distorts the behavior I am trying to capture.
10. As a frontend developer, I want to stop recording and have the session saved automatically, so that I cannot lose a capture by forgetting to save.
11. As a frontend developer, I want to name a recording and assign it to a group when (or after) I save it, so that sessions stay organized by feature or bug.

**Video-style replay — Mode A (screens 1a, 1b)**

12. As a frontend developer, I want to replay a session like a video with play/pause and a seek bar, so that I can review what happened at my own pace.
13. As a frontend developer, I want seeking to be instant at any point on the timeline, so that scrubbing feels like a video editor, not a page reload.
14. As a frontend developer, I want timeline lanes marking network activity, console messages, and errors, so that I can jump straight to the interesting moments.
15. As a frontend developer, I want a filmstrip of screen thumbnails along the timeline, so that I can find a moment visually before scrubbing.
16. As a frontend developer, I want to click any network entry and inspect its request/response headers and bodies as they were during recording, so that I can verify what the server actually returned.
17. As a frontend developer, I want the console output shown as it existed at the playhead time, so that logs line up with what I see on screen.
18. As a frontend developer, I want a transcript view (screen 1b) listing every event chronologically — clicks, navigations, requests, logs, errors — so that I can read the session like a log and click any row to jump the playhead there.
19. As a frontend developer, I want the code panel to highlight, at function granularity, the code that was running as I scrub, so that I always have an approximate "you are here" in my source.
20. As a frontend developer, I want line-exact code highlights at anchor moments (errors, console calls, network request initiations) with their captured stacks, so that hot spots point at the precise line.
21. As a frontend developer, I want all code shown as my original TypeScript/JSX via source maps — never bundle output — so that what I read is what I wrote.
22. As a frontend developer, I want to replay sessions with the dev server stopped or the code since changed, so that yesterday's bug is still debuggable today.

**Real debugging — Mode B (completes screen 1a)**

23. As a frontend developer, I want to pick a moment in the replay and enter debug mode there, so that I can inspect the real program state at that instant.
24. As a frontend developer, I want to see actual variable values, scopes, and closures at the paused point, so that I can confirm or refute my hypothesis about the bug.
25. As a frontend developer, I want the full call stack including framework-internal frames (e.g. react-dom commit phases), so that I can see how my code was reached.
26. As a frontend developer, I want to step (over/into/out) and resume from the paused point, so that I can follow the logic forward from the failure.
27. As a frontend developer, I want to set breakpoints in my original source and re-run the recorded session into them, so that I can stop exactly where I choose.
28. As a frontend developer, I want re-execution to be fed by the recording (same network responses, same timing seeds, same inputs), so that the replayed run behaves like the recorded one.
29. As a frontend developer, I want Entrance to tell me clearly when re-execution diverged from the recording and cannot honestly reproduce a segment, so that I never debug against false state.
30. As a frontend developer, I want an obvious way back to video replay when debug mode diverges, so that I always retain the ground-truth view.

**Library & storage (screen 1e)**

31. As a frontend developer, I want a library of my recordings, grouped and named, with search, so that I can find last week's session in seconds.
32. As a frontend developer, I want to rename, regroup, and delete recordings, so that the library stays curated.
33. As a frontend developer, I want a storage meter and a configurable quota (default 5 GB), so that recordings never silently fill my disk.
34. As a frontend developer, I want to export a recording as a single `.entrance` file and import one back, so that sessions can be archived and moved.

**Trust, safety & platform**

35. As a frontend developer, I want recorded page content isolated and sanitized inside Entrance, so that replaying a session from a compromised or hostile page cannot harm my machine.
36. As a frontend developer, I want Entrance's own panels, menus, and popovers to always render and receive clicks above the embedded page, so that the app UI never loses to the content it hosts.
37. As a frontend developer, I want Entrance to provide its own inspector panels rather than requiring Chrome DevTools on the recorded page, so that recording is never broken by opening DevTools.
38. As a macOS developer, I want a signed and notarized app, so that installation is frictionless and trusted.
39. As a Japanese-speaking developer, I want the app UI in Japanese, so that the tool matches its primary audience (mock language).
40. As a frontend developer, I want the whole app in a single window that transitions between library and recorder, so that I never manage window sprawl.

## Implementation Decisions

All decisions below were ratified in the 2026-07-16 grilling session. **Do not re-litigate.**

1. **Two-mode hybrid architecture** sharing one time-indexed event store (the `.entrance` bundle). Mode A (passive replay) is always available and always correct; Mode B (deterministic re-execution debugging) is on-demand. Rationale: passive replay never executes page JS, so real variables/stacks require re-execution; Mode A remains the permanent safety net.
2. **Mode A** composes rrweb 2.1.0 passive DOM replay with CDP-recorded lanes (network with bodies, console, errors) and a screencast filmstrip. Seek is instant; no page JS runs.
3. **Mode B** re-executes in a hidden browser context: determinism shims injected before any page script (pin Date/performance.now, seed Math.random, wrap timers/rAF); network served from the recording via CDP fetch interception; inputs re-dispatched via CDP input domain (trusted events, CSS-pixel coordinates — never JS-synthesized events); a real CDP Debugger attached for pause/scopes/stepping. Navigation is blocked and network is always mocked during re-execution because trusted input causes real side effects.
4. **Divergence handling**: detect via DOM checksum comparison against the rrweb event spine; surface honestly with a "cannot reproduce this segment" UX and a one-click return to Mode A. Never silently wrong.
5. **Code highlight is two-tier**: always-on function-level highlighting from CPU-profiler sampling during recording, plus line-exact highlights at anchors (error/console/network-initiator stacks), plus full line precision when paused in Mode B. No build-time instrumentation in v1.
6. **Source maps**: harvested at record time from script-parse events and bundled into the recording; resolved with a trace-mapping library so replay works after the dev server is gone or the code has changed.
7. **Embedding**: `<webview>` tag behind an `EmbeddedTarget` abstraction. Chosen because DOM-overlay portals (popovers/menus) composite correctly over `<webview>` but are clipped behind WebContentsView (no per-view click-through upstream). The abstraction keeps a WebContentsView flip reversible; the CDP pipeline is identical either way.
8. **Sole CDP client rule**: Entrance's debugger attachment is the only CDP client on a recorded target; built-in DevTools must never be opened on it (attaching DevTools detaches our session). Entrance ships its own inspector UI.
9. **Screencast frames** come from the CDP page-screencast (JPEG, every-Nth-frame) on the same CDP session — not window-capture polling.
10. **Network bodies** are captured via the CDP Network domain with durable message retention (bodies evict otherwise); interception-point capture is the fallback.
11. **Dev-server detection**: HTTP probe from the main process (no CORS constraints) against localhost on both IPv4 and IPv6; any HTTP status counts as alive; framework fingerprints distinguish Next.js (webpack vs Turbopack variants), Vite, and Storybook.
12. **Process/UI architecture**: single Electron window; the state of record lives in the main process; renderer talks to main exclusively through a context-bridged, invoke-based IPC layer where **every** handler validates its payload with Zod schemas shared from a common types package.
13. **`.entrance` bundle format**: a zip container holding a manifest with `schemaVersion`, time-indexed event lanes as JSONL compressed with zstd, network bodies and screencast frames as external blob entries, and harvested source maps. Designed portable (self-contained), but v1 QA guarantees replay only on the same machine and app version.
14. **Persistence**: SQLite (WAL mode) via Drizzle for recording metadata, groups, and FTS5 search; event lanes and blobs live as external files under the app's user-data directory, referenced from the DB. Storage quota defaults to 5 GB, user-configurable, with a meter in the library.
15. **UI stack**: shadcn/ui **Base UI edition** components; CodeMirror 6 for the code panel; react-arborist for the library tree; a hand-rolled Canvas-2D timeline where the playhead updates via ref + `useSyncExternalStore` (playhead position never enters Redux); react-virtuoso for long lists (transcript, console); react-resizable-panels for layout; Redux Toolkit + reselect for app state.
16. **Project shape**: single package (main / preload / renderer / shared source roots) on electron-vite; scaffolded from the shadcn Vite template then converted. No monorepo (packager × workspace fragility). pnpm with hoisted node linker; native modules unpacked from the app archive at build.
17. **Recording trigger**: explicit Rec button only. No ring buffer, no auto-record in v1.
18. **Replay layouts**: screens 1a and 1b ship in v1; screen 1c's filmstrip ships as a timeline lane inside 1a rather than a separate layout.
19. **Scope of debugging**: client-side JavaScript only in v1; server behavior is observed through the network lane.
20. **Localization & platform**: app UI in Japanese; code, docs, and identifiers in English; macOS-first with signing/notarization in v1.
21. **Security posture**: recorded content is hostile input — sanitize on render, never evaluate recorded strings, per-target isolated persistent sessions, all privileged work in the main process.
22. **Build order**: P0 walking skeleton (scaffold, embed + `EmbeddedTarget`, CDP attach smoke test, dev-server detection, screen 1f) → P1 record (1d) → P2 Mode A replay + library (1b, 1c-lane, 1e, most of 1a) → P3 Mode B debugger (completes 1a). Mode B's Go/No-Go gate is the determinism-rate spike.

## Testing Decisions

**What makes a good test here**: assert observable behavior at a seam, never implementation internals. Per house style: DAMP over DRY; hard-coded expected values; AAA structure with explicit `// Arrange / // Act / // Assert` comments; test names state the observable behavior/spec that breaks (e.g. "seeking to an error marker highlights the throwing line"), so a failure names the broken feature.

**Seams (confirmed with the owner, 2026-07-16)** — two seams total:

1. **Primary seam: the `.entrance` bundle** (the time-indexed event store both modes share). Everything upstream and downstream of it is tested through it:
   - *Replay side*: golden fixture bundles checked into the repo → assert reconstructed DOM/lane state at time T, anchor highlight targets, transcript contents, Mode B pause/scope/step results, and divergence detection verdicts.
   - *Record side*: a scripted interaction against a fixture Next.js dev server → assert the produced bundle's manifest, lane completeness, body capture, and source-map presence.
   - This seam makes the hard logic (source-map resolution, determinism shims, divergence checksums, timeline indexing) testable fast and deterministically, without a live browser in most cases.
2. **Umbrella seam: the app boundary** via Playwright driving the packaged Electron app against the fixture dev server — thin, happy-path only: the P0 acceptance flow (launch → detect server → embed → CDP attach streams events → popover renders above the embedded page) and one end-to-end record→replay pass. Animations/transitions are verified by recorded video with frame extraction, per house QA convention.

**Prior art**: none — the repo is greenfield (research report only). Conventions above are imported from Laststance house standards rather than existing tests.

**Spikes double as tests**: spike #1 (concurrent CDP domain attach on a Next.js dev server) becomes the E2E smoke test; spike #2 (determinism rate) is built as a measurable harness over fixture bundles whose pass-rate number is the Mode B Go/No-Go input.

## Out of Scope (v1)

- Server-side / Node.js debugging (Node inspector integration is v2; server behavior is visible only via the network lane).
- Ring buffer / always-on retroactive recording (v2 candidate; v1 is explicit Rec only).
- Screen 1c as a standalone filmstrip layout (its filmstrip ships as a 1a timeline lane).
- Storybook as a first-class target (v2).
- Cross-machine / cross-version replay guarantees (the bundle is designed portable, but v1 QA covers same machine + same app version only).
- Windows and Linux packaging/signing.
- Build-time code instrumentation for highlight precision.
- WebContentsView migration (the abstraction keeps it possible; no v1 work).
- Multi-window UX.
- Any copying from AGPL-licensed replay products; MPL-licensed reference code stays isolated. Allowed imitation sources: Playwright (Apache-2.0), rrweb (MIT), Chrome DevTools (BSD-3, imitate).

## Further Notes

- **Go/No-Go gate**: Mode B ships in v1 only if the determinism-rate spike clears; if it fails, v1 ships Mode A + the two-tier highlight, and Mode B moves out. Mode A is the permanent fallback either way.
- **Validation spikes before deep commitment** (research report §5f): determinism rate, anchor-highlight pipeline, rrweb fidelity on the target apps, portal-over-webview behavior.
- **P0 acceptance criteria**: app launches (Electron 43, hiddenInset traffic lights); detects a running Next.js dev server and lists it on screen 1f; embeds it; CDP attaches and streams network/console events to a renderer log; Base UI popovers render above the embedded viewport and receive clicks.
- **Design source of truth**: the 6-screen standalone HTML mock; UI text in Japanese as mocked.
- This document is the spec of record derived from the research report + grilling session; the project handoff file summarizes the same decisions for session bootstrap. If they ever disagree, the grilling-session decisions win.

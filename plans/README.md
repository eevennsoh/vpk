# Jira Team EU26 performance plan

Prepared 12 September 2026 for the `/jira-team-eu26` route.

**Implementation update:** the fixes were implemented, verified and delivered through [PR #1730](https://github.com/eevennsoh/vpk/pull/1730) on 13 September 2026 (Australia/Sydney). See [measured results and validation](IMPLEMENTATION.md). List switching median improved from 188 to 136 ms; Board from 152 to 128 ms in the controlled development comparison. Production/field measurements remain pending.

The original plans below aimed to make Board, List, agent sessions and Rovo feel immediate by reducing the work on their interaction paths. They preserve the audit's proposed sequence and acceptance criteria; the subsequent implementation, measurements and delivery are recorded in IMPLEMENTATION.md.

## Scope and evidence

Audited the live route and its project owner, shared board/list components, chat mounting and context, proximity handlers, and existing performance tooling. The linked worktree was at commit `d35d42fc0`. The persistent checkout was `9b583cdc8`; a diff found no differences in the project, board/list, chat context, shell, and chat playback paths cited here. Recheck both revisions before implementation.

Browser: desktop Chromium, 1200 × 803 CSS pixels, DPR 2, localhost, no deliberate CPU/network throttle. Development Next.js, React DevTools instrumentation, and React Grab were present. Cache state was not controlled. These are diagnostic observations, not production benchmarks or field INP percentiles.

| Observed action/state | Evidence | Interpretation |
| --- | --- | --- |
| Board → List | Click Event Timing durations 480 ms first sample, 304 ms repeat | Highest-confidence interaction to investigate first |
| List → Board | 416 ms and 336 ms | Warm switching still does substantial work |
| First Board → List | 396 ms long task; about 394 ms click processing; attributed frame included 47 ms forced layout inside React dispatch and about 25 ms React Grab work | Both rendering and development instrumentation contribute; attribution does not identify a specific component by itself |
| Board card selection | 24 ms for PAY-118 | Not every action is slow; this route selects the card rather than opening a work-item detail |
| Confirmed floating chat opening | 224 ms click sample; two contenteditable editors, one inside an inert ancestor | Hidden sidebar chat remains mounted alongside floating chat |
| Initial page observations | LCP 2.364 s in one sample; later saved sample 1.652 s, FCP 0.784 s, TTFB 0.193 s | Variation and development mode make a controlled production baseline necessary |
| Rendered surface | 2,554 DOM elements on initial board; 3,153 in List after simulated arrivals | Investigate component cost before adding virtualization |
| Resources | 143 script resource entries; roughly 53.6 MB decoded development script bodies in the earlier sample | Includes development/source-map overhead and cached assets; not shipped production bytes or actual network transfer |

Evidence is disposable under `output/agent-browser/eu26-performance/`: `interactions.json`, `resources.json`, `vitals.json`, `list-render.json`, `list.png`, `chat-open.png`. Event observer delivery is asynchronous: use event target/interaction ID, not sample bucket labels, to attribute clicks; deduplicate repeated IDs. The long render recording mixes idle time and interactions, so its aggregate counts are not a per-click cost or reliable proof of an idle loop. `chat.png` predates confirmed opening and should not be used as chat proof.

Focused baseline validation: **90 tests passed** across project list models, session sync, presentation story, shared List contracts, and create-well proximity. Full lint/typecheck, production build, full browser suite, drag/resize profiling, and live backend streaming were not run in this planning audit.

## Recommended order

| Order | Plan | Expected benefit | Effort | Risk / confidence | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | [001 — Establish route and interaction budgets](001-eu26-baseline.md) | Reliable decisions and regression detection; existing default budgets omit EU26 | 1–2 days | Low / high | Interaction harness complete; production budgets pending |
| 2 | [002 — Stop mounting unused chat and defer optional UI](002-eu26-demand-loading.md) | Less startup work and fewer duplicate editors/message renderers | 1–2 days | Medium / high for mounting | Implemented; editor-count regression verified |
| 3 | [003 — Contain Board/List rendering](003-eu26-rendering.md) | Faster view changes, hover, selection and draft typing | 2–3 days | Medium / measured warm-view benefit | Implemented and measured |
| 4 | [004 — Bound proximity work to frames](004-eu26-pointer-work.md) | Smoother pointer movement and drag interaction | 0.5–1 day | Medium / frame-bound work verified | Implemented; drag regressions pass |
| 5 | [005 — Isolate chat updates from the workspace](005-eu26-chat-subscriptions.md) | Board remains responsive while agent replies update | 2–3 days | Higher shared blast radius / controls contract verified | Narrow controls context implemented |

Dependency: **001 → 002 → 003 → 004 → 005**. Rebaseline after every accepted change; 005 is conditional on a playback/streaming trace. Effort is provisional, including validation, not a promised schedule. Start with 001–003 as the first delivery milestone.

## Definition of “snappy”

Proposed acceptance targets, to calibrate against representative hardware:

- Visible acknowledgement of click/typing within 100 ms; completed warm view changes and chat opening within 200 ms at lab p95. Measure acknowledgement and usable-content completion separately so a spinner cannot pass as a fast interaction.
- Field p75 INP ≤200 ms, LCP ≤2.5 s and CLS ≤0.1 if the prototype is deployed to real users. Lab click samples are not substitutes for field INP.
- Sustained drag/scroll near the display refresh rate; at 60 Hz, aim for ≤16.7 ms frames and no repeated >50 ms tasks during a fixed interaction sequence.
- Unrelated board/list rows do not commit on chat text-only updates or movement within an unchanged hover zone.
- Record compressed transfer, decoded JS, mount count, DOM count and retained heap independently. Set EU26 byte/heap ceilings from a production baseline, not the development 53.6 MB figure.
- Keep an optimization only when repeated identical runs improve beyond normal variance and all behavior checks pass. Suggested first experiment threshold: at least 20% lower median on its identified slow path, without worsening tail latency, first-use latency or memory materially. Absolute interaction targets remain the end goal.

## Full-project coverage matrix

Run the current 20-work-item fixture, the full finite session-arrival sequence, and isolated 100/500-item stress fixtures. Do not change the presentation dataset to manufacture an improvement. Include empty/no-match states and long titles.

| Journey | What to measure / preserve |
| --- | --- |
| Cold open and warm reload | Route JS waterfall, LCP, usable board readiness, fonts/images, main-thread startup |
| Board ↔ List; other tabs and return | Mount/commit/layout cost, selection/order/filter and scroll continuity |
| Search, assignee/status filters, menus | Per-keystroke latency, matching correctness, Escape and keyboard focus |
| Create draft, edit fields, selection | Typing echo, commit scope, draft position and preserved values |
| Card/session drag, link/unlink, reorder | Frame time, geometry reads, valid targets, cancellation, cohort order, row flash |
| Session rail expansion and resize | Long-title wrap at rest, hover/focus actions, sticky footer, panel underlap and scroll bounds |
| Smart Link and session flyouts | First/warm opening latency, focus return, reduced motion |
| Chat closed/floating/sidebar, playback | Active renderer count, draft/history retention, board responsiveness during updates |
| Idle and repeated open/close cycles | Timers, listeners, observers, heap returning toward baseline; no ongoing work in hidden panels |
| Backend-dependent flows, if exercised | Separate request/first-byte/model-first-token/render times, cancellation and errors; no sending to external services merely for a benchmark |

## Considered and deferred

- **Blanket virtualization:** only 20 work items currently. First fix redundant work. Consider windowing at larger supported sizes only if mounting/layout remains dominant; preserve variable heights, sticky columns, accessibility and offscreen drag targets.
- **Broad memoization or React Compiler enablement:** no blanket change. Profile a specific boundary, stabilize its inputs, and prove a gain. Do not retain complexity with neutral results.
- **Removing session timers:** the fixture already pauses on hidden documents and stops after its finite queue. Preserve its visible behavior.
- **Removing Pulse data entirely:** EU26 disables Insights, but timeline data also feeds sessions. Defer the optional view implementation, retaining required data.
- **Adding database indexes, Redis, service workers or generic caching:** no measured backend bottleneck was established. Current board/list fixtures are local data.
- **Turning off all animation:** preserve intentional feedback and reduced-motion behavior. Trace the affected layout/paint path first.
- **Changing the shared registry or image pipeline globally:** route loading is already cached/dynamic; static export deliberately uses unoptimized images. Only change a verified EU26-reachable cost, with shared-route checks.
- **Existing browser tests as unquestioned truth:** `tests/projects/jira-team-eu26-hotfix-story.spec.ts` still expects old tab/sidebar structure in some cases. Reconcile each assertion against the intended current contract; never weaken an invariant to get green tests.

The initial audit changed no application source; the subsequent implementation is documented in IMPLEMENTATION.md. Security, dependency upgrades, database query plans and deployment/network performance remain outside scope.

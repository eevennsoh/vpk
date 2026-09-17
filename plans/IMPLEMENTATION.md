# EU26 performance implementation — 12 September 2026

Implemented in a linked worktree on `codex/eu26-performance`.
Previewed on that worktree's Portless URL at `/jira-team-eu26`.
At the initial measurement stage, the persistent main checkout and its Portless route had not been updated or shipped.

**Delivery update — 13 September 2026 (Australia/Sydney):** [PR #1730](https://github.com/eevennsoh/vpk/pull/1730) merged as `e1118f72f`, delivering the implementation and shared adoption described below. The original development measurements and their limitations remain historical evidence; this note does not represent a new benchmark.

## Measured result

A repeatable Playwright journey waited for the finite session queue to reach 24 sessions, then measured 30 switches in each direction using browser Event Timing. Both builds used Chromium, the same test/viewport defaults, direct loopback HTTP, no artificial throttling, and Next.js 16.3.3 development mode. Baseline source was the exact original `d35d42fc0` snapshot in a temporary isolated checkout. Measurements include the first visit to List; subsequent visits are warm. These are laboratory click durations, not production/field INP or promises for other hardware.

| Action | Baseline median | Final median | Baseline p95 | Final p95 |
| --- | --- | --- | --- | --- |
| Board → List | 188 ms | 136 ms | 272 ms | 200 ms |
| List → Board | 152 ms | 128 ms | 224 ms | 192 ms |

List switching improved about 28% at the median; Board switching improved about 16%. The earlier cleanup-only treatment had neutral switching medians (188/160 ms). That evidence identified repeated view mounting as a remaining cost; the measured improvement followed project-scoped warm-view retention. Keep the intermediate result in the ledger rather than attributing all savings to memoization.

Raw samples and conditions: `output/agent-browser/eu26-performance/comparison.json`, `benchmark-baseline.log`, `benchmark-after.log` (cleanup only), `benchmark-retained.log` (final).

## Changes and retained contracts

- **Warm Board/List views:** opt-in `retainWorkItemViews` is enabled only for EU26. Each view mounts on first use. React `Activity` hides the inactive view and cleans up its effects while retaining its DOM/state for return visits. Tests prove node identity is preserved and inactive board controls/list regions disappear from the accessibility tree. The shared session column remains a single instance outside both views. The tradeoff is retaining two visited view trees in browser memory; there is no unbounded view cache.
- **Unused sidebar chat:** EU26 opts into `sidebarChatMount="on-first-open"`. Initial hidden editor count drops from one to zero; first floating chat now has one editor instead of two. Once sidebar chat has been used, it stays mounted on close to preserve its local draft and exit transition. This deliberately does not claim zero hidden editors after every possible chat-surface sequence. Other projects keep eager mounting by default.
- **First-click reliability:** the FAB's first-hover logo animation could remove the SVG that received pointerdown, preventing Chromium from emitting a click. Decorative children now ignore pointer events, keeping the button as the stable target. Drag threshold, capture, suppression and visuals are unchanged. The real mouse-click regression passes.
- **List rendering:** stable row models reuse immutable card/status identities; filtered/replaced cards rebuild safely. Stable column definitions and memoized cell content prevent hover chrome from reconstructing unchanged cell content. Visible row keys are published from a committed layout effect rather than from an abandoned render.
- **Unused hover preview state:** the disabled session-link suggestion capability no longer updates its preview state. Review acknowledgement and flyouts still work, and enabled consumers still receive previews.
- **Pointer work:** create-well hit testing runs once per animation frame using the latest pointer and fresh geometry. A regression exercises 101 input events producing one scheduled geometry pass. Touch, blur, exit, cancellation and disposal cancel pending work. Winner changes do not re-register every well.
- **Chat subscriptions:** a narrow controls context keeps message/queue data out of workspace control subscriptions. It forwards the current surface and actions without creating mirrored state. Existing full-context consumers remain compatible. The selected-agent convenience hook moved into its own file to respect the existing provider file-size budget.
- **Demand loading:** directory dialogs and the optional Pulse view use dynamic imports; directory dialogs retain their state after first use. Required timeline/session data stays available.

## Verification

- Focused scheduler, list-model, review-acknowledgement and controls tests passed. The final unfiltered JS unit gate passed: 6,264 tests, zero failures or skips. Structural assertions now recognize the two retained views outside the single session column.
- New browser regressions: no unused initial editor; one first-use floating editor; first mouse click works; sidebar draft survives view switches and close/reopen; warm view nodes survive while hidden controls are inaccessible. Initial editor and warm-node assertions were observed failing on the old behavior.
- Existing browser checks passed for long-title hover geometry, List sticky footer, session-drop creation, dropping outside targets, and opening an attached session without detaching it. One stale test label was updated from “Unattached sessions” to the existing live “Unlink sessions”; application copy was not changed.
- Typecheck and lint pass (lint retains 21 pre-existing warnings). Source guardrails, lazy-load boundaries and file-size budgets pass. React Doctor reported 93/100 with existing complexity warnings in large owners, no new correctness errors.
- Next runtime was reloaded after changes: `get_errors` returned empty config/session errors, and `get_compilation_issues` returned no issues. An intermediate HMR render saw a not-yet-written export; it was cleared by the completed implementation and fresh navigation.
- Full-page axe baseline and treatment match: 3 existing violation categories with identical affected-node counts (`aria-prohibited-attr`: 10, `region`: 1, `role-img-alt`: 1). The main-only scan was too narrow to stand in for this full-page check.

Evidence and screenshots are under ignored `output/agent-browser/eu26-performance/`. The two long React render recordings mixed interactions/hot reload and inconsistent observation windows; do not use their aggregate counts as a before/after performance claim. Failed temporary-server attempts and the incorrect initial session-row wait are excluded from timing results.

## Remaining measurement work

Production static-export bundle/route budgets, representative slower-device runs, large 100/500-item fixtures, long-running heap measurements, and field INP are still future measurement work. No new production byte threshold was invented from development assets. The planning and measurement stages did not deploy or push; the later PR merge is recorded in the delivery update above. Existing unrelated accessibility findings were not expanded into this performance patch.

## Shared adoption — 13 September 2026

The shared Jira List rendering, experimental Kanban pointer handling, optional Pulse loading, floating launcher fix, and chat-control subscription API were already reusable beyond EU26. The project-specific row adapter and the `retainWorkItemViews` / `sidebarChatMount="on-first-open"` opt-ins remain scoped to EU26; other projects keep their lifecycle defaults.

A syntax-aware inventory found 20 additional `useRovoChat` consumers that read only fields already supported by the narrow controls API. They now use `useRovoChatControls`, exposed through `@/app/contexts`. This covers shared top navigation, Agent List, Confluence header/floating controls, original Golden Journeys playback/overlay, Rovo Button, and supported work-item/floating-session variants. Message readers retain the full context. No equivalent latency improvement is claimed for these other routes without measuring them individually.

The approach is now recorded in the repository's `AGENTS.md`, `.agents/rules/component-architecture.md`, and `.agents/docs/playbooks/improve-ui-performance.md`. Existing global Codex and Claude instructions (`~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`) were updated with framework-independent performance principles. Existing preferences were preserved. The global files are outside this repository and apply to future sessions; the repository changes were subsequently delivered through PR #1730.

Shared adoption validation: 6,264 unit tests passed. Browser regressions passed for Jira and Confluence sidebar open/close/draft preservation and original Golden Journeys floating chat open/close. The first browser attempt included cold compilation in its overall timeout and incorrectly assumed the original gallery opened on a Jira navigation screen; the corrected tests use its actual Kanban gallery entry and retain the original behavior assertions. Typecheck, lint (existing warnings), documented command references, and agent-file validation passed.

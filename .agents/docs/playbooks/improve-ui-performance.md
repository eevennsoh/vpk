# Improve UI performance

Use this for slow interactions, excessive renders, heavy hidden UI, costly view changes, and decisions about mounting or subscriptions. Apply it across VPK projects; measurements from one route do not establish gains on another.

## Diagnose before choosing a technique

1. Name the exact journey, data size and behavior that must remain unchanged: typing, switching views, opening chat, hovering, dragging or scrolling. Measure acknowledgement and usable-content completion separately.
2. Record the source revision, build mode, browser, viewport, CPU/network settings, cache state and background activity. Warm compilation before steady-state measurements; separate first use from repeat use. Wait for fixtures to settle before sampling.
3. Attribute the cost to input delay, handler work, React mounts/updates, style/layout/paint, or network/model wait. A slow model response does not justify memoizing a board. Capture diagnostic profiles separately when instrumentation changes timing.
4. Make one attributable change and repeat the same journey. Compare median/tail latency and variance, and record kept, neutral and rejected experiments. Do not call a smaller render count a measured latency improvement.

Use `next-dev-loop` and [Browser Verify Worktree](browser-verify-worktree.md) for runtime inspection. Development assets, source maps and React Grab can dominate results; use a production build before asserting production bundle/load budgets. HTTP response timing alone does not measure interaction responsiveness. Event Timing click samples are not field INP; use an established Web Vitals implementation for that metric.

## Reuse the opt-in interaction sampler

`tests/projects/jira-team-eu26-performance.spec.ts` records Board/List interactions on `/jira-team-eu26`. Use its existing sampler and `tests/helpers/interaction-performance.ts` when extending a measured journey, rather than inventing a second timing collector. It opens the project directly, uses `PLAYWRIGHT_BASE_URL` or the current worktree's `control-vpk url`, and waits for the finite 24-session fixture before sampling.

For a known development stack:

```bash
PLAYWRIGHT_BASE_URL="$(.agents/skills/vpk-verify/scripts/control-vpk url)" \
VPK_PERF_SAMPLES=30 VPK_PERF_BUILD_MODE=development \
pnpm exec playwright test tests/projects/jira-team-eu26-performance.spec.ts \
  --grep "record repeatable" --workers=1 \
  --output=output/agent-browser/eu26-performance
```

`VPK_PERF_SAMPLES` is a positive integer repeat count. Declare `VPK_PERF_REVISION` only after confirming the served source revision; the observed local checkout may differ from the server. `VPK_PERF_BUILD_MODE` accepts `development` or `production`. `VPK_PERF_CACHE_STATE` and `VPK_PERF_BACKGROUND` record declared comparison conditions. Unobserved conditions stay unknown; a fresh browser context does not prove cold server/build caches.

The `interaction-samples` JSON attachment records condition provenance, browser/viewport/host observations, each action's target and interaction ID, and cold/warm view groups. Cold means first activation of an unvisited view, not a cold page or cache. Summaries report valid/missing counts, median, nearest-rank p95, range and population variance. Compare equivalent warm groups and disclose missing counts; the Event Timing reporting threshold can censor fast events.

Timing is the maximum observed event duration within the attributed click interaction, with input, processing and presentation phases for that event. Duration is rounded to 8ms and the observer requests a 16ms reporting threshold. Unsupported, absent, ambiguous or invalid timing stays missing, never zero-filled. These phases do not separately measure visible acknowledgement, usable-content completion or network/model waits; add explicit journey markers when those are the question. Keep timing thresholds out of functional tests and record neutral or rejected experiments alongside accepted results.

## Existing shared mechanisms

| Problem | Reuse | Contract / tradeoff |
| --- | --- | --- |
| Controls rerender with every chat token | `useRovoChatControls` / `useOptionalRovoChatControls` from `@/app/contexts` | Includes surface/open state and selected stable actions, not messages or queues. Full chat readers keep `useRovoChat`. Do not extend this context with high-frequency data. |
| Expensive editor/dialog mounts before anyone uses it | `MountOnFirstUse` in `components/projects/shared/components/mount-on-first-use.tsx` | Defers first mount, then retains state and exit behavior. It does not suspend later hidden effects or remove duplicate surfaces after every transition. |
| Switching back rebuilds a frequently used view | `RetainedView` in the same module | React Activity retains DOM/state and suspends hidden effects. Bound retained views, use stable entity identities, and test reveal/resume. Retention costs browser memory. |
| Closed sidebar chat initializes an unused editor | `AppLayout` prop `sidebarChatMount="on-first-open"` | Eager remains the shared default; choose per consumer after checking first-use latency, drafts and surface switching. |
| Board/List remount cost is measurable | `ExperimentalJiraKanbanPage` prop `retainWorkItemViews` | Opt-in; one session column remains outside both views. Other screens must validate their own reset, drag, focus and memory contracts. |
| Hover state rebuilds unchanged list cells | Canonical `JiraList` column definitions and `JiraListCellContent` | Stable inputs allow cell reuse. Normalize project data in its adapter; invalidate on changed card identity, status, filtering and callbacks. Never mutate a cache or ref during render. |
| Continuous pointer events repeat geometry work | `createLatestAnimationFrame` in `lib/latest-animation-frame.ts`; the Kanban `createExclusiveProximityScheduler` delegates to it | Latest input, one pending frame, and explicit cancellation/disposal. Consumers own fresh geometry, reads before writes, and cancellation on touch/exit/blur. The final drop still resolves synchronously. |
| Decorative hover animation swallows clicks | Shared floating Rovo button's stable button hit target | Decorations ignore pointer events; the real control retains capture, keyboard and drag semantics. |

## Choose a lifetime, not a blanket default

- **Unmount/reset:** suitable when leaving should reset transient state and remounting is cheap. Keep user-authored drafts above the boundary when they must survive.
- **Mount on first use:** suitable for unused heavy surfaces where existing local state or exit animation must survive later closure.
- **Bounded retained view:** suitable for repeatedly revisited, expensive surfaces. React Activity hides DOM and cleans up effects; verify portals, keyboard shortcuts, subscriptions and observer restart behavior.

Visibility and lifetime are separate. CSS transforms/opacity alone do not stop subscriptions or make offscreen controls inaccessible. Retained DOM requires visibility-aware tests: assert hidden controls are unreachable, and test DOM removal only when removal itself is the intended contract. Keep data/entity identity stable and test A → B → A, close/reopen, changed data while hidden, and cancellation.

## Promote at the correct boundary

Behavior-preserving shared fixes belong in existing shared owners and benefit all callers. When a new narrow API is introduced, migrate compatible consumers in the same change and test its public exports. Keep product data, labels and different lifecycle policies in project adapters. Do not copy the EU26 presentation data, add universal memoization, virtualize every list, or retain all views.

A shared-default change needs evidence across its affected consumers, including one whose prior behavior differs. Roll out explicit capabilities first when state or memory tradeoffs are involved. The EU26 result is an example of that approach: early cleanup did not materially speed up tab switching; measured bounded retention did. Its numeric targets and fixture are not universal budgets.

## Validation and evidence

- Run the repository's targeted behavioral tests, lint and typecheck. Register new component node:test suites in `scripts/js-unit-test-manifest.mjs` and verify discovery with the unfiltered JS unit runner.
- Verify the changed route and representative shared consumers in a real browser: first/repeat open, typing, view changes, drag/drop/cancel, hidden focusability, state persistence and reduced motion as applicable.
- Measure memory/DOM growth when retaining views and first-use latency when deferring them. Keep cache growth bounded. Preserve visual geometry and accessible names.
- Use existing source, file-size and lazy-load guards. Compare accessibility findings with the original route so existing issues are neither hidden nor incorrectly attributed to the optimization.
- Put disposable profiles/screenshots under `output/agent-browser/`; record reproducible commands, conditions, observed gains and limitations in the implementation report. Never present sandbox/server failures or mixed recording windows as performance evidence.

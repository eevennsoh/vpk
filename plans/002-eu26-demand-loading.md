# 002 — Avoid unused chat mounts and load optional UI on demand

Priority P1 · Effort 1–2 days · Risk medium · Depends on 001 · Planned at `d35d42fc0`, 2026-09-12.

## Current state

- `components/projects/page.tsx:197–233`: `!isEmbedded && !shouldHideRovoAction` mounts `<ChatPanel abortOnUnmount={false}>` even when the wrapper is inert, aria-hidden and translated offscreen.
- `components/projects/jira-team-eu26/page.tsx:343`: `hideFloatingRovo` hides shell floating UI but does not disable that sidebar mount.
- `components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay.tsx:107` conditionally mounts floating chat; `components/projects/rovo-floating-chat/components/rovo-floating-chat.tsx:11` imports another ChatPanel. The browser confirmed two editors when floating chat opened, one hidden.
- `components/projects/jira-team-eu26/page.tsx:6–8,31,451–465` eagerly imports directory data/dialogs and renders closed dialogs.
- `components/blocks/jira-kanban/experimental/page.tsx:95,949` statically imports optional `ExperimentalPulse`, despite EU26 setting `insightsEnabled={false}`. Pulse session data remains needed.

## Scope and sequence

1. Drift-check the paths above against `d35d42fc0`. Read shared shell/chat rules and `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`. Use tabs, `@/` imports, React 19 APIs and existing semantic tokens.
2. First isolate sidebar mounting. Give the shared shell an explicit, narrowly scoped mount policy if required, retaining defaults elsewhere, and opt EU26 into demand mounting. Preserve provider-owned conversation, cancellation, history, surface switching and draft content; inspect locally owned editor state before unmounting. Prefer one active renderer, not simultaneous hidden and floating trees. Keep lightweight transition chrome if needed.
3. Measure closed-route startup, first sidebar/floating open, switch between surfaces, and reopen. Assert no hidden editor before first chat use and one active editor per visible surface. If draft/history persistence requires another owner, make that ownership explicit and test it before removing the old mount.
4. In a separate measured change, dynamically load closed directory dialogs and the optional Pulse view implementation at their existing activation seams. Avoid broad registry edits. An immediate dynamic mount is not demand loading. Check transitive imports, because an eager second path can defeat a split.
5. Measure production chunks and first-use latency. Only use intent-based preload on pointer/focus if first-open latency needs it; do not eagerly preload every optional feature. Keep session timeline data, project copy and focus behavior unchanged.

## Verification and done criteria

Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run verify:lazy-load`, and the route performance journey from plan 001. Run `node --test app/contexts/context-rovo-chat-select-agent.test.js app/contexts/rovo-chat-helpers.test.js` for provider invariants. Add browser assertions for draft text surviving close/reopen/surface changes, uninterrupted local playback, Escape/focus restoration, no duplicate composer, and first-use directory loading. Register any new component node:test suite in `scripts/js-unit-test-manifest.mjs` and prove discovery with `node scripts/run-js-unit-tests.mjs`.

Record separate before/after mount counts, initial compressed/decoded JS, startup scripting, and first/warm open durations. A deferred chunk alone is not a win if first use becomes frustrating. Acceptance requires repeatable improvement beyond variance, no meaningful first-use regression, unchanged keyboard/a11y behavior and preserved other-project defaults.

Stop if state retention or abort ownership is unclear. Do not simply set `hideRovoAction`, which would remove visible functionality. Avoid expanding the large chat file with unrelated concerns. Keep patches separate and update the README with measured results and rejected experiments.

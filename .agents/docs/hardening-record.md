# VPK hardening record (12–16 Nov 2026)

The durable record of the hardening programme that ran from 12 to 16 Nov 2026. It replaces the temporary session summary (`hardening-summary.md`, deleted) and folds in the independent review of that summary and the decision entries from the planner's local plan, which was never tracked.

Use it to answer three questions before you change something in these areas: was this already decided, is it known to be open, and does the owner still have to act. Counts were re-measured on 16 Nov 2026 at `d2884c076`; the command for each is in **Counts and how to re-measure**. Where the summary and the review disagreed, the review was right unless a line says otherwise.

## Decisions made

Each line is settled. Reopen one only with the owner.

### Owner decisions

- **Rovo and Studio shells are not merged** (C-5 declined). `components/projects/rovo-core/README.md` says route shells stay product-specific; share only pure helpers and focused primitives through `rovo-core`. The two routes stay separate pages.
- **Every project demo stays** (D6). No demo route or catalog entry is removed; only duplicate implementations behind demos are collapsed. Unreferenced blocks are not automatically dead, because VPK is a kit.
- **`vpk-git-ship-fast` stays ungated** (D2). No pre-push hook or blocking check. Its code pushes no longer skip CI (D2b), so CI runs after the push.
- **GitHub Actions is the gate of record** (D1), since the repo became public. If billing blocks Actions again, the fallback is a local `pnpm run ci:pr`.
- **Repo Claude settings** (D4, #2253): agent shells get the OpenSSL workaround, sandboxed tests may bind loopback, and the two cascading commands (`tmux kill-server`, `portless prune`) are denied. `gh` stays sandboxed.
- **`artifacts/` rule** (D9): unattended automation never writes there; interactive `vpk-html` sessions may write under `artifacts/vpk-html/`.
- **Skill merges** (D7): `vpk-component-ext` folded into `vpk-component`; `vpk-council` became a `vpk-remote` mode; skill bodies capped at 300 lines with trigger eval kits.
- **Codex automations** (D8, D11, D12): retire `engineering-improvement-map`, add the producing automations, auto-merge only labelled low-risk automation PRs, track definitions in the repo with no secrets. Approved; not yet installed (see Owner actions).
- **Dev output on stop** (R-7): `dev:tmux:stop` removes `.next/dev/static` and `.next/dev/server` and keeps the cache; starts outside `dev:tmux` prune output older than a day.
- **One backend per data directory**: enforced with a lock file (#2320), not just documented.
- **jsx-a11y options** (#2255, #2275): the interaction and role rules use the plugin's own `recommended` options instead of bare `"error"`; a boundary test fails if the copied options drift from the plugin.
- **Perf budgets re-baselined** (G-7) to about 3% over measured production builds; budgets only go down, and a raise needs a `raises` entry, which is the owner's call.
- **OpenAI model** (#2277): one code-owned default in `backend/lib/openai-model.js`; stale overrides warn at startup, in `/api/health` and in `doctor`.
- **Plan session "execution" mode**: a plain visible message keeps a plan session in execution, as before.
- **Stuck-port rerun text**: approved to add a separator between the first attempt and the rerun. Not built yet (see Still open).

### Declined or deferred

- **D10**: the plan does not move into the tracked tree, because the repo is public. This page is the tracked record instead.
- **`noUncheckedIndexedAccess`**: not enabled; it adds about 2,840 type errors. Needs a gradual plan if wanted.
- **C-4a**: import moves that need path-only edits in frozen `jira-golden-journey-v0`/`v1` files were not made; the related import suppressions stay. The inverted-range `clamp` copies also stay.
- **A-5c**: moving the vpk-html demo output out of its skill folder is deferred by the owner.
- **Butter state machines** (SM-FE-1/4/5/6): wait until Butter churn settles.
- **Browser-workspace MCP thread binding**: risk accepted until auth is deployed; binding would change the owner's `pnpm run rovo` start path.
- **Butter `/butter` page weight**: the work item stays static, so the route still fetches about 5.7 MB; pinned by a test.
- **React Compiler**: blocked on the React hooks lint backlog.

## How things work now

Things an agent would otherwise get wrong. The linked file owns the detail.

- **`pnpm run check`** runs guards, ESLint on changed files and importers, the full typecheck and the unit suites within two import levels; `pnpm run check -- --deep` adds deeper rendered and bundling suites. Owner: `scripts/check.mjs`, `.agents/rules/testing.md`.
- **`pnpm run typecheck:build`** runs TypeScript 6, the checker `next build` uses, which can reject code the native TypeScript 7 accepts. CI runs it; locally it is opt-in (about 45 s, several GB). Owner: `scripts/typecheck-build.mjs`.
- **Dev stack start and stop**: ports are allocated without colliding across worktrees; `dev:tmux:start` auto-stops idle linked worktree stacks when over the 4-stack budget (never the main checkout, a Codex worktree, another repo's server or the one being started) and logs every stop; `--no-auto-stop` refuses instead. Owner: `.agents/docs/dev-environment.md`, `scripts/lib/dev-stack-budget.js`, `scripts/lib/dev-stack-auto-stop.js`.
- **Catalog registration is generated**: the old hand-edited registries are gone; add the leaf and detail, then run `pnpm run fix:generated`. Owner: `.agents/docs/playbooks/add-component-demo.md`.
- **Test naming and the unit gate**: every `node:test` file runs; the only lists are skipped suites and the frozen legacy-drift baseline, which can only shrink. Owner: `.agents/rules/testing.md`.
- **Caller identity and ownership**: one middleware resolves the caller for every route except the health check; production defaults to the platform identity and fails closed on an invalid setting. Threads, chat sessions, generated media and RFP demo threads are per owner; records with no owner are visible only to a local caller. Owner: `backend/middleware/caller-identity.js`, `backend/lib/caller-identity.js`, `backend/lib/rovo-app-thread-ownership.js`.
- **Chat turn lifecycle** is a pure reducer (`app/contexts/rovo-chat-turn-machine.ts`); Stop cancels on the backend in Rovo, Studio and rovo-core.
- **Review rule**: changes to lifecycle, auth, delete or stop paths get an independent adversarial review (a fresh reviewer that tries to break the change by experiment) before merge, whatever the PR bot says. On 14 Nov each such review found real defects the bot had passed. Mechanical changes need only a diff read and counts that only fall.

## Still open

### Backend

- Three dead paths, waiting on keep, wire up or delete: the run queue (`enqueueRun` in `backend/lib/rovo-app-runs.js`, no caller outside its module and tests), the replace path (`shouldReplaceActiveRunForRequest` in `backend/lib/rovo-app-run-continuation.js`, always false), and `cancelOnComplete` in `backend/lib/rovo-gateway.js` (no caller passes it).
- `onDeferredToolRequest` is not awaited in `backend/lib/rovo-gateway-tool-event-dispatcher.js`, so a question or plan card can be written after post-stream work starts.
- Unknown whether Rovo Serve sends keep-alive events during a pause; if not, a pause longer than the idle timeout ends the stream.
- Smaller: delete-all threads does not cancel live runs; a run stays `queued` if attaching its subscriber throws after creation; clearing the Rovo pool while a paused record exists.
- Stuck-port rerun separator (approved): `backend/chat/rovo-stream-loop.js` rerun branch; today's behaviour is pinned in `backend/chat/rovo-chat-turn.behavior.test.js`.
- Voice barge-in does not always cancel the old turn on the backend.
- RFP demo thread owners are remembered in memory: after a restart a recreated demo thread has no owner (`backend/lib/agents-rfp-demo-job-owner.js`).
- Shared by design, not yet a recorded decision: the checkpoint list, browser-workspace operator routes, and the `chromium-preview`, `ai-utilities`, `orchestrator` and `media` route families have no per-owner check.
- Backend `// @ts-check` ratchet: 27 of 316 non-test backend files.
- Gateway 429s seen on title and suggestion calls during heavy runs.

### Frontend and performance

- `/rovo` and `/studio` are the heaviest routes (fetched-JS budgets 7.09 MB and 7.59 MB). The 402 KB directory chunk stays in first load because the chat startup path imports the catalog repair statically; making it lazy changes how chat starts, so it is the owner's call.
- Hot-context narrowing (C-6) is half done: `useRovoChatControls` exists, but streamed messages still live in the one context that `useRovoChat` reads (26 non-test files outside its own module). No interaction measurement recorded.
- Studio shell is the largest source file: `components/projects/studio/components/rovo-app-shell.tsx`, 3,330 lines.
- Eight behaviour differences between the Rovo and Studio shells were never decided (for example Studio ignores text typed after a prefill).
- On `/rovo`, directory-autocomplete rows are clickable one render before the composer can take the click.
- Cut-short notice can wait up to 120 s while media loads; fix is a shorter media timeout after a cut-short turn (`app/contexts/use-rovo-chat-media-generation.ts`).
- Remote preview capture: Ctrl/Cmd+V pastes the remote clipboard.
- F-2c: 11 suspected Butter regressions; only the keyboard traps are fixed.
- The pull-request details rail exists as three copies.
- rAF coalescing for about 49 pointer and scroll handlers has not started (C-12).

### Accessibility

- 50 jsx-a11y suppressions.
- Known defects: the work-item modal backdrop has no dialog role, Escape or focus trap; no keyboard reorder within kanban columns; hover-only Delete on task-progress and agent-progress; a remove button nested inside a button role on tags; the Confluence body editor has no accessible name.

### Tests and lint debt

- Source-regex suites: 290 `.source.test` files, and 16,719 `no-restricted-syntax` suppressions in 341 files. That count undercounts, because suites that read into a local `source` variable are not matched; widening the selector is an open policy question.
- React hooks lint: 361 suppressions (`refs` 161, `set-state-in-effect` 150, `immutability` 39, `purity` 6, `static-components` 5). About 45 share one cause (hooks returning a ref with values) and may need a hook API change.
- Legacy-drift baseline: 44 suites that fail on `main` and are excluded from the gate.
- Realtime voice reducer (SM-FE-16): characterization tests exist, the reducer does not.
- Open policy question: enforce unused exports and types.

### Tooling

- `pnpm control-vpk` extras (A-2): element crop, frame sequence, GL capture, multi-step recipes, `eval --file`, and frame-rate and A/B serving scripts.
- Dev-stack auto-stop exempts Codex worktrees but not Cursor ones (`isCodexWorktree` in `scripts/lib/dev-stack-budget.js`); confirm or exempt.
- Auto-stop stops nothing when stopping every safe stack still would not get under budget; it could stop the safe ones anyway.
- 82 linked git worktrees exist; run `vpk-git-clean`.

## Owner actions

- **Deploy auth to pdev** and run the 18 checks in the #2311 PR body, check 6 (the sidecar strips a client-sent identity header, and the port is unreachable otherwise) first. The whole ownership design rests on it.
- **Persistent `backend/data`**: no volume is mounted, so a redeploy wipes threads. Decide volume, object storage or accept it, before anyone relies on stored threads.
- **Existing threads after deploy**: decide whether to run `backend/scripts/backfill-rovo-thread-owner.js`; ownerless threads are invisible to every signed-in caller.
- **Issue #2321**: close it, or leave only what remains (its four code items are addressed on `main`).
- **Decide the shared route families** listed under Backend: shared for every signed-in caller, or per owner.
- **Codex automations**: install the approved automations (outside the repo).
- Optional: SSH access to the service for future data backups.
- Optional: one adversarial review with experiments of cross-owner reads, writes and deletes before the deploy.

## Not verified

- No cross-owner request has been sent against a running server; ownership was traced by reading and by unit tests only.
- The Micros service descriptor and service-proxy format were not checked against the platform docs.
- The 177 merges after 14 Nov were sampled, not re-reviewed line by line.
- How adversarial the reviewer-subagent reviews of 14–15 Nov were. That window merged the auth and ownership work, the chat-turn reducer and Stop cancellation (#2333, #2339, #2344, #2346) and dev-stack auto-stop.
- The home page "21.4 MB → 8.6 MB" JS figure from #2290 does not match the budget file (home all-frames ceiling 3.24 MB); it is probably a different counter. Treat it as unconfirmed.
- Skill trigger eval numbers (#2337, #2350), the vpk-grab release and the Butter work from parallel sessions were not reviewed.
- Cold-start cost of each dev-output option was never measured.

## Counts and how to re-measure

| Count | Value | Command |
|---|---|---|
| `.source.test` files | 290 | `git ls-files \| grep -cE '\.source\.test\.'` |
| `.behavior.test` files | 157 | `git ls-files \| grep -cE '\.behavior\.test\.'` |
| `no-restricted-syntax` suppressions | 16,719 in 341 files | sum of `count` per rule in `eslint-suppressions.json` |
| React hooks suppressions | 361 | same, rules starting `react-hooks/` |
| jsx-a11y suppressions | 50 | same, rules starting `jsx-a11y/` |
| Legacy-drift suites | 44 | length of `LEGACY_DRIFT_TEST_FILES` in `scripts/js-unit-test-legacy-drift.mjs` |
| Backend `@ts-check` files | 27 of 316 | `git ls-files 'backend/**/*.js'`, non-test, first line `// @ts-check` |
| `noUncheckedIndexedAccess` errors | 2,839 | native `tsc --noEmit --noUncheckedIndexedAccess`, lines matching `error TS` |
| Studio shell | 3,330 lines | `wc -l` on `rovo-app-shell.tsx` |
| `useRovoChat` readers | 26 files | `git grep -lw useRovoChat` on non-test `.ts`/`.tsx`, minus `app/contexts/context-rovo-chat.tsx` |
| Linked worktrees | 82 | `git worktree list`, minus the main checkout |
| `AGENTS.md` | 20,860 bytes | `wc -c AGENTS.md` |
| Route budgets | as quoted | `scripts/perf-route-budgets.json` |

Corrections to the temporary summary: "about 300" source-regex tests is a file count (290), not the assertion debt; hooks lint is 361, not "about 380"; `noUncheckedIndexedAccess` is 2,839 now, not 2,855; the review's 144 behaviour suites and 26 of 312 `@ts-check` files have since grown to 157 and 27 of 316.

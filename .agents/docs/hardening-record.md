# VPK hardening record (12–16 Nov 2026)

The durable record of the hardening programme that ran from 12 to 16 Nov 2026. It replaces the temporary session summary (`hardening-summary.md`, deleted) and folds in the independent review of that summary and the decision entries from the planner's local plan, which was never tracked.

Use it to answer three questions before you change something in these areas: was this already decided, is it known to be open, and does the owner still have to act. The figures in **Counts and how to re-measure** were re-measured on 19 Nov 2026 at `3c05c80f9`, with the command for each; the status of the other items is as of when this record merged. Where the summary and the review disagreed, the review was right unless a line says otherwise.

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
- **Codex automations** (D8, D11, D12): retire `engineering-improvement-map`, add the producing automations, auto-merge only labelled low-risk automation PRs, track definitions in the repo with no secrets. On 20 Nov 2026 `engineering-improvement-map` was retired (moved to `~/.codex/automations-retired/`) and `main-health`, `baseline-burn-down`, `skill-health` and `worktree-sweep` were installed `PAUSED` from the tracked drafts in `.agents/automations/`; the owner activates them after review. Each job uses the latest model of its family (`gpt-6.2-sol`, `gpt-6-luna`; terra and astra would be `gpt-6.1-terra` and `gpt-6.2-astra`). D11 is built: `scripts/automation-merge-eligibility.mjs` holds the low-risk policy, producers label each PR `automerge:allowed` or `risk:needs-human` from its `--policy` check, and the local `automation-merge` job runs `scripts/automation-merge.mjs`, which merges only allowed PRs with a clean current-head Codex signal through the `vpk-git-ship` review gate and `merge-remote.js`. Still open: tracking the 15 older job definitions (D12).
- **Dev output on stop** (R-7): `dev:tmux:stop` removes `.next/dev/static` and `.next/dev/server` and keeps the cache; starts outside `dev:tmux` prune output older than a day.
- **One backend per data directory**: enforced with a lock file (#2320), not just documented.
- **jsx-a11y options** (#2255, #2275): the interaction and role rules use the plugin's own `recommended` options instead of bare `"error"`; a boundary test fails if the copied options drift from the plugin.
- **Perf budgets re-baselined** (G-7) to about 3% over measured production builds; budgets only go down, and a raise needs a `raises` entry, which is the owner's call.
- **OpenAI model** (#2277): one code-owned default in `backend/lib/openai-model.js`; stale overrides warn at startup, in `/api/health` and in `doctor`.
- **Plan session "execution" mode**: a plain visible message keeps a plan session in execution, as before.
- **Stuck-port rerun text**: approved and built. A rerun's text starts as its own paragraph; text that was still held back when the port stuck is discarded as before, so the first attempt's text ends where it had been shown (`backend/chat/rovo-text-output.js`, pinned in `backend/chat/rovo-chat-turn.behavior.test.js`).
- **Three dead backend paths deleted** (owner decision "delete"): the run queue, the replace-on-request path and `cancelOnComplete`. The port-available plumbing that only the queue used went with them.
- **Cut-short notice wait**: a cut-short turn waits `CUT_SHORT_MEDIA_WAIT_MS` (5 s, confirmed by the owner on 17 Nov 2026) for pending media instead of the full media timeout (`app/contexts/use-rovo-chat-media-generation.ts`).
- **Thread change in the chat provider** (#2358): a thread change stops and detaches the departing request first, then swaps the transcript and resets the turn in one synchronous step, so a stopped reply or a cut-short notice never lands on the new thread; request liveness comes from the turn reducer (`hasLiveRequest` in `app/contexts/rovo-chat-turn-machine.ts`). Switching threads drops prompts still queued on the old thread (before, they were sent into the new one); the owner confirmed this on 17 Nov 2026. Keeping a queue per thread is not planned.
- **Chat failure notice** (#2361, owner decision "fix that"): a failure notice is its own paragraph and reaches the client once on every turn type. Before it, held plain text is shown; an unfinished marker, an open fence at the start of a reply and a classifier payload are dropped, from the stored reply too; text that reached the client is never removed. The text output controller lives in `backend/chat/rovo-text-output.js`; the marker adapter's `flushVisibleText()` is the failure-path flush and `flush()` stays for the end of a stream.
- **Streamed fence hold** (#2369, owner decision "ship with gap"): during normal streaming the text output controller holds only the undecided end of the text (a partial opener of a spec or media fence, an open one, or a split spec patch line) and splits the rest as before, so fence text does not reach the client however the reply is chunked. A fence is a spec fence only when its language is exactly `spec`. A `WIDGET_LOADING:` marker split across chunks is read once whole. Five independent reads; the last one's finding was fixed in #2373.
- **Chat request gate** (#2367): requests belong to a transcript. Nothing starts for a transcript between a thread change's stop phase and its commit point; a committed change drops its retry, queue and edit resend, and a superseded or failed change lets them continue (`sendForTranscript` in `app/contexts/rovo-chat-request-lifecycle.ts`). The retry is reducer state with a due time and an effect arms it (`app/contexts/use-rovo-chat-retry.ts`), edit resends are serialized on reducer state, and a thread creation that was cut off is adopted for the same transcript instead of repeated. Queued prompts keep sending while the provider is hidden, and deleting a thread that is not active holds nothing up.
- **Deferred tool handler awaited** (#2372): a question or plan card is stored before the stream reader takes the next chunk, so text after it is written after it and post-stream work starts once it is stored. A handler that rejects goes through the stream's error path; one still pending after the stream ends is bounded by the idle timeout (`ROVO_STREAM_DEFERRED_HANDLER_TIMEOUT`).
- **Delete-all cancels live runs** (#2371): a local delete-all cancels the live runs, closes each thread's browser one at a time under a single 5 s limit, then removes generated files and clears the stores. The cancel endpoint, single-thread delete and delete-all share `backend/lib/rovo-app-thread-cleanup.js`.
- **Media block close** (#2373, owner decision "ship all three"): an image or audio block closes at the first run of three or more backticks that starts its line, ends its line, or follows the JSON object that opens the body, with any whitespace around it; backticks inside the body no longer end it. When the complete text has no such run, the block closes at its first three backticks as before, so no reply shows less than it did. The rule is stated once in `backend/lib/direct-media-fence.js` and every reader follows it (streaming, the stored reply, the generation request, and the frontend copy, which a test compares with it). Three independent reads; the last one's findings are the media-block gaps below.
- **Shared route families** (owner decision, 19 Nov 2026): with a signed-in caller, these stay shared between callers by design: health and status (`backend/routes/status.js`), the stateless AI and media utilities (`ai-utilities.js`, `media.js`, `genui.js`), vpk-html assets and html-selector tokens, ticket-classify and standup, the Agents RFP demo board state, `/api/claim-test`, and `POST /api/agent-mode` (one Rovo Serve whose mode the UI sets before every turn; an accepted limitation). Browser workspaces and the chromium preview stay shared behind the runtime admin token. Threads, sessions, generated media, RFP demo threads and `/api/whoami` are per owner. Still to be built to match the decision: `POST /api/rovo/cancel-deferred-tool` becomes per owner (check the record's thread), `GET /api/orchestrator/log` and `/timeline` and `GET /api/checkpoints` become admin-only, and `GET /api/personal-graph/*` becomes local-dev only in production (see **Backend**).

### Declined or deferred

- **D10**: the plan does not move into the tracked tree, because the repo is public. This page is the tracked record instead.
- **`noUncheckedIndexedAccess`**: not enabled; it adds about 2,880 type errors. Needs a gradual plan if wanted.
- **C-4a**: import moves that need path-only edits in frozen `jira-golden-journey-v0`/`v1` files were not made; the related import suppressions stay. The inverted-range `clamp` copies also stay.
- **A-5c**: moving the vpk-html demo output out of its skill folder is deferred by the owner.
- **Butter state machines** (SM-FE-1/4/5/6): wait until Butter churn settles.
- **Browser-workspace MCP thread binding**: deferred; it would change the owner's `pnpm run rovo` start path.
- **Butter `/butter` page weight**: the work item stays static, so the route still fetches about 5.7 MB; pinned by a test.
- **React Compiler**: blocked on the React hooks lint backlog.

## How things work now

Things an agent would otherwise get wrong. The linked file owns the detail.

- **`pnpm run check`** runs guards, ESLint on changed files and importers, the full typecheck and the unit suites within two import levels; `pnpm run check -- --deep` adds deeper rendered and bundling suites. Owner: `scripts/check.mjs`, `.agents/rules/testing.md`.
- **`pnpm run typecheck:build`** runs TypeScript 6, the checker `next build` uses, which can reject code the native TypeScript 7 accepts. CI runs it; locally it is opt-in (about 45 s, several GB). Owner: `scripts/typecheck-build.mjs`.
- **Dev stack start and stop**: ports are allocated without colliding across worktrees; `dev:tmux:start` auto-stops idle linked worktree stacks when over the 4-stack budget (never the main checkout, a Codex worktree, another repo's server or the one being started) and logs every stop; `--no-auto-stop` refuses instead. Owner: `.agents/docs/dev-environment.md`, `scripts/lib/dev-stack-budget.js`, `scripts/lib/dev-stack-auto-stop.js`.
- **Catalog registration is generated**: the old hand-edited registries are gone; add the leaf and detail, then run `pnpm run fix:generated`. Owner: `.agents/docs/playbooks/add-component-demo.md`.
- **Test naming and the unit gate**: every `node:test` file runs; the only lists are skipped suites and the frozen legacy-drift baseline, which can only shrink. Owner: `.agents/rules/testing.md`.
- **Rendered test harness** (#2394): `renderComponent` compiles each bundle without a parent module and, after each test, removes the window and document listeners that test added, so bundles no longer stay alive for the whole run (one Butter suite had reached about 2.9 GB of heap). Compare a DOM node with `null` as a boolean (`assert.equal(node === null, true)`), as 38 asserts in three Butter suites now do: a failing assert on a node makes node:assert print the whole document until the process is killed, with no test name. Lint now rejects a new equality assert on a DOM node (`vpk-tests/no-dom-node-assert`, #2408). Owner: `scripts/lib/render-component.js`; the rule is in `scripts/lib/eslint-plugin-vpk-tests.mjs`.
- **Merging `eslint-suppressions.json`**: resolve only the conflicting hunks and keep both sides' other changes, then run `pnpm run fix:generated -- --all`. The generator only prunes, so it cannot restore an entry a merge dropped. Other generated files: take either side and regenerate. Owner: `.agents/skills/vpk-git-ship/references/merge-and-sync.md`.
- **Route JS budgets** (`routeJsBytes`, #2392): from 19 Nov the root `app/page` chunk counts only on `/`. Next lists it in every route's manifest, but only `/` loads it, so route JS figures from before 19 Nov are not comparable. First-load JS and asset count follow the same rule since #2407 (see **Frontend and performance**). Owner: `scripts/collect-perf-baseline.js`.
- **Caller identity and ownership**: one middleware resolves the caller; production defaults to the platform identity and fails closed on an invalid setting. Threads, chat sessions, generated media and RFP demo threads are per owner; records with no owner are not visible to signed-in callers. Owner: `backend/middleware/caller-identity.js`, `backend/lib/caller-identity.js`, `backend/lib/rovo-app-thread-ownership.js`.
- **Chat turn lifecycle** is a pure reducer (`app/contexts/rovo-chat-turn-machine.ts`); Stop cancels on the backend in Rovo, Studio and rovo-core.
- **Review rule**: changes to lifecycle, auth, delete or stop paths get an independent adversarial review (a fresh reviewer that tries to break the change by experiment) before merge, whatever the PR bot says. On 14 Nov each such review found real defects the bot had passed. Mechanical changes need only a diff read and counts that only fall.

## Still open

### Backend

- Deferred tool requests, after #2372: if the card write throws after the deferred call is registered, the registration stays active; after a handler failure at the end of a stream the Rovo turn is not cancelled, so what the next message does depends on Rovo Serve; the inline warning shows the raw error text.
- Media blocks, after #2373, in malformed replies only: a plain (non-JSON) body with backticks glued to text, next to a spec patch line, can show that patch line during streaming where it was hidden before, hide it where it was shown, or drop an unfinished one from the stored reply at a failure notice. A media block closed by backticks glued to a `spec` opener now generates its media and leaves the spec text in the stored reply, where it used to leave part of the request. A line ends at a line feed only; a carriage return or a Unicode line separator counts as whitespace.
- While a media block is open, work per delta grows with its length: about 0.3 s in total over a 256 KiB stream, against 2.5 ms before #2373. Most of it is the spec splitter reading the held text again on every delta.
- A whole spec patch line followed by a media opener in one delta shows the media body, and a patch line cut before its prefix is recognisable is shown; both as before #2369.
- Malformed fences (a fence opener on a patch line together with an unclosed hidden fence that runs into other backticks) can show hidden text or hide visible text: 159 of 200,000 generated delta sequences differed from the previous controller in a way that is not intended. The cause is in the sanitizer's splitters.
- While a hidden fence is open, its held text is split again on every delta, so work per delta grows with the held length (about 0.14 ms at 100 KB).
- The post-stream fallback still extracts patches inside a `spec foo` fence, although streaming now shows such a fence. The paragraph break after a dropped patch line is not joined with the one before it.
- `emitForcedTextDelta` called while a hidden-fence opener is held hides the forced text. Both production callers run after `finalizeBufferedAssistantText`, so it does not happen today.
- A card built after a failed turn has the failure notice in its summary, because the summary is the stored reply without the fence.
- On a card-first turn with no widget, a reply that starts with `{` or a code fence and then trips the inability or clarification detectors is not shown before a failure notice; it stays in the stored reply. A rerun's held whitespace is matched as a string, so three or more collapsed newlines can leave part of it in the stored reply.
- Unknown whether Rovo Serve sends keep-alive events during a pause; if not, a pause longer than the idle timeout ends the stream.
- Delete-all threads, after #2371: a run's final save that lands between file cleanup and the store clear can leave its generated file on disk; a run started during delete-all survives it; browsers may stay open past the 5 s limit.
- Smaller: a run stays `queued` if attaching its subscriber throws after creation; clearing the Rovo pool while a paused record exists.
- Voice barge-in does not always cancel the old turn on the backend.
- RFP demo thread ownership does not survive a backend restart (`backend/lib/agents-rfp-demo-job-owner.js`).
- Route guards the shared-route decision still needs: any signed-in caller holding a `toolCallId` can cancel another caller's paused tool or plan (`backend/routes/chat-control.js`, `/rovo/cancel-deferred-tool`); every signed-in caller can read the orchestrator log and timeline of all callers' turns (`backend/routes/orchestrator.js`) and the checkpoint list (`backend/routes/rovo-app.js`); `GET /api/personal-graph/*` is not blocked in production, only its writes are (`backend/routes/personal-graph.js`).
- Backend `// @ts-check` ratchet: 27 of 320 non-test backend `.js` files.
- Gateway 429s seen on title and suggestion calls during heavy runs.

### Frontend and performance

- `/rovo` and `/studio` are the heaviest routes (fetched-JS budgets 7.09 MB and 7.59 MB). The 402 KB directory chunk stays in first load. A source-only study on 18 Nov found that making the catalog repair lazy would save no startup bytes: about ten other static paths import the directory (the composer's mention sources, the header's agent selector, the agent creation context, Studio's template data), and startup needs only ids and names. The proposed first step, loading skill bodies (about 64 KB serialized) when a skill's detail editor opens, is not planned as of 18 Nov: it is under 1% of the route's JS and makes the skill editor asynchronous. Revisit it if route JS becomes a priority.
- CSS byte budgets were raised by 3,000 bytes on 18 Nov with the owner's approval, each with a `raises` entry: home, components, butter, eu26 and heavy-visual after product changes on `main` (#2385), and rovo and studio for the accessibility fixes (#2382). On 19 Nov, each again with a `raises` entry: butter and eu26 fetched CSS 750,000 → 753,000 and home route JS 35,000 → 49,000 with the owner's approval (#2392), and heavy-visual fetched CSS 738,000 → 741,000 for the progress-card focus ring (#2396). The home route JS rise added no module to the route's first load: webpack regrouped existing modules into different chunks after `empty` joined the `ui-primitives` chunk in `next.config.ts`. Butter and eu26 route JS budgets went down, 37,000 → 33,000, under the new count.
- Global stylesheet headroom is under 3,000 bytes on butter, eu26, heavy-visual, rovo and studio at their last measurement, and fetched CSS is measured only on `main`, not on pull requests, so a small CSS addition can pass its pull request and turn `main` red.
- From #2407 (19 Nov), `firstLoadJsBytes` and `assetCount` also leave the root `app/page` chunk out on every route except `/`, so earlier first-load JS and asset-count figures are not comparable. Budgets were lowered to match, with no raise: first-load JS by 14,000 bytes and asset count by 1 on every route except home, and route JS on components, rovo and studio to 62,000 each by the margin rule. The first-load JS budgets on rovo, studio and components were then lowered to the margin rule on 19 Nov (6,576,000, 7,068,000 and 2,017,000), at the owner's request.
- Hot-context narrowing (C-6) is half done: `useRovoChatControls` exists, but streamed messages still live in the one context that `useRovoChat` reads (26 non-test files outside the two context files name it). No interaction measurement recorded.
- Studio shell is the largest source file: `components/projects/studio/components/rovo-app-shell.tsx`, 3,325 lines.
- Eight behaviour differences between the Rovo and Studio shells were never decided (for example Studio ignores text typed after a prefill).
- On `/rovo`, directory-autocomplete rows are clickable one render before the composer can take the click.
- After a hot-reload edit to the chat provider or its hooks in development, the turn state React shows (active prompt, queue, retry countdown) can stay stale until the next send, because events are dropped while the provider is disposed (`app/contexts/use-rovo-chat-turn-machine.ts`). Not checked in a live dev session.
- Cancelling a local turn no longer aborts its thread creation (the thread is adopted by the next send on the same transcript), so switching away before sending leaves an empty thread in history (`app/contexts/use-rovo-chat-thread-creation.ts`).
- Deleting a thread and then selecting it can land on the deleted thread when the fetch beats the delete; a superseded selection's detach can arrive after a kept request on that thread has started; a failed delete of the thread being selected still cancels the selection.
- Stop while an edit resend waits still sends the edit. A superseded `resetChat` or `deleteAllThreads` leaves the active thread id on the old thread behind an empty transcript, and a superseded delete of the active thread still deletes it on the server.
- Remote preview capture: Ctrl/Cmd+V pastes the remote clipboard.
- F-2c: 11 suspected Butter regressions; only the keyboard traps are fixed.
- The pull-request details rail exists as three copies.
- rAF coalescing for about 49 pointer and scroll handlers has not started (C-12).

### Accessibility

- 46 jsx-a11y suppressions.
- The five defects known on 16 Nov were fixed on 18 Nov (#2382): the Jira work-item modal is a modal dialog with a focus trap, Escape and focus return; kanban cards have Move up / Move down in their menu with a live-region announcement; Delete on task-progress and agent-progress is reachable and shown on keyboard focus; a button Tag no longer contains its remove button; the Confluence body editor is a named multiline textbox. No screen-reader test was run.
- Accepted trade-off: while that modal is open, the floating Rovo launcher and chat are outside the dialog, so keyboard and screen-reader users reach them only after closing it (the sibling work-item dialogs behave the same).
- The four leftovers found while fixing those were fixed after it: remove buttons on agent chips and frontmatter list items are named once; `SkillTag` no longer contains its overlay control; the rich-text placeholder slot is no longer `aria-hidden` around a focusable button; task-progress and agent-progress cards carry their button role on a layer beside Stop, Retry and Delete, with a short name and an expanded state (#2396). That layer is a native button. A mouse click toggles the card and no longer moves focus to it (on `main` before, a click left focus on the card); keeping focus on the card after a click without showing the focus ring was not done and needs a browser to verify. Proven by rendered tests and the progress-card smoke spec; no screen-reader test was run.

### Tests and lint debt

- Source-regex suites: 320 `.source.test` files, and 16,483 `no-restricted-syntax` suppressions in 332 files. That count undercounts, because suites that read into a local `source` variable are not matched; widening the selector is an open policy question.
- React hooks lint: 252 suppressions (`refs` 68, `set-state-in-effect` 145, `immutability` 39). The shared `refs` cause (reading a ref through a hook's result object in render) was fixed at the callers on 18 Nov (#2381) with no hook API change. `purity` (4 → 0) and `static-components` (5 → 0) were cleared on 19 Nov (#2403) by changing the code. One behaviour changed with it: a progress card given no start time now fixes its default start when it mounts (`hooks/use-timestamp-ago.ts`) and counts up, where it used to freeze near 10m 50s. Since #2414 (19 Nov) `@smoke` browser specs cover that timer, the shimmer animation and reduced motion, the board auto-arrange label and the App Directory sidebar logos. What is left is mostly real work per site: derived state set in effects, external-store initialisation, imperative animation engines.
- DOM-node asserts: 270 existing sites in 44 test files are baselined under `vpk-tests/no-dom-node-assert` (#2408); the count may only fall. The rule decides from syntax alone, so it does not see a node held in a `let`, passed as a parameter, read from an object property such as `view.container.firstChild`, or returned by a helper that takes arguments.
- `.agents/skills/vpk-deploy/scripts/image-upload.test.js` failed once in CI (the first run on #2403) because its fake `docker` did not read the password piped to it; fixed in #2406, as `deploy-safety.test.js` was earlier. Both suites now write that fake from one shared helper, `.agents/skills/vpk-deploy/scripts/deploy-test-fakes.js`, which owns the stdin drain and the fixture password longer than a pipe buffer.
- Legacy-drift baseline: empty. All 44 suites were repaired and returned to the gate on 18 Nov (#2383, #2384 and the change that emptied the list); the list may only shrink, so it stays empty. The graph demo's origin defaults now declare 0.5, the value the parameter clamp always produced, and a test checks that every numeric demo default survives the clamp unchanged.
- Realtime voice reducer (SM-FE-16): characterization tests exist, the reducer does not.
- Open policy question: enforce unused exports and types.

### Tooling

- `pnpm control-vpk` extras (A-2): element crop, frame sequence, GL capture, multi-step recipes, `eval --file`, and frame-rate and A/B serving scripts.
- Dev-stack auto-stop exempts Codex worktrees only (`isCodexWorktree` in `scripts/lib/dev-stack-budget.js`); the owner closed the Cursor worktrees on 16 Nov 2026 instead of adding a Cursor exemption.
- Auto-stop stops nothing when stopping every safe stack still would not get under budget; it could stop the safe ones anyway.
- Linked worktrees pile up; run `vpk-git-clean` periodically.

## Owner actions

- **Deploy auth to pdev** and run the checks in the #2311 PR body before anyone relies on per-owner data, starting with the identity checks.
- **Persistent `backend/data`**: no volume is mounted, so a redeploy wipes threads. Decide volume, object storage or accept it, before anyone relies on stored threads.
- **Existing threads after deploy**: decide whether to run `backend/scripts/backfill-rovo-thread-owner.js`; ownerless threads are invisible to every signed-in caller.
- **Codex automations**: review the four `PAUSED` drafts in `.agents/automations/` and set `status = "ACTIVE"` in `~/.codex/automations/<id>/automation.toml` for the ones to run; install `automation-merge` from its tracked definition.
- Optional: SSH access to the service for future data backups.
- Optional: one adversarial review with experiments of cross-owner reads, writes and deletes before the deploy.

## Not verified

- Ownership was verified by reading and by unit tests, not against a running deployment.
- The Micros service descriptor and service-proxy format were not checked against the platform docs.
- The 177 merges after 14 Nov were sampled, not re-reviewed line by line.
- How adversarial the reviewer-subagent reviews of 14–15 Nov were. That window merged the auth and ownership work, the chat-turn reducer and Stop cancellation (#2333, #2339, #2344, #2346) and dev-stack auto-stop.
- The home page "21.4 MB → 8.6 MB" JS figure from #2290 does not match the budget file (home all-frames ceiling 3.24 MB); it is probably a different counter. Treat it as unconfirmed.
- Skill trigger eval numbers (#2337, #2350), the vpk-grab release and the Butter work from parallel sessions were not reviewed.
- Cold-start cost of each dev-output option was never measured.

## Counts and how to re-measure

| Count | Value | Command |
|---|---|---|
| `.source.test` files | 320 | `git ls-files \| grep -cE '\.source\.test\.'` |
| `.behavior.test` files | 196 | `git ls-files \| grep -cE '\.behavior\.test\.'` |
| DOM-node assert suppressions | 270 in 44 files | `node -e 'let c=0,f=0;for(const r of Object.values(require("./eslint-suppressions.json"))){const v=r["vpk-tests/no-dom-node-assert"];if(v){c+=v.count;f++}}console.log(c+" in "+f+" files")'` |
| `no-restricted-syntax` suppressions | 16483 in 332 files | `node -e 'let c=0,f=0;for(const r of Object.values(require("./eslint-suppressions.json"))){const v=r["no-restricted-syntax"];if(v){c+=v.count;f++}}console.log(c+" in "+f+" files")'` |
| React hooks suppressions | 252 | `node -e 'let n=0;for(const r of Object.values(require("./eslint-suppressions.json")))for(const[k,v]of Object.entries(r))if(k.startsWith("react-hooks/"))n+=v.count;console.log(n)'` |
| jsx-a11y suppressions | 46 | `node -e 'let n=0;for(const r of Object.values(require("./eslint-suppressions.json")))for(const[k,v]of Object.entries(r))if(k.startsWith("jsx-a11y/"))n+=v.count;console.log(n)'` |
| Legacy-drift suites | 0 | `node --input-type=module -e 'import("./scripts/js-unit-test-legacy-drift.mjs").then(m=>console.log(m.LEGACY_DRIFT_TEST_FILES.length))'` |
| Non-test backend `.js` files | 320 | `git ls-files backend \| grep -E '\.js$' \| grep -v '\.test\.' \| grep -c .` |
| Backend `@ts-check` files | 27 | `git ls-files backend \| grep -E '\.js$' \| grep -v '\.test\.' \| xargs grep -l '^// @ts-check' \| grep -c .` |
| `noUncheckedIndexedAccess` errors | 2881 | `node --max-old-space-size=4096 ./node_modules/@typescript/native/bin/tsc --noEmit --noUncheckedIndexedAccess \| grep -c 'error TS'` |
| Studio shell | 3325 lines | `wc -l < components/projects/studio/components/rovo-app-shell.tsx` |
| Files naming `useRovoChat` | 26 | `git grep -lw useRovoChat -- '*.ts' '*.tsx' \| grep -v '\.test\.' \| grep -vxE 'app/contexts/context-rovo-chat(-controls)?\.tsx' \| grep -c .` |
| `AGENTS.md` | 20860 bytes | `wc -c < AGENTS.md` |
| `/rovo`, `/studio` fetched JS and home all-frames JS budgets (bytes) | 7088000 7591000 3240000 | `node -e 'const r=require("./scripts/perf-route-budgets.json").routes;console.log(r.rovo.fetchedJsBytes,r.studio.fetchedJsBytes,r.home.fetchedJsBytesAllFrames)'` |

Run the commands from the repo root. The backend counts include top-level files such as `backend/server.js`, which the pathspec `'backend/**/*.js'` skips (315 files), and match `// @ts-check` on any line, because `backend/scripts/backfill-rovo-thread-owner.js` has it on line 2 after a shebang.

Corrections to the temporary summary: "about 300" source-regex tests is a file count (290), not the assertion debt; hooks lint is 361, not "about 380"; `noUncheckedIndexedAccess` is 2,881 now, not 2,855; the review's 144 behaviour suites and 26 of 312 `@ts-check` files have since grown to 196 and 27 of 320.

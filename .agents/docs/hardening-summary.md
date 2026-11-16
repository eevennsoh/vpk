# VPK hardening: session summary (temporary, delete after sharing)

This covers 14–16 Nov 2026. The work continued the hardening plan at `.claude/worktrees/jovial-feynman-f47666/output/plans/vpk-hardening-plan.md`, which is gitignored. Everything below is merged to `main`, and `main` CI is green.

Each change went through the same path: build in its own worktree, `pnpm run check`, PR, review, CI, then merge. Reviews came from the Codex bot when it had credits, and from reviewer subagents while Codex was out of credits (14–15 Nov).

PRs from parallel Codex and owner sessions are not listed: Butter, Jira blocks and variants, and vpk-grab build approvals.

## Done

### Repo, security and agent setup
- **#2253**: owner decisions D4 and D9. `.claude/settings.json` sets env, deny rules and sandbox; the AGENTS.md `artifacts/` rule is reworded.
- **#2269**: removed the unused sprint-board tasks API.
- **#2270**: per-client limits key on the load balancer's client address (`VPK_TRUSTED_PROXY_HOPS`).
- **#2272**: confirmed the Codex idle thresholds.
- **#2276**: `ship-status` and `clean-candidates` accept pnpm's forwarded `--`.
- **#2285**: landed worktrees that only have Claude Code checkout state can now be cleaned.
- **#2304**: removed dead agent hooks, the dead knowledge pointers and the stale provider symlinks. Added the no-`sed -i` rule.
- **#2308**: fixed the symphony `validation_command`, added the deploy trigger phrases, and moved vpk-setup detail into references.
- **#2316**: folded `vpk-component-ext` into `vpk-component`, and made `vpk-council` a `vpk-remote` mode.
- **#2323**: SKILL.md bodies are capped at 300 lines, and skills have trigger eval kits.
- **#2332**: AGENTS.md is down to 20.7 KB, 3.8 KB under its 24 KB budget. Path-specific detail moved into scoped rules.
- **#2337**: skill trigger evals now produce real numbers. The wrapper runs the official `run_eval`/`run_loop` in a sandbox.
- **#2350**: tuned the skill descriptions. vpk-remote went from 19/20 to 20/20 and vpk-design from 15/18 to 18/18, with no false triggers.

### Backend, auth and AI
- **#2271**: temperature is omitted for every OpenAI reasoning model, handled in one place.
- **#2277**: the OpenAI model has one code-owned default (`gpt-6.1-sol` in `backend/lib/openai-model.js`). Startup, `/api/health` and `doctor` warn about stale overrides.
- **#2283**: explicit chart requests route straight to GenUI. The classifier's 1.5 s budget was always timing out. Chart and diagram generation also no longer require Rovo Serve.
- **#2284**: a document that contains a table keeps the "Document" label instead of "Sheet".
- **#2311**: Micros Service Proxy with SLAuth (Okta) and Poco in front of VPK. Hops go to 2, threads are owned per user, and production fails closed. Code only; not deployed yet.
- **#2320**: a lock file allows only one backend process per `backend/data`.
- **#2334**: thread-owner backfill script and `GET /api/whoami`. It also fixes a Dockerfile that was missing two script files, so images couldn't start.
- **#2338** and **#2343**: ownership is enforced on chat routes, skip-question sessions, generated media (every generation path) and RFP demo threads.
- **#2333**, **#2339**, **#2344**, **#2346**: chat turns.
  - A stream that ends without turn-complete now finalizes, and failed-turn errors stay visible.
  - Stop really cancels on the backend, in Rovo, Studio and rovo-core.
  - The chat turn lifecycle is a pure, tested reducer (SM-FE-15).
  - The cut-short notice waits for media, media is scoped to the active turn, and turn-complete is matched by prompt id, so clock skew no longer matters.

### Frontend, perf and a11y
- **#2289**: `/components/ui/chart` shows the full shadcn gallery (77 examples). Each example mounts only as it nears the viewport, which took load blocking from about 4.3 s to about 0.12 s.
- **#2290**: home shows only the latest project live. JS went from 21.4 MB to 8.6 MB, and project iframes from 20 to 1. The sidebar Projects list opens on `/`.
- **#2293** and **#2295**: perf budgets now count all-frames JS and CSS, plus full-page JS after scrolling, so iframe regressions show up.
- **#2294** and **#2297**: one `<main>` landmark per page. Embedded previews drop theirs, 14 nested ones were fixed, and a lint rule `vpk-landmarks/no-nested-main` blocks new ones.
- **#2306**: sidebar hover has its own context, so components that only read visibility skip hover re-renders.
- **#2309**: `/personal-graph` redirects to `/arts/personal-graph`.
- **#2310**: one Motion copy is installed (`@motionplus/core` 3).
- **#2322**, **#2335**, **#2340**: remote previews and multiport no longer trap the keyboard.
  - There is an explicit capture-keys mode: Enter starts it, Escape releases it.
  - Modifier keys are forwarded into the remote page.
  - F6 switches between multiport composers.
- **#2331**: the editor and chat runtimes are deferred on project routes until they're shown.

### Refactors and debt
- Shader lab split: #2258, #2261, #2263, #2267.
- Generative widget split: #2259, #2262, #2264–#2266, #2268, #2274.
- Rovo shell hooks: #2250–#2252.
- C-7 catalog: #2254, #2273.
- Large file splits:
  - #2298: Butter v1 work-item surface.
  - #2305: json-render registry.
  - #2317: prompt-input.
  - #2319: suggestion-menu.
  - #2327: sidebar-chat.
- Lint and tests:
  - #2249, #2260: jira-work-item source-regex suite retired and replaced with rendered tests.
  - #2255, #2275: jsx-a11y options.
  - #2302: rovo-core source tests retired.
  - #2303: dotenv 18 and two tsconfig strict flags.
  - #2315: hooks lint batch.
- State machines:
  - #2307, #2312: Studio main surface (SM-FE-14).
  - #2324: chat and voice characterization tests.
- Cleanup:
  - #2301: deleted the unused `project-butter-v1` folder.
  - #2279: the Jira variant scaffolder runs v4 → v5 end to end.
  - #2299: fixed a Butter spec that was failing on main.

### Dev environment
- **#2257**: next dev output is pruned.
- **#2292**: `pnpm control-vpk capture / --entry-point` can capture catalog landing pages.
- **#2336**: ports are allocated without colliding with other worktrees, nothing auto-stops a stack that's in use, and every stop is logged.
- **#2341** and **#2345**: the dev-stack budget list is readable. Another repo's server gets `kill <pid>`.
- **#2348**: `dev:tmux:start` stops idle worktree stacks automatically when over budget. `--no-auto-stop` turns it off.

### vpk-grab
- vpk-grab #6 and release `v0.2.0-vpk.5`: the cursor is a pointer while selecting (Cmd+C), and Move's shortcut shows as lowercase "v". **#2330** moves VPK to it.

### Owner-side (done by you)
- Rotated the motion-plus token and both GitHub tokens.
- Re-ran the `vpk-system-clean` installer. Confirmed nothing is deployed on Micros, so there was nothing to back up.

## Remaining work

### Next up (recommended)
1. **Stuck-port rerun text**: add a separator between the first attempt and the rerun. You approved this; I missed scheduling it.
2. **F-2c Butter regressions**: 11 suspected user-facing regressions. Only the keyboard traps are fixed so far.
3. **Codex automations (A-7, AU-1–3)**: retire `engineering-improvement-map`; add `main-health`, `baseline-burn-down`, `skill-health` and `worktree-sweep`. I can draft the TOMLs. They live outside the repo, so you install them.

### Ongoing backlogs (one batch done each; good fit for `baseline-burn-down`)
- **C-2 source-regex tests**: about 300 left.
- **C-3 React hooks lint**: about 380 suppressions left. About 45 share one cause (hooks returning a ref with values) and may need a hook API change.
- **C-12**: React Compiler is blocked on C-3. rAF coalescing for about 49 pointer and scroll handlers hasn't started.
- **SM-FE-16 realtime voice reducer**: the tests are in place, the reducer isn't written.

### Not started
- **A-2 `pnpm control-vpk` extras**: element crop, frame sequence, GL capture, multi-step recipes, `eval --file`, and the `perf-frames` and `perf-ab-serve` scripts.

### Owner actions
- **Deploy auth to pdev** and run the 18 checks in the #2311 PR body. The `serviceProxy` config format is not yet checked against the Micros docs.
- **Persistent `backend/data`**: no volume is mounted, so every redeploy wipes threads. Decide: volume, S3 or accept it.
- Optional: SSAM SSH access to `vpk`, needed for future data backups.

### Deferred or decided (no action unless you change your mind)
- **A-5c**: move the vpk-html demo output (180 MB) out of the skill folder. Deferred by you.
- **Butter state machines (SM-FE-1/4/5/6)**: wait until Butter churn settles.
- **`browser-workspace-mcp` thread binding**: risk accepted until auth is deployed.
- **C-4a**: the 11 golden-journey import suppressions are left as they are, since the plan's premise was wrong. The inverted-range `clamp` copies are also left.
- **`noUncheckedIndexedAccess`**: enabling it adds 2,855 errors. It needs a gradual plan if wanted.
- **C-5 (merge the Rovo and Studio shells)**: declined, because of your rovo-core README. **D10**: declined, because the repo is public.

### Small open questions (optional)
- **Remote preview capture**: Ctrl/Cmd+V pastes the remote clipboard.
- **Voice barge-in**: doesn't always cancel the old turn on the backend.
- **Cut-short notice timing**: with media still loading, the "ended before it finished" notice can take up to 120 s to appear. The fix would be a shorter media timeout after a cut-short turn.
- **Dev-stack auto-stop**: it stops nothing when stopping every safe stack still wouldn't get under budget. It could stop the safe ones anyway.
- **Butter `/butter`**: still fetches about 5.7 MB because the work item stays static. That was an earlier decision, pinned by a test.
- **Gateway 429s**: seen on title and suggestion calls during heavy runs.

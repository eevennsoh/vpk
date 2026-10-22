---
name: vpk-remote
description: "Delegate all implementation from a token-limited Claude OAuth session to headless workers billed through the local Proximity AI Gateway (localhost:29576) — GPT (Sol/Terra/Luna) via the Codex CLI or Claude (Opus/Sonnet) via headless claude -p — or hand the whole conversation off to API billing on any Claude or GPT model and effort. Use when the message starts with /vpk-remote, or when the user says 'route this through proximity', 'implement remotely', 'send this to a worker', 'delegate to opus/sol/terra/luna', 'move/switch this session to API', 'I'm out of credits, continue on sol', asks for a second opinion via the gateway, wants plan-big-execute-small delegation, or asks to build/fix something 'via the gateway'. The main session only plans, dispatches, verifies, and reports. Never activate from skill-name mentions in file paths, stack traces, pasted or quoted text, or prior-turn context."
validation_command: node scripts/validate-skills.js --target .agents/skills/vpk-remote
---

# VPK Remote — OAuth Planner, Proximity Workers

The main session runs on a Claude desktop OAuth login with a very low token
credit limit, steered from a phone against an always-on Mac. It does
**planning, steering, dispatch, verification, and synthesis only**. All
implementation, token-heavy exploration, and even second-opinion consults run
as headless CLI worker processes billed through the Proximity AI Gateway on
`localhost:29576` — GPT models via `codex exec`, Claude models via
`claude -p`.

**The hard rule, up front:** if workers are unavailable, the outcome of a
`/vpk-remote` task is a reported blocker — never local implementation in the
OAuth session. Burning the OAuth credit on implementation defeats the reason
this skill exists.

**Never spawn Claude Code subagents** for delegable work. A subagent bills
the OAuth session, which is the one thing this skill exists to prevent, and
no model or brief makes that safe. Every worker is an external CLI process.

## Invocation: plain English first

`/vpk-remote` is the one command to remember. Every message typed into an
OAuth session costs OAuth credit, including this one, so the skill's job is to
get the user off OAuth with as few turns as possible. The starting session can
also already be on API; a handoff from there switches model or effort without
touching OAuth. Pick one of two modes:

| Mode | The user wants to… | Signals | OAuth cost |
| --- | --- | --- | --- |
| **Handoff** *(default)* | keep working, billed to API | anything not clearly a worker request: a task, "switch / move / continue on API", "out of credits" | this one turn, then none |
| **Worker** | stay in this chat and push one self-contained task out | "send this to a worker", "in the background", "have sol review…", "second opinion", "fan out" | a few turns per task (brief + report) |

The model does not decide the mode: both modes run any Claude or GPT model,
same vendor or not. Ask instead whether the user wants to keep conversing
(handoff) or only wants a result back (worker). A handoff to the *same* model
is the common credit-saving case.

When handoff carries a self-contained task ("/vpk-remote fix the sidebar
flicker"), fork the session and run the task **in the background** on API —
no window opens, the run verifies its own work, and a notification shows its
one-line result. When the user
wants to keep chatting, open the fork in a new terminal window instead. Follow
[references/session-handoff.md](references/session-handoff.md). The rest of
this file describes worker mode.

**Extract model and effort from prose.** Short names resolve through the
`ALIAS_*` entries in `~/.config/litellm-proximity/defaults.env` (`opus`,
`sonnet`, `haiku`, `sol`, `terra`, `luna`, …), and a full model ID is
accepted as-is. Effort words map directly: "medium", "high", "xhigh" /
"extra high", "max" / "maximum" / "think as hard as you can". Unstated model
or effort takes the defaults in that same file — read it each run, never
hardcode values here.

Only treat a word as a model or effort when the sentence uses it **as a
setting** ("on sol", "with opus", "at high effort", "use terra"). In "fix
the high contrast toggle" or "the luna theme is broken", *high* and *luna*
are task text. When a reading is genuinely ambiguous, ask one short
question rather than guess.

Examples:

```text
/vpk-remote fix the sidebar flicker                               → handoff in the background, defaults
/vpk-remote I'm out of credits, move this chat to sol            → handoff, sol
/vpk-remote continue my last session on opus at max             → handoff, --continue, opus, max
/vpk-remote send a worker to rename useFoo to useBar             → worker, defaults
/vpk-remote have terra review this diff in the background       → worker, terra
/vpk-remote second opinion from opus on this plan               → advisor consult (worker)
```

Always echo the parsed plan in one line before acting (mode, model, effort),
so a misread costs one glance instead of a wrong run.

### Explicit flags (optional)

Flags still work and override prose. They are never required.

| Flag | Values | Default |
| --- | --- | --- |
| `--model` | any alias or full ID | `defaults.env` |
| `--effort` | `medium` `high` `xhigh` `max` | `defaults.env` |
| `--worker` | *(no value)* — force worker mode | off (handoff is the default) |
| `--advisor` / `--no-advisor` | *(no value)* | **on** |
| `--fanout` / `--single` | *(no value)* | **auto** (see *Worker shapes*) |
| `--worktree` / `--no-worktree` | *(no value)* | **on for briefs that write** (see *Worktree isolation*) |

`/vpk-remote` with nothing after it hands the session off with no first prompt.

All three behavioral defaults are **on**: the planner isolates writing work in
a worktree, consults an advisor, and fans out read-only work without being
asked. `--no-worktree`, `--no-advisor`, and `--single` are the escape hatches,
and `--worktree` / `--advisor` / `--fanout` force the behavior in cases the
planner would otherwise judge too small for it.

**Lane follows the model family**: a `claude-*` model runs on the Claude
lane (`claude -p`), a `gpt-*` model on the GPT lane (`codex exec`). An
unknown model name or effort value is an error to report, never a near-match
guess.

`medium` `high` `xhigh` `max` are valid on both lanes. `low` exists in the
CLIs but workers do not use it: the planner's credit is the scarce resource,
and a worker that under-thinks buys a correction round on the expensive side
of the boundary. Handoff sessions may use `low`, since the user is steering
them directly.

### Choosing effort

Do not coast on the default — pick from the task's shape. Effort and
verification are substitutes only where a proof command exists; where it
doesn't, effort is the sole quality lever.

| Task shape | Effort | Why |
| --- | --- | --- |
| Advisor consults, and genuine design ambiguity — unruled-out failure modes, a call the brief cannot settle | `xhigh` | Nothing verifies judgment. No proof command backstops a wrong call, so thinking is the only lever. |
| Explicit request for the deepest reasoning, or an exceptional judgment call where `xhigh` proved insufficient | `max` | This is opt-in because it trades the most worker time and tokens for one more reasoning tier. |
| Implementation against a clear spec — the common case | the default (`medium` unless `defaults.env` says otherwise) | The proof command backstops mistakes, so effort and verification share the load. Raise to `high` for multi-file or subtle changes. |
| Mechanical sweeps — renames, mass migrations, formatting, "apply this same edit to these 9 files" | `medium` (never above) | The brief fully determines the answer. Higher effort here buys scope creep, not correctness: a maximally-thinking worker starts finding adjacent improvements nobody asked for. |

Before reaching for the effort knob on a task that failed once, re-read the
brief first. Round-trips come far more often from an underspecified brief
than an under-thinking worker, and raising effort on a vague brief just
produces a confident wrong answer sooner.

Examples:

```text
/vpk-remote rename useFoo to useBar across components/, medium effort is fine
/vpk-remote --model terra --effort xhigh <task>
```

## Hard preflight (blocking)

Run before writing any brief; every check must pass or the task ends as a
reported blocker.

```bash
curl -fsS --max-time 5 http://localhost:29576/openai/v1/models >/dev/null
```

- Gateway health only. Proximity's model catalog is **stale** (it lists
  models older than what the gateway actually serves — verified: the catalog
  tops out at gpt-5.5 while `gpt-5.6-sol`, `gpt-5.6-terra`, and
  `gpt-5.6-luna` work).
  **Never grep the catalog for the target model**; a model rejection at
  dispatch time is itself a blocker to report.
- GPT lane: `codex --version` succeeds.
- Claude lane: `"$HOME/.local/bin/claude" --version` succeeds and
  `test -f "$HOME/.claude/settings-gw.json"` passes.

On failure: report which check failed and stop. Never fall back to
implementing in the OAuth session, never substitute the planner's own model,
never retry through a shell alias.

## Billing boundary

- **Planner:** this Claude session (OAuth, low credit). Owns decisions,
  briefs, review, final proof, synthesis.
- **Workers:** external CLI processes whose requests go only to Proximity.
  Own repo mutation and token-heavy reading.
- **Upstream credential:** owned by Proximity. Never appears in briefs,
  reports, worker homes, or repo files.
- **Never spawn Claude Code subagents** (Agent tool) for delegable work —
  they bill the OAuth session.
- **Never invoke shell wrappers** — `claude-gw`, `codex-gw`, `vpk-codex*`,
  `codex-use-*`. They are zsh functions/aliases that do not resolve in
  non-interactive shells, and an alias change could silently redirect
  billing. The canonical commands in the references are fully inlined; their
  `env …` prefix also bypasses same-name shell functions by construction.
- Always unset ambient credentials in worker env: `OPENAI_API_KEY` /
  `CODEX_API_KEY` (GPT lane) and `ANTHROPIC_AUTH_TOKEN` /
  `CLAUDE_CODE_OAUTH_TOKEN` / `CLAUDE_EFFORT` (Claude lane). The parent
  session exports its own `ANTHROPIC_BASE_URL` and `CLAUDE_EFFORT`, so the
  Claude-lane recipe sets both explicitly rather than trusting inheritance.

## Worktree isolation

**Every brief that writes files gets its own git worktree, by default.** This
skill is steered from a phone, so several tasks on unrelated problems are
routinely in flight at once. Workers sharing one checkout do not error when
they collide — the later write simply wins, and you get two confident reports
describing a diff that matches neither. That is the same mechanical hazard the
*Worker shapes* fan-out rule guards against, at the scale of concurrent tasks
rather than concurrent workers, and it is invisible from a phone.

Two further reasons the default is on, not merely available:

- **`main` is protected.** Direct pushes are blocked and a PR plus passing
  checks is required, so the work becomes a branch regardless. Writing in the
  checkout only defers branching; it never avoids it.
- **Every other agent surface already does this.** Codex, Cursor, and Claude
  Code each create a per-task worktree. Writing in place makes this skill the
  lone outlier.

| Brief | Worktree |
| --- | --- |
| Writes files (implementation, refactor, migration) | **yes** — default on |
| Read-only (advisor consults, audits, research, fan-out) | **no** |

Read-only briefs are dispatched `--sandbox read-only` (GPT) or
`--permission-mode plan` (Claude), so they *cannot* write. Isolation buys
nothing there and costs setup, which is why the default is keyed to the same
"does this brief write?" predicate that already picks the worker shape.

### Creating the worktree

Branch from the current `main` and place it under the repo's ignored
`.claude/worktrees/`, one per task:

```bash
branch="remote/<short-task-slug>"
tree="$PWD/.claude/worktrees/<short-task-slug>"
git worktree add -b "$branch" "$tree" main
```

Then **warm it up before dispatching** — a fresh worktree has no
`node_modules` and no `.env*`, and the brief's proof command is usually
`pnpm run lint` / `pnpm run typecheck`, which cannot run without them:

```bash
cp "$PWD"/.env.local "$tree"/.env.local 2>/dev/null || true
(cd "$tree" && CI=true pnpm install --prefer-offline)
```

Per repo guidance, do **not** run parallel pnpm validations until warmup
completes. Dispatch the worker with `-C "$tree"` (GPT lane) or from `$tree`
(Claude lane), and write the brief's *Exact repo paths* relative to that
worktree. `output/` artifacts stay under the **main** checkout so reports from
concurrent tasks remain readable in one place.

### Landing

The worker commits its work to the task branch inside the worktree; the
planner verifies the diff there and reports. **Stop at a verified diff** —
pushing the branch and opening a PR is `/vpk-git-ship`, run only when the user
asks. Nothing outward-facing happens on the strength of a passing proof
command alone.

Leave the worktree in place after reporting so the user can inspect it.
Cleanup of landed branches is `/vpk-git-clean`, never an automatic step of
this skill — and never `tmux kill-server` or `portless prune`, which cascade
across every worktree.

### When `--no-worktree` is right

Writing in the current checkout is correct when the task *is* the checkout's
uncommitted state — amending work already in progress there, or a change the
user is actively watching in a running dev server. Say which one applies when
the flag is used, and check `git status` first so the worker is not handed a
dirty tree it will silently fold into its diff.

## Procedure

1. **Ground.** Read only enough repo context to identify the owner, the
   constraints, and the proof command. The planner judges; it does not spend
   its scarce context on mechanical coverage. Part of grounding is the
   **reading-volume test**: every handoff bills the brief and the report
   twice (written by one side, read by the other), so delegation must clearly
   dominate that overhead — for tiny read-only questions, just answer;
   any non-trivial mutation still goes to a worker.
2. **Isolate.** If the brief writes files, create and warm the task worktree
   per *Worktree isolation* above, and confirm warmup finished before
   dispatch. Skip for read-only briefs and under `--no-worktree`.
3. **Freeze the brief** to a file — Goal / Exact repo paths / Constraints /
   Non-goals / Proof expected / Output shape, per
   [references/dispatch-patterns.md](references/dispatch-patterns.md). Never
   inline a brief into a shell command.
4. **Dispatch** via background Bash using the lane's canonical command:
   [references/gpt-executor.md](references/gpt-executor.md) or
   [references/claude-executor.md](references/claude-executor.md).
   Write that command to `run.sh` in the worker directory and launch it
   through the surface wrapper (see *Terminal surfaces*) rather than running
   it bare, so the user can watch the worker in herdr.
5. **Read only the report file.** Never stream or parse raw worker output —
   raw material stays in worker contexts; that is where the credit and
   context-window savings come from. An absent or empty report does **not**
   imply an absent diff: a worker killed mid-run may have already written
   every file. Always check `git status` in the task worktree before
   re-dispatching.
6. **Verify.** Inspect `git status` and `git diff` **in the task worktree**,
   run the brief's proof command if cheap (targeted `node --test`, a single
   grep). Delegate heavy verification (full `pnpm run lint &&
   pnpm run typecheck`, suites) as its own follow-up brief. A worker never
   self-certifies.
7. **Correct at most twice.** Send focused follow-ups to the same worker
   (GPT lane: `resume`; Claude lane: re-brief with the prior report + diff
   summary). After two failed correction cycles, stop and report the
   blocker — the planner does not silently take over implementation.
8. **Verify with an advisor** (default-on; see *Mode: advisor*). Send the
   diff and the original goal to the other family for an independent read
   before reporting done. Skip only for a trivial diff or under
   `--no-advisor`.
9. **Synthesize.** Outcome, proof, what the advisor confirmed or flagged,
   which branch and worktree hold the diff, and genuine blockers. Cite worker
   evidence rather than re-deriving it.

## Mode: advisor

A second opinion at high judgment moments, billed to Proximity: a
**read-only** consult brief, dispatched with the same lane commands as any
other worker.

**Consults are on by default.** The planner runs them without being asked,
stating that it is consulting and why. `--advisor` on its own makes a consult
the entire task; `--no-advisor` suppresses them for a run.

**Standing consult — every task that produces a diff:**

- **Pre-completion verify.** Before reporting work as done, send the diff and
  the original goal to the other family for an independent read. This is the
  verifier shape, and it is the one that pays off when you are steering from
  a phone: it is a second pair of eyes you did not have to ask for, and it
  costs you one line in the summary.

**Additional consults, on judgment:**

1. **Stuck** — after roughly two failed correction cycles on the same
   problem, before dispatching a third variation of the same idea.
2. **Before committing to an approach** whose design decision the brief
   cannot settle and where a wrong call means discarding the worker's output
   rather than amending it.

**Where consults are skipped** — the default is on, not unconditional. Skip
the verify for a trivial diff (a copy change, a one-line fix, a mechanical
rename a proof command already covers), because a consult spends planner
tokens on both sides — writing the brief and reading the advice — while the
thinking itself bills Proximity. When a wrong call would cost less than that
handoff, decide and move. Never consult on single-step questions or an
obvious plan.

**Default to the family that did not do the work.** Cost no longer picks the
advisor — every lane bills Proximity — so what a consult buys is
*independence*, not a capability tier. A GPT worker's blind spots are found
most cheaply by a Claude reviewer and vice versa; asking the same family to
audit its own reasoning re-runs the same priors.

| Work under review | Advisor default |
| --- | --- |
| GPT-lane worker output (`sol` / `terra` / `luna`) | `opus` alias at xhigh |
| Claude-lane worker output (`opus` / `sonnet`) | `sol` alias at xhigh |
| A plan this planner wrote, or nothing dispatched yet | `sol` alias at xhigh |

The third row follows from the second: **this planner is Claude**, so
anything it authored is Claude-family work and a Claude advisor would review
its own priors. GPT is the independent reviewer by default, and Opus is
reached for only when GPT actually did the work.

All rows are `xhigh` for the reason in *Choosing effort* above: advice is
unverifiable, so effort is the only quality lever a consult has.

Explicit flags always win: `/vpk-remote --advisor --model sol <question>`
forces a GPT consult regardless of what ran before it.

Consult moments, packaging checklist, and advice shape:
[references/advisor-pattern.md](references/advisor-pattern.md). The advisor
never edits files; after advice returns, state in a sentence what you adopt
or reject, then continue.

## Worker shapes

Shape is chosen automatically from the brief, not requested:

| Brief | Shape |
| --- | --- |
| Writes files (implementation, refactor, migration) | **Single worker**, always |
| Read-only and splits into 2+ independent reading scopes | **Fan-out**, 2–5 workers |
| Read-only, one scope | Single worker |

**Fan-out is the default for read-only work** — research, audits, sweeps,
"check X across these areas" — dispatched in one message with disjoint
reading scopes, every brief carrying an explicit "make no edits" constraint.
Lanes may mix (e.g. sonnet + sol in parallel). Wait for every report before
synthesizing; never conclude from a partial fan-out.

**Fan-out can never be the default for briefs that write.** This is a
mechanical constraint, not a preference: parallel workers share one worktree
and will overwrite each other's edits, leaving a diff no report describes.
`--fanout` on a writing brief is therefore an **error** — report it and ask
whether to split the task into provably disjoint write scopes (which then
runs as a fan-out of narrower briefs) or to run it single. Implementation
otherwise stays one worker iterated via follow-ups.

Worktree isolation is **per task, not per worker**, so it does not soften this
rule — every worker on one task shares that task's worktree and collides there
exactly as described. What it prevents is the same collision *between*
concurrently dispatched tasks; see *Worktree isolation*.

Full shape, sizing, and completion rules:
[references/dispatch-patterns.md](references/dispatch-patterns.md).

## Terminal surfaces

When the planner runs inside herdr (`HERDR_ENV=1`), every worker, advisor, and
handoff gets a visible, labelled surface instead of an invisible background
process. The planner launches the wrapper with background Bash exactly as
before; the wrapper places the run, waits, and exits with the worker's status,
so the harness still notifies on completion. Outside herdr the same command
runs the worker inline, so there is one recipe for both.

```bash
node scripts/agent-surface.js run \
  --script "$worker_root/run.sh" --label "<task-slug>-worker-1" \
  [--worktree "$tree"] [--group "<task-slug>"]
```

| Run | Flags | herdr surface |
| --- | --- | --- |
| Writing worker in its task worktree | `--worktree "$tree"` | the worktree's own **workspace** |
| Fan-out (2–5 read-only workers) | `--group "<task-slug>"` on every worker | one **tab**, one **pane** per worker |
| Single read-only worker or advisor | *(neither)* | a new **tab** in the planner's workspace |
| Handoff `--new-window` | handled by `ai-api` | a new **tab** running the forked session |

The `run.sh` keeps the lane's redirects: the report still lands in
`report.md`, and the pane shows `stderr` and progress for the user. The
planner reads only the report, as before. Each pane reports its state to
herdr, so the sidebar shows the worker as `working`, then `done` (with `exit N`
on failure), and `herdr agent wait <label-slug>` can block on it. Panes are left
open after exit so the user can scroll them; close them only when the user
asks. Conventions, status reporting, and cleanup: `.agents/docs/herdr.md`.

## Artifacts

Everything lives under gitignored `output/`:

```text
output/remote-gpt/worker-<n>/      # home/ (CODEX_HOME), brief.md, report.md, followup-<k>.md
output/remote-claude/worker-<n>/   # brief.md, report.md, stderr.log, followup-<k>.md
output/remote-<lane>/advisor-<n>/  # advisor consults, same layout as that lane's workers
```

One directory per worker; never reuse a directory across concurrent workers.

Artifacts stay under the **main checkout's** `output/`, never inside a task
worktree, so reports from concurrently dispatched tasks stay readable in one
place and survive worktree cleanup. Name the worker directory after the task
when several are in flight (`output/remote-gpt/<task-slug>-worker-1/`).

## Boundaries

- The planner never edits repo files during a `/vpk-remote` task; workers own
  mutation. (Exception: none. Even one-line fixes are a worker brief or an
  honest "this is too small to delegate — want me to spend OAuth credit on
  it?" question to the user.)
- The advisor cannot edit files, and this is **enforced by the dispatch flags**
  — `--permission-mode plan` on the Claude lane, `--sandbox read-only` on the
  GPT lane — never by the brief alone. It matters most for the pre-completion
  verify, where the worker's diff is uncommitted and a post-consult
  `git status` could not distinguish an advisor's edit from the worker's.
- Workspace-write sandboxing is the GPT-lane default; do not escalate to
  bypass mode. The Claude lane runs with permissions skipped, so the brief's
  scope boundaries are its only guardrail — write them explicitly.
- Never copy, link, or read `~/.codex/auth.json` or any OAuth credential
  into a worker home.
- Never modify `~/.codex/config.toml`, `~/.claude/settings-gw.json`, or
  model pins as part of a run.
- A missing or empty report after worker exit is an infrastructure failure —
  **check `git status` in the task worktree first**, since a worker killed
  mid-run may have completed every edit and died before emitting its report.
  Re-dispatch that brief once to a fresh worker only if no diff landed. A
  well-supported "not found" is a valid finding, not a failure.
- Advisor consults are on by default and the planner runs them unasked, but
  they are not unconditional — skip the verify on a trivial diff, and honor
  `--no-advisor`. Always say when a consult ran and what it concluded.
- Worktree isolation is on by default for briefs that write, and the planner
  creates the worktree unasked. It never pushes, opens a PR, or removes a
  worktree on its own: shipping is `/vpk-git-ship` and cleanup is
  `/vpk-git-clean`, both only when the user asks. Always report which branch
  and worktree hold the diff.

## Known infrastructure hazard

Proximity's **`/openai/*` route intermittently returns HTTP 400** —
`CloudID is invalid or not provisioned in the staging environment` — on
roughly 10% of requests (measured 2026-08-01: 18/20 small identical calls
passed, and an 8KB request failed while a 400KB one succeeded, so it is
neither size nor config). `codex exec` treats 400 as non-retryable and aborts
the whole session, so a long GPT-lane run is likely to die partway.

The single-request preflight cannot detect this — most requests succeed. When
a GPT-lane worker dies with that message, it is **not** a brief or model
problem: check `git status` for a landed diff, then prefer the Claude lane
(`--model opus` / `--model sonnet`, routed via `/vertex/claude`, 12/12 clean
in the same window) rather than re-dispatching to GPT. The upstream fix
belongs to whoever provisions the staging CloudID.

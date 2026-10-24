---
name: vpk-remote
description: "Plan in this Claude Code or Codex session — started on a subscription login (`claude`, `codex`) or API (`claude-gw`, `codex-gw`), detected automatically — and delegate implementation to headless workers billed through the local Proximity AI Gateway (localhost:29576): GPT (Sol/Terra/Luna) via the Codex CLI or Claude (Opus/Sonnet) via headless claude -p. Workers report back here for verification and an advisor review. Can also move the conversation itself onto API on any Claude or GPT model and effort. Use when the message starts with /vpk-remote, or when the user says 'route this through proximity', 'implement remotely', 'send this to a worker', 'delegate to opus/sol/terra/luna', 'move/switch this session to API', 'I'm out of credits, continue on sol', asks for a second opinion via the gateway, wants plan-big-execute-small delegation, or asks to build/fix something 'via the gateway'. Never activate from skill-name mentions in file paths, stack traces, pasted or quoted text, or prior-turn context."
validation_command: node scripts/validate-skills.js --target .agents/skills/vpk-remote
---

# VPK Remote — Planner Session, Proximity Workers

The user steers this session, often from a phone against an always-on Mac. It
**plans, dispatches, verifies, and reports**. Implementation, token-heavy
exploration, and second-opinion consults run as headless CLI workers billed
through the Proximity AI Gateway on `localhost:29576` — GPT models via
`codex exec`, Claude models via `claude -p`. Each worker reports back to
this session, which reviews the diff before calling the task done.

## One flow, any planner

There is no mode to pick. `/vpk-remote <task>` always runs the same loop —
dispatch a worker, wait for its report, verify, consult an advisor, report —
whether this session is Claude Code or Codex, and whether it was started on
API (`claude-gw`, `codex-gw`, `ai-api`) or on a subscription login (`claude`,
`codex`). Workers bill Proximity in every case; the planner's own turns bill
whichever login started it, and that cost is accepted.

Detect the planner once, at the start of the run:

```bash
if [ -n "${CODEX_THREAD_ID:-}" ]; then
  app=codex
  # Codex picks its provider in config.toml, not the environment.
  grep -qE '^model_provider *= *"openai-gw"' "${CODEX_HOME:-$HOME/.codex}/config.toml" 2>/dev/null \
    && billing=api || billing=oauth
else
  app=claude
  if [ "${CLAUDE_CODE_DISABLE_OAUTH:-}" = 1 ] || [[ "${ANTHROPIC_BASE_URL:-}" == *localhost:29576* ]]; then
    billing=api     # claude-gw or ai-api
  else
    billing=oauth   # plain claude
  fi
fi
gitdir="$(git rev-parse --git-common-dir)"
touch "$gitdir/.vpk-remote-probe" 2>/dev/null && rm "$gitdir/.vpk-remote-probe" \
  && git_write=yes || git_write=no   # no = sandboxed; worktree creation needs approval
```

A Codex session started with `codex -c model_provider=…` can differ from its
config file; the echoed plan is where the user catches that.

| | `api` parent | `oauth` parent |
| --- | --- | --- |
| Implementation | gateway worker | gateway worker |
| Planner reading, review, trivial edits | fine | fine (cost absorbed) |
| In-app subagents (Claude Code Agent tool) | allowed — they inherit the gateway login | avoid for heavy work — they bill the subscription; use a gateway worker |
| Credits run out mid-session | not applicable | move the conversation (below) |

Echo the detected app, billing, model, and effort in the one-line plan (for
example `codex · api · terra · high`), so a misdetection is visible.

### Codex as the planner

The loop is the same; three mechanics differ.

- **Waiting on workers.** Codex has no background command that wakes the
  session on exit. Run the surface wrapper in the foreground and let it block
  until the worker exits; it still exits with the worker's status. Fan-out
  means launching every worker first (each `run.sh` with `&`, then `wait`)
  in one command, so they still run in parallel.
- **Sandbox and approvals.** Enterprise-managed requirements on this Mac cap
  Codex at `workspace-write` or `read-only` with `on-request` approvals.
  `--dangerously-bypass-approvals-and-sandbox` (which `codex-gw` passes) is
  overridden to **read-only**, so it does not help. Under `workspace-write`,
  writes under `.git` are blocked (`git_write=no` above), and launching a
  worker also needs approval because `claude -p` / `codex exec` write state
  outside the workspace. Request approval for the worktree step and each
  worker launch; the user approves them in the Codex UI. Never try to disable
  the sandbox. Headless `codex exec` cannot answer approvals, so it cannot act
  as a `/vpk-remote` planner.
- **Advisor family.** Codex plans on a GPT model, so its own plans go to the
  `opus` advisor; see *Mode: advisor*.

### Moving the conversation itself

Only when the user explicitly asks to move or switch **the chat** — "I'm out
of credits", "move this chat to sol", "continue my last session on opus" —
fork the conversation onto API with `ai-api --new-window`, per
[references/session-handoff.md](references/session-handoff.md). This changes
which model the user talks to; it is not a way to run a task. A plain task
always takes the worker flow above, so its result comes back here.

## Invocation: plain English first

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
/vpk-remote fix the sidebar flicker                               → worker, defaults, verified here
/vpk-remote rename useFoo to useBar with terra                   → worker, terra
/vpk-remote second opinion from opus on this plan               → advisor consult
/vpk-remote I'm out of credits, move this chat to sol            → move the conversation, sol
/vpk-remote continue my last session on opus at max             → move the conversation, --continue, opus, max
```

Always echo the parsed plan in one line before acting (app, billing, model, effort),
so a misread costs one glance instead of a wrong run.

### Explicit flags (optional)

Flags still work and override prose. They are never required.

| Flag | Values | Default |
| --- | --- | --- |
| `--model` | any alias or full ID | `defaults.env` |
| `--effort` | `medium` `high` `xhigh` `max` | `defaults.env` |
| `--advisor` / `--no-advisor` | *(no value)* | **on** |
| `--fanout` / `--single` | *(no value)* | **auto** (see *Worker shapes*) |
| `--worktree` / `--no-worktree` | *(no value)* | **on for briefs that write** (see *Worktree isolation*) |

`/vpk-remote` with nothing after it asks what to run; it does not move the
conversation unless the user says so.

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
CLIs but workers do not use it: a worker that under-thinks buys a correction
round that costs more than the thinking it skipped. A moved conversation may
use `low`, since the user is steering it directly.

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
implementing in the planner session, never substitute the planner's own model,
never retry through a shell alias.

## Billing boundary

- **Planner:** this Claude session, on whichever login started it (see *One
  flow, either billing*). Owns decisions, briefs, review, final proof,
  synthesis.
- **Workers:** external CLI processes whose requests go only to Proximity.
  Own repo mutation and token-heavy reading.
- **Upstream credential:** owned by Proximity. Never appears in briefs,
  reports, worker homes, or repo files.
- **Claude Code subagents** (Agent tool) bill the planner's login. On an
  `api` parent that is the gateway, so they are fine for review or search; on
  an `oauth` parent, keep heavy work on gateway workers.
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

## Naming

Every surface, branch, worktree, and artifact directory for a task uses one
name: `vpk-<type>-<slug>[-<pane>]`, lowercase kebab-case.

- `vpk` — always first; marks what this skill created, in this repo or any
  other.
- `<type>` — writing: `feat`, `fix`, `refactor`, `perf`, `docs`, `chore`;
  read-only: `audit`, `research`.
- `<slug>` — the work in 1–3 words (`ui-generation`, `live-progress`).
- `<pane>` — only when a task has more than one surface: `-1`…`-n` for
  fan-out panes, `-review` for the advisor. A single writing worker has no
  suffix.

| Thing | Format | Example |
| --- | --- | --- |
| herdr workspace / tab / pane label | `vpk-<type>-<slug>[-<pane>]` | `vpk-fix-sidebar-flicker` |
| Branch | `vpk/<type>-<slug>` | `vpk/fix-sidebar-flicker` |
| Worktree | `.claude/worktrees/vpk-<type>-<slug>` | `.claude/worktrees/vpk-fix-sidebar-flicker` |
| Artifacts | `output/remote-<lane>/vpk-<type>-<slug>[-<pane>]/` | `output/remote-claude/vpk-fix-sidebar-flicker/` |

`scripts/agent-surface.js` rejects a `--label` or `--group` outside this
scheme, so a misnamed surface fails before anything opens.

The herdr agent name (what `herdr agent wait <name>` takes; the pane closes
on exit, so the wait only says the run ended) is the label
itself when it fits herdr's 32-character limit. A longer label becomes its
first 25 characters, `-`, and a 6-character hash of the whole label:
`vpk-research-authentication-middleware-1` →
`vpk-research-authenticati-<hash>`. The hash is stable, so `-1` and `-2`
stay distinct and a label always maps to the same name.

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

Fetch first, then branch from `origin/main` — not the local `main` ref, which
goes stale in a long-lived checkout and would start the worker on old code.
Place it under the repo's ignored `.claude/worktrees/`, one per task, named
per *Naming*:

```bash
name="vpk-<type>-<slug>"
branch="vpk/<type>-<slug>"
tree="$PWD/.claude/worktrees/$name"
git fetch origin main
git worktree add --no-track -b "$branch" "$tree" origin/main
```

`--no-track` keeps the task branch from adopting `origin/main` as its
upstream, so a later push sets its own upstream instead of targeting `main`.

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
   constraints, and the proof command. The planner judges; it keeps its
   context for decisions rather than mechanical coverage. Tiny read-only
   questions it can answer directly; any non-trivial mutation goes to a
   worker.
2. **Isolate.** If the brief writes files, create and warm the task worktree
   per *Worktree isolation* above, and confirm warmup finished before
   dispatch. Skip for read-only briefs and under `--no-worktree`.
3. **Freeze the brief** to a file — Goal / Exact repo paths / Constraints /
   Non-goals / Proof expected / Output shape, per
   [references/dispatch-patterns.md](references/dispatch-patterns.md). Never
   inline a brief into a shell command.
4. **Dispatch** via background Bash (Codex planner: foreground; see *Codex as
   the planner*) using the lane's canonical command:
   [references/gpt-executor.md](references/gpt-executor.md) or
   [references/claude-executor.md](references/claude-executor.md).
   Write that command to `run.sh` in the worker directory and launch it
   through the surface wrapper (see *Terminal surfaces*) rather than running
   it bare, so the user can watch the worker in herdr. A writing task's
   worker launches with `--worktree "$tree"`, which opens it as its own
   workspace in the herdr sidebar automatically, unless `--no-worktree`
   applies. Then there is no `$tree`: the worker runs in the current checkout
   as a tab in the planner's workspace, labelled per *Naming*. Leave
   `--worktree` off only under `--no-worktree`.
5. **Read only the report file.** Never stream or parse raw worker output —
   raw material stays in worker contexts, which keeps the planner's context
   window for review. The pane status and `events.jsonl` are for the human;
   tail them only when the user asks for progress or a run needs diagnosing
   (see *Checking progress*). An absent or empty report does **not**
   imply an absent diff: a worker killed mid-run may have already written
   every file. Always check `git status` in the task worktree before
   re-dispatching. After reading the report, close any leftover finished
   worker tab (`herdr tab close <tab_id>`, from the wrapper's first JSON
   line); never close the user's own tabs or the task's sidebar workspace.
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
rename a proof command already covers), where a proof command already
settles the question. Never consult on single-step questions or an obvious
plan.

**Default to the family that did not do the work.** Cost no longer picks the
advisor — every lane bills Proximity — so what a consult buys is
*independence*, not a capability tier. A GPT worker's blind spots are found
most cheaply by a Claude reviewer and vice versa; asking the same family to
audit its own reasoning re-runs the same priors.

| Work under review | Advisor default |
| --- | --- |
| GPT-lane worker output (`sol` / `terra` / `luna`) | `opus` alias at xhigh |
| Claude-lane worker output (`opus` / `sonnet`) | `sol` alias at xhigh |
| A plan a Claude planner wrote, or nothing dispatched yet (`app=claude`) | `sol` alias at xhigh |
| A plan a GPT planner wrote, or nothing dispatched yet (`app=codex`, or a Claude Code session running a GPT model) | `opus` alias at xhigh |

The planner rows follow the same rule: whatever the planner authored is its
own family's work, so the reviewer comes from the other family. Judge by the
planner's **model**, not its app — Claude Code can run on `sol` via `ai-api`.

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
moved conversation gets a visible, labelled surface instead of an invisible background
process. The planner launches the wrapper with background Bash exactly as
before (a Codex planner runs it in the foreground); the wrapper places the
run, waits, and exits with the worker's status, so the harness still notifies
on completion. Outside herdr the same command
runs the worker inline, so there is one recipe for both.

```bash
node scripts/agent-surface.js run \
  --script "$worker_root/run.sh" --label "$name" --worktree "$tree"
```

| Run | Flags | herdr surface |
| --- | --- | --- |
| Writing worker (always) | `--label "vpk-<type>-<slug>" --worktree "$tree"` | the worktree's own **workspace** in the sidebar |
| Fan-out (2–5 read-only workers) | `--label "vpk-<type>-<slug>-<n>" --group "vpk-<type>-<slug>"` | one **tab**, one **pane** per worker |
| Single read-only worker | `--label "vpk-<type>-<slug>"` | a new **tab** in the planner's workspace |
| Advisor | `--label "vpk-<type>-<slug>-review"` | a new **tab** in the planner's workspace |
| Moved conversation (`--new-window`) | handled by `ai-api` | a new **tab** running the forked session |

A writing worker always gets its own sidebar workspace, with no manual step,
even when the planner itself runs in a linked worktree: the wrapper opens the
workspace from the main checkout (herdr refuses `worktree open` from a linked
worktree), and if herdr still refuses, the wrapper exits with herdr's error
rather than falling back to a tab. Report that error; do not relaunch the
writing worker without `--worktree`. When the workspace is already open,
the run never takes its root pane: it splits into the workspace's tab with the
same label (`--group`, else `--label`) when there is one, otherwise it gets a
new tab with that label.

The `run.sh` keeps the lane's redirects: the report still lands in
`report.md`, and the pane shows the user the worker's status, not a per-step
feed. On the GPT lane that is the codex stderr stream; on the Claude lane
`scripts/agent-stream-format.js` prints `working · <model> · started HH:MM`,
a `working · 4m12s · 23 steps` line rewritten in place, then
`done · 8m54s · $5.47 · 16 turns` or `failed · <reason>`. Pass it `--feed`
only to debug a run (see
[references/claude-executor.md](references/claude-executor.md)). The planner
reads only the report, as before. Each pane reports `working` to herdr while
it runs. Worker and advisor panes close themselves the moment they exit,
success or failure, and an emptied tab goes with them; the planner reports
the outcome. `report.md`, `events.jsonl`, and `stderr.log` keep the full
record for diagnosing a failure. The only pane that stays is the root pane of
a worktree workspace the run opened, because closing it would close the
task's sidebar workspace. Conventions and status reporting:
`.agents/docs/herdr.md`.

### Checking progress

| Question | Where to look |
| --- | --- |
| Is it still running? | the herdr sidebar or the worker's pane while it shows `working`; gone means it ended, and the wrapper's exit status says how |
| What has it done, step by step? | `events.jsonl` (Claude lane, one JSON event per line); rerun with `--feed` only to debug |
| What has actually landed? | `git status` / `git diff` in the task worktree |
| What did it conclude? | `report.md` |

There is no "needs input" state. Workers run headless with permissions
skipped, so they cannot stop to ask; a blocked worker exits non-zero, or
exits 0 with the blocker written in its report.

## Artifacts

Everything lives under gitignored `output/`:

```text
output/remote-gpt/vpk-<type>-<slug>/          # home/ (CODEX_HOME), brief.md, report.md, followup-<k>.md
output/remote-claude/vpk-<type>-<slug>/       # brief.md, report.md, events.jsonl, stderr.log, followup-<k>.md
output/remote-<lane>/vpk-<type>-<slug>-<n>/   # one per fan-out worker
output/remote-<lane>/vpk-<type>-<slug>-review/  # advisor consults, same layout as that lane's workers
```

The directory carries the surface's name (see *Naming*), so one directory per
surface; never reuse a directory across concurrent workers. Follow-ups reuse
the worker's directory as `followup-<k>.md`.

Artifacts stay under the **main checkout's** `output/`, never inside a task
worktree, so reports from concurrently dispatched tasks stay readable in one
place and survive worktree cleanup.

## Boundaries

- Workers own mutation during a `/vpk-remote` task. The planner may make a
  trivial fix itself (a copy change, a one-line correction found in review)
  in the task worktree; anything larger is a worker brief or follow-up.
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

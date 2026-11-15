---
name: vpk-remote
description: "Plan in this Claude Code or Codex session — started on a subscription login (`claude`, `codex`) or API (`claude-gw`, `codex-gw`), detected automatically — and delegate implementation to headless workers billed through the local Proximity AI Gateway (localhost:29576): GPT (Sol/Terra/Luna) via Codex CLI or Claude (Opus/Sonnet) via claude -p. Workers report back here for verification and advisor review. Can also move this conversation onto API, on any Claude or GPT model and effort. Use when the message starts with /vpk-remote, or when the user says 'route this through proximity', 'implement remotely', 'send this to a worker', 'delegate to opus/sol/terra/luna', 'move/switch this session to API', 'I'm out of credits, continue on sol', asks for a second opinion via the gateway, asks for a council review or vpk-council, wants plan-big-execute-small delegation, or asks to build/fix something via the gateway. Never activate from skill names in file paths, stack traces, pasted or quoted text, or prior turns."
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

Detect the planner (app, billing, git write access) once at the start of the
run and echo app, billing, model, and effort in the one-line plan (for example
`codex · api · terra · high`), so a misdetection is visible. Read
[references/planner-detection.md](references/planner-detection.md) at the
start of every run for the detection snippet and the `api` / `oauth` table,
and when the planner is Codex, for how waiting, sandbox approvals, and the
advisor family differ there.

## Moving the conversation itself

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
/vpk-remote council review this PR                               → council mode (see *Mode: council*)
/vpk-remote I'm out of credits, move this chat to sol            → move the conversation, sol
/vpk-remote continue my last session on opus at max             → move the conversation, --continue, opus, max
/vpk-remote what's the status of my tasks                        → status table (see *Status*)
```

Always echo the parsed plan in one line before acting (app, billing, model, effort),
so a misread costs one glance instead of a wrong run.

Flags (`--model`, `--effort`, `--advisor` / `--no-advisor`, `--fanout` /
`--single`, `--worktree` / `--no-worktree`, `--status`) override prose and are
never required; worktree, advisor, and fan-out are on by default. Pick effort
from the task's shape rather than coasting on the default: `xhigh` for advisor
consults and genuine design ambiguity, the default for clear-spec
implementation, never above `medium` for mechanical sweeps, and workers never
use `low`. Read
[references/invocation-flags-and-effort.md](references/invocation-flags-and-effort.md)
when a flag appears, when choosing effort, or before raising effort on a task
that failed once.

## Preflight the selected route

Before creating a worktree or dispatching, check the selected worker CLI and run
only the selected lane's probe:

```bash
node scripts/vpk-remote-preflight.js --app codex --model <resolved-gpt-id>
node scripts/vpk-remote-preflight.js --app claude --model <resolved-claude-id>
```

Read [references/preflight-and-maintenance.md](references/preflight-and-maintenance.md)
when a probe fails, when installing or repairing the launcher, when a GPT-lane
worker dies with `CloudID is invalid`, or when changing this skill's maintained
scripts (it holds the regression checks).

## Billing boundary

- **Planner:** this Claude session, on whichever login started it (see *One
  flow, any planner*). Owns decisions, briefs, review, final proof,
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

## Naming and worktree isolation

Every surface, branch, worktree, and artifact directory for a task uses one
name, `vpk-<type>-<slug>[-<pane>]` (branch `vpk/<type>-<slug>`, worktree
`.claude/worktrees/vpk-<type>-<slug>`). **Every brief that writes files gets
its own git worktree, by default**, branched from a freshly fetched
`origin/main` with `--no-track` and warmed (`.env.local` copied,
`pnpm install`) before dispatch; read-only briefs get none. Read
[references/naming-and-worktrees.md](references/naming-and-worktrees.md)
before naming a task or creating its worktree, and when deciding whether
`--no-worktree` is right.

## Procedure

1. **Ground.** Read only enough repo context to identify the owner, the
   constraints, and the proof command. The planner judges; it keeps its
   context for decisions rather than mechanical coverage. Tiny read-only
   questions it can answer directly; any non-trivial mutation goes to a
   worker.
2. **Isolate.** If the brief writes files, create and warm the task worktree
   per [naming-and-worktrees.md](references/naming-and-worktrees.md#worktree-isolation),
   and confirm warmup finished before dispatch. Skip for read-only briefs and under `--no-worktree`.
3. **Freeze the brief** to a file — Goal / Exact repo paths / Constraints /
   Non-goals / Proof expected / Output shape, per
   [references/dispatch-patterns.md](references/dispatch-patterns.md). Never
   inline a brief into a shell command. Beside it, write
   `task.json`, the record *Status* reads; read
   [references/status-and-artifacts.md § The task record](references/status-and-artifacts.md#the-task-record)
   for its fields and the advisor `Verdict:` line.
4. **Dispatch** via background Bash (Codex planner: foreground; see
   [planner-detection.md](references/planner-detection.md#codex-as-the-planner)) using the lane's canonical command:
   [references/gpt-executor.md](references/gpt-executor.md) or
   [references/claude-executor.md](references/claude-executor.md).
   Write that command to `run.sh` in the worker directory and launch it
   through the surface wrapper (see *Terminal surfaces*) rather than running
   it bare, so the user can watch the worker in herdr. A writing task's
   worker launches with `--worktree "$tree"`, which opens it as its own
   workspace in the herdr sidebar automatically, unless `--no-worktree`
   applies. Then there is no `$tree`: the worker runs in the current checkout
   as a tab in the planner's workspace, labelled per *Naming and worktree isolation*. Leave
   `--worktree` off only under `--no-worktree`.
5. **Read only the report file.** Never stream or parse raw worker output —
   raw material stays in worker contexts, which keeps the planner's context
   window for review. The pane status and `events.jsonl` are for the human;
   tail them only when the user asks for progress or a run needs diagnosing
   (see [terminal-surfaces.md § Checking progress](references/terminal-surfaces.md#checking-progress)).
   An absent or empty report does **not** imply an absent diff: a worker killed mid-run may have already written
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
   before reporting done. Skip only for a trivial diff, under
   `--no-advisor`, or after a complete council round (see *Mode: council*).
9. **Synthesize.** Outcome, proof, what the advisor confirmed or flagged,
   which branch and worktree hold the diff, and genuine blockers. Cite worker
   evidence rather than re-deriving it.

## Mode: advisor

A second opinion at high judgment moments, billed to Proximity: a
**read-only** consult brief, dispatched with the same lane commands as any
other worker. **Consults are on by default**: every task that produces a diff
gets a pre-completion verify, where the diff and original goal go to the other
family before reporting done, and the planner says it is consulting and why.
Also consult when stuck after about two failed correction cycles, or before an
approach the brief cannot settle. Skip the verify for a trivial diff a proof
command already settles, and under `--no-advisor`; `--advisor` alone makes a
consult the entire task.

**Default to the family that did not do the work**, at `xhigh`:

| Work under review | Advisor default |
| --- | --- |
| GPT-lane worker output (`sol` / `terra` / `luna`) | `opus` alias at xhigh |
| Claude-lane worker output (`opus` / `sonnet`) | `sol` alias at xhigh |
| A plan a Claude planner wrote, or nothing dispatched yet (`app=claude`) | `sol` alias at xhigh |
| A plan a GPT planner wrote, or nothing dispatched yet (`app=codex`, or a Claude Code session running a GPT model) | `opus` alias at xhigh |

Explicit flags always win. Read
[references/advisor-pattern.md](references/advisor-pattern.md) before every
consult, for why independence picks the family, the consult moments, context
packaging, and advice shape. The advisor never edits files; after advice
returns, state in a sentence what you adopt or reject, then continue.

## Mode: council

`/vpk-remote council <subject>`, or a request for a council review, runs
independent parallel read-only reviews (default `sol` and `opus` at xhigh) of
the same subject, reconciles them with scores, and repeats after accepted
fixes. A complete round replaces the pre-completion advisor verify. Follow
[references/council.md](references/council.md).

## Worker shapes

Shape is chosen automatically from the brief, not requested:

| Brief | Shape |
| --- | --- |
| Writes files (implementation, refactor, migration) | **Single worker**, always |
| Read-only and splits into 2+ independent reading scopes | **Fan-out**, 2–5 workers |
| Read-only, one scope | Single worker |

Fan-out is the default for read-only work, dispatched in one message with
disjoint reading scopes and a "make no edits" constraint in every brief; wait
for every report before synthesizing. **`--fanout` on a writing brief is an
error**: workers on one task share its worktree and overwrite each other.
Read [references/dispatch-patterns.md § Shape selection](references/dispatch-patterns.md#shape-selection)
before any fan-out or when a writing task seems to want parallel workers.

## Terminal surfaces

Launch every worker, advisor, and fan-out pane through the surface wrapper
(background Bash; a Codex planner runs it in the foreground). Inside herdr it
opens a labelled surface; outside herdr it runs the worker inline:

```bash
node scripts/agent-surface.js run \
  --script "$worker_root/run.sh" --label "$name" --worktree "$tree"
```

Read [references/terminal-surfaces.md](references/terminal-surfaces.md) when
choosing flags for a run shape, when the wrapper reports a herdr error, when
the user asks for progress, or when reading pane status.

## Status

`/vpk-remote --status`, `/vpk-remote status`, and plain English asking about
task status run `node scripts/vpk-remote-status.js` (`--all`, `--task <name>`,
`--markdown`) from the main checkout. Present its facts **as a markdown table
in your own response** (Task with goal, Status, PR, Next action), never in a
code block, then at most two sentences on what needs attention. Status is
read-only. Read
[references/status-and-artifacts.md](references/status-and-artifacts.md)
before answering a status request, and for the `output/remote-<lane>/` artifact
layout.

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

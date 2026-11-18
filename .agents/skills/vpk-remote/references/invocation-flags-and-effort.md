# Invocation flags and effort

Read this before choosing a task model, when a flag appears, when choosing effort, or after a failed attempt. Back to [SKILL.md](../SKILL.md).

## Choosing the model

Choose for quality and task uncertainty; money and credits are not constraints.
Explicit model requests win, including named advisors and council members.
Resolve aliases from `~/.config/litellm-proximity/defaults.env` each run:
`sol` is GPT-6.2 Sol, `astra` is GPT-6.2 Astra, `opus` is Claude Opus 5.5,
and `sonnet` is Claude Sonnet 5.5. If a setting differs, report it rather than
silently rewriting a model pin during a task.

| Task shape without an explicit model | Selection |
| --- | --- |
| Clear requirements, established pattern, routine implementation or mechanical migration | `sol` |
| Architecture, conflicting requirements, difficult diagnosis, subtle correctness, or unresolved judgment that could materially change the solution | `astra` |
| Independent review of GPT work or a GPT planner's plan | `opus` at xhigh |
| Independent review of Claude work or a Claude planner's plan | GPT family: `sol` for clear checks, `astra` for unresolved judgment, at xhigh |

Choose by uncertainty, not line count: a small concurrency bug may warrant Astra;
a large mechanical migration can suit Sol. Apply this to implementation,
research, and the GPT seat in a council. Preserve the executor's lane constraints.
For conversation handoffs, retain the configured app default unless the user
chooses a model; task routing does not switch the planner's model.

Keep Sonnet available for explicit requests and straightforward tasks where the
user asks for a Claude alternative. Keep Opus as the automatic Claude reviewer;
do not route to Sonnet automatically without a demonstrated advantage on the
user's work. These are initial routing heuristics, not measured quality rankings.

Before dispatch, name the resolved model, effort, and concrete selection reason
in one line, for example: `codex · api · gpt-6.2-astra · xhigh — shared state ownership is unresolved`.

After a failure, first distinguish a reasoning or approach failure from an
underspecified brief, missing dependency, Gateway error, or broken environment.
If an automatically selected Sol worker failed because of its understanding or
approach, reassess and escalate to Astra with the evidence and any landed diff.
Do not switch an explicitly selected model without the user's agreement.
Inspect task-worktree status first; reuse the existing task and preserve its diff.
Preflight Astra before dispatch and include prior attempts in its brief. Model
escalation counts toward the existing two-correction limit; it never resets it.
Infrastructure failures follow the preflight guidance, not model escalation.
Record the reason for escalation and its outcome in the task report; use actual
outcomes to refine routing rather than inventing model specialties.

## Explicit flags (optional)

Flags still work and override prose. They are never required.

| Flag | Values | Default |
| --- | --- | --- |
| `--model` | any alias or full ID | task routing above; handoffs use `defaults.env` |
| `--effort` | `medium` `high` `xhigh` `max` | `defaults.env` |
| `--advisor` / `--no-advisor` | *(no value)* | **on** |
| `--fanout` / `--single` | *(no value)* | **auto** (see *Worker shapes* in SKILL.md) |
| `--worktree` / `--no-worktree` | *(no value)* | **on for briefs that write** (see [naming-and-worktrees.md](naming-and-worktrees.md#worktree-isolation)) |
| `--status` / `status` | `--all`, or a task name | off; see *Status* in SKILL.md |

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

## Choosing effort

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

# Invocation flags and effort

Read this when a flag appears in the request, when choosing effort, or before raising effort on a task that failed once. Back to [SKILL.md](../SKILL.md).

## Explicit flags (optional)

Flags still work and override prose. They are never required.

| Flag | Values | Default |
| --- | --- | --- |
| `--model` | any alias or full ID | `defaults.env` |
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

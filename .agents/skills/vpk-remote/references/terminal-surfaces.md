# Terminal surfaces

Read this when choosing wrapper flags for a run shape, when the wrapper reports a herdr error, when the user asks for progress, or when reading pane status. Back to [SKILL.md](../SKILL.md).

## Surfaces per run

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
task's sidebar workspace. That root pane carries the task's status: the
workspace shows `working` while any of its runs goes, then `idle` (last run
exited 0) or `blocked` (`failed · exit N`) instead of `unknown`. Runs record
themselves in `live-runs/` in the worker directory, under a lock, so
overlapping runs never leave a wrong final state. To keep that status, it
holds at `Press Enter for a shell.` after its run.
Conventions and status reporting: `.agents/docs/herdr.md`.

### Checking progress

| Question | Where to look |
| --- | --- |
| Is it still running? | the herdr sidebar or the worker's pane while it shows `working`; gone means it ended, and the wrapper's exit status says how. A writing task's workspace shows `working`, then `idle` or `blocked` |
| What has it done, step by step? | `events.jsonl` (Claude lane, one JSON event per line); rerun with `--feed` only to debug |
| What has actually landed? | `git status` / `git diff` in the task worktree |
| What did it conclude? | `report.md` |

There is no "needs input" state. Workers run headless and cannot stop to
ask: Claude-lane workers with permissions skipped, GPT-lane workers sandboxed
with `approval_policy="never"`, so a refused command fails instead of
prompting; a blocked worker exits non-zero, or
exits 0 with the blocker written in its report.

# Status and artifacts

Read this before answering a status request, when writing `task.json`, and for the `output/remote-<lane>/` artifact layout. Back to [SKILL.md](../SKILL.md).

## The task record

Beside each frozen brief, write `task.json`, the record the status script reads:

```json
{ "name": "vpk-feat-ui-generation", "goal": "One-line summary", "type": "feat",
  "branch": "vpk/feat-ui-generation", "worktree": ".claude/worktrees/vpk-feat-ui-generation",
  "lane": "claude", "model": "claude-opus-5-5[1m]", "effort": "high",
  "kind": "worker", "createdAt": "<ISO time>" }
```

`kind` is `worker`, `review` (an advisor on a worker; its name ends in
`-review`), or `research` (read-only; `branch` and `worktree` are `null`).
Add `"advisor": false` under `--no-advisor`, so status does not ask for a
review that was skipped on purpose. An advisor's report ends with one line,
`Verdict: ship`, `Verdict: ship with nits`, or `Verdict: request changes`;
status reads any other line, or none, as `review unclear`.

## Status

`/vpk-remote --status`, `/vpk-remote status`, and plain English asking about
task status ("what's the status of my tasks", "what's running") run, from the
main checkout:

```bash
node scripts/vpk-remote-status.js                   # --status: JSON facts for active tasks
node scripts/vpk-remote-status.js --all             # --status --all: include done tasks and e2e runs
node scripts/vpk-remote-status.js --task <name>     # --status <name>: one task, every run and report
node scripts/vpk-remote-status.js --markdown        # ready-made rows, if the planner wants them
```

The script prints facts, not a layout: per task `name`, `goal`, `status`,
`nextAction`, `pr`, `branch`, `worktree`, ages, `runs`, and `reports` (`--json`
is an accepted alias). Present them **as a markdown table in your own
response**: Task (with the goal in the same cell), Status, PR, Next action.
Never put the table in a code block or as preformatted text. Follow it with at
most two sentences on what needs attention. This works the same in any planner,
whether Claude Code, Codex, Cursor or another tool: each renders a markdown
table and wraps it to its own pane, which is why the script does not lay text
out itself. `--markdown` prints the same four columns as a plain GitHub table,
with `|` and newlines escaped. Status is read-only: it never dispatches, moves
the conversation, or runs preflight. Tasks named `vpk-chore-e2e-*` are
throwaway test runs of this skill and show only with `--all`.

The script reads every `output/remote-<lane>/<name>/` directory. Both lanes
share one task per name, and a worker joins its `-review` advisors
(`task.json` `kind` decides when present). Runs are ordered by the start times
`agent-surface.js` records in `runs.jsonl` and `<script>.start`, so a reused
run script counts once per launch. A cut-off line in `runs.jsonl` loses only
itself, and a `.start` newer than every record counts as a newer run; file
times stand in only for legacy runs with no record. `report.md` belongs to the latest run that started before it
was last written; earlier runs read their `report-<k>.md` snapshot (the k-th
run by start) when the planner kept one. It derives one status from the runs' exits, the worker
report's `## Blockers` (empty only when blank or just `None`), the review's
`Verdict:` line, git, the branch's most recently created PR, and the live
worker process (`bash <run script>`, its `agent-surface.js` wrapper, or
`claude -p` / `codex exec` in the task directory; a pager or editor on its
files does not count):

- `running`, `stopped` (no exit file and no process), `not started`, `failed`
  (the worker's latest run, whatever reviews followed), `blocked`;
- `needs fixes`, `review unclear` (the verdict line is missing or is not
  `ship`, `ship with nits`, or `request changes`), `reviewing`, `needs review`.
  A review counts only for worker runs that ended before it started, the
  latest started review decides even if an older one finishes later, and a
  stopped review is ignored;
- `no commits`, `ready to ship`, `PR open`, `PR closed`, `merged`, `done`.
  A merged PR settles the task only if no worker run started after it merged
  and the local branch has no commits past its head; otherwise status comes
  from the newer runs. A merged task is `done` only once its worktree and
  local branch are both observed gone; if the branch list failed it stays
  `merged` with next action "re-run status". A task whose recorded branch
  and worktree are both gone, with no rename in git's history leading to a
  live branch, is `unknown` (next action: find the renamed branch) unless its
  PR merged and no local branch's tip is, or descends from, the last HEAD a
  run recorded (else the PR's head);
- `done (read-only)` for research, reviews, and tasks whose `task.json` has
  null `branch` and `worktree`, once none of their runs is live;
- `unknown` when `ps`, `git` or `gh` failed, so the answer can't be
  observed; any run whose liveness is unknown makes the task unknown, even if
  a later run finished. Next action: re-run status.

Each status comes with its next action. The branch is the one checked out in
the task's worktree, else `task.json`'s. Directories without `task.json` still
show, with a blank goal, and `task.json` fields of the wrong type are ignored.

## Artifacts

Everything lives under gitignored `output/`:

```text
output/remote-gpt/vpk-<type>-<slug>/          # home/ (CODEX_HOME), task.json, brief.md, run.sh(.start/.exit), runs.jsonl, report.md, followup-<k>.md
output/remote-claude/vpk-<type>-<slug>/       # task.json, brief.md, run.sh(.start/.exit), runs.jsonl, report.md, events.jsonl, stderr.log, followup-<k>.md
output/remote-<lane>/vpk-<type>-<slug>-<n>/   # one per fan-out worker
output/remote-<lane>/vpk-<type>-<slug>-review/  # advisor consults, same layout as that lane's workers
```

The directory carries the surface's name (see [naming-and-worktrees.md](naming-and-worktrees.md)), so one directory per
surface; never reuse a directory across concurrent workers. Follow-ups reuse
the worker's directory as `followup-<k>.md`, run by `run-<k>.sh`, so each run
keeps its own exit file. `agent-surface.js` writes `<script>.start` before each
launch and appends a start line and an end line per run to the directory's
`runs.jsonl` (`script`, `startedAt`, `endedAt`, `exit`, both times ISO with
milliseconds, plus `head`, the task worktree's HEAD, on a writing run's end
line), so a relaunched script keeps every run in order. A writing run also
keeps `live-runs/<pid>.json` there while it is live (see [terminal-surfaces.md](terminal-surfaces.md)).

Artifacts stay under the **main checkout's** `output/`, never inside a task
worktree, so reports from concurrently dispatched tasks stay readable in one
place and survive worktree cleanup.

# herdr Terminal Topology

VPK agents run inside [herdr](https://herdr.dev/docs/) when `HERDR_ENV=1`.
herdr organizes terminals into workspaces, tabs, and panes, detects coding
agents in panes (`working`, `blocked`, `done`, `idle`, `unknown`), and exposes
the session through the `herdr` CLI. The global `herdr` skill owns the full CLI
contract; this page covers the VPK conventions on top of it.

Outside herdr, every recipe below falls back to inline/background behavior.
Never drive a herdr session from a process that is not inside one.

## Topology Conventions

| Work | Surface | Why |
| --- | --- | --- |
| Writing task in its own git worktree | herdr **workspace** for that worktree (`herdr worktree open`) | herdr links worktree workspaces to the repo, and `vpk-git-clean` can find them |
| Several workers on one task (fan-out) | one **tab** per task, one **pane** per worker | the user sees the whole fan-out side by side |
| One-off worker, consult, or API handoff | a new **tab** in the caller's workspace | keeps the caller's pane and focus untouched |
| Quick command the caller watches (tests, a dev server log) | a **pane** split beside the caller | the herdr skill's default |

Always pass `--no-focus`; the user's focus stays where it was. Label every tab
and pane after the task (`vpk-fix-sidebar-flicker`, `vpk-audit-tokens-2`) so
the sidebar is readable from a glance or a phone; `/vpk-remote` names follow
*Naming* in `.agents/skills/vpk-remote/SKILL.md`.

## Run a Script in a Visible Surface

`scripts/agent-surface.js` is the paved path. It places a prepared shell script
according to the table above, runs it, waits, and exits with the script's
status. Outside herdr it runs the script inline with the same contract, so
callers never branch on terminal.

```bash
node scripts/agent-surface.js run --script <file> --label <name> \
  [--cwd <dir>] [--worktree <path>] [--group <name>] \
  [--no-wait] [--timeout-ms <n>] [--surface auto|herdr|inline]
```

- The script's exit code lands in `<script>.exit`; the wrapper reads it, so
  it works the same for background Bash calls and for `--no-wait` callers that
  poll later.
- Each run also leaves `<script>.start` (written before launch) and a start
  and an end line in the script directory's `runs.jsonl`, so a relaunched
  script keeps every run's times (ISO, with milliseconds).
- `--label` and `--group` must match `vpk-<type>-<slug>[-<pane>]`
  (`SURFACE_NAME_PATTERN`); anything else is rejected before herdr is called.
- `--worktree` runs `herdr worktree open` with the **main checkout** as
  `--cwd` (derived from `git rev-parse --git-common-dir`), because herdr opens
  worktree workspaces only from the repo parent. The worktree then gets its
  own sidebar workspace even when the caller sits in a linked worktree. If
  herdr still refuses, the wrapper fails with herdr's error; it never falls
  back to a tab.
- In an already-open worktree workspace, the run splits into the tab with the
  same label (`--group`, else `--label`) when one exists, and otherwise gets a
  new tab with that label. Its root pane is never reused because the user may
  be typing there.
- The pane closes itself the moment the script exits, success or failure,
  right after writing `<script>.exit`, so the close cannot race the wrapper.
  herdr drops a tab when its last pane closes, so a single-run tab goes too;
  a `--group` tab stays until its last worker exits. The one exception is the
  root pane of a worktree workspace the run just opened: closing it would
  close the task's sidebar workspace, so it stays, holding at
  `Press Enter for a shell.` so its task status sticks (see below).
- Closing the pane before the script finishes is reported as an error, not a
  silent hang.
- The full runner is written to `<script>.pane.sh` and the pane only runs
  `bash '<that file>'`, because `herdr pane run` rejects lines over 1024 bytes.
  Like `<script>.exit`, it is left beside the script.

### Worker status in the sidebar

The pane reports its own state, so workers show in the sidebar and
`herdr agent list` as agent `vpk-worker` instead of `unknown`:

| Phase | Reported state | Sidebar |
| --- | --- | --- |
| Script starts | `working`, title = `--label` | `working` |
| Script exits, any status | pane closes | gone |

A writing task's sidebar workspace (`--worktree`) also reports on its root
pane, the one pane that outlives every run, so the workspace shows the task's
state instead of `unknown` between runs:

| Phase | Root pane reports | Message |
| --- | --- | --- |
| Any run in the workspace starts | `working` | `working · run-2.sh` |
| Run exits 0 | `idle` | `done · run-2.sh` |
| Run exits non-zero | `blocked` | `failed · exit 1` |

The per-run pane still closes on exit. herdr clears a report as soon as its
pane is back at a shell prompt, so the root pane holds at
`Press Enter for a shell.` after its run; once the user presses Enter it is
their shell, and later runs leave it alone (status falls back to `unknown`).
Reports go only to the root pane of the task's own workspace, never to the
planner's pane or another workspace's, and a run that ends while another run
in the workspace is still working leaves it `working`. A rejected report
prints one `agent-surface: task workspace state …` line; the run's exit
status never changes.

The pane itself shows the same level of detail: a `/vpk-remote` Claude-lane
worker prints `working · <model> · started HH:MM`, one status line rewritten
in place, then `done · <time> · <cost> · <turns>` or `failed · <reason>`
(`scripts/agent-stream-format.js`). The step-by-step trail is in the worker's
`events.jsonl`; the formatter's `--feed` flag prints it to the pane for
debugging. Headless workers cannot ask for input, so a run pane never reports
`blocked`; a stuck worker ends as `exit N`, or as `done` with the blocker in
its report. The task workspace's `blocked` means its last run failed.

Beyond the task workspace's `idle` or `blocked`, the outcome is not shown
in herdr: the wrapper's exit status and the worker's
`report.md`, `events.jsonl`, and `stderr.log` carry it, and the planner
reports it to the user. Those files keep the full record for diagnosing a
failure after the pane is gone.

The pane is also named after the label, so another pane can block on it. A
label over herdr's 32-character agent name limit becomes its first 25
characters plus a 6-character hash of the full label, so long labels that
differ only at the end stay distinct (see *Naming* in the vpk-remote skill):

```bash
herdr agent wait vpk-fix-sidebar-flicker --timeout 20000
```

Because the pane closes on exit, the wait ends with `agent_not_running` (exit
1) whichever way the run went; read `<script>.exit` for the status. Reports
run in the background and never change the exit status, so a missing or
broken `herdr` cannot fail a run. Two concurrent runs whose labels reduce to
the same name cannot both hold it; target the second by pane ID.

## Inspect and Coordinate

Resolve live IDs at the time of use; never save one in a prompt.

```bash
herdr workspace list
herdr tab list --workspace "$HERDR_WORKSPACE_ID"
herdr pane list --workspace "$HERDR_WORKSPACE_ID"
herdr agent list
```

For an interactive agent in another pane, use the agent surface so herdr
validates identity and state before typing:

```bash
herdr agent get <name-or-pane>
herdr agent read <name-or-pane> --source recent-unwrapped --lines 80
herdr agent prompt <name-or-pane> "Run typecheck and report the result." --wait --timeout 120000
```

`agent prompt` refuses an agent that is `blocked` on an approval dialog;
inspect it and ask the user before answering. A delivered prompt is
coordination evidence, not implementation proof: re-read Git state and tests in
the owning checkout after any cross-pane handoff.

Codex subagents in one task and Claude agent teams already share an
orchestrator; use their native messaging instead of typing into panes.

## Integrations

`herdr integration status` should report `claude` and `codex` as `current`.
Those hooks report session IDs so herdr can restore native sessions after a
restart. Install a missing one with `herdr integration install <agent>`; the
hook files are herdr-managed and must not be edited.

## vpk-worktree Plugin

`.agents/herdr/plugins/vpk-worktree/` is a local herdr plugin (`vpk.worktree`)
that warms up new VPK worktrees:

- On `worktree.created` it checks the new checkout belongs to this repo (git
  common dir), copies missing ignored `.env*` files from the source checkout
  (never overwriting), and runs `CI=true pnpm install --prefer-offline` in an
  unfocused `vpk warmup` tab of the worktree's workspace. The tab ends with
  `[vpk-worktree] warmup done` or `warmup FAILED (exit N)`. Other repos are
  skipped, and the hook always exits 0.
- The workspace action `vpk.worktree.warmup` does the same on demand for a
  worktree created outside herdr; it skips the env copy in the main checkout.
  It acts on the focused workspace, so focus the worktree's workspace first,
  never the main checkout while other agents work there. Each run opens a new
  tab; close old ones by hand.
- If no tab can be opened, the install runs in the background and logs to
  `warmup.log` under herdr's plugin state dir.

Link it once per machine, with an absolute path:

```bash
herdr plugin link "$(git rev-parse --show-toplevel)/.agents/herdr/plugins/vpk-worktree"
herdr plugin list                      # vpk.worktree ... enabled
herdr plugin log list --plugin vpk.worktree
```

## Recommended herdr Config (optional)

These are personal settings in `~/.config/herdr/config.toml`, not repo
requirements. Apply with `herdr server reload-config`.

- **Notifications:** `brew install terminal-notifier`; herdr's `system` toast
  delivery tries it before `osascript`. Allow it once in System Settings >
  Notifications (run `terminal-notifier -message test`), or herdr keeps
  falling back to Script Editor toasts.
- **Pane names and state text in the sidebar:** add the `pane` token so
  worker labels show, and `state_text` so states read as words, not only icons:

  ```toml
  [ui.sidebar.agents]
  row_gap = 0
  rows = [["state_icon", "machine", "workspace", "tab", "pane"], ["agent", "state_text"]]
  ```

## Cleanup

- Close only the tabs, panes, and workspaces you created, and only when the
  user asked or the surface held a finished background run.
- Never use `herdr workspace close --group` to bypass a worktree-group
  confirmation, and never run `herdr server stop` from inside a session.
- Removing a git worktree does not close its herdr workspace. `vpk-git-clean`
  closes the matching workspace (`herdr worktree list` shows
  `open_workspace_id`) before `git worktree remove`.

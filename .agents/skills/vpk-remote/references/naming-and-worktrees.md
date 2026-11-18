# Naming and worktree isolation

Read this before naming a task or creating its worktree, and when deciding whether `--no-worktree` is right. Back to [SKILL.md](../SKILL.md).

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
*Worker shapes* fan-out rule in SKILL.md guards against, at the scale of
concurrent tasks rather than concurrent workers, and it is invisible from a
phone.

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
per *Naming* above:

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

In a task worktree, the worker commits its work to the task branch; the
planner verifies the diff there and reports. A GPT-lane worker can commit
only through the git grant in its canonical command, which opens its own
branch and the repository's shared object store, and no other ref (see
[gpt-executor.md § Commits](gpt-executor.md#commits)). A task under
`--no-worktree` has no task branch, and its GPT worker gets no grant. Where
the grant is `{}` (under `--no-worktree`, a detached or moved `HEAD`,
worktree metadata the grant script does not accept, or a planner who chose
not to trust the worker with the object store) or a commit fails, the worker
leaves the changes uncommitted and puts its proposed commit subject in its
report, and the planner commits after verifying the diff. **Stop at a verified diff** —
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

---
name: vpk-git-clean
description: "Remove only proven-landed VPK worktrees and branches, prune stale refs, and close explicitly abandoned PRs. Use when the user says \"vpk-git-clean\", \"clean up worktrees\", \"clean up branches\", \"remove merged worktrees\", \"prune stale refs\", or \"worktrees are piling up\"."
validation_command: git status --short
---

# VPK Git Clean

Use this skill for deferred VPK housekeeping after work has landed. Complete
the cleanup of proven-safe local branches and their unused worktrees; report
the exact blockers for everything retained.

## When to use

Accept a PR number, branch, worktree path, or a broad landed-work scope. A bare
`vpk-git-clean` requests a repository-wide cleanup, including eligible branches
that are still checked out in removable worktrees. Execute the safe set without
stopping at an inventory or approval gate. Inventory only when the user asks for
an audit, dry run, or list of candidates.

Run from the surviving persistent checkout and use the verified default-branch
ref as the landing baseline. Do not switch another task's checkout merely to
make cleanup convenient. If the current checkout is itself a candidate, clean
other eligible targets and report that one for a later run.

Do not use this to ship changes (`vpk-git-ship`), force-remove abandoned local
work, or clean Symphony issue state managed by `vpk-symphony`.

## Hard invariants

- Prove landing before deletion with `pnpm run clean-candidates -- --json`
  (read-only). "Proven landed" is defined once, in
  `scripts/lib/branch-landing.js`; do not re-derive it by hand. Only a target
  with status `main-synced` and no blockers is a candidate; `unknown` never is.
  An `upstream gone` marker proves only remote branch deletion.
- Any uncommitted or untracked file makes a worktree ineligible. Treat it as
  user work, regardless of whether the branch itself merged.
- Never remove or switch the current/default worktree, an open-PR head, an
  ambiguous path, or a worktree with an unresolved interactive process owner.
- Remove eligible worktrees with plain `git worktree remove`, then delete their
  source branches. Use `git branch -d` only for a target whose report says
  `proof: "ancestry"` (with an upstream set, `-d` also deletes a branch that is
  merged only into its upstream, so it is no proof on its own). A target proven
  only by `proof: "content"` needs the owner's go-ahead before any branch
  deletion. For a non-ancestor
  head, `git branch -D` is allowed only when the local tip exactly matches the
  head SHA of a merged PR into the default branch (`clean-candidates` reports
  `proof: "merged-pr"` with `exactHead: true`), no open PR owns its name or
  SHA, and no worktree owns the branch. Record the SHA and PR before deletion;
  a branch-name match or a `content` proof alone does not authorize `-D`.
  Never force-remove a worktree or detach one to clear a dirty branch.
- Stop only exact-path repository dev processes after the Git and PR checks
  pass. Preserve interactive shells, editors, other agents, and any process
  whose ownership or purpose remains unclear. Never use global
  `tmux kill-server` or `portless prune`.
- Do not reset, restore, clean, stash, fake ancestry, create commits, or use
  raw filesystem deletion to make a candidate removable.

GitHub PR records are not deleted. "Delete the PR after merge" means delete its
merged source branch and local worktree/refs. Close an unmerged PR with
`gh pr close --delete-branch` only after explicit abandonment confirmation.

## Inventory

```bash
pnpm run clean-candidates -- --fetch --json
git status --short --branch
git branch -vv
git worktree list --porcelain
git remote show origin
git symbolic-ref refs/remotes/origin/HEAD
git ls-remote --heads origin <default-branch>
gh auth status
gh pr list --state open --limit 1000 \
  --json number,headRefName,headRefOid,baseRefName,state
gh api repos/:owner/:repo \
  --jq '{full_name,delete_branch_on_merge,default_branch,private}'
```

The same report lists stale worktrees (`stale`: no branch activity and no
process for `--stale-days`, default 7, each with why it is or is not safe; a
process check that could not run is never safe) and every `index.lock` with its
holders (`indexLocks`). It removes nothing except, with
`--remove-stale-locks`, an `index.lock` no process holds that is older than
`--lock-min-age-minutes` (default 30), never in the persistent main checkout.
A stale worktree is still removed only through the workflow below.

Treat `git worktree list --porcelain` and local Git refs as authoritative, even
when a Git UI shows stale counts after a failed fetch. Query merged PRs for
non-ancestor candidates by exact branch and head SHA rather than relying on a
truncated repository-wide PR list. If the open-PR list reaches its limit, page
further before deleting refs. If injected-token auth fails while keyring auth
exists, retry read-only GitHub commands with
`/usr/bin/env -u GITHUB_TOKEN gh ...`.

## Workflow

1. Establish the current worktree and default branch, then enumerate local
   branches and registered worktrees. Match every checked-out branch to its
   owning worktree. Classify `upstream gone` separately from landed work.
2. First delete landed, unused branches; for a landed branch still checked out
   in a worktree, evaluate and remove that worktree before deleting the branch.
   Use only targets with `cleanable: true`. The report checks committed
   landing, tracked/untracked/skip-worktree/assume-unchanged changes, ignored
   content outside its regenerable list, half-done operations, reflog-only
   commits, the remote branch tip, every PR on the branch (by name; forks
   excluded), and current/default/locked/shared worktrees (the full list is in
   the header of `scripts/clean-candidates.js`). It does not check processes or
   open PRs by head SHA: prove those as in [evidence.md](references/evidence.md).
   A detached worktree is a target of its own: it is cleanable only by
   ancestry or content (it has no PR) and only with no reflog-only commits.
   A checked-out marker alone is not a reason to leave a clean, unused,
   landed worktree behind.
3. For an eligible worktree with an exact-path dev stack, stop that stack before
   removal. From the surviving checkout, prefer the tested
   cwd-scoped helper:

   ```bash
   node -e 'require("./scripts/lib/worktree-listener-cleanup").cleanupListeningProcessesForWorktree({ worktreePath: process.argv[1], logger: console }).then((s) => console.log(JSON.stringify(s)))' <worktree>
   ```

   Record `matchedPids`, `signalledCount`, `gracefulCount`, and
   `forceKilledCount`. It matches TCP listeners and the Rovo supervisor by the
   target cwd, so another checkout's stack remains untouched.
4. If the helper is unavailable, read `.dev-frontend-port`,
   `.dev-backend-port`, `.dev-rovo-port`, and `.dev-rovo-ports` before removal.
   Stop a listener only after `lsof -a -d cwd -p <pid> -Fn` reports the exact
   candidate path. Send TERM, recheck, then KILL only the same surviving PID.
5. Recheck status, HEAD, PR ownership, and exact-path process state immediately
   before removal. Remove a registered, clean, landed, process-safe worktree
   with plain `git worktree remove <path>`. Inside herdr (`HERDR_ENV=1`), first
   read `open_workspace_id` for that path from `herdr worktree list --cwd <repo>`
   and close it with `herdr workspace close <id>` (never `--group`); skip if the
   workspace hosts a live agent and report it instead. Use `git worktree prune --verbose`
   only when the directory is already gone and registered admin metadata is stale.
6. Recheck that no worktree uses the branch, then delete the local ref with
   `git branch -d <branch>` or the narrow merged-PR `-D` exception above. If
   `-d` refuses only because the invoking checkout trails the verified default
   commit, retry from an existing checkout at that commit or a temporary
   detached cleanup worktree there; do not switch an active checkout or use
   `-D` to bypass that refusal. Remove a temporary checkout afterward. If
   proof changes or Git still refuses, retain the branch and report why.
7. Delete a merged remote source branch only when the report says
   `remoteSafeToDelete: true` for it (`origin/<branch>` has nothing the landed
   local branch lacks; run with `--fetch` first) and no open PR uses its name or
   head commit. After remote deletion, prove `git ls-remote --heads` is empty
   before removing a stale local tracking ref with `git update-ref -d`.

Portless routes left by a removed stack may be removed one alias at a time with
`portless alias --remove <name>`. Global pruning can kill a different worktree
that reused the port, so it is outside this per-worktree flow.

Repeat the branch/worktree scan after each batch until no currently eligible
landed local branch or removable owning worktree remains. Concurrent tasks may
create or activate paths mid-sweep; preserve those and record the new blocker.

## Validation

```bash
git status --short --branch
git worktree list --porcelain
git worktree prune --dry-run --verbose
git branch -vv
git branch -r -v
git ls-remote --heads origin <deleted-branch>
```

Report deleted local refs and worktrees; processes and ports stopped; remote and
tracking refs deleted; explicitly abandoned PRs closed; and the remaining
branches grouped as open-PR, dirty worktree, active or unresolved process,
non-landed head, or other blocker. State separately how many merged branches
remain checked out and how many unused merged local branches remain.

---
name: vpk-git-clean
description: "Remove only proven-landed VPK worktrees and branches, prune stale refs, and close explicitly abandoned PRs. Use when the user says \"vpk-git-clean\", \"clean up worktrees\", \"clean up branches\", \"remove merged worktrees\", \"prune stale refs\", or \"worktrees are piling up\"."
metadata:
  validation_command: git status --short
---

# VPK Git Clean

Use this skill for deferred VPK housekeeping after work has landed. Complete
the cleanup of proven-safe local branches and their unused worktrees; report
the exact blockers for everything retained.

## When to use

Accept a PR number, branch, worktree path, or a broad landed-work scope. A bare
`vpk-git-clean` requests a repository-wide cleanup, including eligible branches
that are still checked out in removable worktrees. Investigate and resolve
recoverable blockers, rather than stopping at the report: preserve reflog-only
history, inspect ignored paths and stopped dev stacks, and check whether local
work is already represented on main. Execute the safe set and re-scan. Inventory
only when the user asks for an audit, dry run, or list of candidates.

Run from the surviving persistent checkout and use the verified default-branch
ref as the landing baseline. Do not switch another task's checkout merely to
make cleanup convenient. If the current checkout is itself a candidate, clean
other eligible targets and report that one for a later run.

Do not use this to ship changes (`vpk-git-ship`), discard uncertain local
work, or clean Symphony issue state managed by `vpk-symphony`.

## Hard invariants

- Prove landing before deletion with `pnpm run clean-candidates -- --fetch --json`
  (it removes nothing and writes no local branch, worktree, index or config;
  with `--fetch` it updates remote-tracking refs; the header of
  `scripts/clean-candidates.js` says exactly what it writes). Run it outside the
  Claude sandbox: inside it `.env*` files cannot be read, so every worktree with
  env files is retained (safe, but nothing is cleaned). "Proven landed" is defined once, in
  `scripts/lib/branch-landing.js`; do not re-derive it by hand. A target must
  have status `main-synced` and no blockers, except for the narrowly verified
  stopped-stack metadata in step 2. A dirty target is eligible only under
  step 2's verified superseded tracked-edit exception; `unknown` is never a
  candidate.
  An `upstream gone` marker proves only remote branch deletion.
- Uncommitted or untracked files are user work, regardless of whether the
  branch merged. The only automatic exception is the verified, backed-up
  superseded tracked edits in step 2. Untracked files are always retained.
- Never remove or switch the current/default worktree, an open-PR head, an
  ambiguous path, or a worktree with an unresolved interactive process owner.
- Remove eligible worktrees with plain `git worktree remove`, then delete their
  source branches. A branch may be deleted only when its report says
  `proof: "ancestry"`, `proof: "merged-pr"` with `exactHead: true` (the
  local tip is the head SHA of a merged PR into the default branch), or
  `proof: "content"` with its exact head preserved in a local recovery tag
  (step 2). No open PR may own its name or SHA, and no worktree may own the
  branch. Patch equivalence alone is not a landing proof.
  Delete with the report's head as the expected value (step 6), so a commit
  added since the report is never deleted; record the SHA and PR first. A
  branch-name match or `git branch -d` alone is no proof (with an upstream set,
  `-d` deletes a branch merged only into its upstream). Never detach a worktree
  to clear a dirty branch. Force-removal is limited to step 2's verified,
  backed-up superseded tracked edits.
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
   Use targets with `cleanable: true`, or the narrowly verified stopped-stack
   and superseded tracked-edit exceptions below. The report checks committed
   landing, tracked/untracked/skip-worktree/assume-unchanged changes, ignored
   content outside its regenerable list, half-done operations, reflog-only
   commits, the remote branch tip, every PR on the branch (by name; forks
   excluded), and current/default/locked/shared worktrees (the full list is in
   the header of `scripts/clean-candidates.js`). It does not check processes or
   open PRs by head SHA: prove those as in [evidence.md](references/evidence.md).
   A detached worktree is a target of its own: it is cleanable only by
   ancestry or content (it has no PR) and only with no reflog-only commits.
   Resolve recoverable blockers before asking the owner:

   - **Reflog-only history:** for a landed target blocked only by reflog history,
     a missing worktree, or independently verified stopped-stack metadata, retain
     each otherwise-unreachable branch/HEAD reflog tip and per-worktree ref as
     an exact local `refs/tags/rescue/vpk-git-clean/<full-oid>` ref. For missing
     worktrees use the report's `rescue` OIDs. Create refs with an expected empty
     old value; accept an existing tag only if it points to that same OID. Never
     invent commits or ancestry. Re-run the fetched report and require the
     reflog blocker to clear or `removeSafe: true` before removal. Keep unknown,
     truncated, or unreadable reflogs. Record the tag-to-branch mapping in a
     mode-0600 manifest under a mode-0700 directory in the common Git directory;
     report its path and the recovery refs.
   - **Environment files:** immediately before removal, compare each listed
     regular file silently (`cmp -s`) with the same relative path in the
     surviving persistent checkout; require that counterpart to be a regular
     non-symlink file. An exact duplicate is recoverable there and needs no
     separate confirmation. Never print file contents or hashes. If any file
     differs, is missing, or cannot be compared, show all such paths together
     and wait for the owner to authorize their removal. Do all other safe work
     first. Do not infer consent for a different list from an earlier answer.
   - **Stopped stack metadata:** an ignored `.dev-stack.json` may be disregarded
     only after verifying the record belongs to that exact checkout, its
     recorded tmux session is absent, its service processes and exact-path cwd
     owners are gone, and recorded ports have no listener owned by that path.
     An old `starting` phase alone is not proof of activity or of safety. Require
     the report's staleness age to be known and past its configured threshold.
     Only the record and recursively empty ignored directories may remain as report
     blockers; `.dev-stack.json.lock`, unknown processes, unreadable records,
     symlinks and other ignored files remain blockers. Run the fetched report
     again and recheck all facts immediately before plain worktree removal.
   - **Uncommitted or unlanded work:** compare the actual diff, commits, PRs and
     current main code and tests; identify what is incorporated or superseded.
     A patch-equivalent historical commit or a merged PR with later local
     commits is not proof that the current behavior contains those changes.
     For a branch whose head is an ancestor of both local and remote main, and
     whose entire tracked diff is demonstrably superseded by current code and
     tests, preserve an exact binary patch and base commit in a private
     directory under the common Git directory. Require no staged,
     untracked, hidden or `artifacts/**` changes; no other ignored content
     except the checked environment and stopped-stack cases above; and no
     active or unclear owner. All report blockers other than the verified dirty
     edits and stopped-stack metadata must first be resolved, including reflog
     history, unfinished operations, locked or shared ownership, remote tips,
     and unreadable facts. Require the report's staleness age to be known and
     past its configured threshold. Create the backup directory with mode 0700 and
     patch/manifest with mode 0600, tag the base commit, and verify the patch
     applies to that base using an isolated temporary index. Recheck that the
     worktree status, environment comparison, diff and head still match the
     backup and the process check is clear immediately before using
     `git worktree remove --force`. Record the evidence and backup paths. If
     any hunk is uncertain, keep the worktree and explain why. Preserve local
     conversation data and all `artifacts/**`; never remove artifacts without
     the user's explicit path-specific instruction.

   Use `git --no-optional-locks -C <worktree> ...` for read-only inspection so
   `git status` does not refresh the index and make an idle worktree look new.
   Preserve actual recent activity and live or unclear process ownership.
   Prune stale remote-tracking refs (`git fetch --prune origin`) only before
   running the report, and run it again after any prune; the report counts a
   remote-tracking ref as keeping a commit only after a successful `--fetch`
   and only while its branch still exists on origin.
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
5. Immediately before removal, run the report again and require the target to
   be still `cleanable: true`, or satisfy only the independently verified
   stopped-stack metadata or backed-up superseded tracked-edit exceptions in
   step 2, with the same `head` and `ignoredEnvFiles`; the
   report applies the ignored-files rule, which plain `git status` does not (it
   never shows ignored files created since). Then recheck PR ownership and
   exact-path process state. Remove a registered, clean, landed, process-safe
   worktree with plain `git worktree remove <path>`. Only the backed-up
   superseded tracked-edit exception permits `--force`. Inside herdr (`HERDR_ENV=1`), first
   read `open_workspace_id` for that path from `herdr worktree list --cwd <repo>`
   and close it with `herdr workspace close <id>` (never `--group`); skip if the
   workspace hosts a live agent and report it instead. A registered worktree
   whose directory is gone is in the report's `missingWorktrees`: remove that
   entry alone with `git worktree remove <path>`, and only when it says
   `removeSafe: true` and it is not locked. Never run `git worktree prune`,
   which drops every stale entry at once, with the only reference to a
   detached worktree's commits. For `removeSafe: false`, preserve the report's
   rescue OIDs as in step 2 and re-run the report; if it remains false or is
   unknown, retain it with the rescue commands.
6. Recheck that no worktree uses the branch (`git worktree list --porcelain`),
   then delete the local ref with the head the report saw as its expected
   value; it fails instead of deleting a commit added since the report:

   ```bash
   git update-ref -d refs/heads/<branch> <evidence.head>
   ```

   If it fails, or the proof changed, retain the branch, rerun the report, and
   report why.
7. Delete a merged remote source branch only when the report, run with
   `--fetch`, says `"fetch": "ok"` and `remoteSafeToDelete: true` for it
   (`origin/<branch>` has nothing the landed local branch lacks), and no open PR
   uses its name or head commit. Delete it with a lease on the tip the report
   saw, so a push made since the report is not deleted:

   ```bash
   git push --force-with-lease=refs/heads/<branch>:<evidence.remoteTip> origin :refs/heads/<branch>
   ```

   A `stale info` rejection means someone pushed after the report: keep the
   branch and rerun the report. After remote deletion, prove
   `git ls-remote --heads` is empty before removing a stale local tracking ref
   with `git update-ref -d`.

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

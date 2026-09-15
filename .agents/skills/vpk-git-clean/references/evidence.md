# Cleanup evidence

Use this walkthrough to prove a worktree or branch has landed before removing
it. Evidence must cover committed history, uncommitted files, PR ownership,
registration, and process ownership; no single signal proves all five.

## Establish repository truth

Run from the surviving persistent checkout and verify the default-branch ref:

```bash
git status --short --branch
git worktree list --porcelain
git remote show origin
git symbolic-ref refs/remotes/origin/HEAD
git ls-remote --heads origin <default-branch>
gh pr list --state open --limit 1000 \
  --json number,headRefName,headRefOid,baseRefName,state
```

Record the default branch and its current remote head, current worktree,
candidate path, candidate branch or detached HEAD, and candidate head SHA. A
target is ineligible if it is current, owns the default branch, or is not a
registered worktree with inspectable Git metadata. If the local default ref
trails the remote head, fetch the remote commit and use the refreshed remote ref
as the landing baseline. Do not move a checked-out local branch ref or switch
an active checkout merely to make the local default ref current.

Use `git branch -vv` to spot missing upstreams, then use ancestry and PR
evidence to decide landing. A missing upstream does not prove the local head
landed. `git worktree list --porcelain` tells you which branches cannot be
deleted until their owning worktree is removed.

## Prove the working tree is empty

Use porcelain with untracked files enabled:

```bash
git -C <worktree> status --short --branch --untracked-files=all
git -C <worktree> status --porcelain=v1 --untracked-files=all
```

Any output from the second command is a hard stop. Capture the exact path,
branch or detached state, and file list, then leave it alone. A merged PR proves
only committed work; it says nothing about these local files.

## Prove committed work landed

Try ancestry first:

```bash
git merge-base --is-ancestor <candidate-head> <default>
```

Exit zero proves the candidate commit is in the default branch's history. When
ancestry fails because the PR was squash-merged or commits were recreated, use
GitHub merged-PR evidence: match the candidate branch or head SHA to a closed
PR, confirm its `state`, `mergedAt`, and base branch, and verify no open PR uses
the same branch or head. Query the candidate branch directly rather than
assuming the latest repository-wide PR page includes it:

```bash
gh pr list --state merged --head <candidate-branch> --limit 100 \
  --json number,headRefName,headRefOid,baseRefName,state,mergedAt
```

Require the candidate's current tip to equal that merged PR's `headRefOid`.
A branch-name match alone does not cover commits added locally after the merge.

For local `git branch -D`, require an exact match between the current local tip
and a merged PR's `headRefOid`, plus no registered worktree or open PR owner.
Record the PR and tip before deleting the ref. PR branch-name match alone and
patch-equivalence are not enough for force deletion.

When ancestry and PR metadata are unavailable or insufficient, use
patch-equivalence only as a final fallback:

```bash
git cherry -v <default> <candidate-head>
```

Every candidate patch must be shown as equivalent on the default branch. Review
the actual diff when the result is unclear. Do not create no-op merges or fake
ancestry to turn an uncertain target into an eligible one.

## Reconcile PR and remote branch state

For a merged PR whose source branch remains:

1. Capture `headRefName`, `headRefOid`, `baseRefName`, state, and merge time.
2. Query open PRs by both branch name and candidate head SHA.
3. Delete the remote branch only when the PR is merged and neither query finds
   active ownership.
4. Check the remote directly:

   ```bash
   git ls-remote --heads origin <branch>
   ```

5. Only after the command returns no ref may a stale tracking ref be removed:

   ```bash
   git update-ref -d refs/remotes/origin/<branch>
   ```

For an ancestor head, delete the local branch with `git branch -d` only when it
is unused by every registered worktree. If it is still checked out, first
remove its clean, landed, process-safe owning worktree with plain
`git worktree remove`; then recheck branch ownership and delete the ref. For a
non-ancestor head, use the exact merged-PR `-D` exception above or retain it.
If `-d` refuses because the invoking checkout is behind the verified default,
retry from a checkout at the default commit. A stale invoking HEAD is not a
reason to force-delete an ancestor branch.

For an unmerged PR, do nothing from an ambiguous cleanup request. Confirm the
user wants abandonment, then inspect unpushed commits, dependent PRs, active
worktrees, and local files before `gh pr close <number> --delete-branch`.

## Prove process ownership

After Git and PR checks, inspect cwd owners at or inside the exact worktree path
and the worktree's recorded dev ports/listeners. Run process checks after
`git -C <worktree>` validation, not in parallel with it, to avoid counting your
own transient Git processes:

```bash
lsof -d cwd -Fpcn
```

Match each `n` path exactly to the candidate or a descendant. Record PID,
command, and cwd for matches. An exact-path repository dev listener may be
stopped after all Git and PR checks pass; recheck afterward. Preserve an
interactive shell, editor, agent, or unknown owner. Prefer the repo's
cwd-scoped listener helper documented in `../SKILL.md`.

`lsof +D <worktree>` may help resolve suspicious open-file ownership, but it is
not the mandatory process proof: dependency-heavy worktrees can make it time
out. If the cwd scan and exact listener/port checks complete with no owner, an
optional recursive-scan timeout alone does not make the worktree ineligible.
If either targeted check fails or leaves ownership unclear, retain the path.

For a port-file fallback, collect candidate ports before deleting the directory:

```bash
cat <worktree>/.dev-frontend-port <worktree>/.dev-backend-port 2>/dev/null
cat <worktree>/.dev-rovo-port 2>/dev/null
grep -oE '[0-9]+' <worktree>/.dev-rovo-ports 2>/dev/null
lsof -ti:<port> -sTCP:LISTEN
lsof -a -d cwd -p <pid> -Fn
```

The `n` line must exactly equal the candidate path. Skip listeners owned by any
other cwd. Send SIGTERM, recheck ownership and liveness, and use SIGKILL only on
the same PID if it persists.

## Removal proof record

Before each removal, retain a compact evidence record:

```text
path: <absolute worktree path>
head: <branch-or-detached> <sha>
clean: yes
current/default: no/no
landed proof: ancestry | merged PR #N | patch-equivalent
open PR by branch/head: none
process proof: cwd and port checks clear | exact-path dev PIDs stopped
action: git worktree remove <path>, then git branch -d <branch>
```

After removal, re-run the worktree inventory and dry-run prune. Report stale
admin metadata, tracking refs, dirty state, or any mismatch instead of widening
the cleanup scope.

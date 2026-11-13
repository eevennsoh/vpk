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

Use `git branch -vv` to spot missing upstreams, and `clean-candidates` to decide
landing. A missing upstream does not prove the local head landed. `git worktree list --porcelain` tells you which branches cannot be
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

Run the read-only report and read the target's entry; do not re-derive landing
by hand:

```bash
pnpm run clean-candidates -- --fetch --json
```

`ship-status` shows where one branch is on its way to main; it does not apply
the cleanup blockers, so its `main-synced` is not "removable". Only
`clean-candidates` decides cleanup.

"Proven landed" is defined once, in `scripts/lib/branch-landing.js`
(`provenLanded`): the head is an ancestor of `origin/<default>` (`ancestry`); or
a PR merged into `<default>` carried every local commit (`merged-pr`; squash and
rebase merges); or merging the head into `origin/<default>` changes nothing
(`content`: `git merge-tree --write-tree` gives `origin/<default>`'s own tree).
The content proof is git's plain three-way text merge with every merge driver,
attribute and renormalization setting neutralised (an
`$GIT_COMMON_DIR/info/attributes` that sets anything makes it unknown). Unlike
`git cherry` it sees whitespace and merge commits, but it is a merge, not an
identity check: when the target already holds the head's changes together with
later edits near them, the merge is clean and the head counts as landed. Commits past a merged PR's head are not landed. A read that failed makes the answer `unknown`, which is
never removable. `evidence.proof` names the proof and, for a merged PR,
`evidence.landedBy` its number and `evidence.exactHead` whether the local tip
equals the PR's recorded head.

The report's `main-synced` status also requires the local `<default>` to hold
the landing commit; `merged` means "sync main first". `exactHead: true` is
still required for `git branch -D` (below). Do not create no-op merges or fake
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
landed proof: ancestry | merged PR #N | content
open PR by branch/head: none
process proof: cwd and port checks clear | exact-path dev PIDs stopped
action: git worktree remove <path>, then git branch -d <branch>
```

After removal, re-run the worktree inventory and dry-run prune. Report stale
admin metadata, tracking refs, dirty state, or any mismatch instead of widening
the cleanup scope.

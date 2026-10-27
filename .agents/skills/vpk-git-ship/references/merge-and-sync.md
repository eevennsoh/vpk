# Merge and sync

Use this reference after the review gate is clear. It covers the wait/merge
mechanics, batch behavior, conflicts and failed checks, and synchronization of
the persistent `main` checkout.

## Wait for checks, then merge

Do not use `gh pr merge --auto`. Without enforced branch protection it merges
at once, before CI finishes. Wait on the gate first:

```bash
node .agents/skills/vpk-git-ship/scripts/review-gate-status.js \
  --pr <number> --repo <owner>/<repo> --wait 1200 --rerun-interrupted 3 --require-clear --json
```

Run it as a background command so the harness notifies on exit; a full wait
plus reruns can take an hour.

- Exit 0: checks passed, review gate clear, merge state `CLEAN`. Merge now:
  `gh pr merge <number> --merge --delete-branch`.
- Exit 3 with `checks.state: "billing-blocked"`: GitHub Actions did not run
  because of account billing, and nothing else blocks. Skip GitHub CI without
  asking or waiting: run `pnpm run ci:pr` locally at the PR head, comment the
  result on the PR, and merge with the same command only if it exited 0. Follow
  [Billing-blocked CI](review-gate.md#billing-blocked-ci).
- Exit 2 with `checks.state: "failing"`: stop and report each failing check's
  name and URL. Do not retry or fix unless the user asked for remediation.
- Exit 2 with `checks.state: "interrupted"`: a run was cancelled or timed out
  three times without a verdict (`reruns` lists the run IDs). This is not a
  test failure. Stop, preserve the PR, and report it as a CI capacity problem
  (usually the job `timeout-minutes` in `.github/workflows/ci.yml`). Never
  merge on an interrupted run.
- Exit 2 with `checks.state: "pending"`: the wait ran out. Stop and
  preserve the PR; report the pending checks.
- Exit 2 with checks passing: a review or merge-state condition remains; see
  [review-gate.md](review-gate.md).

`--delete-branch` deletes the remote source branch; local worktrees and
branches remain cleanup work.

If `BLOCKED` appears while checks look green, repeat the review-gate GraphQL and
REST reconciliation once. Merge only after every surfaced thread is resolved.
When sources agree that conversations are clear, report the actual remaining
rule (for example CODEOWNERS or a required human review); do not use
`--admin`.

For merge-back of an existing PR, run the same wait-and-gate command first; the
merge command is the same.

Prefer merge commits unless the user explicitly asks for squash or rebase.

## Conflict and failed-check handling

- Resolve conflicts only in the PR branch or its owning worktree, never by
  overwriting persistent-main edits.
- Inspect both sides and preserve unrelated changes. Push the conflict fix, then
  rerun checks and the full review gate because the PR head changed.
- If a required check fails, report its name and URL. Fix it only when the user
  asked to finish the PR; otherwise leave the branch and PR intact.
- If review is re-requested or approval is dismissed after a push, wait for the
  current-head policy result. Old-head approval is not reusable proof.
- Treat Codex review timeout or unavailability as non-blocking once recorded;
  treat unresolved conversations and failing, interrupted, or pending checks as
  blocking. Billing-blocked checks are replaced by a passing local
  `pnpm run ci:pr`; they are not skipped silently.

## Sync persistent main

After GitHub confirms `state: MERGED`, update the local `main` **ref**. Never
run `git pull` in a checkout without first confirming it has `main` checked
out: `git pull origin main` merges into whatever branch is current, so in a
checkout another session has switched to its own branch it silently rewrites
that branch (this happened on 2026-10-24, when a Codex dependency branch in
the main checkout was fast-forwarded onto a merged PR).

Find which worktree, if any, has `main` checked out:

```bash
git worktree list --porcelain | grep -B2 '^branch refs/heads/main$'
```

- **No worktree has `main` checked out** (the usual case when the main
  checkout is on another session's branch): update the ref without touching
  any working tree. The refspec refuses a non-fast-forward update.

  ```bash
  git fetch origin main:main
  ```

- **A worktree has `main` checked out:** confirm it, then fast-forward there.

  ```bash
  test "$(git -C <that-worktree> branch --show-current)" = main
  git -C <that-worktree> pull --ff-only origin main
  ```

Never switch another session's checkout to `main` to make the sync work.

Before syncing, inspect the persistent checkout's status. If unrelated edits
would be affected, preserve them with the narrowest safe mechanism and restore
them unstaged afterward. If there is no safe preservation path, stop and report
the blocker rather than forcing a sync.

Only switch to `main` and delete the local feature branch when running in the
persistent checkout and its tree is clean. In a secondary worktree, or whenever
local edits exist, stay put. Never remove the current worktree or delete the
branch it is using. Defer that to `vpk-git-clean` from the main checkout.

Verify synchronization:

```bash
git rev-parse main origin/main
git -C <main-checkout> status --short --branch   # its current branch must be unchanged
```

The two revisions should match after a successful fast-forward. If they do not,
report whether local `main` diverged or dirty files prevented the update. Do not
reset, force, or discard the local state.

## Batch merge-back

For multiple PRs, branches, or worktrees:

1. Parse and echo the full ordered target list before changing state.
2. Inspect every target once and group it as ready, conflict/rebase needed, or
   blocked by checks, draft state, review, or ownership ambiguity.
3. Run the review gate independently for every ready target.
4. Preserve unrelated persistent-main edits once, not once per PR.
5. Merge ready PRs sequentially in user order, or ascending PR number when no
   order was given.
6. After each merge, fetch and fast-forward persistent `main` before evaluating
   the next target. A later PR may conflict with the new base.
7. If a later target becomes conflicted, stop on that target and leave remaining
   state intact; do not invent cross-PR conflict resolutions.
8. Restore preserved edits unstaged, run one final sync verification, and report
   one status line per target: merged, skipped with reason, or failed.

Branch deletion is limited to the remote source branches of PRs merged in this
flow. Do not bulk-delete local branches or worktrees; `vpk-git-clean` proves and
performs those removals separately.

## Edge cases

- A remote merge can succeed even when local branch deletion fails because a
  worktree still owns the branch. Verify the PR and merge commit, sync `main`,
  and defer local deletion.
- A merge helper may complain that `main` is already checked out elsewhere.
  Use the owning worktree with `git -C`; do not attach `main` twice.
- If the persistent checkout is intentionally on another branch, preserve that
  branch and report that local `main` was not switched. Sync only when it is safe.
- If the merge command returns an error after GitHub may have accepted it,
  re-read `state`, `mergedAt`, and `mergeCommit` before retrying. Never create a
  duplicate PR or duplicate merge because the local cleanup portion failed.

## Final evidence

Report the PR URL, current-head check result, review-gate result, merge commit,
remote branch deletion, persistent-main revision, preserved local edits, and a
one-line instruction to run `vpk-git-clean` later for landed worktree cleanup.

# Merge and sync

Use this reference after the review gate is clear. It covers the wait/merge
mechanics, batch behavior, conflicts and failed checks, and synchronization of
the persistent `main` checkout.

## Wait for checks, then merge

Do not use `gh pr merge --auto`. Without enforced branch protection it merges
at once, before CI finishes. Wait on the gate first:

```bash
node .agents/skills/vpk-git-ship/scripts/review-gate-status.js \
  --pr <number> --repo <owner>/<repo> --wait 1800 --rerun-interrupted 3 --require-clear --json
```

Run it as a background command so the harness notifies on exit; a full wait
plus reruns can take an hour. Check progress when a state changes or a run
exceeds its expected duration, and report the current job, elapsed time, and
known blocker. A pending check is not evidence of failure or a stalled test.
Record current-head review status concurrently, bounded to three minutes as in
[review-gate.md](review-gate.md). Reuse valid evidence on unchanged code rather
than starting duplicate full local CI while Actions is healthy.

- Exit 0: record checks, current-head review and `CLEAN` merge state. Merge with
  the canonical helper and the reviewed SHA:

  ```bash
  node .agents/skills/vpk-git-ship/scripts/merge-remote.js \
    --pr <number> --repo <owner>/<repo> --head <reviewed-head-sha>
  ```
- Exit 3 with `checks.state: "billing-blocked"`: GitHub Actions did not run
  because of account billing, and nothing else blocks. Skip GitHub CI without
  asking or waiting: run `pnpm run ci:pr` locally at the PR head, comment the
  result on the PR, then follow the explicit expected-SHA REST path only if local
  CI exited 0. The canonical helper refuses exit 3; it has no bypass flag. Follow
  [Billing-blocked CI](review-gate.md#billing-blocked-ci).
- Exit 2 with `checks.state: "failing"`: inspect the check logs. When the user
  asked to ship or finish the PR, fix a failure attributable to the requested
  changes when the fix is clear and within scope. Batch fixes and validate ALL
  colocated contracts and affected browser checks against the final reconciled
  candidate before pushing. Reuse unaffected evidence, commit and push, then repeat the full current-head review and CI gate. Do not
  blindly rerun a real failure. Stop and report unrelated failures, unclear
  product decisions, or failures that cannot be safely fixed in scope.
- Exit 2 with `checks.state: "interrupted"`: a run was cancelled or timed out
  three times without a verdict (`reruns` lists the run IDs). This is not a
  test failure. Stop, preserve the PR, and report the interrupted runs and known
  cause; do not infer capacity or timeout without evidence. Never
  merge on an interrupted run.
- Exit 2 with `checks.state: "pending"`: the wait ran out. Stop and
  preserve the PR; report the pending checks.
- Exit 2 with checks passing: a review or merge-state condition remains; see
  [review-gate.md](review-gate.md).

The helper obtains a fresh full review gate, rejects a changed reviewed SHA,
then uses the documented REST merge endpoint (`PUT /repos/{owner}/{repo}/pulls/{number}/merge`)
with `sha` and `merge_method: merge`. It verifies the merged PR before considering
branch deletion. Deletion requires the original and current head to belong to
the same repository, retain their branch name and SHA, and differ from the base
and default branch. A fresh ref read is followed by a Git push with an explicit
repository URL and `--force-with-lease=<head-ref>:<reviewed-sha>`; this makes a
concurrent push reject deletion. REST ref deletion has no documented expected-SHA
condition, so the helper never uses it. Fork and changed refs are preserved.

After a verified merge, the JSON retains `mergeCommit` and the full `gate`, and
`branchDeletion` reports `{ state, ref?, reason?, stage?, error?, warning? }`:
`deleted` means the leased Git deletion succeeded; `preserved` means identity or
an advanced ref prevented deletion; `unconfirmed` means ref lookup or deletion
failed. A lookup 404 can mean automatic deletion or hidden permission failure,
so it never proves deletion. Report the actual state and warning, reconcile or
defer cleanup, and continue the separate main sync. Never repeat a verified
merge because cleanup is unconfirmed. An advanced ref is never deleted.

The helper never switches checkout, deletes a local branch, or syncs main.
Genuinely unconfirmed merges still fail closed; an unknown merge mutation is
reconciled once without retrying it. Cleanup failures after verified merge return
the structured outcome with exit 0; callers must inspect `branchDeletion.state`
instead of equating command success with deletion. Persistent-main synchronization below remains a separate step. Local
branches and worktrees belong to `vpk-git-clean`.

If `BLOCKED` appears while checks look green, repeat the review-gate GraphQL and
REST reconciliation once. Merge only after every surfaced thread is resolved.
When sources agree that conversations are clear, report the actual remaining
rule (for example CODEOWNERS or a required human review); do not use
`--admin`.

For merge-back of an existing PR, run the same wait-and-gate command first; the
canonical remote merge helper is the same.

Prefer merge commits unless the user explicitly asks for squash or rebase.

## Conflict and failed-check handling

- Resolve conflicts only in the PR branch or its owning worktree, never by
  overwriting persistent-main edits.
- Inspect both sides and preserve unrelated changes. Validate the final reconciled
  candidate before pushing: focused checks, ALL colocated contracts and affected
  browser checks. Then push the conflict fix and require hosted CI and a fresh
  current-head review gate.
- Generated files listed by `pnpm run generated:status` (repo map, route
  manifest, API surfaces, Cursor rules, skills index, lockfile) are never
  hand-merged: take either side, run `pnpm run fix:generated`, and commit the
  result.
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

Keep the current checkout on its owning branch. Never switch to `main` or delete
local branches as part of remote merge or sync. Defer landed branch/worktree
cleanup to `vpk-git-clean` from the main checkout.
Verify synchronization:

```bash
pnpm run ship-status -- --branch <branch> --json   # status main-synced (or cleaned)
git -C <main-checkout> status --short --branch   # its current branch must be unchanged
```

`main-synced` proves the local `main` holds the landing commit. If it still
reads `merged`, report whether local `main` diverged or dirty files prevented
the update. Do not reset, force, or discard the local state.

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

- A remote merge can succeed while a later remote deletion lease is rejected.
  Record the merge commit, preserve the advanced ref, and sync `main` separately;
  a failed deletion is not a failed merge. Local worktree ownership is irrelevant
  to the remote helper.
- If the persistent checkout is intentionally on another branch, preserve that
  branch and report that local `main` was not switched. Sync only when it is safe.
- If the merge command returns an error after GitHub may have accepted it,
  re-read `state`, `mergedAt`, and `mergeCommit` before retrying. Never create a
  duplicate PR or duplicate merge because a subsequent branch deletion failed.

## Final evidence

Report the PR URL, current-head check result, review-gate result, merge commit,
remote branch deletion, persistent-main revision, preserved local edits, and a
one-line instruction to run `vpk-git-clean` later for landed worktree cleanup.

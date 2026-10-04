---
name: vpk-git-ship
description: "Ship VPK changes through a pull request, required checks, review remediation, merge, and persistent-main sync. Use when the user says \"vpk-git-ship\", \"ship this\", \"merge it\", \"land this work end-to-end\", or \"merge these PRs back to main\"; use vpk-git-clean for cleanup."
validation_command: pnpm run verify:fast && pnpm run lint && pnpm run typecheck
---

# VPK Git Ship

Use this skill for interactive VPK shipping that preserves unrelated work,
publishes a PR, clears its merge gates, and syncs the persistent `main` checkout.
It ends at merged plus synced; local worktree and branch cleanup belongs to
`vpk-git-clean`.

## When to use

- Bare `vpk-git-ship` runs the full create/update PR -> review -> merge -> sync flow.
- `vpk-git-ship --pr [title hint]` stops after creating or updating the PR.
- `vpk-git-ship --merge <PR | branch | worktree>` runs merge-back only.
- Multiple merge targets run the batch flow in
  [merge-and-sync.md](references/merge-and-sync.md).
- `--bypass`, "no Codex credit", or equivalent skips only the best-effort wait
  for a fresh Codex auto-review; it never skips checks or review conversations.

Do not run the workflow for a help question about the skill. Do not use it for
direct-to-main shipping (`vpk-git-ship-fast`), cleanup (`vpk-git-clean`), or a
Symphony issue already following `vpk-symphony/references/git/land.md`.

## Hard invariants

- Preserve unrelated user edits. Inspect the actual checkout and diff before
  staging, stashing, switching, rebasing, or syncing another worktree.
- Never commit changes to `main` in the PR flow. A detached HEAD is normal;
  attach a contextual feature branch when there is work to ship.
- Required `CI / PR checks` are enforced by branch protection on `main`, and
  auto-merge waits for them. Unresolved review threads block merge server-side.
  Never bypass either gate with admin flags. Follow
  [review-gate.md](references/review-gate.md) before every merge.
- Missing or timed-out Codex auto-review is non-blocking once its status is
  recorded; unresolved conversations are blocking.
- Never remove the current worktree or force-delete local state. After shipping,
  point to `vpk-git-clean` for deferred cleanup.

## Baseline inventory

Run from the checkout that owns the work:

```bash
pwd
git update-index --refresh
git status --short --branch
git worktree list --porcelain
gh repo view --json nameWithOwner,defaultBranchRef
```

If an injected `GITHUB_TOKEN` is invalid but keyring auth exists, retry read-only
`gh` commands with `/usr/bin/env -u GITHUB_TOKEN gh ...` before declaring GitHub
unavailable.

## Create or update the PR

1. Inspect `git status --porcelain=v1 --untracked-files=all`,
   `git log --oneline origin/main..HEAD`, current branch, and upstream. Stop only
   if both the working tree and commits-ahead list are empty.
2. Derive a short 3-5-word kebab-case verb-noun branch name from the combined
   diff and commit subjects. Avoid session names, random worktree slugs, ticket
   prefixes, and generic names such as `fix-bug`.
3. Attach or select the branch:
   - On `main`, create the derived feature branch.
   - On detached HEAD, create the branch at the current commit.
   - On a stale or mismatched feature name, rename it only when no open PR owns
     it. Keep an existing PR's branch and report the mismatch.
   - If the derived name exists, add a 2-3-character short-SHA suffix.
4. Check `gh pr list --head <branch> --state open`. If an open PR exists, update
   it in place when the request clearly targets that work; otherwise ask once
   whether to update it or close it and open a new PR.
5. Refresh status again. Prefer `git add -A`, but stage selectively when the tree
   contains unrelated experiments, secrets, or `.env*`; report every skipped
   path. Generate a concise imperative commit subject from the diff, with no
   co-author footer unless requested.
6. Run `pnpm run verify:fast` (~10s: generated-file drift, file-size budget,
   guardrails, ESLint suppression ratchet — about half of first-run CI
   failures). Then push with upstream when needed and create the PR with
   `gh pr create` or capture the updated PR URL. List only checks actually run.
7. Report the PR URL, branch, commit, and checks URL. `--pr` stops here.

Local validation may be deferred to CI for the create-only path. If the flow
will merge and GitHub has no required checks, run the relevant `AGENTS.md`
validation locally; include focused tests and browser evidence when the changed
surface requires them.

## Full ship sequence

1. Run the create/update flow and capture the PR number and head SHA.
2. Poll briefly for the configured Codex auto-review only when this run pushed a
   new head. With `--bypass`, record `bypassed/no credit` and continue.
3. Execute [review-gate.md](references/review-gate.md). Fix valid findings,
   explain invalid ones, and stop on ambiguous product judgment.
4. Queue and monitor auto-merge, then synchronize persistent `main` using
   [merge-and-sync.md](references/merge-and-sync.md).
5. Report the merge commit, remote branch deletion, main-sync state, review and
   validation evidence, plus the deferred `vpk-git-clean` handoff.

## Merge-back entry point

For `--merge`, identify the exact PR, branch, or worktree first. Inspect the PR
and the named checkout in place, reconcile conflicts on the PR branch, then run
the same review gate before merging. Do not wait for a new Codex signal when the
head was not updated in this run; inspect and report the existing status.

Read [merge-and-sync.md](references/merge-and-sync.md) for auto-merge polling,
batch ordering, conflict and check failures, re-requested review, persistent-main
sync, and local branch/worktree edge cases.

## Stop rules

Stop without destroying state when the checkout has overlapping edits with no
safe preservation path; required checks fail; merge state is `DIRTY`; review
threads remain unresolved or cannot be reconciled through documented APIs;
GitHub ownership or ancestry is ambiguous; or the merge poll times out. Preserve
the branch, commit, and PR so the user can resume the same flow.

## Proof and report

Before handoff, capture:

```bash
gh pr view <number> --json state,mergedAt,mergeCommit,url,statusCheckRollup
git -C <main-checkout> status --short --branch
git -C <main-checkout> rev-parse main
git -C <main-checkout> rev-parse origin/main
```

Report created/updated/merged state, PR URL, branch and commit, Codex status,
review dispositions, check results, merge commit, persistent-main sync, preserved
edits, and the `vpk-git-clean` follow-up.

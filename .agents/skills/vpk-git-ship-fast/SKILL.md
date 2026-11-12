---
name: vpk-git-ship-fast
description: "Commit all eligible changes and push directly to VPK main without a PR. Use when the user says \"vpk-git-ship-fast\", \"commit and push to main\", \"push straight to main, no PR\", or \"land this directly\"; protected main may require fallback to vpk-git-ship."
validation_command: git status --short
---

# VPK Git Ship Fast

Use this deliberately ungated path to commit the entire eligible working tree
and fast-forward it directly to remote `main`. It creates no PR or feature
branch and performs no review or CI gate before the push. Nothing waits on CI:
for code changes, GitHub's push-to-`main` workflow runs after the push, and the
skill prints that run's URL without waiting for it. Docs- or artifacts-only
pushes, and pushes while Actions is billing-blocked, carry the `[skip ci]`
commit-message marker instead.

The owner chose this deliberately. Do not add a pre-push hook, a local check, or
a wait for hosted CI to this workflow, and do not propose one.

## When to use

Use only when the user explicitly chooses the fast direct-to-main path. Use
`vpk-git-ship` when they want a PR, CI gate, review, or selective shipping.
If branch protection rejects a direct push, stop; the user can separately
choose a gated workflow. Use `vpk-git-clean` for worktree, branch, or ref
cleanup.

## Hard invariants

- Inventory the whole tree first because `git add -A` includes unrelated and
  untracked files. Warn about paths not created in the current task, then honor
  the user's explicit all-tree fast-ship choice.
- Exclude `.env*`, keys, certificates, credentials, and other secrets. If they
  cannot be confidently separated, stop before staging.
- Integrate an advanced `origin/main` into the committed local work before
  pushing. Push only when `origin/main` is an ancestor of `HEAD`; never
  force-push or rewrite remote history.
- If protected `main` rejects the push with `GH006`, leave the local commit
  intact and stop; do not bypass branch protection or start a gated workflow.
- Preserve dirty or divergent state in the persistent `main` checkout. A
  successful remote push does not authorize discarding local work to sync it.
- Always attempt to sync local `main` with freshly fetched `origin/main`, even
  when there is nothing to commit or push. Report any blocker.

## Workflow

1. Refresh remote `main` and inventory the whole tree:

   ```bash
   git fetch origin main
   git update-index --refresh
   git status --short --branch
   git diff HEAD --stat
   git diff HEAD
   git log --oneline origin/main..HEAD
   ```

   If the tree is clean and there are no commits ahead of the freshly fetched
   `origin/main`, attempt the local-main sync in step 9 before reporting that
   there is nothing to commit or push. A branch behind `main` alone does not
   need an empty commit or a push.

2. Record the current branch. On a feature branch or detached HEAD, warn once
   that its resulting commit will be pushed directly to `main`, then continue;
   explicit fast-ship intent is the authorization.

3. Compare every changed and untracked path with the current task. List any
   unrelated or concurrent paths that will also be committed. Do not silently
   omit them unless they are secrets or clearly unsafe to publish.

4. Stage the eligible tree with `git add -A`. When secrets are present, stage
   only safe paths and report every exclusion. Re-read `git status --short`
   before committing, and decide the CI marker from what will land (staged work
   plus commits ahead of `origin/main`) in the same command:

   ```bash
   git status --short && node .agents/skills/vpk-git-ship/scripts/main-health.js --ci-marker
   ```

   It prints `CI marker: add [skip ci]` only when every landing path is
   markdown outside `AGENTS.md` and `.agents/**` (which repo guards check) or
   under `artifacts/`, or when the latest CI run was refused for account
   billing in the last 24 hours. Otherwise it prints `CI marker: none` and CI
   runs after the push. It makes at most a couple of read-only GitHub calls and
   never blocks; when GitHub is unreachable it answers `none`. Follow it without
   asking. If it says a commit to push already skips CI (for example a retried
   fast ship), do not rewrite that commit; start CI explicitly after the push
   (step 10).

5. Generate an imperative subject of about 50 characters from the actual diff.
   Include `[skip ci]` in the commit message only when step 4 said `add`.
   Never mention the marker in a message that should run CI, even when quoting
   another commit: GitHub skips push-triggered CI if the literal marker (or
   `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]`, or a
   `skip-checks: true` trailer) appears in a pushed commit's message. Add a short body only for distinct concerns,
   follow repository log style, and omit co-author footers unless requested.
   Commit once. If the tree is clean but commits are ahead, create an empty
   commit only when the marker is needed; otherwise push the existing commits
   as they are rather than rewriting them.

6. Do not run or wait for local or hosted CI checks as part of this fast-ship
   workflow, including `verify:fast`, lint, typecheck, or tests. If a merge
   conflict requires editing code, run the narrow tests needed to verify that
   resolution. Preserve the inventory, secret-exclusion, and fast-forward checks.

7. Fetch immediately before pushing. If `origin/main` is not an ancestor of
   `HEAD`, merge it into the current branch or detached HEAD, preserving both
   sides. The merge commit becomes the pushed head, so its message carries the
   marker exactly when step 4 said `add`:

   ```bash
   git fetch origin main
   git merge-base --is-ancestor origin/main HEAD
   # If the ancestry check failed (append " [skip ci]" only when step 4 said add):
   git merge --no-ff origin/main -m "Merge origin/main for fast ship"
   ```

   Resolve conflicts using the actual changes on both sides, then finish the
   merge with the same message. Never choose a whole side blindly.
   If the resolution cannot be determined safely, stop and report the paths;
   preserve the merge state and local commit for the user. After a merge, check
   the resulting diff against `origin/main` and confirm the intended work is
   present. Fetch and check ancestry again immediately before pushing with
   `git push origin HEAD:main`.

   Run SSH-backed fetch/push with the required sandbox approval when access to
   `~/.ssh/known_hosts` is denied. A known-hosts permission error is an
   environment failure; retry that exact remote command with approval once.

8. If `main` advances during the final fetch or a push is rejected specifically
   as non-fast-forward, fetch, integrate, and retry once using step 7. If it
   advances again, stop with the local commits intact and report the race. If
   push returns `GH006`, stop and report the rejection; do not treat protection
   failures as a non-fast-forward retry.

9. Before reporting any outcome, including a failed or rejected ship, attempt to
   sync local `main` when a fresh fetch is possible. Find its owner with
   `git worktree list --porcelain`. If checked out, check that worktree is clean
   and run `git -C <path> merge --ff-only origin/main`; if not checked out,
   fast-forward the ref with `git fetch origin main:main`. Compare the resulting
   `main` and `origin/main` commits: report synced only when they match. Do not
   overwrite dirty, ahead, or divergent local work; report the blocker instead.

   Remote SSH operations and writes to another checkout may require sandbox
   approval. A failed local sync does not undo a successful remote push.

10. After a successful push of a commit without the marker, print the CI run
    URL once and move on; do not wait for, poll, or report the run's result:

    ```bash
    node .agents/skills/vpk-git-ship/scripts/main-health.js --run-url "$(git rev-parse HEAD)"
    ```

    If GitHub has not queued the run yet, it prints the commit's checks page,
    which shows the run when it starts. When step 4 reported a commit that
    already skips CI, the push starts no run, so start one on `main` first
    (a single dispatch, not a wait), then print the URL:

    ```bash
    gh workflow run ci.yml --repo <owner/name> --ref main
    ```

## Stop rules

Stop shipping when there is nothing to land, secrets cannot be excluded, a merge
cannot be resolved safely, the bounded non-fast-forward retry is exhausted,
direct push is protected by `GH006`, or fetch/push fails after the single
appropriate environment retry. Attempt step 9 where safe before reporting the
outcome; do not retry a failed fetch blindly or undo a successful push because
the local-main sync failed.

## Proof and report

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Report branch and unrelated-change warnings, committed and excluded paths,
commit hash and subject, push result, protected-main rejection when applicable,
local-main sync state, conflict-resolution verification if needed, and that local
CI checks were skipped. Report the CI marker decision and its reason. Without
the marker, report the run URL from step 10 and that the result was not awaited.
With the marker, do not claim it suppresses checks from other CI providers or
workflows triggered by events that GitHub does not skip.

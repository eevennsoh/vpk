---
name: vpk-git-ship-fast
description: "Commit all eligible changes and push directly to VPK main without a PR. Use when the user says \"vpk-git-ship-fast\", \"commit and push to main\", \"push straight to main, no PR\", or \"land this directly\"; protected main may require fallback to vpk-git-ship."
validation_command: git status --short
---

# VPK Git Ship Fast

Use this deliberately ungated path to commit the entire eligible working tree
and fast-forward it directly to remote `main`. It creates no PR or feature
branch and performs no review gate.

## When to use

Use only when the user explicitly chooses the fast direct-to-main path. Use
`vpk-git-ship` when they want a PR, CI gate, review, selective shipping, or when
branch protection rejects direct pushes. Use `vpk-git-clean` for worktree,
branch, or ref cleanup.

## Hard invariants

- Inventory the whole tree first because `git add -A` includes unrelated and
  untracked files. Warn about paths not created in the current task, then honor
  the user's explicit all-tree fast-ship choice.
- Exclude `.env*`, keys, certificates, credentials, and other secrets. If they
  cannot be confidently separated, stop before staging.
- Push only when `origin/main` is an ancestor of `HEAD`. Never force-push or
  rewrite remote history.
- If protected `main` rejects the push with `GH006`, leave the local commit
  intact and fall back to `/vpk-git-ship`; do not bypass branch protection.
- Preserve dirty or divergent state in the persistent `main` checkout. A
  successful remote push does not authorize discarding local work to sync it.

## Workflow

1. Refresh and inventory:

   ```bash
   git update-index --refresh
   git status --short --branch
   git diff HEAD --stat
   git diff HEAD
   git log --oneline origin/main..HEAD
   ```

   If the tree is clean and there are no commits ahead of `origin/main`, report
   that there is nothing to commit or push.

2. Record the current branch. On a feature branch or detached HEAD, warn once
   that its resulting commit will be pushed directly to `main`, then continue;
   explicit fast-ship intent is the authorization.

3. Compare every changed and untracked path with the current task. List any
   unrelated or concurrent paths that will also be committed. Do not silently
   omit them unless they are secrets or clearly unsafe to publish.

4. Stage the eligible tree with `git add -A`. When secrets are present, stage
   only safe paths and report every exclusion. Re-read `git status --short`
   before committing.

5. Generate an imperative subject of about 50 characters from the actual diff.
   Add a short body only for distinct concerns, follow repository log style,
   and omit co-author footers unless requested. Commit once.

6. Run `pnpm run verify:fast` (~10s). It is the only check before this commit
   lands on `main`; if it fails, fix the cause or stop and report the failure.

7. Fetch and prove fast-forward ancestry immediately before pushing:

   ```bash
   git fetch origin main
   git merge-base --is-ancestor origin/main HEAD
   git push origin HEAD:main
   ```

   Run SSH-backed fetch/push with the required sandbox approval when access to
   `~/.ssh/known_hosts` is denied. A known-hosts permission error is an
   environment failure; retry that exact remote command with approval once.

8. If the ancestry check is non-zero, stop with the local commit intact and
   report that `origin/main` advanced. The user must merge or rebase onto the
   current remote tip before retrying. If push returns `GH006`, route to
   `/vpk-git-ship` instead.

9. After a successful push, sync local `main` only when it can fast-forward
   without touching user edits. If this checkout owns `main`, it already moved.
   Otherwise find the owner with `git worktree list --porcelain` and use:

   ```bash
   git fetch origin main:main
   # If main is checked out at <path>:
   git -C <path> merge --ff-only origin/main
   ```

   Remote SSH operations and writes to another checkout may require sandbox
   approval. If local `main` is dirty or divergent, stop syncing and report it;
   the remote push remains complete.

## Stop rules

Stop when there is nothing to land, secrets cannot be excluded, ancestry is not
fast-forward, direct push is protected by `GH006`, or fetch/push fails after the
single appropriate environment retry. Never retry blindly or undo a successful
push because the optional local-main sync failed.

## Proof and report

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Report branch and unrelated-change warnings, committed and excluded paths,
commit hash and subject, push result, protected-main fallback when applicable,
local-main sync state, and that `CI / PR checks` may run after an accepted push
but did not gate this direct path.

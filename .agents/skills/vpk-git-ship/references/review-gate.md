# Review gate

Run this gate before every merge, including merge-back of an existing PR. The
`CI / PR checks` status must pass before merge. GitHub does not enforce this on
the current plan, so this gate does: an unreported or running required check
counts as pending, never as passing. The one exception is billing-blocked
Actions, gated on a local `pnpm run ci:pr` instead (see
[Billing-blocked CI](#billing-blocked-ci)). Never use `--admin` to bypass checks or
conversation resolution.

## Codex auto-review status

After creating or updating a PR, capture its current head and update time:

```bash
gh pr view <number> --json headRefOid,updatedAt,reviews,url
```

When this run pushed the head and the user did not request `--bypass`, poll for
up to three minutes at 15-second intervals for a terminal Codex signal:

- a `chatgpt-codex-connector` review tied to the current head;
- a current-head `+1` reaction, meaning reviewed with no findings;
- `eyes`, meaning still in progress.

Ignore stale-head signals and keep polling until the timeout. A timeout, missing
credit, auth problem, outage, or explicit bypass is non-blocking: record the
status and continue. Do not post `@codex review`; automatic review is already
configured and a manual mention can duplicate it. For an existing PR whose head
was not pushed in this run, inspect current status without waiting.

## Fetch every review surface

Run the repo-owned read-only status helper from the VPK checkout:

```bash
node .agents/skills/vpk-git-ship/scripts/review-gate-status.js \
  --pr <number> --repo <owner>/<repo> --json
```

The helper captures the current head and check rollup, pages GraphQL
`reviewThreads` until `hasNextPage` is false, fetches paginated REST comments and
reviews, and maps every top-level REST comment to a GraphQL thread by database
ID. When GraphQL temporarily omits a REST comment, it re-fetches every surface
at five-second intervals for up to 30 seconds. Its JSON is the rerunnable review
artifact; do not replace it with an ad-hoc partial query.

Inspect `unresolvedThreads`, `missingRestCommentIds`, and
`nonApprovingReviews`. Classify every listed non-approving review using its ID
and the current PR before proceeding; the helper cannot decide product judgment.
Only declare the review gate clear when `reviewGateClear` is true and those
reviews are classified. Older-commit conversations still block when unresolved.
`mergeStateStatus: CLEAN` and passing checks are separate supporting evidence.

Immediately before merge, wait for checks and require a clear gate in one
call:

```bash
node .agents/skills/vpk-git-ship/scripts/review-gate-status.js \
  --pr <number> --repo <owner>/<repo> --wait 1200 --rerun-interrupted 3 --require-clear
```

`--wait` polls every 30 seconds while any check is pending, for up to the given
seconds. A cancelled or timed-out run is `interrupted`, not `failing`:
`--rerun-interrupted 3` reruns it (`gh run rerun`) up to three times, waiting
the full `--wait` after each, and never reruns a real failure. `PR checks` is required by default; pass `--required-check <name>`
(repeatable) to replace that list. Exit 2 means at least one
review, check, or merge-state condition remains; inspect the same JSON rather
than weakening the gate. Exit 3 means the only blocker is billing-blocked
GitHub Actions; follow [Billing-blocked CI](#billing-blocked-ci). An API/schema failure exits 1. If a REST comment stays
missing after the bounded retries, or any surface cannot be fetched, stop and
report its ID. Do not use scraped HTML, undocumented endpoints, or browser
automation to manufacture a thread ID.

## Billing-blocked CI

When GitHub account billing fails (a failed payment or a spending limit), every
Actions job reports `FAILURE` after 1-2 seconds without starting. The check-run
annotation reads: "The job was not started because recent account payments
have failed or your spending limit needs to be increased. Please check the
'Billing & plans' section in your settings". The helper reads each failed
check's annotations and lists those checks under `checks.billingBlocked`, not
`checks.failing`. When they are the only non-passing checks, `checks.state` is
`billing-blocked`. It never reruns them.

If billing is the problem, always skip GitHub CI. On exit 3, do not ask the
user, wait, or retry. Instead:

1. In the PR's checkout, confirm `git rev-parse HEAD` equals the reported
   `headRefOid` and the tree is clean. Then run the local gate and capture its
   exit code with `$?` (zsh has no `PIPESTATUS`):

   ```bash
   pnpm run ci:pr; ci_status=$?
   ```

2. Merge only if `ci_status` is 0. A non-zero result is a real failure: stop
   and report it as you would a failing check.
3. The other gates still apply. Exit 3 already means the review gate is clear
   and the merge state is `CLEAN` or `UNSTABLE`. `UNSTABLE` is expected here
   only because of the failed billing check. `DIRTY`, `BLOCKED`, or any
   unresolved thread exits 2 instead.
4. Record the exception on the PR before merging:

   ```bash
   gh pr comment <number> --body "GitHub Actions was billing-blocked (jobs not started: account payment or spending limit). Local \`pnpm run ci:pr\` exited <ci_status> on <head-sha>."
   ```

5. Merge with `gh pr merge <number> --merge --delete-branch`. Never add
   `--admin`; branch protection is not enforced here, so it is not needed.

Billing-blocked is the only CI exception. A check with `checks.state:
"failing"`, including a real failure next to billing-blocked checks, still
blocks.

## Classify and remediate

Classify every unresolved thread, regardless of reviewer:

- **Valid:** a real bug, contract gap, missing test, incorrect visual state, or
  clarity issue. Make the smallest source fix, run focused validation, commit,
  and push.
- **Invalid or already handled:** current source or a newer diff proves the
  concern no longer applies. Do not change code; reply with specific evidence.
- **Ambiguous or product judgment:** stop before merge and report the URL and
  decision needed. Do not resolve it.

Every resolved conversation needs a visible disposition first:

```text
Fixed in <commit>; validation: <check/result>.
No code change: <specific evidence/rationale>.
```

Reply through the documented mutation:

```bash
gh api graphql -f threadId="<PRRT-id>" -f body="<reply>" \
  -f query='mutation($threadId:ID!,$body:String!){
    addPullRequestReviewThreadReply(input:{
      pullRequestReviewThreadId:$threadId,body:$body
    }){comment{url}}
  }'
```

A reply is not a resolution. Resolve only after the disposition exists:

```bash
gh api graphql -f threadId="<PRRT-id>" \
  -f query='mutation($threadId:ID!){
    resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}
  }'
```

The mutation requires the GraphQL `PRRT_...` ID, not a REST comment ID. Re-fetch
all pages and REST surfaces afterward. Continue only when every handled thread
returns `isResolved: true`, no unresolved thread remains, and required checks
are passing or pending under auto-merge.

## Failure and re-review cases

- If a remediation push changes the head, re-check required checks and repeat
  the full review-surface reconciliation. A reviewer may create new threads.
- If GitHub dismisses or re-requests review after the push, treat that as current
  state; do not reuse approval evidence from the old head.
- If APIs cannot fetch, reply, resolve, or verify a thread, stop before merge.
- If `BLOCKED` or `UNKNOWN` persists while checks are green, reconcile GraphQL
  and REST again before attributing it to CODEOWNERS or another ruleset.
- Never resolve silently, resolve first and fix later, or treat a posted reply
  as a cleared conversation.

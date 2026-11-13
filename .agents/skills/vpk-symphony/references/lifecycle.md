# Symphony Lifecycle

Use this reference when executing or updating the VPK Symphony workflow.

## Ad-Hoc Request Bootstrap

Use this before the state flow when `vpk-symphony` is invoked without an
existing Linear issue identifier or URL.

- If the user invoked `vpk-symphony`, first try to create a Linear issue in the
  configured Symphony project and put it in `Todo` so Symphony can claim it.
  This applies to implementation, docs, tiny local edits, generated artifact
  edits, investigation, review, audit, triage, operational guidance, codebase
  tours, and answer-only explanations.
- Use the Linear transport in this order. The first path is the preferred,
  proven path:
  1. direct Linear GraphQL over HTTPS with local `LINEAR_API_KEY` and
     `SYMPHONY_LINEAR_PROJECT_SLUG` from the shell or `.env.local`;
  2. if direct HTTPS is blocked by the current sandbox or network allowlist,
     immediately rerun the same direct GraphQL bootstrap with the required
     approval/escalation for the Linear API route in the same turn;
  3. blocked-access handling only after the available paths fail with a real
     auth, project, schema, sandbox, or network blocker.
- Do not stop at a status update after a sandbox or network allowlist failure.
  The required next action is the escalated rerun of the same GraphQL request.
  Report Linear as blocked only if the escalated request is denied or still
  fails.
- Do not wait for or prefer an injected `linear_graphql` tool. Company policy
  does not expose that tool to Codex workers, so direct Linear GraphQL with
  local auth is the normal path.
- Do not hardcode prompt examples. Derive a concise imperative title and a
  scoped description from the actual request, including any explicit validation
  or acceptance criteria the user provided.
- If the user provides an existing issue key or URL, skip creation and fetch
  that issue fresh.
- If the user explicitly says not to create Linear work items for a meta/setup
  correction to the Symphony harness itself, honor that instruction and update
  the setup docs directly.
- If Linear access, local Linear auth, or the configured project cannot be
  resolved after trying the direct GraphQL path, report the exact missing capability.
  Do not continue as Symphony-managed work without a ticket. If the user wants
  normal local work without Linear, they must redirect the task out of the
  Symphony flow before work begins.
- After creating the ticket, report the issue identifier/URL. Default to
  leaving the issue in `Todo` so `pnpm run symphony` can claim it and create the
  issue workspace through the launcher `after_create` hook.
- Continue executing in the current checkout only when the user explicitly asks
  for immediate local execution or the current checkout is already a Symphony
  issue workspace. Do not move a freshly bootstrapped ticket to `In Progress`
  from the persistent checkout just because the current agent can edit files.
- If immediate local execution is deliberately chosen, record a workpad note
  before editing that says no new Symphony workspace was created, names the
  current checkout path/branch, and explains why local execution is being used.
- During active issue execution, do not create follow-up issues for discovered
  adjacent work. Record those notes in the workpad instead.

## States

The states, who acts in each, and the allowed moves are one table: "Issue
states" in `.agents/docs/symphony.md`. `WORKFLOW.md` is the runtime copy.

## Execution Rules

1. Bootstrap a Linear issue first for every `vpk-symphony` ad-hoc invocation
   that does not already name an issue. Do not skip bootstrap for direct local
   file edits, generated artifacts, meta support, or answer-only work.
2. Fetch fresh Linear issue details before planning.
3. Reuse the active `## Codex Workpad` comment if it exists.
4. Classify answer-only issues before creating branches or PRs; write the
   answer to the workpad and move them to `Done`.
5. Before closing an implementation ticket or moving it to review, verify the
   workpad records workspace provenance. It must either show a Symphony-created
   issue workspace or explicitly justify immediate local execution.
6. Before closing browser-observable work or moving it to review, verify the
   workpad has the required browser evidence or a concrete capture blocker.
   Generated/offline HTML under `output/` is browser-observable.
7. Keep project-specific context in issue descriptions and comments, not in the
   shared workflow files.
8. Do not advance dependent work until the previous PR is actually merged to the
   default branch.
9. If an issue becomes terminal while a run is active, stop implementation work
   and let cleanup/landing logic respect the terminal state.

## Phase Prompts

- `Todo`: kickoff worker; move to `In Progress`, create/reuse the workpad, and
  derive plan, acceptance criteria, and validation before code edits.
- `In Progress`: implementer; sync, implement, validate, push the same PR, and
  move to `Agent Review` only when the completion bar is satisfied.
- `Agent Review`: fresh adversarial code reviewer; read-only against tracked
  files, verify the PR against the issue/workpad/diff/proof, post the
  standardized review comment, then route by status.
- `Human Review`: narrow waiting gate; do not code, only react to super-risk or
  blocked-access decision updates when explicitly routed.
- `Merging`: landing worker; follow `references/git/land.md`, merge only after
  the current-head review/check/feedback gates pass, then move to `Done`.
- Terminal states: do nothing and shut down.

## Merging Rule

`Merging` is a merge-only state. Verify the attached PR has a current-head
passing Symphony Agent Review, green checks, clean mergeability, resolved review
feedback, branch divergence is understood, and GitHub reports the merge commit
before moving the issue to `Done`.

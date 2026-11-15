---
name: vpk-symphony
description: Repo-local VPK Symphony workflow for turning task-like ad-hoc requests into Linear tickets via direct Linear GraphQL, Linear issue execution, Codex Workpad updates, git sync/commit/push/land flow, stuck-run debugging, and Playwright CLI browser evidence. Use whenever the user invokes vpk-symphony for a task-like request, works on VPK Symphony issues, updates WORKFLOW.md or .agents/docs/symphony.md, diagnoses Symphony runs, syncs or lands Symphony PRs, or captures Symphony UI evidence.
validation_command: node --test scripts/symphony.test.js scripts/symphony-issue-states.test.js
---

# vpk-symphony

## Overview

Use this skill for the repo-local Symphony harness in VPK. It keeps the
Linear workpad, git lifecycle, browser evidence, PR handoff, and stuck-run
debugging rules in one discoverable place.

When invoked without an existing Linear issue identifier or URL, first try to
bootstrap a Linear ticket for the request. This applies to task-like requests,
tiny local file edits, generated artifact edits, investigations, reviews,
audits, triage, operational guidance, and answer-only work such as codebase
tours or explanations. The best proven creation path is direct Linear GraphQL
over HTTPS with the local `LINEAR_API_KEY` and
`SYMPHONY_LINEAR_PROJECT_SLUG` from the shell or `.env.local`. Company policy
does not expose an injected `linear_graphql` tool to Codex workers, so do not
wait for it, search for it, or present it as the default. If direct HTTPS to
`api.linear.app` is blocked by the current sandbox or network allowlist,
immediately rerun the same direct GraphQL bootstrap with the required
approval/escalation in the same turn. Do not pause to explain the block before
requesting escalation unless the tool cannot request it. Only state that Linear
issue creation is blocked after the escalated request is denied or still fails.
Do not treat that block as permission to skip Linear.

Skip issue creation only when the user provides an existing Linear issue
identifier or URL; fetch that issue fresh instead. Also honor an explicit user
instruction not to create Linear work items for meta/setup corrections to the
Symphony harness itself. If the user wants normal local work without Linear for
ordinary repo work, they must avoid invoking `vpk-symphony` or explicitly
redirect the task out of the Symphony flow before work begins.

This skill is for Symphony-managed Linear work. For normal local UI work outside
Symphony, follow `AGENTS.md` and use `/agent-browser` instead of the
Playwright CLI evidence path.

## Core Flow

1. Read `AGENTS.md`, `WORKFLOW.md`, and `.agents/docs/symphony.md` before changing the
   harness or executing an issue.
2. If the skill was invoked with no Linear issue, attempt to create a `Todo`
   issue in the configured Symphony Linear project
   before doing the work. Use `references/lifecycle.md` for classification and
   `references/linear-graphql.md` for schema-safe issue creation. Use direct
   Linear GraphQL with local auth as the preferred path. Do not wait for
   injected `linear_graphql`; it is not expected to be available. When direct
   HTTPS to Linear is blocked by sandbox or network policy, immediately request
   sandbox/network approval by rerunning the same GraphQL bootstrap with
   escalation. If Linear access or project configuration is still missing after
   that escalated attempt, report the exact blocker instead of silently
   continuing as non-Symphony local work for repo-changing tasks. After a
   successful ad-hoc bootstrap, default to leaving the issue in `Todo` for
   `pnpm run symphony` to claim in a fresh workspace. Continue in the current
   checkout only when the user explicitly asks for immediate local execution or
   the current checkout is already a Symphony issue workspace, and record that
   decision in the workpad.
3. Fetch fresh Linear issue details and use exactly one active
   `## Codex Workpad` comment.
4. Classify the issue before editing:
   - Answer-only issues get a concise investigation, workpad handoff, and
     terminal `Done` status.
   - Implementation issues move through branch, validation, PR, Agent Review,
     and guarded merge.
   - `Agent Review` is an adversarial code review gate. It is read-only against
     tracked repo files, but may run verification commands that leave tracked
     files unchanged.
   - `Merging` issues are merge-only unless review evidence proves more code is
     required.
5. Sync with `origin/main` before code edits and record the result in the
   workpad.
6. Keep validation tied to the issue acceptance criteria. For visible UI,
   browser-observable behavior, or generated/offline HTML output, follow the
   browser evidence policy; source search alone is not enough when
   `playwright-cli` can capture the result.
7. Land with a merge commit only after GitHub reports the PR merged, then move
   the Linear issue to `Done`.

## References

Read only the reference needed for the current task:

- `references/workpad.md`: workpad structure, update rules, and evidence fields.
- `references/lifecycle.md`: ad-hoc ticket bootstrap, Linear state handling, and issue execution flow.
- `references/browser-evidence.md`: Symphony-only Playwright CLI evidence policy.
- `references/linear-graphql.md`: direct Linear GraphQL issue creation, comments, uploads, and schema-safe queries.
- `references/git/pull.md`: sync current branch with `origin/main`.
- `references/git/commit.md`: create commit messages from actual changes.
- `references/git/push.md`: push branches and create/update PRs.
- `references/git/land.md`: monitor reviews/checks and merge PRs.
- `references/debug/logs.md`: trace stuck or failing Symphony sessions.
- `references/playwright-cli/quickstart.md`: Playwright CLI command reference.

For detailed Playwright CLI tasks, load the specific file under
`references/playwright-cli/` instead of reading the whole folder.

## Scripts

- `scripts/land_watch.py`: async watcher for PR review comments, CI status, and
  head updates. Use it from the repository root:

```bash
python3 .agents/skills/vpk-symphony/scripts/land_watch.py
```

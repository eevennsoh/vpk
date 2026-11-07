---
name: vpk-council
description: Convene independent GPT Sol and Claude Opus reviews through VPK Remote, reconcile their findings, and repeat after accepted fixes. Use when the user invokes vpk-council or explicitly asks for a VPK council review.
validation_command: node scripts/validate-skills.js --target .agents/skills/vpk-council
---

# VPK Council

Adapted from [t3dotgg/tstack council](https://github.com/t3dotgg/tstack/blob/1085050f3baed1ac724caa4a8166145fb2ac88af/skills/council/SKILL.md), copyright Theo Browne, under the MIT license in [LICENSE](LICENSE).

Before an audit, address outstanding PR comments and known issues within the user's authorized scope, and run relevant checks. Give the council the updated implementation; do not defer known fixes until reviews return. If the user wants to discard the implementation and explore new ideas, skip fixes to code being replaced. For a read-only review request, report known issues without making edits.

Bring in two independent delegates to help with the user's request, usually for review or feedback. By default use GPT Sol and Claude Opus at xhigh effort. If the user names council members, use those instead when accessible; never silently substitute for an unavailable named model. Resolve model aliases from VPK Remote's current defaults, rather than hardcoding model IDs.

Read [VPK Remote](../vpk-remote/SKILL.md), its dispatch patterns, advisor pattern, and executor references for the selected lanes. Run the specified preflights for each distinct model before launching. Use its canonical commands, read-only enforcement, separate worker directories, surface wrapper, report handling, sandbox and approval rules. Workers run through Proximity AI Gateway and bill the gateway, not the planner's subscription; state this before dispatch. Do not silently fall back to subscription credentials. Every selected member is required, including the default pair: if a member is unavailable or a preflight fails, report the failure without claiming a complete council or substituting another model. In particular, do not switch a failed GPT council seat to Claude. For a missing or empty report after exit, follow Remote's permitted single retry with a fresh worker on the same model. Report available partial findings and distinguish them from a complete round.

Give every delegate the same request, relevant context, exact subject or diff, and applicable constraints, including Remote's advisor-specific instruction block and the score request. For reviews and feedback, dispatch all delegates in parallel as independent read-only workers and wait for every result or an explicit failure. The common scope is intentional: independent reviews of the same subject are required here, overriding VPK Remote's default of disjoint reading scopes. Name the workers `vpk-audit-<slug>-<n>`, group them under `vpk-audit-<slug>`, and record them as `kind: research` in separate lane directories. Do not give delegates one another's findings until their independent reviews have completed. For other requests, keep parallel delegates read-only and carry out any agreed changes separately under the user's authorization.

Collect their responses and summarize useful findings, disagreements, and recommended next steps. For a code review, ask each delegate for a score out of 10. Count each full review pass as one round; a fresh review after fixes starts a new round. Record missing scores as `no score`; never invent one. Report actual model identities and any failed or incomplete review.

If you agree with their recommendations and changes are authorized, make the changes, verify them, and request a fresh review from all delegates. Follow VPK Remote's ownership rules: non-trivial fixes go to a single writing worker; the planner may make trivial fixes. Choose the worktree based on the actual work under review: when it is the current checkout's uncommitted changes, use Remote's `--no-worktree` case so the worker fixes those changes in place; otherwise use the appropriate task worktree. Point both reviewers at the same resulting checkout and diff in every subsequent round. A complete council round serves as Remote's pre-completion advisor check for that change; do not dispatch a redundant advisor.

Before another round, preserve each prior report under a distinct round-specific filename so reruns cannot overwrite the evidence. Send each reviewer a fresh brief with the original request, the accepted findings, and what changed; do not resume a session after fan-out. Continue until all delegates are satisfied. If the user asked for review only, report the recommendations without changing the work. If reviewers disagree irreconcilably, repeat findings without progress, or a required delegate remains unavailable, stop and report the unresolved issue rather than claiming consensus. Do not let repeated reviews result in scope creep.

If the authorized work ends in a pull request, put the results in the PR description, before the model and harness line if present. If the PR is already open and its description may be edited within the user's authorization, edit it; do not post a comment for this. Otherwise put the same results in the final reply. Include each round and each actual delegate, for example:

```markdown
## Council review

Rounds: 2

| Delegate | Round 1 | Round 2 |
| --- | --- | --- |
| GPT Sol | 8/10 | 10/10 |
| Claude Opus | 7/10 | 9/10 |
```

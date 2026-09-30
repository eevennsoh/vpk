---
name: vpk-scheduled-automation
description: >-
  Shared execution policy for VPK scheduled jobs that investigate one
  maintenance candidate, make a review-ready change, and open or update a pull
  request. Use when a Codex automation invokes vpk-scheduled-automation for bug,
  test, deprecation, interface, simplification, engineering-map, AGENTS.md,
  frontend-runtime, performance, UI-quality, or dependency work. Do not use for
  read-only summaries or local cleanup jobs.
---

# VPK Scheduled Automation

Apply this policy together with the invoking automation's task-specific goal,
evidence, success criteria, constraints, output, and stop rules. The scheduled
prompt decides *what* to investigate; this skill controls *how* a producer run
works safely. Do not ask for clarification during a scheduled run. If the
evidence cannot resolve an important ambiguity, stop with a no-PR report.

## Skill contract

### Purpose

Keep recurring producer jobs narrow, concurrency-safe, evidence-driven, fully
validated, and bounded at PR handoff.

### Owner

VPK.

### Category

Automation workflow.

### Inputs

Automation goal, success criteria, candidate evidence, task-specific stop rules,
requested PR title, and requested labels.

### Outputs

One review-ready pull request or an evidence-backed no-PR report.

### Required tools

Shell, Git, GitHub CLI, Corepack, and pnpm.

### Validation command

`corepack pnpm run ci:pr` after focused validation.

### Generated artifacts

Git branches, commits, and pull requests for successful producer runs.

### Common failure modes

Duplicating overlapping work, editing from unsafe state, bundling multiple
candidates, hiding validation failures, or merging a producer PR.

## 1. Establish safety and freshness

Before editing:

```bash
pwd
git status --short --branch
git branch --show-current
git worktree list --porcelain
gh pr list --state open --limit 100 --json number,title,headRefName,isDraft,url,updatedAt,labels
```

- Work only in the repository and project supplied by the automation.
- Preserve all pre-existing user or concurrent-agent changes. If the checkout
  is dirty with work this run does not own, stop; do not stash, reset, overwrite,
  or absorb it.
- A clean detached automation worktree is valid. After selecting a candidate,
  attach it with a new `automation/<job-slug>-<summary>` branch at the current
  commit. From clean `main`, create the same kind of branch before editing.
  Never commit a producer change directly to `main`.
- Recheck status immediately before branching, committing, and pushing. If a
  branch name already exists or belongs to another worktree/PR, choose a unique
  evidence-based suffix rather than taking it over.
- Inspect open and recently merged PRs for the same automation, subsystem, and
  likely files. An exact in-progress PR may be updated only when the current
  branch clearly owns it. Otherwise choose a non-overlapping candidate or stop.
  Never create a duplicate PR to work around unclear ownership.

## 2. Select exactly one candidate

Use current repository, GitHub, test, runtime, or browser evidence named by the
scheduled prompt. Select the smallest high-confidence candidate that meets all
task-specific success criteria and has a credible validation path.

One candidate may include its direct regression/contract test, required docs,
or mechanically necessary generated update. It must not become a bundle of
unrelated findings, opportunistic cleanup, or a broad framework migration. If
no single candidate is strong enough, make no change.

For Dependency hygiene, read
[references/dependency-hygiene.md](references/dependency-hygiene.md) after this
file and execute exactly one of its two lanes.

## 3. Implement the smallest complete change

- Prove the problem or opportunity before patching, then address its owner/root
  cause. Do not weaken types, tests, accessibility, security, supply-chain
  policy, or product behavior to make validation pass.
- Follow `AGENTS.md`, contextual repo rules, and task-specific skills only when
  the selected candidate needs them. Keep generated and lockfile changes limited
  to what the candidate requires.
- Add focused regression or contract proof when the task calls for it. For
  browser-visible changes, prove the actual live route and preserve reduced
  motion and accessibility behavior as applicable.

## 4. Validate in two layers

Run the narrowest meaningful checks first: the reproducer, focused test,
contract verifier, browser probe, or task-specific command. Then run:

```bash
corepack pnpm run ci:pr
```

Do not replace `ci:pr` with an arbitrary subset merely because the full gate is
slow. If the gate cannot execute because of an environmental restriction,
report the restriction and run every available focused and relevant repo check;
do not claim full readiness.

If `ci:pr` fails:

1. Capture the exact failing command and output.
2. Decide whether the candidate could plausibly cause it from the diff and
   ownership boundary.
3. To call it an unrelated baseline failure, reproduce the same failure on the
   untouched `origin/main` revision in a clean disposable worktree, or cite an
   equivalent current CI failure for that exact baseline commit. A historical,
   assumed, or merely different-looking failure is not proof.
4. If the focused checks pass and the failure is proven baseline-only, the PR
   may proceed with that evidence clearly disclosed. If causality is uncertain,
   fix the candidate or stop without a PR.

## 5. Hand off; never merge

Before handoff, repeat the overlap/freshness check and inspect the final diff.
Commit only the selected candidate, push its branch, and create or update the
task-specific `[Automation] ...` PR.

Verify requested labels with `gh label list` and apply only labels that exist.
Do not invent or create labels; note missing requested labels in the report.
The PR body must include:

- evidence and why this candidate was selected;
- root cause or contract being improved;
- concise change summary;
- focused validation and `corepack pnpm run ci:pr` result;
- any proven unrelated baseline failure and its reproduction evidence;
- overlap/freshness result;
- explicit reviewer focus and remaining risk.

Write the body with a shell heredoc into the worktree's ignored `output/`
directory (for example `output/automation/pr-body.md`) and pass it with
`gh pr create --body-file`. Do not `apply_patch` files outside the worktree,
such as `/tmp`: that write waits for a human approval, and unattended runs have
stalled on it for hours.

Report the PR URL, branch, commit, validation state, and reviewer focus. A
producer job stops at review-ready PR handoff. Never merge, enable auto-merge,
approve, or bypass review/check policy from this skill.

## No-PR output

Stop without editing or opening a PR when safety, overlap, evidence, scope, or
validation does not meet this policy or the scheduled prompt's stricter rules.
Return a terse report naming the candidate considered, decisive evidence, stop
reason, and any useful next review target. Do not narrate every command.

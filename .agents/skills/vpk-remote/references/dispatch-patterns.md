# Dispatch Patterns Reference (briefs, reports, shapes, economics)

Lane-agnostic rules for every `/vpk-remote` worker, GPT or Claude.

## Frozen brief contract

Write the brief to `brief.md` in the worker's directory **before** dispatch;
never inline it into a shell command. Every brief carries, in order:

1. **Goal** — one concrete outcome, no ambiguity.
2. **Exact repo paths** — files and directories in scope, written relative to
   the worktree the worker runs in. Under the default, a writing brief runs in
   its own task worktree branched from a freshly fetched `origin/main` (see
   *Worktree isolation* in SKILL.md), so paths resolve there, not in the
   user's checkout.
3. **Constraints** — the specific repo rules that apply (tabs, `@/` imports,
   token classes, pnpm; name only the relevant ones).
4. **Non-goals** — what the worker must not touch or expand into. For
   implementation briefs, state that unrelated existing worktree changes
   belong to the user and must be preserved. A fresh task worktree starts
   clean, so this matters most under `--no-worktree`.
5. **Proof expected** — the exact command that must pass (e.g. a targeted
   `node --test`, or `pnpm run lint && pnpm run typecheck`).
6. **Output shape** — the report contract below, identical on both lanes so
   any report slots into the same synthesis step.

For parallel briefs, explicitly say whether the worker is read-only or list
its exclusive write scope.

## Worker report contract

Require every worker's final message to end with:

```text
## Findings
- [conclusion or change — evidence: file:line or command output]

## Not determined
- [requested fact that could not be established, plus where it was checked]

## Blockers
- [only infrastructure or scope blockers]
```

`## Findings` is always present; omit empty optional sections. Reports
contain conclusions and minimal evidence — never raw file dumps or long
command logs.

## Shape selection

Shape is inferred from the brief, not requested — `--fanout` / `--single`
only override the inference. Anything that writes files is single-worker;
read-only work that splits into 2+ independent scopes fans out.

**Single worker (anything that writes).** Iterated with follow-ups (GPT lane:
`resume`; Claude lane: stateless re-brief). Every worker on a task shares that
task's worktree — unlike subagents they really do race on files — so
overlapping write scopes must never run in parallel, regardless of what flag
was passed. Per-task worktrees separate *tasks* from each other, not workers
within a task.

**Fan-out (the default for read-only coverage).** 2–5 parallel workers when
every brief is substantial and independent:

- Dispatch all workers in **one message** (parallel background Bash calls),
  each with its own worker directory.
- Every fan-out brief carries an explicit "make no edits" constraint.
- Keep **reading scopes** disjoint, not just write scopes — workers cannot
  see each other, so overlapping briefs pay for the same research twice.
- Lanes may mix (e.g. a sonnet worker and a sol worker in parallel); worker
  directories are lane-namespaced so artifacts never collide.
- **Never `resume` during or immediately after fan-out** — session selection
  is ambiguous.

**Parallel completion rule.** Wait for every dispatched worker to produce a
report or an explicit infrastructure failure before synthesizing anything.
Re-dispatch only infrastructure failures (missing/empty report after exit),
once, to a fresh worker. A well-supported "not found" is a valid finding.

## Planner review (after every implementation report)

1. Inspect the real `git status` and `git diff`.
2. Trace the change to the requested owner and behavior.
3. Run the proof command independently if cheap; otherwise delegate the
   heavy verification as its own brief.
4. Check for unrelated edits, dead compatibility paths, incomplete cleanup.
5. Write a narrow follow-up if correction is needed.

A worker's own test claim is evidence to inspect, not verification. After two
failed correction cycles, stop and report the concrete blocker — the planner
never silently takes over implementation.

## Economics (when delegation pays)

- **Boundary duplication:** every token crossing the planner↔worker boundary
  bills twice — the planner writes a brief the worker reads; the worker
  writes a report the planner reads. Delegation pays when worker reading
  volume clearly dwarfs this fixed handoff cost.
- **Brief sizing:** a brief should represent minutes of reading/execution,
  not one lookup. Two small related checks belong in one brief. 2–5 workers
  covers most tasks; over-sharding raises cost.
- **Warm reuse:** sequential briefs in the same area go to the same worker
  (GPT lane `resume` keeps the prompt cache warm; a fresh run re-pays the
  cold-start read).
- **Planner context:** the planner's context window is for decisions and
  review. Tiny read-only questions it can answer from context stay with the
  planner; any non-trivial mutation goes to a worker.

# Dispatch Patterns Reference (briefs, reports, shapes, economics)

Lane-agnostic rules for every `/vpk-remote` worker, GPT or Claude.

## Frozen brief contract

Write the brief to `brief.md` in the worker's directory **before** dispatch;
never inline it into a shell command. Every brief carries, in order:

1. **Goal** — one concrete outcome, no ambiguity.
2. **Exact repo paths** — files and directories in scope, written relative to
   the worktree the worker runs in. Under the default, a writing brief runs in
   its own task worktree branched from a freshly fetched `origin/main` (see
   [naming-and-worktrees.md § Worktree isolation](naming-and-worktrees.md#worktree-isolation)), so paths resolve there, not in the
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

**Git in briefs.** A writing worker in a task worktree commits only to its
own task branch; under `--no-worktree` there is no task branch to commit to.
Ask for `git add`, `git commit`, `git restore` / `git checkout -- <path>`
and read-only git, nothing else: never `git stash` (the stash stack is shared
with every worktree), switching branches, `git branch -f`, `git fetch`,
`git worktree`, or `git config`. On the GPT lane the sandbox refuses writes
to `HEAD`, the stash, other branches and git config (see
[gpt-executor.md § Commits](gpt-executor.md#commits)). To compare
with the old source, use `git show HEAD:<path>` or `git diff`, never a stash
or a checkout of another revision. When the GPT worker gets no commit grant
(`{}`: under `--no-worktree`, or when the planner keeps the object store
closed), the brief asks it to leave the changes uncommitted and put a
proposed commit subject in its report.

**Browser proof on the GPT lane.** When the proof is a Playwright test,
dispatch it with a browser server, per
[gpt-executor.md § Browser tests](gpt-executor.md#browser-tests-playwright),
and name the exact `playwright test` command in *Proof expected*. The server
gives the worker host capabilities outside its sandbox; use it only for a
brief you would trust unsandboxed in the browser.

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
  each with its own worker directory and label, `vpk-<type>-<slug>-<n>`
  (see [naming-and-worktrees.md](naming-and-worktrees.md)).
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

**Fan-out can never be the default for briefs that write.** This is a
mechanical constraint, not a preference: parallel workers share one worktree
and will overwrite each other's edits, leaving a diff no report describes.
`--fanout` on a writing brief is therefore an **error** — report it and ask
whether to split the task into provably disjoint write scopes (which then
runs as a fan-out of narrower briefs) or to run it single. Implementation
otherwise stays one worker iterated via follow-ups.

Worktree isolation is **per task, not per worker**, so it does not soften this
rule — every worker on one task shares that task's worktree and collides there
exactly as described. What it prevents is the same collision *between*
concurrently dispatched tasks; see
[naming-and-worktrees.md § Worktree isolation](naming-and-worktrees.md#worktree-isolation).

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

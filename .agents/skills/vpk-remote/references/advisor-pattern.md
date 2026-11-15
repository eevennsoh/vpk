# Advisor Pattern Reference (Proximity-billed consults)

An advisor consult is a one-shot, **read-only** worker on either lane —
[gpt-executor.md](gpt-executor.md) or
[claude-executor.md](claude-executor.md) — writing to
`output/remote-<lane>/vpk-<type>-<slug>-review/` (see [naming-and-worktrees.md](naming-and-worktrees.md)).
It runs as an external CLI process, not a Claude Code subagent, so the model
and family can be chosen per consult.

## The idea

The planner session runs the loop. A high-judgment model is
consulted mid-task for strategic guidance: it reads the situation, produces a
decision or course-correction, and the planner continues. The advisor never
generates the final output and never edits files.

## Picking the advisor: independence, not tier

Do not pick the advisor by capability tier. Every lane bills Proximity at the
same boundary, so there is no cost gradient to arbitrage and no reason to
reach for a "stronger" model.

What a consult buys is **perspective diversity**. A model reviewing its own
family's output re-runs largely the same priors and tends to ratify; a
different family fails differently and is far likelier to surface the thing
that was missed. So default the consult to the family that did *not* do the
work: **`opus` xhigh only when reviewing GPT-lane output; `sol` xhigh
otherwise** — Claude-lane output, a plan the planner authored, or a question
with nothing dispatched yet. Explicit `--model` / `--effort` flags override.

Two corollaries worth remembering:

- **Reviewing your own planner counts too.** When the consult is about a plan
  the Claude planner session wrote, the GPT lane is the independent reviewer,
  even though no worker has run yet.
- **Do not stack same-family consults.** A second opinion from the same
  family as the first advisor adds cost without adding independence; if the
  first consult was inconclusive, sharpen the question instead.

## When to consult (and when not to)

1. **Before committing to an approach** on a task with a non-obvious design
   decision or an unruled-out failure mode.
2. **When stuck** — after roughly two failed attempts at the same problem,
   before trying a third variation of the same idea.
3. **Before declaring a complex task done** — a final plan/diff sanity
   review. This is the **verifier** shape: the advisor checks worker output
   rather than producing it.
4. **At scheduled checkpoints on long exploratory loops** — agree the cadence
   up front (initial plan + 2–3 checkpoints) and consult for **re-ranking
   and steering**, not new ideas. Hold the advisor's *initial* plan loosely
   on this shape of task: an upfront ranking of approaches nobody has tried
   yet is a guess, and the value lands at the checkpoints, where real results
   are available to re-rank against.

Moment 3 is the **standing default** — every task that produces a diff gets a
pre-completion verify unless the diff is trivial or the user passed
`--no-advisor`. Moments 1 and 2 fire on judgment during a run. Moment 4 is
opt-in per task: agree the checkpoint cadence with the user up front, because
a cadence nobody asked for spends planner tokens on a schedule rather than on
a trigger.

Consults are on by default, not unconditional. Skip them for single-step
questions, mechanical edits, an obvious plan, or anything a proof command
already settles. Consult when a wrong call would be costly to undo.
Good advice is a 400–700 token course-correction, not an essay.

## Defaults in a /vpk-remote run

The full statement of the defaults that SKILL.md summarizes.

**Consults are on by default.** The planner runs them without being asked,
stating that it is consulting and why. `--advisor` on its own makes a consult
the entire task; `--no-advisor` suppresses them for a run.

**Standing consult — every task that produces a diff:**

- **Pre-completion verify.** Before reporting work as done, send the diff and
  the original goal to the other family for an independent read. This is the
  verifier shape, and it is the one that pays off when you are steering from
  a phone: it is a second pair of eyes you did not have to ask for, and it
  costs you one line in the summary.

**Additional consults, on judgment:**

1. **Stuck** — after roughly two failed correction cycles on the same
   problem, before dispatching a third variation of the same idea.
2. **Before committing to an approach** whose design decision the brief
   cannot settle and where a wrong call means discarding the worker's output
   rather than amending it.

**Where consults are skipped** — the default is on, not unconditional. Skip
the verify for a trivial diff (a copy change, a one-line fix, a mechanical
rename a proof command already covers), where a proof command already
settles the question. Never consult on single-step questions or an obvious
plan.

**Default to the family that did not do the work.** Cost no longer picks the
advisor — every lane bills Proximity — so what a consult buys is
*independence*, not a capability tier. A GPT worker's blind spots are found
most cheaply by a Claude reviewer and vice versa; asking the same family to
audit its own reasoning re-runs the same priors. The planner rows of the
SKILL.md table follow the same rule: whatever the planner authored is its
own family's work, so the reviewer comes from the other family. Judge by the
planner's **model**, not its app — Claude Code can run on `sol` via `ai-api`.

All rows are `xhigh` for the reason in
[invocation-flags-and-effort.md § Choosing effort](invocation-flags-and-effort.md#choosing-effort):
advice is unverifiable, so effort is the only quality lever a consult has.

Explicit flags always win: `/vpk-remote --advisor --model sol <question>`
forces a GPT consult regardless of what ran before it.

## Context packaging (the consult starts cold)

A one-shot worker on either lane sees only its brief — no transcript, and on
the GPT lane no CLAUDE.md either. Package all five items:

1. **Task** — what the user asked for, verbatim where it matters.
2. **Constraints** — repo rules, API contracts, non-negotiables.
3. **Pointers** — exact file paths. The worker runs in this worktree and can
   read them itself; name the load-bearing files instead of pasting them.
4. **History** — approaches already tried and how each failed.
5. **The question** — the specific decision to make, not "any thoughts?".

Read-only is enforced by the dispatch flags — `--permission-mode plan`
(Claude lane) or `--sandbox read-only` (GPT lane) — so the brief's "advising
only" line is a restatement for the model, not the guard. Never dispatch a
consult with write permissions and rely on the wording.

Include these advisor-specific constraints verbatim in every consult brief:

```text
You are advising only. Make no edits of any kind. Reply with:
1. A decision (which option, or the diagnosis).
2. A plan — 3–7 concrete steps or the correction to the current plan.
3. Risks / failure modes the planner should verify.
Keep it under ~700 tokens. When reviewing a diff, end with exactly one line:
Verdict: ship | ship with nits | request changes
```

Treat consults as stateless and re-send context as a fresh brief on repeat:
prior advice, what was adopted, what changed, and the new question. Keep the
delta tight. (The GPT lane could technically `resume` a consult session, but
a re-brief keeps both lanes on one contract and consults are short.)

## After advice returns

State in one or two sentences what you adopt or reject and why, then
continue. Advice is input, not command — if it conflicts with something the
advisor could not see, say so and decide.

`git status` after a consult is a cheap sanity check, not the read-only
guard: during a pre-completion verify the worker's diff is still uncommitted,
so a clean-vs-dirty comparison proves nothing about the advisor. Enforcement
lives in the dispatch flags.

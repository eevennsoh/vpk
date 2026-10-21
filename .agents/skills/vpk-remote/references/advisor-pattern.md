# Advisor Pattern Reference (Proximity-billed consults)

An advisor consult is a one-shot, **read-only** worker on either lane —
[gpt-executor.md](gpt-executor.md) or
[claude-executor.md](claude-executor.md) — writing to
`output/remote-<lane>/advisor-<n>/`. It is never a Claude Code subagent: a
subagent bills the OAuth session, and the model is chosen per consult rather
than pinned.

## The idea

The token-limited OAuth session runs the loop. A high-judgment model is
consulted mid-task for strategic guidance: it reads the situation, produces a
decision or course-correction, and the planner continues. The advisor never
generates the final output and never edits files — that is where the savings
come from.

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
  the OAuth Claude session wrote, the GPT lane is the independent reviewer,
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
verifies more cheaply than the consult costs. The bar is a cost comparison
you can actually run: a consult spends planner tokens on both sides — one
brief written, one piece of advice read — while the thinking itself bills
Proximity. Consult when a wrong call would cost more than that handoff.
Good advice is a 400–700 token course-correction, not an essay.

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
Keep it under ~700 tokens.
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

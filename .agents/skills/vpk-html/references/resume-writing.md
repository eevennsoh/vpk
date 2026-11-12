# Resume Writing

Owner of resume writing for [SKILL.md](../SKILL.md). Load when you write a resume.

Contents: [The bullet template](#the-bullet-template) · [Verbs that pull weight](#verbs-that-pull-weight) · [What to quantify](#what-to-quantify) · [Bullet ordering inside a role](#bullet-ordering-inside-a-role) · [Role headers](#role-headers) · [Experience comes before education](#experience-comes-before-education) · [One page until eight years](#one-page-until-eight-years) · [Common AI-generated failure modes](#common-ai-generated-failure-modes) · [Read each bullet aloud before shipping](#read-each-bullet-aloud-before-shipping)

Resume-specific quality bar. Use alongside `references/writing.md` (which has the general prose rules).

## The bullet template

Every bullet on a resume should answer four questions:

```
[Action] + [Scope] + [Result] + [Business Outcome]
```

| Slot | What it answers | Examples |
|---|---|---|
| Action | What you did | Led, built, migrated, designed, owned, shipped |
| Scope | How big it was | 3-person team, 142 tables, 1.8 TB dataset, 12 services |
| Result | What measurable thing changed | 47-minute cutover, p99 from 480ms to 312ms, 0 mismatches |
| Business Outcome | Why anyone outside engineering should care | Saved $48k/mo, unblocked Q3 launch, eliminated SEV-1s in checkout |

A bullet that has only Action + Scope is a job description. A bullet that adds Result is a story. A bullet that adds Business Outcome is a hire signal.

### Bad

> Worked on database performance improvements.

(Action only. No scope, no result, no outcome.)

### Better

> Improved Postgres performance via index tuning and query rewrites.

(Action + Scope. Still no result.)

### Good

> Reduced p99 query latency from 480ms to 312ms across 142 tables by adding 14 composite indexes and rewriting 8 hot-path queries.

(Action + Scope + Result.)

### Great

> Reduced p99 query latency from 480ms to 312ms across 142 tables by adding 14 composite indexes and rewriting 8 hot-path queries, unblocking the Q2 checkout redesign that had been waiting on database headroom.

(Action + Scope + Result + Business Outcome.)

## Verbs that pull weight

Strong verbs lead with capability. Weak verbs leak passivity.

| Use | Avoid | Why |
|---|---|---|
| Built, shipped, designed | Helped build, contributed to | "Helped" is everyone’s hedge. If you owned it, say so. |
| Led, owned | Was responsible for | Owning is binary; "responsible for" is a fig leaf. |
| Reduced, increased, eliminated | Improved, optimized | Movement verbs imply measurement. |
| Migrated, replaced, deprecated | Worked on | "Worked on" can mean anything from architect to interim resource. |
| Authored, defined | Helped draft, participated in | Authorship is a strong claim; use it where you can defend it. |

> If you can’t substitute a stronger verb, the bullet isn’t a story worth telling. Move it down or cut.

## What to quantify

The reader’s question is always "how big?" Answer it before they ask.

| Easy to quantify | Example numbers |
|---|---|
| Team size | "3-person team", "team of 12" |
| Scope | "142 tables", "8 services", "24,000 users" |
| Duration | "delivered in 6 weeks", "47-minute cutover" |
| Performance | "p99 dropped 35%", "throughput up 4x" |
| Cost | "$48k/mo saved", "$576k annualized" |
| Risk reduction | "0 incidents in 90 days", "eliminated SEV-1s in module X" |

Where exact numbers aren’t available, use ranges or magnitudes ("dozens of", "≈30 services"), but only when ranges are genuinely all you have. A vague number is better than a fabricated specific.

## Bullet ordering inside a role

Order bullets by *impact*, not chronology. The first bullet of a role should be the most senior, highest-impact thing you did. The reader may stop after two bullets, so make sure those two are the strongest.

| Position | What goes there |
|---|---|
| Bullet 1 | The headline accomplishment of the role |
| Bullet 2 | The second-strongest thing, often a complementary axis (e.g., shipped + scaled, built + hired) |
| Bullet 3 | Either a third major win or a notable side-effort |
| Bullets 4-5 | Optional, only if they add a distinct dimension |

Five bullets per role is the practical maximum. More dilutes; fewer is fine.

## Role headers

Each role needs: title, company, dates, location (optional, omit if remote).

```
Staff Software Engineer · Acme Corp · 2023 – 2026
Lead engineer for the Platform team. Owned the API tier, capacity, and
on-call rotation across 12 tier-0 services.
```

The one-line role summary directly under the header (the "what was the job") is optional but helpful when the role doesn’t telegraph itself from the title.

## Experience comes before education

| Order | Section | Rule |
|---|---|---|
| 1 | Name + contact | One line each |
| 2 | Summary (optional) | 2-3 sentences, only if the candidate’s positioning is non-obvious (e.g., switching specialties, returning to engineering) |
| 3 | Experience | Reverse chronological |
| 4 | Education | Concise; one line per degree unless the degree is the most recent thing |
| 5 | Selected projects / open-source (optional) | Only if a project has bullets as strong as the experience section |
| 6 | Skills (optional) | Flat list, no proficiency bars |

| Wrong | → Right |
|---|---|
| An "Objective" section that says "looking for challenging role" | → omit it, or a summary that states the positioning |
| A headshot or a pie chart of skill proficiency | → omit |
| Soft skills as bullets ("team player", "good communicator") | → a bullet whose result shows the skill |
| "References available on request" | → omit; it implies you’re hiding something |

## One page until eight years

| Experience | Pages |
|---|---|
| 0–8 years | One |
| 8+ years | One or two |
| 15+ years, or staff/principal | Two is acceptable; three is almost always padding |

If you can’t fit it on one page and you have 0-8 years of experience, the issue is bullet quality (usually too much Action+Scope, not enough Result).

## Common AI-generated failure modes

| Symptom | Fix |
|---|---|
| Every bullet starts with "Helped" or "Collaborated with" | Replace with strong verbs. Hedging is the AI default. |
| Numbers are suspiciously round (10%, 50%, 100x) | These read as fabricated. Use real numbers: "47-minute cutover", not "1-hour cutover". |
| Bullets describe responsibilities, not accomplishments | A responsibility is "ongoing thing you did." An accomplishment is "a thing that finished." Most bullets should be accomplishments. |
| Five identical-shape bullets per role | Vary the shape. Some are migrations (one big effort), some are processes (recurring work), some are mentorship/hiring (people work). |
| Buzzword soup ("cross-functional, agile, customer-centric") | Cut. The hiring manager reads these as filler and skips ahead. |

## Read each bullet aloud before shipping

| Ask | A bullet fails when |
|---|---|
| Could I defend this number in an interview? | The number is a guess or rounded to sound good |
| Could another engineer at my company have written this exact bullet? | Yes: it is not specific enough |
| Does it pass the "so what?" test: would a hiring manager care? | No result a hiring manager would weigh |

If any bullet fails all three, cut or rewrite.

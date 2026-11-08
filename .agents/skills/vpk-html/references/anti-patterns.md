# Anti-patterns

Owner of document and figure failure modes for [SKILL.md](../SKILL.md). Load when you draft any document, and again before you show a figure.

Contents: [1. Emptiness: every paragraph does work](#1-emptiness-every-paragraph-does-work) · [2. Fabrication: every number has a source](#2-fabrication-every-number-has-a-source) · [3. Mimicry: inherit the genre’s substance, not its surface](#3-mimicry-inherit-the-genres-substance-not-its-surface) · [4. Excess: a template slot is permission, not a requirement](#4-excess-a-template-slot-is-permission-not-a-requirement) · [5. Source gaps: date every currentness claim](#5-source-gaps-date-every-currentness-claim) · [6. Tone contamination: hold the genre’s register](#6-tone-contamination-hold-the-genres-register) · [7. Figure failures: the corrections users have had to make](#7-figure-failures-the-corrections-users-have-had-to-make) · [Ship only when every row below holds](#ship-only-when-every-row-below-holds)


## 1. Emptiness: every paragraph does work

| Wrong | Right |
| --- | --- |
| Heading “Validation evidence”, body “This section provides evidence of the validation we performed.” | Show the evidence or delete the section. |
| “• Caching” | “Redis caches token validation; p99 fell from 480ms to 312ms.” |
| “We built a scalable, modern, user-friendly system.” | Name what makes this project different. |
| “Risk. Some risks exist.” | List each risk concretely or remove the section. |
| Caption “Architecture diagram of the system.” | State the insight: “Auth is the only cross-zone dependency.” |

The tell: removing the paragraph loses no information.

## 2. Fabrication: every number has a source

The rows cover content you added yourself; supplied material renders as given.

| Wrong (added by you) | Right |
| --- | --- |
| “Improved performance by 40%” you added with no source | Find a primary source for the number, or drop the quantity. |
| “Lewis et al. 2020” you never opened | Cite only papers you can link and have checked. |
| “One customer said ‘This changed everything.’” | Use a real, attributed quote or paraphrase without quotes. |
| A code example calling a function that does not exist | Check every API, function and flag against the codebase. |

Who supplied a claim decides whether you verify it, render it as given or mark a gap: see [source policy § Decide by who supplied the claim](source-policy.md#decide-by-who-supplied-the-claim).

## 3. Mimicry: inherit the genre’s substance, not its surface

| Wrong | Right |
| --- | --- |
| A status report where every metric is up | Report what slipped and why. |
| “Drove cross-functional alignment” | Action, scope, result: “Led 3 people migrating 142 tables from pg15 to pg16 in 47 minutes.” |
| An architecture diagram with every box in the darkest ink | One focal node, the rest demoted ([diagrams](diagrams.md)). |
| A post-mortem with “Action: improve monitoring” and no root cause | Contributing factors, then root cause, then actions. |

The tell: it passes “looks like the right shape” and fails “is this useful”.

## 4. Excess: a template slot is permission, not a requirement

| Wrong | Right |
| --- | --- |
| A resume with 5 projects when 3 are real | Use the 3 real projects. |
| A one-sentence “Background” section | Merge it into its neighbour or delete it. |
| A 9-item list where 3 matter | Keep the 3. |
| A 200-line code block | Show the diff or the 10 relevant lines and link the file. |

The tell: the reader scrolls past it.

## 5. Source gaps: date every currentness claim

| Wrong (added by you) | Right |
| --- | --- |
| “Uses the latest Postgres” | “Postgres 16.2, checked 2026-11-07.” |
| “Recent papers show…” | Cite the paper, or drop the recency claim. |
| “Raised $40M in March 2026” | Link the press release or remove the figure. |
| “Costs $X per seat” | Verify and date it, or write “see the vendor’s pricing page”. |

Who supplied a claim decides whether you verify it, render it as given or mark a gap: see [source policy § Decide by who supplied the claim](source-policy.md#decide-by-who-supplied-the-claim).

## 6. Tone contamination: hold the genre’s register

| Wrong | Right |
| --- | --- |
| “Dear Sir/Madam, We’re SO excited…” | One register throughout. |
| “I’m passionate about delighting customers!” in a resume | Facts and results. |
| “The on-call engineer should have…” | Describe what the process allowed. |
| “This stock will moon” | Evidence and targets. |
| “In the rapidly evolving landscape of…” | Cut it. |

Read real examples of the genre before drafting. The tell: one sentence could be pasted into any other document.

## 7. Figure failures: the corrections users have had to make

Spot these in captured light and dark frames before the user does. [Verification § 10](verification.md#10-map-each-user-complaint-to-its-cause) maps the user’s words to a row here.

| Failure | The tell: |
| --- | --- |
| Over-detailed, labelled UI | a shape or word per text row, see [fidelity § 1](figure-fidelity.md#1-container-outlines-on-opaque-surfaces), [§ 2](figure-fidelity.md#2-no-text-in-product-ui-scenes-except-named-exceptions) |
| Empty outlines | bare tiles nobody can name at 240px, see [fidelity § 1](figure-fidelity.md#1-container-outlines-on-opaque-surfaces) |
| Stripped exceptions | cursor moves read as anonymous, see [fidelity § 2](figure-fidelity.md#2-no-text-in-product-ui-scenes-except-named-exceptions) |
| Too dark | the light figure reads as dark theme, see [fidelity § 3](figure-fidelity.md#3-shading-after-the-reference-video) |
| Washed out | tops and sides merge into flat stickers, see [fidelity § 3](figure-fidelity.md#3-shading-after-the-reference-video) |
| Leaking shadow | a pale band beside a column on bare ground, see [fidelity § 3](figure-fidelity.md#3-shading-after-the-reference-video) |
| Heavy shadow | a ground shadow darker than any side face, see [fidelity § 3](figure-fidelity.md#3-shading-after-the-reference-video) |
| Solid black surface | a black face, panel or shadow, see [fidelity § 3](figure-fidelity.md#3-shading-after-the-reference-video) |
| Orange spread or faint | two orange things, or none, at 240px, see [fidelity § 3](figure-fidelity.md#3-shading-after-the-reference-video) |
| Dark thumbnails, repeated ids | thumbnails darker than their live frame, or a thumbnail clips to another’s element, see [fidelity § 4](figure-fidelity.md#4-copies-outside-the-root-share-the-colour-scope) |
| Misplaced detail | detail paints over nearer cards or past a clipped column, see [fidelity § 5](figure-fidelity.md#5-surface-detail-in-plan-units-one-matrix-per-surface) |
| Outlined glyphs | the HTML grows about 3x and the figure has 0 `<text>` nodes, see [fidelity § 5](figure-fidelity.md#5-surface-detail-in-plan-units-one-matrix-per-surface) |
| Stretched lettering | title letters widen as a card changes aspect, see [fidelity § 5](figure-fidelity.md#5-surface-detail-in-plan-units-one-matrix-per-surface) |
| Tuned by eye, not to production | no production crop beside yours, see [fidelity § 6](figure-fidelity.md#6-match-production-frames-not-your-own-render) |
| Invented motion | a move the production video never shows, see [figure motion](figure-motion.md#match-the-production-video-first) |
| Uncarried arrival | a wall card moves or hangs with no named cursor, see [figure motion](figure-motion.md#a-named-cursor-carries-every-arrival) |
| Frozen final act | the figure stops 2 s after the wheel reaches the end, see [figure motion](figure-motion.md#an-idle-clock-runs-on-top-of-scrolled-time) |
| Board breaks product rules | a gap stays open, one selected card moves alone, or Done ends on a whole card, see [figure motion](figure-motion.md#collections-reflow-like-the-product) |

## Ship only when every row below holds

| Holds | Section |
| --- | --- |
| Every paragraph does work | [§ 1](#1-emptiness-every-paragraph-does-work) |
| Every number you added has a primary source; supplied numbers render as given | [§ 2](#2-fabrication-every-number-has-a-source) |
| It reads like a real example of its genre | [§ 3](#3-mimicry-inherit-the-genres-substance-not-its-surface) |
| Every slot earns its space | [§ 4](#4-excess-a-template-slot-is-permission-not-a-requirement) |
| Currentness claims you added carry a version or a check date | [§ 5](#5-source-gaps-date-every-currentness-claim) |
| The register holds end to end | [§ 6](#6-tone-contamination-hold-the-genres-register) |
| No figure failure shows in light or dark frames | [§ 7](#7-figure-failures-the-corrections-users-have-had-to-make) |

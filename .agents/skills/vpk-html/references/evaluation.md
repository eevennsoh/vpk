# Evaluation

Owner of how you measure and improve the vpk-html skill itself for [SKILL.md](../SKILL.md). Load when you change vpk-html guidance, templates, shared mechanics or checks. Proving one artifact is [verification](verification.md).

## Run the health check before every round

```bash
node .agents/skills/vpk-html/scripts/build.mjs --check-evals
node scripts/validate-skills.js
```

It validates `evals/evals.json` (schema, template references, reader jobs) and the catalog counts on disk. Every template outside the legacy baseline in `scripts/playbooks.mjs` needs at least one scenario; playbooks name scenarios by `name`, never by id. Every file in `assets/diagrams/` needs a CHEATSHEET row; `--check-evals` fails when one is missing.

`validate-skills.js` is the repo’s skill gate (frontmatter, links, INDEX row); it must exit 0.

To run every script suite, pass a quoted recursive glob; a bare folder fails with `Cannot find module`, and a single `*` misses the suites in `iso/`, `anatomy/`, `lab/`, `runtime/`, `review/`, `code/`, `media/`, `x-thread/` and the other subfolders:

```bash
node --test ".agents/skills/vpk-html/scripts/**/*.test.{js,mjs}"
```

Browser-gated suites skip by default; set `VPK_HTML_BROWSER=1` and run unsandboxed to include them. `evals.test.js` asserts this glob matches every `*.test.*js` file under `scripts/`.

The eval kit and its commands: [evals/README.md](../evals/README.md).

## Run a comparison round

```sh
ROUND=output/vpk-html-evals/<round>; mkdir -p "$ROUND/<scenario>"
cp -r .agents/skills/vpk-html "$ROUND/baseline-skill"   # before you edit: this copy is the baseline
```

| Wrong | Right |
| --- | --- |
| Reroll the candidate until it wins | One first attempt each; a loss is data |
| Claim the skill improved from one win | Run 3 per side; report the median and range of each graded value; record a gap smaller than the range as “no measurable difference” |

The tell: a losing run that was replaced rather than counted.

Run 3 per side, the same floor skill-creator’s benchmark uses. Figure scores vary more than prose scores, so when the two sides’ ranges overlap on a figure value, add 2 runs per side before you call the gap. A scenario with no run on one side backs no claim; list it under “not run” in the round’s `grading.json`.

1. Snapshot the skill with the commands above before you edit it.
2. Hold the scenario prompt, inputs, model and viewport fixed. Append the scenario’s viewport from `evals.json` to each run prompt; the prompts do not carry it. Record skill revision and model beside each run. Generate one attempt from each.
   When a run’s notification arrives, save its `total_tokens` and `duration_ms` to `timing.json` in the run folder at once; they are not recoverable later.
3. Run `build.mjs --check-placeholders`, `build.mjs --verify`, `check-html.mjs` and `build.mjs --check-content` on every artifact, Error-filtered per [verification § 5](verification.md#5-filter-every-command-on-error). Save the output beside the artifact.
4. Save evidence under `output/vpk-html-evals/<round>/<scenario>/`: prompt, revision, model, viewport, artifact, frames, `timing.json`, check output, reviewer feedback. Graders read `artifacts/vpk-html` in an expectation as this round folder.
5. Review blind. If an installed `skill-creator` provides `eval-viewer/generate_review.py`, use its static or local-server command. If no compatible viewer is installed, create `review.md` inside the round folder: label the matched outputs A and B at random, link each artifact and screenshot, copy the scenario’s human rubric, and record the reviewer’s choice and corrections there. A missing viewer never stops a round or justifies a bespoke review app.
6. Rerun affected scenarios after each correction. At milestones, run the full corpus against the saved baseline.

Completion criterion:
- [ ] Baseline and candidate ran on identical inputs, with no rerolls, and 3 per side behind any claim of improvement (5 where figure ranges overlapped).
- [ ] `review.md` or the viewer records a choice for every scenario.

## Grade in three layers

| Layer | Question | Evidence |
| --- | --- | --- |
| Objective | Did a known mechanical failure occur? | Facts and caveats survive; offline, self-contained, placeholder-free; runtime hooks intact; no overflow, font, console or request failure; gates pass |
| Visual reference | Does the figure match production? | Contact sheet, 0.1 s strips and crops beside reference frames, light and dark ([verification § 2-4](verification.md#2-extract-reference-frames-before-you-draw)) |
| Human judgment | Is the page useful? | The reader finds the decision in 30 seconds; a deep reader audits evidence without rebuilding the argument; composition follows the reader’s job; caveats weigh what they change |

A figure verdict cites its frame paths, per [verification § 9](verification.md#9-show-frames-before-you-claim-done).

## Run a fresh critic, then filter it

Brief a subagent that did not write the change with [critic-prompt.md](../evals/critic-prompt.md) and [rubric.md](../evals/rubric.md); use another model family when one is available. This loop reviews artifacts produced by a round. A change to the skill’s own files goes through the installed `skill-creator` skill: its eval, benchmark and description-optimisation loop.

Sort every finding:

| Bucket | Rule | Example finding |
| --- | --- | --- |
| Act on | Breaks a Block if line or a reader’s job | “Thumbnail strip stays light in dark theme, `frames/ours/page-slides-w1440-dark-t13.png`” |
| Consider | Real and small | “Rail tick 2px off the button centre at 1024px” |
| Noted | True, no change needed | “Video mode reuses the Page figure at a smaller scale” |
| Dismissed | Hypothetical, taste with no rubric line, or missing context | “Cards could use a gradient” |

Fix every Act on item in its owner, then brief a new critic. Stop at two consecutive APPROVE or WOWED verdicts, or after 3 rounds with no new Act on item; report the open Consider items. An all-nit review means the work holds.

## Land each correction in the narrowest owner

| Correction | Owner |
| --- | --- |
| Reader framing, composition judgment, copy principle | `SKILL.md` or the relevant reference |
| Repeatable typography, spacing, component or runtime behaviour | tokens, shared scripts or templates |
| Observable mechanical failure | a check in `check-html.mjs` or [quality gates](quality-gates.md) |
| Figure differs from production | the figure owner, plus a frame pair in the round |
| Scenario-specific supplied fact | the scenario input only |
| Review or capture problem | [verification](verification.md), never authoring guidance |

Keep a rule only when a frozen comparison shows it helps or the same failure recurs in real feedback. Never tune a prompt to make one saved output win. If a change fixes one scenario and harms another, revise or revert it; never add a compensating exception.

# Evaluation and feedback loop

Use this reference when changing vpk-html guidance, templates, shared mechanics,
or deterministic checks. Routine document generation does not need to run the
full evaluation loop.

## Health check

The committed scenario corpus lives at `evals/evals.json`. Validate its schema,
template references, reader jobs, and the published catalog snapshot with:

```bash
node .agents/skills/vpk-html/scripts/build.mjs --check-evals
```

This command does not generate model outputs. It ensures every comparison round
starts from the same valid prompts and that agent-facing capability counts have
not drifted from the files on disk.

## What the corpus measures

The scenarios cover recurring artifact jobs rather than individual visual
components: renewal recommendation, performance status, benchmark comparison,
interactive planning, build-versus-buy, security governance, and a decision
deck. Each scenario freezes:

- supplied facts and caveats;
- the intended template and viewport;
- the reader's quick-read decision or action;
- the evidence needed for a deeper audit;
- objective expectations and a human review rubric.

Do not tune a prompt to make one saved output win. A useful correction should
improve the underlying reader job across multiple scenarios.

Every template outside the legacy baseline in `scripts/playbooks.mjs` must have
at least one scenario, and `--check-evals` enforces it. Playbooks name scenarios
by `name`, never by id.

## Run a comparison round

1. Snapshot the current skill before editing it. That snapshot is the baseline
   for an existing-skill comparison.
2. Keep the scenario prompt, inputs, model configuration, and viewport fixed.
   Append the scenario's frozen viewport to each run prompt (for example
   "Review viewport 1440x1000."), because `evals.json` prompts do not carry it.
   Record the skill revision and model beside each run. Generate one first
   attempt from the baseline and one from the candidate. Do not reroll a weak
   result.
3. Run the required placeholder, browser-render, and HTML checks against every
   generated artifact. Record their output beside the artifact.
4. Save run evidence under `output/vpk-html-evals/<round>/<scenario>/`, including
   the prompt, skill revision, model, viewport, artifact, screenshot, timing,
   check results, and reviewer feedback. Evaluation output is disposable review
   evidence, not a durable user artifact. Graders read `artifacts/vpk-html` in
   an expectation as this round folder for eval runs.
5. Review outputs blind when practical. If an installed `skill-creator` provides
   `eval-viewer/generate_review.py`, use its documented static or local-server
   command for side-by-side human review. If no compatible viewer is installed,
   create `review.md` inside the round folder: randomly label the matched outputs
   A and B, link each artifact and screenshot, copy the scenario's human rubric,
   and record the reviewer's choice and corrections there. A missing optional
   viewer must not stop a comparison round or trigger a bespoke review app.
6. Rerun affected scenarios after a correction. At milestones, run the full
   corpus and compare it with the saved baseline.

## Review in two layers

Deterministic checks answer whether a known, mechanical failure occurred. Human
review answers whether the page is actually useful.

### Objective checks

- supplied facts, caveats, and requested decisions survive;
- the file remains offline, self-contained, and placeholder-free;
- the referenced template exists and required runtime hooks remain intact;
- the target viewport has no overflow, font, console, or request failures;
- applicable accessibility and advisory gates pass.

### Human judgment

- the reader can find the decision or action in about thirty seconds;
- a deeper reader can audit the evidence without reconstructing the argument;
- composition follows the reader's job rather than filling template slots;
- hierarchy, prose, figures, and interaction share the Algebrica identity;
- caveats receive weight proportional to their effect on the decision.

Passing deterministic checks is necessary but does not prove good design.

## Land each correction in the narrowest owner

| Correction type | Owner |
| --- | --- |
| Reader framing, composition judgment, copy principle | `SKILL.md` or the relevant reference |
| Repeatable typography, spacing, component, or runtime behavior | tokens, shared scripts, or templates |
| Observable mechanical failure | deterministic checker or quality gate |
| Scenario-specific supplied fact | the scenario input only |
| Review or capture problem | evaluation workflow, not authoring guidance |

Keep a rule only when a frozen comparison shows that it helps or repeated real
feedback shows the same failure. If a change fixes one scenario but harms
another, revise or revert it instead of adding a compensating exception.

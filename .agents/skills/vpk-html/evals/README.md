# vpk-html evals

Load when you change vpk-html guidance and need numbers before and after; it says how to run each eval here and where results go. Back to [SKILL.md](../SKILL.md); the round procedure is [evaluation](../references/evaluation.md).

| File | Eval | Run it |
| --- | --- | --- |
| `evals.json` | Task scenarios graded on the artifact | Grade per [evaluation § Run a comparison round](../references/evaluation.md#run-a-comparison-round) |
| `triggers.json` | Does the description fire on the right prompts | [Measure recall](#measure-recall-on-near-misses-precision-on-guards-and-siblings) |
| `rubric.md`, `critic-prompt.md` | Fresh-critic review of one artifact | [Brief a fresh critic](#brief-a-fresh-critic-with-only-the-text-block) |

## Write every result under one round folder

```sh
ROUND=output/vpk-html-evals/$(date +%Y-%m-%d)-<change>; mkdir -p "$ROUND"
```

Never write results into the skill folder or `artifacts/`. Save each run; never overwrite an earlier one.

## Which scenarios carry with/without proof

Five of the 14 `evals.json` scenarios have with-skill and without-skill runs in the 2026-11-08 rounds 1–3: 1 renewal-recommendation (rounds 1 and 2), 2 api-performance-status (rounds 1 and 3), 6 security-governance, 13 story-explainer-scroll-to-end-motion and 14 story-explainer-modes-and-chrome (round 3). Of those, 1, 2 and 13 discriminate on content; 6 and 14 score level, so they back no improvement claim.

Scenarios 3–5, 7–12 are conformance-only: `build.mjs --check-evals` proves each is well-formed and names a template that exists, and no claim rests on them. They have not run because 3–5 and 7–11 have no grader in any round’s `grade.mjs` yet, 12 needs the production route on a live dev origin, and the remaining runs at 3 per side cost tens of hours of agent time. A scenario with no run on one side backs no claim ([evaluation § Run a comparison round](../references/evaluation.md#run-a-comparison-round)).

## Measure recall on near misses, precision on guards and siblings

The vpk-html description says “Use only when”, so recall comes from `near-miss-positive` rows and false positives from `guard` and `sibling` rows; literal `invoke` rows are reported but leave the recall headline. Each row’s `note` says what it tests. Rows marked `"where": "repo"` name the VPK app and only mean something run from the repo root.

Run the rows with the installed `skill-creator` skill’s trigger eval; `triggers.json` is already its `{query, should_trigger}` format:

```sh
SC=$(dirname "$(find ~/.claude/plugins -path '*skill-creator/SKILL.md' | head -1)")
(cd "$SC" && python3 -m scripts.run_eval --eval-set "$OLDPWD/.agents/skills/vpk-html/evals/triggers.json" \
  --skill-path "$OLDPWD/.agents/skills/vpk-html" --runs-per-query 3 --timeout 60 --verbose) > "$ROUND/triggers.json"
```

Ship on recall 0.85 or more on the near-miss rows and false positives 0.10 or less on the guard and sibling rows. For a failing description, use skill-creator’s `run_loop` (train/test split, held-out selection) rather than hand rewording; the fix goes to the description in `SKILL.md`, never to a reworded query, unless the row leans on content it does not carry.

## Brief a fresh critic with only the text block

```sh
awk '/^```text$/{f=1;next} /^```$/{f=0} f' .agents/skills/vpk-html/evals/critic-prompt.md | sed \
  -e "s#{ARTIFACT_PATH}#artifacts/vpk-html/<slug>/<slug>.html#" -e "s#{FRAMES_DIR}#output/vpk-html/<slug>/frames#" \
  -e "s#{REFERENCE_DIR}#output/vpk-html/<slug>/frames/ref#" -e "s#{RUBRIC}#.agents/skills/vpk-html/evals/rubric.md#" \
  -e "s#{VIEWPORT}#<scenario viewport from evals.json, else 1440×900>#" > "$ROUND/critic-brief.md"
```

Hand `critic-brief.md` to a fresh subagent and save its reply as `$ROUND/critic-<n>.md`. Sort and loop per [evaluation § Run a fresh critic](../references/evaluation.md#run-a-fresh-critic-then-filter-it).

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

## Measure recall on near misses, precision on guards and siblings

The vpk-html description says “Use only when”, so `run-triggers.mjs` scores it as explicit-only: literal `invoke` rows are reported but leave the recall headline. Recall comes from `near-miss-positive` rows, false positives from `guard` and `sibling` rows. `--with-skills .agents/skills` installs the project siblings (vpk-explain, vpk-artifact, vpk-build) beside vpk-html in the `/tmp` sandbox, so only the vpk-* sibling rows compete as they do in the repo. The other three name global winners the flag does not install: hyperframes and frontend-design compete only on a machine that has them as user skills (`~/.claude/skills`, which `claude -p` loads in any directory), and dataviz is not a user skill there, so its row tests only that vpk-html stays silent. Each of those rows says so in its `note`.

```sh
node ~/.agents/skills/create-skill/scripts/run-triggers.mjs .agents/skills/vpk-html --with-skills .agents/skills --out "$ROUND" --runs 3
```

It writes `$ROUND/triggers-<date>.json`. Thresholds, detection and the `--runs 5` rerun rule live in `~/.agents/skills/create-skill/references/eval-protocol.md` § Trigger runs; it exits 1 when one misses. A `refused` line names the fix, for example unlinking `~/.claude/skills/vpk-html` for the run. Read the failing row’s transcripts first, saved as `$ROUND/transcripts/<row index>-<run>.jsonl`. When they match a cause in that § Trigger runs table, apply that fix; otherwise the fix goes to the description in `SKILL.md`, never to a reworded query.

## Brief a fresh critic with only the text block

```sh
awk '/^```text$/{f=1;next} /^```$/{f=0} f' .agents/skills/vpk-html/evals/critic-prompt.md | sed \
  -e "s#{ARTIFACT_PATH}#artifacts/vpk-html/<slug>/<slug>.html#" -e "s#{FRAMES_DIR}#output/vpk-html/<slug>/frames#" \
  -e "s#{REFERENCE_DIR}#output/vpk-html/<slug>/frames/ref#" -e "s#{RUBRIC}#.agents/skills/vpk-html/evals/rubric.md#" \
  -e "s#{VIEWPORT}#<scenario viewport from evals.json, else 1440×900>#" > "$ROUND/critic-brief.md"
```

Hand `critic-brief.md` to a fresh subagent and save its reply as `$ROUND/critic-<n>.md`. Sort and loop per [evaluation § Run a fresh critic](../references/evaluation.md#run-a-fresh-critic-then-filter-it).

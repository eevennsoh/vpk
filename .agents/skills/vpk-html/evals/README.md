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

The vpk-html description says “Use only when”, so `run-triggers.mjs` scores it as explicit-only: literal `invoke` rows are reported but leave the recall headline. Recall comes from `near-miss-positive` rows, false positives from `guard` and `sibling` rows. `--with-skills .agents/skills` installs every other folder with a `SKILL.md` under `.agents/skills` beside vpk-html in the `/tmp` sandbox: the 20 vpk-* skills (vpk-artifact, vpk-build, vpk-component, vpk-component-ext, vpk-deploy, vpk-design, vpk-domain, vpk-explain, vpk-git-clean, vpk-git-ship, vpk-git-ship-fast, vpk-host, vpk-remote, vpk-scheduled-automation, vpk-setup, vpk-symphony, vpk-system-clean, vpk-tidy, vpk-tunnel, vpk-verify; list them with `ls .agents/skills/*/SKILL.md`). So the vpk-explain and vpk-artifact sibling rows compete as they do in the repo. The other three name global winners the flag does not install: hyperframes and frontend-design compete only on a machine that has them as user skills (`~/.claude/skills`, which `claude -p` loads in any directory), and dataviz is not a user skill there, so its row tests only that vpk-html stays silent. Each of those rows says so in its `note`.

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

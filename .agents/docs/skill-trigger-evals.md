# Skill trigger evals

Load this when you need numbers on whether a VPK skill's description fires on the right prompts. It says why skill-creator's `run_eval` scored 0.0 on every row here, and how to run it so the numbers are real.

The kits are each skill's `evals/triggers.json`: `{query, should_trigger, note}` rows that `run_eval` reads as they are. Always score them with the installed skill-creator plugin's `run_eval`, `run_loop` for description tuning; never a custom harness. Run both through the wrapper below: `run_loop` imports the same project-root lookup and also defaults to 10 workers, so run plainly it scores 0.0 too.

## Run it

```sh
pnpm run eval:skill-triggers -- vpk-remote
pnpm run eval:skill-triggers -- vpk-design --runs-per-query 1 --model claude-sonnet-5-5
pnpm run eval:skill-triggers -- vpk-design --loop --model claude-opus-5-5   # run_loop: tune the description
```

`scripts/skill-trigger-eval.js` only prepares the environment and then runs `python3 -m scripts.run_eval` (or `scripts.run_loop` with `--loop`) from the installed plugin, unchanged. It saves the JSON to `output/skill-evals/<date>-<skill>/triggers.json` (`loop.json` for `--loop`) and streams the `--verbose` lines; a run that fails or is interrupted writes `<out>.failed` and leaves an earlier result alone. Relative `--out` and `--eval-set` paths are taken from the folder you ran `pnpm` in. Flags other than its own (`--loop`, `--keep-user-config`, `--eval-set`, `--out`, `--skill-creator`) go to skill-creator, in either `--flag value` or `--flag=value` form; its defaults are 3 runs per query, a 60 s timeout and 1 worker. Keep one worker per skill (a 20-row kit at 3 runs takes about 30 minutes, mostly negative rows running to the timeout); to save time, run different skills at once instead, since each run gets its own sandbox.

`run_loop` opens its live HTML report in a browser by default; pass `--report none` (or `--results-dir output/skill-evals/<name>`) for a headless run.

It needs headless auth in the environment, because the Claude config it uses is empty: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or `CLAUDE_CODE_OAUTH_TOKEN`. A `claude-gw` session already exports `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL`; on a subscription login, run `claude setup-token` once and export `CLAUDE_CODE_OAUTH_TOKEN`.

The empty config also drops the model you set in your settings, so `claude -p` uses `ANTHROPIC_MODEL` if it is exported and Claude Code's default otherwise. The script prints which one it used on its `model:` line. Numbers are only comparable across runs with the same explicit `--model`.

## Why the plain recipe scores 0.0

`run_eval` writes the description under test as a temporary command, `<root>/.claude/commands/<skill>-skill-<id>.md`, where `<root>` is the nearest ancestor of the working directory that holds a `.claude/` folder. It runs `claude -p "<query>"` there and reads the stream. A row counts as triggered only if the first tool the model calls is `Skill` or `Read` naming that temporary command; any other first tool (`Bash`, `ToolSearch`, `ListAgents`) ends the row as not triggered. Three things in a normal setup break that, and a fourth in `run_eval` itself:

| Cause | What happens | Fix in the wrapper |
| --- | --- | --- |
| Run from the repo | The real `.agents/skills/<skill>` is listed too, so the model calls `Skill("vpk-remote")`, not the temporary copy, and the row scores a miss. A literal `/vpk-remote …` query expands the real skill directly, so the first tool is `Bash`. | Run in a throwaway project outside the repo that links every sibling VPK skill except the one under test, plus `AGENTS.md`. Siblings still compete. |
| Run from skill-creator's folder (the old recipe) | The nearest `.claude/` above the plugin cache is `$HOME`, so the temporary command is written into `~/.claude/commands` and `claude -p` runs in `$HOME`. | The sandbox holds its own `.claude/`, so `run_eval` resolves it; the script checks this before starting. |
| Your own Claude config | A typical user config loads hundreds of skills, several plugins and SessionStart hooks. The temporary command is listed, but the model starts with `Bash` or `ListAgents` instead of a skill. | A throwaway `CLAUDE_CONFIG_DIR`, so only built-in skills, the siblings and the temporary command are listed. `--keep-user-config` turns this off to reproduce the problem. |
| Parallel workers (`--num-workers`, default 10) | Every worker writes its temporary command into the same `.claude/commands`, with the same description and a different id. The model often calls another worker's copy, which scores as a miss: with 6 workers, vpk-remote passed 0 of 12 positive rows; with 1 worker, the same rows trigger. | Default to `--num-workers 1`, and warn when you raise it. |

The gateway is not a cause: `run_eval` calls the `claude` binary on `PATH` (the zsh `claude`/`claude-gw` functions do not reach a subprocess) with your environment, and the same gateway environment triggered correctly once the config was isolated.

## Read the numbers

First real baseline, 2026-11-16, `claude-opus-5-5[1m]` (from `ANTHROPIC_MODEL`) through the gateway, 3 runs per row: vpk-remote 19/20 rows (positives 11/12, negatives 8/8 with no false trigger), vpk-design 16/18 (positives 8/10, negatives 8/8). The misses were "farm this out to sonnet in the background…" (vpk-remote) and the two screenshot-to-code rows without a Figma link (vpk-design).

The result is relative to VPK's own skills and Claude Code's built-ins, not to your personal skill set; a description can still lose to a user-level skill in a real session. Rows marked `"where": "repo"` assume the VPK app; the sandbox carries `AGENTS.md` but no source, so treat a miss there with care. For ship thresholds and how to fix a failing description, follow the skill's own evals README (for example `.agents/skills/vpk-html/evals/README.md`); change the description in `SKILL.md`, not the query.

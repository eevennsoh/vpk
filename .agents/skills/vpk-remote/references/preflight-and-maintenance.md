# Preflight and maintenance

Read this when a preflight probe fails, when installing or repairing the launcher, when a GPT-lane worker dies with `CloudID is invalid`, or when changing this skill's maintained scripts. Back to [SKILL.md](../SKILL.md).

## Preflight the selected route

For ordinary tasks, check the selected worker CLI (`codex --version` or
`"$HOME/.local/bin/claude" --version`) and run the maintained probe before
creating a worktree or dispatching a worker:

```bash
node scripts/vpk-remote-preflight.js --app codex --model <resolved-gpt-id>
node scripts/vpk-remote-preflight.js --app claude --model <resolved-claude-id>
```

Run only the command for the selected lane. The probe sends a small streamed
tool-call request to the exact model and inference route. It checks the returned
tool name, namespace, and arguments. It retries transient transport/408/429/5xx
failures once; authentication, model, schema, and CloudID errors stop immediately.
It never changes the model or falls back to a subscription login.

Do not use `/openai/v1/models` as a health gate. Discovery can return 502 while
Claude inference works, and its catalog can omit working models. Report the
selected inference route's actual failure and next action. A passed probe does
not certify all installed plugins or a later worker run.

For a conversation handoff, `ai-api` runs this probe itself for the selected app
and model. Its dry run is offline and does not read the translator key. Install
or update the maintained launcher and historical-tool guard with:

```bash
bash scripts/install-vpk-remote.sh
```

The installer backs up existing files, preserves model routes, and registers a
LiteLLM callback. Restart only the local translator to load a newly installed
callback; do not restart Proximity or unrelated services. Installation outside
the checkout requires the harness's normal filesystem approval.

Repairing this skill, launcher, or adapter is local tooling work. Diagnose and
fix a broken gateway path directly; do not require that broken path to run its
own repair worker. For other task failures, stop before dispatch, preserve any
landed diff, and report the concrete blocker instead of implementing in the
planner or silently switching models.

## Known infrastructure hazard

Proximity's **`/openai/*` route intermittently returns HTTP 400** —
`CloudID is invalid or not provisioned in the staging environment` — on
roughly 10% of requests (measured 2026-08-01: 18/20 small identical calls
passed, and an 8KB request failed while a 400KB one succeeded, so it is
neither size nor config). `codex exec` treats 400 as non-retryable and aborts
the whole session, so a long GPT-lane run is likely to die partway.

The single-request preflight cannot detect this — most requests succeed. When
a GPT-lane worker dies with that message, it is **not** a brief or model
problem: check `git status` for a landed diff, then prefer the Claude lane
(`--model opus` / `--model sonnet`, routed via `/vertex/claude`, 12/12 clean
in the same window) rather than re-dispatching to GPT. The upstream fix
belongs to whoever provisions the staging CloudID.

## Regression checks

```bash
node --test scripts/vpk-ai-api.test.js scripts/vpk-remote-preflight.test.js scripts/vpk-remote-tools.test.js scripts/vpk-remote-browser-server.test.js scripts/vpk-remote-git-grant.test.js
python3 scripts/test_vpk_remote_tools.py
node scripts/validate-skills.js --target .agents/skills/vpk-remote
```

The maintained sources are `scripts/vpk-ai-api.sh`,
`scripts/vpk-remote-preflight.js`, `scripts/vpk_remote_tools.py`, and
`scripts/vpk_remote_callback.py`; change these before reinstalling, rather than
patching site-packages or leaving the fix only in a machine-local script.
`scripts/vpk-remote-browser-server.js` (the GPT lane's browser server, see
[gpt-executor.md § Browser tests](gpt-executor.md#browser-tests-playwright))
and `scripts/vpk-remote-git-grant.js` (its commit grant, see
[gpt-executor.md § Commits](gpt-executor.md#commits)) run from the checkout
and need no reinstall.

A 400 `tools: Tool names must be unique` on a Codex-to-Claude fork can come from
historical `additional_tools` bundles repeating the current tools. The callback
keeps current runtime schemas, merges missing historical members, and gives the
latest historical definition precedence when there is no current definition.
Conflicting definitions inside the current list fail locally rather than being
silently replaced. It does not rename tools or rewrite tool calls/results.

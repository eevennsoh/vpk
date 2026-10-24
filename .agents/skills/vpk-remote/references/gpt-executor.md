# GPT Executor Reference (Sol/Terra/Luna via Codex CLI → Proximity)

The GPT lane for `/vpk-remote` workers. Each worker is a `codex exec` process
in a background Bash call, routed to Proximity's localhost gateway with an
isolated per-worker `CODEX_HOME`. The contract is intentionally
self-contained: it does not rely on the user's aliases, `~/.codex/config.toml`,
or login state. Flags verified against **codex-cli 0.146.0** (2026-08-03);
re-run `codex exec --help` and update this doc if a newer CLI drifts.

## Preflight

```bash
codex --version
curl -fsS --max-time 5 http://localhost:29576/openai/v1/models >/dev/null
```

The curl is a **health check only**. Proximity's catalog endpoint is stale —
it lists models older than what the gateway serves (verified: catalog tops
out at gpt-5.5 while `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`
answer). Do not
grep the catalog for the target model; if the gateway rejects the model at
dispatch time, that rejection is the blocker to report. Failure of either
check is a blocker — never substitute the planner's provider or login.

## Canonical first run

Substitute `<model>` (the full GPT ID — resolve aliases and defaults from
`~/.config/litellm-proximity/defaults.env`) and
`<effort>` (`medium` | `high` | `xhigh` | `max`; `low` is accepted by the CLI
but deliberately not offered by this skill — see *Choosing effort* in
SKILL.md) from the dispatch grammar. Create one directory per worker; never
copy anything from `~/.codex` into it. Luna at `max` was verified end-to-end
through Proximity on 2026-08-03.

```bash
worker_root="$PWD/output/remote-gpt/vpk-<type>-<slug>"
mkdir -p "$worker_root/home"

env -u OPENAI_API_KEY -u CODEX_API_KEY \
  CODEX_HOME="$worker_root/home" \
  codex exec --ignore-user-config -C "$PWD" \
  -m gpt-5.6-sol \
  -c 'model_provider="openai-gw"' \
  -c 'model_reasoning_effort="high"' \
  -c 'approval_policy="never"' \
  -c 'model_providers.openai-gw.name="AI Gateway (Proximity)"' \
  -c 'model_providers.openai-gw.base_url="http://localhost:29576/openai/v1"' \
  -c 'model_providers.openai-gw.wire_api="responses"' \
  -c 'model_providers.openai-gw.requires_openai_auth=false' \
  -c 'sandbox_workspace_write.network_access=true' \
  --sandbox workspace-write \
  --output-last-message "$worker_root/report.md" \
  - < "$worker_root/brief.md"
```

Run via Bash with `run_in_background: true`; the harness notifies on exit.
A Codex planner has no background notification: run it in the foreground
(see *Codex as the planner* in SKILL.md).
Fan-out = several of these in one message, each with its own `worker_root`
(`vpk-<type>-<slug>-<n>`).
For read-only briefs, `--sandbox read-only` is a tighter fit.

Why each isolation layer exists:

- `CODEX_HOME` keeps worker sessions and state away from the user's Codex
  home (Desktop or CLI).
- `--ignore-user-config` prevents provider, model, plugin, or approval drift
  from `~/.codex/config.toml`.
- Unsetting `OPENAI_API_KEY`/`CODEX_API_KEY` prevents ambient credentials
  from changing the request path.
- The **`name` key is required** — `--ignore-user-config` builds the provider
  block from scratch, and omitting `model_providers.openai-gw.name` fails
  with `provider name must not be empty` (observed on 0.144.5).
- `requires_openai_auth=false` stops Codex from requiring or attaching a
  login; Proximity authenticates upstream itself.
- `wire_api="responses"` is the wire format Proximity's OpenAI path speaks.
- Explicit model + effort pins mean an alias or config change cannot
  silently redirect the run.
- Workspace-write contains implementation to the current worktree; do not
  escalate to `--dangerously-bypass-approvals-and-sandbox`.
- The leading `env` is an external command, so a same-name shell function
  (`codex` is one in the user's zshrc) cannot intercept the invocation.

Read **only** the `--output-last-message` file afterwards. Never parse the
stdout/JSONL stream — that is raw worker material and stays out of the
planner's context.

## Resume a single worker

Reuse the same `CODEX_HOME` and repeat every override. Exec-level flags must
come **before** the `resume` subcommand (`codex exec resume --last --sandbox …`
fails with `unexpected argument`).

```bash
worker_root="$PWD/output/remote-gpt/vpk-<type>-<slug>"

env -u OPENAI_API_KEY -u CODEX_API_KEY \
  CODEX_HOME="$worker_root/home" \
  codex exec --ignore-user-config \
  -m gpt-5.6-sol \
  -c 'model_provider="openai-gw"' \
  -c 'model_reasoning_effort="high"' \
  -c 'approval_policy="never"' \
  -c 'model_providers.openai-gw.name="AI Gateway (Proximity)"' \
  -c 'model_providers.openai-gw.base_url="http://localhost:29576/openai/v1"' \
  -c 'model_providers.openai-gw.wire_api="responses"' \
  -c 'model_providers.openai-gw.requires_openai_auth=false' \
  -c 'sandbox_workspace_write.network_access=true' \
  --sandbox workspace-write \
  --output-last-message "$worker_root/report.md" \
  resume --last - < "$worker_root/followup-1.md"
```

Resuming keeps the session's prompt cache warm — a fresh `codex exec`
re-pays the whole cold-start context read. Use `resume --last` only when this
is the sole active/recent session in its isolated home; **never resume during
or immediately after fan-out** (the selected session is ambiguous).

## Advisor consults

This lane serves advisor consults at `gpt-5.6-sol` `xhigh` when the work
under review came from the **Claude** lane, including plans written by the
Claude planner itself — see the independence rule in
[advisor-pattern.md](advisor-pattern.md). Use `--sandbox read-only`, an
`output/remote-gpt/vpk-<type>-<slug>-review/` directory (see *Naming* in
SKILL.md), and a read-only brief.

## Failure handling

- Missing CLI, unreachable gateway, model rejection, authentication prompts,
  or an absent/empty report file are infrastructure blockers. Re-dispatch an
  absent-report brief once to a fresh worker; report everything else.
- Do not retry through `openai-no-ws`, a default provider, the planner's
  `CODEX_HOME`, or any shell alias.
- A worker that searched its scope and reported "not found" succeeded — that
  is a finding, not a failure.

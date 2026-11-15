# Planner detection

Read this at the start of every `/vpk-remote` run, and when the planner is Codex. Back to [SKILL.md](../SKILL.md).

## Detect the planner

Detect the planner once, at the start of the run:

```bash
if [ -n "${CODEX_THREAD_ID:-}" ]; then
  app=codex
  # Codex picks its provider in config.toml, not the environment.
  grep -qE '^model_provider *= *"openai-gw"' "${CODEX_HOME:-$HOME/.codex}/config.toml" 2>/dev/null \
    && billing=api || billing=oauth
else
  app=claude
  if [ "${CLAUDE_CODE_DISABLE_OAUTH:-}" = 1 ] || [[ "${ANTHROPIC_BASE_URL:-}" == *localhost:29576* ]]; then
    billing=api     # claude-gw or ai-api
  else
    billing=oauth   # plain claude
  fi
fi
gitdir="$(git rev-parse --git-common-dir)"
touch "$gitdir/.vpk-remote-probe" 2>/dev/null && rm "$gitdir/.vpk-remote-probe" \
  && git_write=yes || git_write=no   # no = sandboxed; worktree creation needs approval
```

A Codex session started with `codex -c model_provider=…` can differ from its
config file; the echoed plan is where the user catches that.

| | `api` parent | `oauth` parent |
| --- | --- | --- |
| Implementation | gateway worker | gateway worker |
| Planner reading, review, trivial edits | fine | fine (cost absorbed) |
| In-app subagents (Claude Code Agent tool) | allowed — they inherit the gateway login | avoid for heavy work — they bill the subscription; use a gateway worker |
| Credits run out mid-session | not applicable | move the conversation (below) |

Echo the detected app, billing, model, and effort in the one-line plan (for
example `codex · api · terra · high`), so a misdetection is visible.

## Codex as the planner

The loop is the same; three mechanics differ.

- **Waiting on workers.** Codex has no background command that wakes the
  session on exit. Run the surface wrapper in the foreground and let it block
  until the worker exits; it still exits with the worker's status. Fan-out
  means launching every worker first (each `run.sh` with `&`, then `wait`)
  in one command, so they still run in parallel.
- **Sandbox and approvals.** Enterprise-managed requirements on this Mac cap
  Codex at `workspace-write` or `read-only` with `on-request` approvals.
  `--dangerously-bypass-approvals-and-sandbox` (which `codex-gw` passes) is
  overridden to **read-only**, so it does not help. Under `workspace-write`,
  writes under `.git` are blocked (`git_write=no` above), and launching a
  worker also needs approval because `claude -p` / `codex exec` write state
  outside the workspace. Request approval for the worktree step and each
  worker launch; the user approves them in the Codex UI. Never try to disable
  the sandbox. Headless `codex exec` cannot answer approvals, so it cannot act
  as a `/vpk-remote` planner.
- **Advisor family.** Codex plans on a GPT model, so its own plans go to the
  `opus` advisor; see *Mode: advisor* in SKILL.md.

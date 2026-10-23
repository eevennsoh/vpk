# Claude Executor Reference (Opus 5 / Sonnet 5 via headless claude -p → Proximity)

The Claude lane for `/vpk-remote` workers. Each worker is a headless
`claude -p` process routed to Proximity's `/vertex/claude` endpoint. Verified
end-to-end on 2026-07-31 (Opus 5 at `--effort xhigh` returned correctly with
clean stderr, launched from inside a Claude Code Bash call). Sonnet 5 at
`--effort max` was verified through Proximity on 2026-08-03.

## Preflight

```bash
"$HOME/.local/bin/claude" --version
test -f "$HOME/.claude/settings-gw.json"
curl -fsS --max-time 5 http://localhost:29576/openai/v1/models >/dev/null
```

Failure of any check is a blocker. `settings-gw.json` is user-maintained and
carries the gateway env block (dummy `ANTHROPIC_API_KEY` that satisfies SDK
validation, `ANTHROPIC_BASE_URL`, model defaults, OAuth-disable flags). This
skill references it by path and never copies its contents anywhere.

## Canonical run

Substitute `<model>` (the full Claude ID — resolve aliases and defaults from
`~/.config/litellm-proximity/defaults.env`) and `<effort>`
(`medium` | `high` | `xhigh` | `max`, all verified accepted; `low` works but
is deliberately not offered — see *Choosing effort* in SKILL.md). The model
ID **must be quoted** — `[1m]` is a shell glob pattern.

```bash
worker_root="$PWD/output/remote-claude/worker-1"
mkdir -p "$worker_root"

env -u ANTHROPIC_AUTH_TOKEN -u CLAUDE_CODE_OAUTH_TOKEN -u CLAUDE_EFFORT \
  ANTHROPIC_BASE_URL="http://localhost:29576/vertex/claude" \
  "$HOME/.local/bin/claude" -p --dangerously-skip-permissions \
  --settings "$HOME/.claude/settings-gw.json" \
  --model "claude-opus-5[1m]" --effort high \
  --no-session-persistence \
  < "$worker_root/brief.md" \
  > "$worker_root/report.md" \
  2> "$worker_root/stderr.log"
```

Run via Bash with `run_in_background: true` (a Codex planner runs it in the
foreground; see *Codex as the planner* in SKILL.md). `claude -p` writes its result to
**stdout**, so the stdout redirect is the report channel (the analogue of
codex's `--output-last-message`). Read `stderr.log` only when `report.md`
comes back empty.

Why each layer exists:

- Unsetting `ANTHROPIC_AUTH_TOKEN` / `CLAUDE_CODE_OAUTH_TOKEN` guarantees the
  worker cannot ride an OAuth login, so workers always bill Proximity.
- The parent Claude session **exports its own `ANTHROPIC_BASE_URL` and
  `CLAUDE_EFFORT`** into Bash (observed). Set the gateway URL explicitly and
  unset `CLAUDE_EFFORT` rather than trusting inheritance or settings-file
  precedence.
- `--settings settings-gw.json` supplies the dummy API key,
  `CLAUDE_CODE_FORCE_API_AUTH=1`, `CLAUDE_CODE_DISABLE_OAUTH=1`, and model
  defaults; explicit `--model`/`--effort` flags then pin this run regardless
  of that file's defaults.
- Full path `"$HOME/.local/bin/claude"` plus the external `env` prefix
  bypasses the `claude-gw` zsh function and any alias — wrappers must never
  be invoked from this workflow.
- `--no-session-persistence` keeps one-shot workers out of the resume list.
- `--dangerously-skip-permissions` lets headless implementation edit files
  without prompts, so on **writing briefs the scope boundaries are the only
  guardrail** — write Constraints and Non-goals explicitly. Read-only briefs
  must not use this flag; see *Advisor and read-only consults* below.

## Follow-ups (stateless re-brief)

The default correction path is a fresh `-p` run in the same `worker_root`
whose brief contains: the original goal, the prior report, a summary of the
current diff, and the specific correction. Write it to
`followup-<k>.md` and redirect the new report over `report.md`.

There is no warm-resume contract on this lane: `--no-session-persistence`
intentionally forfeits `--resume`, and headless resume behavior is
unverified. If a long implementation loop needs statefulness, prefer the GPT
lane (codex `resume` is verified) or verify claude resume behavior first and
update this doc.

## Advisor and read-only consults

This lane serves advisor consults at Opus 5 `--effort xhigh` when the work
under review came from the **GPT** lane — see the independence rule in
[advisor-pattern.md](advisor-pattern.md).

**Read-only is enforced, never merely asked for.** Swap
`--dangerously-skip-permissions` for `--permission-mode plan`, which blocks
writes at the tool layer:

```bash
advisor_root="$PWD/output/remote-claude/advisor-1"
mkdir -p "$advisor_root"

env -u ANTHROPIC_AUTH_TOKEN -u CLAUDE_CODE_OAUTH_TOKEN -u CLAUDE_EFFORT \
  ANTHROPIC_BASE_URL="http://localhost:29576/vertex/claude" \
  "$HOME/.local/bin/claude" -p --permission-mode plan \
  --settings "$HOME/.claude/settings-gw.json" \
  --model "claude-opus-5[1m]" --effort xhigh \
  --no-session-persistence \
  < "$advisor_root/brief.md" \
  > "$advisor_root/report.md" \
  2> "$advisor_root/stderr.log"
```

Verified 2026-07-31: a consult explicitly instructed to create a file
refused, and the worktree stayed clean. This matters most for the
pre-completion verify, where the worker's diff is still uncommitted — a
post-consult `git status` cannot tell an advisor's edit from the worker's
own, so the guard has to be enforcement rather than inspection. Keep the
"make no edits" line in the brief and the `git status` check as secondary
signals, not as the mechanism.

The GPT lane's equivalent is `--sandbox read-only`.

## Failure handling

- Empty `report.md` + non-empty `stderr.log` = infrastructure blocker; read
  stderr, re-dispatch once if transient, otherwise report.
- Any auth/OAuth traffic in `stderr.log` means the isolation failed — stop
  and report; do not retry until the cause is understood.
- Model rejection at the gateway is a blocker; never substitute the
  planner's model or login.

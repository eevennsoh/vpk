#!/usr/bin/env bash
# ai-api — launch Claude Code or Codex billed through Proximity (API), any model, any effort.
#
#   ai-api <claude|codex> [--model M] [--effort E]
#          [--resume ID | --continue | --fork ID | --fork-last]
#          [--new-window | --background "task"] [--dry-run] [-- extra app args]
#
# Same-vendor models go straight to Proximity (localhost:29576); cross-vendor models
# (GPT in Claude Code, Claude in Codex) go through the LiteLLM proxy on :4000, which
# is started automatically when needed. Defaults: ~/.config/litellm-proximity/defaults.env
set -euo pipefail

dir="$HOME/.config/litellm-proximity"
# shellcheck source=/dev/null
source "$dir/defaults.env"

die() { echo "ai-api: $*" >&2; exit 2; }

app="${1:-}"; shift || true
[[ "$app" == claude || "$app" == codex ]] || die "first argument must be 'claude' or 'codex'"

model="" effort="" mode="new" sid="" new_window=0 background=0 task="" dry=0 extra=()
set_mode() {
	[[ "$mode" == new ]] || die "choose only one session mode"
	mode="$1"
}
while (($#)); do
	case "$1" in
		--model) model="${2:?}"; shift 2 ;;
		--effort) effort="${2:?}"; shift 2 ;;
		--resume) set_mode resume; sid="${2:?}"; shift 2 ;;
		--continue) set_mode continue; shift ;;
		--fork) set_mode fork; sid="${2:?}"; shift 2 ;;
		--fork-last) set_mode fork-last; shift ;;
		--new-window) new_window=1; shift ;;
		--background) background=1; task="${2:?--background needs a task}"; shift 2 ;;
		--dry-run) dry=1; shift ;;
		--) shift; extra=("$@"); break ;;
		*) die "unknown option '$1'" ;;
	esac
done
((new_window && background)) && die "--new-window and --background are mutually exclusive"

# Resolve model: alias -> full ID; empty -> the app's native default.
if [[ -n "$model" ]]; then
	if [[ "$model" =~ ^[a-zA-Z_][a-zA-Z_0-9]*$ ]]; then
		alias_var="ALIAS_$model"
		model="${!alias_var:-$model}"
	fi
elif [[ "$app" == claude ]]; then model="$CLAUDE_MODEL"
else model="$GPT_MODEL"; fi
[[ "$model" =~ ^(claude-[a-zA-Z0-9.-]+(\[1m\])?|gpt-[a-zA-Z0-9.-]+|o[0-9][a-zA-Z0-9.-]*)$ ]] || die "unsupported model ID or alias"

case "$model" in
	claude-*) family=claude ;;
	gpt-*|o[0-9]*) family=gpt ;;
	*) die "can't tell whether '$model' is a Claude or GPT model" ;;
esac
if [[ -z "$effort" ]]; then
	[[ "$family" == claude ]] && effort="$CLAUDE_EFFORT_DEFAULT" || effort="$GPT_EFFORT_DEFAULT"
fi
case "$effort" in low|medium|high|xhigh|max) ;; *) die "effort must be low|medium|high|xhigh|max" ;; esac

ensure_proxy() {
	((dry)) && { echo "# (would start LiteLLM proxy on :4000)"; return 0; }
	curl -fsS -m 2 http://127.0.0.1:4000/health/liveliness >/dev/null 2>&1 && return 0
	echo "ai-api: starting LiteLLM proxy on 127.0.0.1:4000…" >&2
	local node_start
	node_start="$(type -P node)" || die "node is not installed or not on PATH"
	"$node_start" - "$dir/start.sh" "$dir/proxy.log" <<'JS'
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const log = fs.openSync(process.argv[3], "a", 0o600);
const child = spawn(process.argv[2], [], { detached: true, stdio: ["ignore", log, log] });
child.on("error", () => { process.stderr.write("ai-api: translator could not start\n"); process.exitCode = 1; });
child.unref();
fs.closeSync(log);
JS
	for _ in $(seq 1 40); do
		curl -fsS -m 1 http://127.0.0.1:4000/health/liveliness >/dev/null 2>&1 && return 0
		sleep 0.5
	done
	die "proxy failed to start; see $dir/proxy.log"
}

unset_env=(-u ANTHROPIC_AUTH_TOKEN -u CLAUDE_CODE_OAUTH_TOKEN -u CLAUDE_EFFORT
	-u ANTHROPIC_BASE_URL -u ANTHROPIC_API_KEY -u ANTHROPIC_MODEL -u OPENAI_API_KEY -u CODEX_API_KEY)
cmd=(env "${unset_env[@]}" PATH="$PATH")

if [[ "$app" == claude ]]; then
	if [[ "$family" == claude ]]; then settings="$HOME/.claude/settings-gw.json"
	else ensure_proxy; settings="$dir/claude-settings.json"; fi
	if [[ "$family" == claude ]]; then cmd+=(ANTHROPIC_BASE_URL="http://localhost:29576/vertex/claude"); fi
	cmd+=("$HOME/.local/bin/claude" --settings "$settings" --model "$model" --effort "$effort")
	if ((background)); then
		bg_sid="$(uuidgen | tr 'A-Z' 'a-z')"
		cmd+=(-p --dangerously-skip-permissions --session-id "$bg_sid")
		[[ "$mode" == resume || "$mode" == continue ]] && cmd+=(--fork-session)  # never write into a live session
	fi
	case "$mode" in
		resume) cmd+=(--resume "$sid") ;;
		continue) cmd+=(--continue) ;;
		fork) cmd+=(--resume "$sid" --fork-session) ;;
		fork-last) cmd+=(--continue --fork-session) ;;
	esac
else
	if [[ "$family" == gpt ]]; then
		prov=(-c 'model_provider="openai-gw"'
			-c 'model_providers.openai-gw.name="AI Gateway (Proximity)"'
			-c 'model_providers.openai-gw.base_url="http://localhost:29576/openai/v1"'
			-c 'model_providers.openai-gw.wire_api="responses"'
			-c 'model_providers.openai-gw.requires_openai_auth=false')
	else
		ensure_proxy
		model="${model%\[1m\]}"   # proxy model names carry no context suffix
		prov=(-c 'model_provider="litellm"'
			-c 'model_providers.litellm.name="LiteLLM → Proximity"'
			-c 'model_providers.litellm.base_url="http://127.0.0.1:4000/v1"'
			-c 'model_providers.litellm.env_key="LITELLM_KEY"'
			-c 'model_providers.litellm.wire_api="responses"'
			-c 'model_providers.litellm.supports_websockets=false')
	fi
	sub=()
	((background)) && sub=(exec)
	case "$mode" in
		resume|continue) ((background)) && sub+=(fork) || sub+=(resume) ;;
		fork|fork-last) sub+=(fork) ;;
	esac
	codex_bin="$(type -P codex)" || die "codex is not installed or not on PATH"
	cmd+=("$codex_bin" ${sub[@]+"${sub[@]}"} "${prov[@]}" -m "$model" -c "model_reasoning_effort=\"$effort\"")
	case "$mode" in
		resume|fork) cmd+=("$sid") ;;
		continue|fork-last) cmd+=(--last) ;;
	esac
	((background)) && cmd+=(--json --skip-git-repo-check --sandbox workspace-write --output-last-message "$dir/runs/.last-$$")
fi
cmd+=(${extra[@]+"${extra[@]}"})

echo "ai-api: $app · $model · effort $effort · ${mode}${sid:+ $sid}" >&2
if ((dry)); then printf '%q ' "${cmd[@]}"; echo; exit 0; fi
node_bin="$(type -P node)" || die "node is not installed or not on PATH"
preflight="$dir/bin/vpk-remote-preflight.js"
[[ -f "$preflight" ]] || die "missing preflight helper; run bash scripts/install-vpk-remote.sh from VPK"
"$node_bin" "$preflight" --app "$app" --model "$model" || die "selected route failed preflight; no session launched"
if [[ "$app" == codex && "$family" == claude ]]; then
	export LITELLM_KEY="$(cat "$dir/master_key")"
fi

if ((background)); then
	# Headless run with the full history: nothing opens, a notification fires when done.
	logdir="$dir/runs"; mkdir -p "$logdir"
	stamp="$(date +%Y%m%d-%H%M%S)-$$"
	log="$logdir/$stamp-$app.log"
	summary="$logdir/$stamp-$app.summary.md"
	# Ask the run to verify its own work and finish with a fixed-shape summary.
	brief="$task

---
When the work is done, verify it before you finish:
- In a git repo, run the checks that cover your change: the relevant test file if one exists, plus the repo's lint and typecheck (for example \`pnpm run lint\` and \`pnpm run typecheck\`). Skip checks that do not exist; never invent results.
- Do not claim a check passed unless you ran it and saw it pass.

End your final message with exactly this block and nothing after it:
RESULT: <one line, under 80 characters: what changed, then each check as name ✓ or name ✗, e.g. Fixed sidebar flicker · lint ✓ typecheck ✓>
CHANGED: <files changed, comma-separated, or none>
CHECKS: <each command you ran and its outcome>
NOTES: <anything unfinished, risky, or needing review, or none>"
	(
		last="$logdir/.last-$$"
		if printf '%s\n' "$brief" | "${cmd[@]}" >"$log" 2>&1; then status=0; else status=$?; fi
		if [[ "$app" == claude ]]; then
			reopen="ai-api claude --model $(printf %q "$model") --effort $(printf %q "$effort") --resume $bg_sid"
			cp "$log" "$last" 2>/dev/null   # claude -p prints only the final message
		else
			tid="$(grep -o '"thread_id":"[^"]*"' "$log" | head -1 | cut -d'"' -f4)" || tid=""
			reopen="ai-api codex --model $(printf %q "$model") --effort $(printf %q "$effort")${tid:+ --resume $tid}"
		fi
		# Keep the block from RESULT: onward; fall back to the exit status if it is missing.
		if [[ -f "$last" ]]; then awk '/^RESULT:/{f=1} f' "$last" >"$summary"; else : >"$summary"; fi
		rm -f "$last"
		if [[ -s "$summary" ]]; then
			headline="$(head -1 "$summary" | sed 's/^RESULT:[[:space:]]*//')"
		else
			headline="no summary returned (exit $status) — check the log"
			echo "RESULT: $headline" >"$summary"
		fi
		[[ $status -ne 0 ]] && headline="exit $status · $headline"
		{ echo; echo "--- summary"; cat "$summary"; echo "--- exit $status · reopen with: $reopen"; } >>"$log"
		echo "reopen: $reopen" >>"$summary"
		headline="${headline//\"/\'}"
		osascript -e "display notification \"$headline\" with title \"ai-api · $model\" subtitle \"$(printf %s "$task" | cut -c1-50 | tr '"' "'")\"" >/dev/null 2>&1
	) </dev/null >/dev/null 2>&1 &
	disown
	echo "ai-api: running in the background" >&2
	echo "ai-api: summary will be at $summary" >&2
	exit 0
fi
if ((new_window)); then
	launcher="$(mktemp -t ai-api).command"
	{
		echo '#!/bin/zsh -l'
		echo "cd $(printf %q "$PWD") || exit 1"
		if [[ "$app" == codex && "$family" == claude ]]; then
			printf 'export LITELLM_KEY="$(cat %q)"\n' "$dir/master_key"
		fi
		printf 'exec '; printf '%q ' "${cmd[@]}"; echo
	} >"$launcher"
	chmod 700 "$launcher"
fi
if ((new_window)) && [[ "${HERDR_ENV:-}" == 1 ]]; then
	# Inside herdr: open a tab in the caller's workspace so herdr tracks the agent.
	herdr="${HERDR_BIN_PATH:-herdr}"
	label="api-${model%%\[*}"
	pane="$("$herdr" tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label "$label" --no-focus \
		| python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["root_pane"]["pane_id"])')"
	"$herdr" pane run "$pane" "$(printf '%q' "$launcher")" >/dev/null
	"$herdr" pane rename "$pane" "$label" >/dev/null
	echo "ai-api: opened herdr tab '$label' (pane $pane)" >&2
	exit 0
fi
if ((new_window)); then
	# .command files open in the user's default app for them (Terminal.app unless changed).
	open "$launcher"
	echo "ai-api: opened in a new window of your default terminal (not a Codex sidebar chat); preflight passed, session response not yet verified" >&2
	exit 0
fi
exec "${cmd[@]}"

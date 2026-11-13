#!/usr/bin/env bash
#
# Bootstrap worktree dependencies and env for local agent worktrees.
#
# Shared by:
#   - Claude Code SessionStart hooks
#   - Cursor .cursor/worktrees.json setup-worktree
#   - Codex + Superset setup scripts (explicit env prefix, or the
#     CODEX_*/SUPERSET_* fallbacks below)
#
# Mirrors the Codex setup-script behavior for local worktrees by delegating to
# the shared bootstrap helper:
#   - ignored .env* files are copied from another local worktree when available.
#   - node_modules is warmed from a matching source checkout when possible,
#     falling back to CI=true pnpm install --prefer-offline.
#
# Wired via .claude/settings.json -> hooks.SessionStart with
# matcher: "startup", so this fires once when a new session enters a
# worktree (or the main worktree) and no-ops on /compact, /clear, resume.
#
# Claude hook output contract:
#   - Installer noise -> stderr (visible in terminal, NOT injected into
#     Claude's context window — keeps the first turn lean).
#   - One short status line -> structured hookSpecificOutput JSON, which
#     becomes additionalContext for Claude on session start. Skipped
#     entirely when there is nothing to report. Non-Claude callers only get
#     human-readable stderr/stdout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
. "$SCRIPT_DIR/lib/worktree-bootstrap.sh"

IS_CLAUDE_HOOK=0
CLAUDE_SESSION_CHECKOUT=""

# The shared .git directory, resolved, so two checkouts of one repository compare equal.
git_common_dir() {
	local common_dir

	common_dir="$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 1
	(cd "$common_dir" && pwd -P)
}

if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
	IS_CLAUDE_HOOK=1
	# A worktree session started from the desktop app keeps CLAUDE_PROJECT_DIR on
	# the main checkout; the session's own checkout is the payload's cwd. Without
	# this the hook bootstrapped main and left the worktree with main's ports.
	# Claude closes stdin after the payload; the timeout keeps any other caller
	# that leaves the pipe open from hanging the hook.
	HOOK_INPUT=""
	[ -t 0 ] || IFS= read -r -d '' -t 2 HOOK_INPUT || true
	if [[ "$HOOK_INPUT" =~ \"cwd\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]]; then
		SESSION_CWD="${BASH_REMATCH[1]}"
		# Only a checkout of this repository: a cwd inside a nested clone, a
		# submodule, or another folder added to the session is not bootstrapped.
		SESSION_COMMON_DIR="$(git_common_dir "$SESSION_CWD" || true)"
		if [ -n "$SESSION_COMMON_DIR" ] && [ "$SESSION_COMMON_DIR" = "$(git_common_dir "$CLAUDE_PROJECT_DIR" || true)" ]; then
			CLAUDE_SESSION_CHECKOUT="$(git -C "$SESSION_CWD" rev-parse --show-toplevel 2>/dev/null || true)"
		fi
	fi
fi

PROJECT_DIR="${PROJECT_DIR:-${CODEX_WORKTREE_PATH:-${SUPERSET_WORKSPACE_PATH:-${CURSOR_WORKTREE_PATH:-${CLAUDE_SESSION_CHECKOUT:-${CLAUDE_PROJECT_DIR:-$PWD}}}}}}"
SOURCE_TREE_PATH="${SOURCE_TREE_PATH:-${CODEX_SOURCE_TREE_PATH:-${SUPERSET_ROOT_PATH:-${CURSOR_SOURCE_TREE_PATH:-}}}}"

vpk_bootstrap_worktree "$PROJECT_DIR" "$SOURCE_TREE_PATH"

# Preview ports differ per checkout, so .claude/launch.json is generated rather than tracked.
# stdout is reserved for the hook JSON below; best-effort so a failure never blocks startup.
if [ "$IS_CLAUDE_HOOK" -eq 1 ] && [ -f "$PROJECT_DIR/scripts/write-claude-launch-config.js" ]; then
	(cd "$PROJECT_DIR" && node scripts/write-claude-launch-config.js) >&2 || true
fi

# Close agent browsers control-vpk recorded whose owning session has ended (there is no
# session-end hook). Detached and best-effort, so it never delays or fails startup.
CONTROL_VPK="$PROJECT_DIR/.agents/skills/vpk-verify/scripts/control-vpk"
if [ -f "$CONTROL_VPK" ] && command -v node >/dev/null 2>&1; then
	(cd "$PROJECT_DIR" && nohup node "$CONTROL_VPK" cleanup --orphaned-browsers </dev/null >/dev/null 2>&1 &) || true
fi

# Under memory pressure, one line on swap, dev stacks and which one to stop (R-8). It reads
# memory live and the stacks from the cache the sweep, `pnpm run mem --brief` and
# `pnpm run check` write (~0.1 s); it prints nothing otherwise and never stops anything.
if [ "$IS_CLAUDE_HOOK" -eq 1 ] && [ -f "$PROJECT_DIR/scripts/machine-state.js" ] && command -v node >/dev/null 2>&1; then
	MACHINE_LINE="$(cd "$PROJECT_DIR" && node scripts/machine-state.js --hook 2>/dev/null || true)"
	[ -n "$MACHINE_LINE" ] && VPK_BOOTSTRAP_MESSAGES+=("$MACHINE_LINE")
fi

if [ "$IS_CLAUDE_HOOK" -eq 1 ] && [ ${#VPK_BOOTSTRAP_MESSAGES[@]} -gt 0 ]; then
	CONTEXT="${VPK_BOOTSTRAP_MESSAGES[*]}"
	CONTEXT_ESCAPED=$(printf '%s' "$CONTEXT" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n')
	cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$CONTEXT_ESCAPED"
  }
}
EOF
fi

exit 0

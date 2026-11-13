#!/usr/bin/env bash

set -euo pipefail

# Lightweight tmux launcher for the plain dev stack (frontend + backend via
# `pnpm run dev`, no Rovo Serve pool), run THROUGH `portless run` so each
# worktree gets a stable .localhost URL. Companion to scripts/dev-tmux.sh, which
# owns the heavier `rovo:tmux:*` 8-pane session.
#
# Why this exists separately:
#   - It only needs `pnpm run dev`, so it has none of the Rovo billing/port-pool
#     prerequisites of dev-tmux.sh.
#   - It runs on a private tmux socket, which keeps the dev server alive across
#     terminal/session boundaries without touching the user's default server.

REPO_ROOT="$(pwd)"
FRONTEND_PORT_FILE=".dev-frontend-port"
BACKEND_PORT_FILE=".dev-backend-port"
SOCKET="${VPK_TMUX_SOCKET:-vpk-dev}"
# The session's pane output is copied here, so a dev-server error can be read
# without attaching. One previous run is kept as dev.previous.log.
DEV_LOG_DIR="${VPK_DEV_LOG_DIR:-$REPO_ROOT/output/logs/$(basename "$REPO_ROOT")}"
DEV_LOG_FILE="$DEV_LOG_DIR/dev.log"
# scripts/lib/dev-log-filter.js masks secret-shaped values and keeps the file under this size.
DEV_LOG_MAX_BYTES="${VPK_DEV_LOG_MAX_BYTES:-20971520}"

# Resolve a tmux binary: an explicit override first, then common install
# locations, then a PATH lookup.
resolve_tmux() {
	local candidate
	for candidate in "${VPK_TMUX_BIN:-}" /opt/homebrew/bin/tmux /usr/local/bin/tmux /usr/bin/tmux; do
		if [[ -n "$candidate" && -x "$candidate" ]]; then
			printf '%s' "$candidate"
			return 0
		fi
	done

	local path_tmux
	path_tmux="$(command -v tmux 2>/dev/null || true)"
	if [[ -n "$path_tmux" ]]; then
		printf '%s' "$path_tmux"
		return 0
	fi

	return 1
}

TMUX_BIN="$(resolve_tmux || true)"
if [[ -z "$TMUX_BIN" ]]; then
	echo "No standalone tmux binary found." >&2
	echo "Install tmux (e.g. 'brew install tmux') or set VPK_TMUX_BIN to its path." >&2
	exit 1
fi

# All tmux invocations go through the private socket so we never touch a managed
# server.
tm() {
	"$TMUX_BIN" -L "$SOCKET" "$@"
}

# Per-worktree session name so parallel worktrees don't collide on one socket.
resolve_session_name() {
	node - <<'NODE'
const { getWorktreeName } = require("./scripts/lib/worktree-ports");

const sanitizeToken = (value, fallback) => {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
	return normalized.length > 0 ? normalized : fallback;
};

const explicitName = process.env.VPK_DEV_TMUX_SESSION;
if (typeof explicitName === "string" && explicitName.trim().length > 0) {
	process.stdout.write(explicitName.trim());
	process.exit(0);
}

const prefix = sanitizeToken(process.env.VPK_DEV_TMUX_SESSION_PREFIX || "vpk-dev", "vpk-dev");
const worktree = sanitizeToken(getWorktreeName() || "main", "main");
process.stdout.write(`${prefix}-${worktree}`);
NODE
}

# Resolve the extra args for `portless run` for this worktree: empty on main or a
# branched worktree (vanilla portless derives the URL), or `--name <dir>` when
# HEAD is detached. Shared logic lives in scripts/lib/worktree-ports.js.
resolve_portless_args() {
	node - <<'NODE'
const { getPortlessRunArgs } = require("./scripts/lib/worktree-ports");
process.stdout.write(getPortlessRunArgs().join(" "));
NODE
}

# Print the worktree's stable Portless URL by matching the running frontend port
# against ~/.portless/routes.json via the shared helper (skips stale routes).
resolve_portless_url() {
	node - <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const { loadPortlessRoutes, findPortlessUrl } = require("./scripts/lib/portless-routes");
try {
	const port = fs.readFileSync(path.join(process.cwd(), ".dev-frontend-port"), "utf8").trim();
	const url = findPortlessUrl(loadPortlessRoutes(), port);
	if (url) process.stdout.write(url);
} catch {
	// Best effort — no URL line if portless isn't routing this worktree.
}
NODE
}

check_workspace_deps() {
	node scripts/check-workspace-deps.js --command "pnpm run dev:tmux:start" portless concurrently next express --bin portless --bin concurrently
}

SESSION_NAME="$(resolve_session_name)"
REPO_ROOT_PHYSICAL="$(pwd -P)"
FORCE_START=0

# One stack per worktree: sessions are matched to this worktree by their start directory, not
# by name. A name follows the branch (or the directory when HEAD is detached), so a renamed or
# newly checked-out branch would otherwise start a second session and next-server beside the
# first.
sessions_for_worktree() {
	local name spath
	tm list-sessions -F '#{session_name}|#{session_path}' 2>/dev/null | while IFS='|' read -r name spath; do
		[[ -n "$name" ]] || continue
		if [[ "$spath" == "$REPO_ROOT" || "$spath" == "$REPO_ROOT_PHYSICAL" ]]; then
			printf '%s\n' "$name"
		fi
	done
}

# Use an existing session for this worktree even when it carries another name.
adopt_worktree_session() {
	local name
	tm has-session -t "$SESSION_NAME" 2>/dev/null && return 0
	while IFS= read -r name; do
		[[ -n "$name" ]] || continue
		echo "Adopting tmux session '$name' for this worktree (this checkout would name it '$SESSION_NAME')."
		SESSION_NAME="$name"
		return 0
	done < <(sessions_for_worktree)
	return 0
}

stop_named_session() {
	local name="$1"
	# Send Ctrl-C first so `portless run` runs its own SIGINT cleanup and removes THIS worktree's
	# route from ~/.portless/routes.json before the session is killed. (tmux kill-session sends
	# SIGHUP, which portless does not trap, so the route would otherwise linger until a manual
	# prune.) This is scoped to this worktree, unlike the global `portless prune`.
	tm send-keys -t "$name" C-c 2>/dev/null || true
	sleep 1
	tm kill-session -t "$name" 2>/dev/null || true
	echo "Stopped tmux session '$name' (socket: $SOCKET)."
}

# Stop every other session whose start directory is this worktree.
stop_duplicate_sessions() {
	local name
	while IFS= read -r name; do
		[[ -n "$name" && "$name" != "$SESSION_NAME" ]] || continue
		echo "Stopping duplicate tmux session '$name' for this worktree."
		stop_named_session "$name"
	done < <(sessions_for_worktree)
}

# Machine-wide budget before a new stack starts (scripts/lib/dev-stack-budget.js).
check_stack_budget() {
	local args=(check --worktree "$REPO_ROOT")
	if [[ "$FORCE_START" == "1" ]]; then
		args+=(--force)
	fi
	VPK_TMUX_BIN="$TMUX_BIN" node scripts/lib/dev-stack-budget.js "${args[@]}"
}

# Seed .env.local the same way the non-tmux launchers do, preferring the main
# worktree's copy and falling back to the example file.
seed_env_local() {
	node - <<'NODE'
const { ensureEnvLocalExists } = require("./scripts/lib/env-local");
const result = ensureEnvLocalExists({ cwd: process.cwd() });
if (result.createdFrom === "main-worktree") {
	console.log(`[dev:tmux] Created .env.local from main worktree: ${result.mainWorktreePath}`);
} else if (result.createdFrom === "example") {
	console.log("[dev:tmux] Created .env.local from .env.local.example");
}
NODE
}

read_port() {
	if [[ -f "$1" ]]; then
		tr -d '[:space:]' <"$1"
	fi
	return 0
}

port_is_listening() {
	local port="$1"
	[[ -n "$port" ]] && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

session_frontend_is_listening() {
	local port
	port="$(read_port "$FRONTEND_PORT_FILE")"
	port_is_listening "$port"
}

# Poll until the frontend records a port AND that port is actually listening.
# Prints the port on success; prints whatever was recorded (possibly empty) and
# returns 1 on timeout.
wait_for_frontend() {
	local attempts="${VPK_DEV_TMUX_WAIT:-90}"
	local port=""
	local i
	for ((i = 0; i < attempts; i++)); do
		port="$(read_port "$FRONTEND_PORT_FILE")"
		if port_is_listening "$port"; then
			printf '%s' "$port"
			return 0
		fi
		sleep 1
	done
	printf '%s' "$port"
	return 1
}

print_endpoints() {
	local fe="$1" be url
	be="$(read_port "$BACKEND_PORT_FILE")"
	url="$(resolve_portless_url)"
	echo ""
	if [[ -n "$url" ]]; then
		echo "  🌐 Portless: $url"
	fi
	if [[ -n "$fe" ]]; then
		echo "  ▲ Frontend: http://localhost:$fe"
	fi
	if [[ -n "$be" ]]; then
		echo "  ⚙ Backend:  http://localhost:$be"
	fi
	echo ""
}

print_controls() {
	echo "  Logs:        $DEV_LOG_FILE"
	echo "  Attach:      $TMUX_BIN -L $SOCKET attach -t $SESSION_NAME   (detach: Ctrl-b then d)"
	echo "               pnpm run dev:tmux:attach"
	echo "  Stop:        pnpm run dev:tmux:stop"
}

launch_session() {
	check_workspace_deps
	# Clear stale port files so wait_for_frontend doesn't latch onto a dead
	# port from a previous run.
	rm -f "$FRONTEND_PORT_FILE" "$BACKEND_PORT_FILE"
	seed_env_local
	local portless_args
	portless_args="$(resolve_portless_args)"
	tm new-session -d -s "$SESSION_NAME" -c "$REPO_ROOT"
	mkdir -p "$DEV_LOG_DIR"
	[[ -f "$DEV_LOG_FILE" ]] && mv -f "$DEV_LOG_FILE" "$DEV_LOG_DIR/dev.previous.log"
	# pipe-pane copies what the pane prints without changing the command it runs; the
	# filter masks secrets and caps the file. Absolute paths: the tmux server's PATH may
	# be another worktree's.
	local node_bin
	node_bin="$(command -v node)"
	tm pipe-pane -t "$SESSION_NAME" -o "'$node_bin' '$REPO_ROOT/scripts/lib/dev-log-filter.js' --out '$DEV_LOG_FILE' --max-bytes '$DEV_LOG_MAX_BYTES'"
	# Launch the dev stack THROUGH portless so this worktree gets a stable
	# .localhost URL. `portless run` with no command runs the package.json
	# "dev" script (frontend + backend); ${portless_args} adds `--name <dir>`
	# only when HEAD is detached.
	tm send-keys -t "$SESSION_NAME" "cd \"$REPO_ROOT\" && CI=true pnpm exec portless run ${portless_args}" C-m
	echo "Started tmux session '$SESSION_NAME' (socket: $SOCKET)."
}

start_session() {
	adopt_worktree_session
	stop_duplicate_sessions
	if tm has-session -t "$SESSION_NAME" 2>/dev/null; then
		if session_frontend_is_listening; then
			echo "Session '$SESSION_NAME' already running (socket: $SOCKET)."
		else
			echo "Session '$SESSION_NAME' exists but has no listening frontend port. Restarting it..."
			stop_session
			check_stack_budget || exit $?
			launch_session
		fi
	else
		check_stack_budget || exit $?
		launch_session
	fi

	echo "Waiting for the frontend to come up..."
	local port
	if port="$(wait_for_frontend)"; then
		print_endpoints "$port"
	else
		echo "Frontend hasn't reported a listening port yet — check the logs:"
	fi
	print_controls
	# The URL to open is the last line, so a caller (or an agent) can take it with `tail -1`.
	local final_url=""
	if [[ -n "${port:-}" ]]; then
		final_url="$(resolve_portless_url)"
		if [[ -z "$final_url" ]]; then
			final_url="http://localhost:$port"
		fi
		echo "$final_url"
	fi
}

stop_session() {
	adopt_worktree_session
	if tm has-session -t "$SESSION_NAME" 2>/dev/null; then
		stop_named_session "$SESSION_NAME"
	else
		echo "No tmux session '$SESSION_NAME' on socket '$SOCKET'."
	fi
	stop_duplicate_sessions
	# Backstop: stop any listener still bound to this exact worktree (cwd-scoped,
	# never touches other worktrees). Best-effort: never fail the stop.
	node ./scripts/cleanup-worktree-listeners.js || true
	rm -f "$FRONTEND_PORT_FILE" "$BACKEND_PORT_FILE"
}

attach_session() {
	adopt_worktree_session
	if tm has-session -t "$SESSION_NAME" 2>/dev/null; then
		exec "$TMUX_BIN" -L "$SOCKET" attach -t "$SESSION_NAME"
	fi
	echo "No tmux session '$SESSION_NAME' on socket '$SOCKET'. Start it with: pnpm run dev:tmux:start"
	exit 1
}

status_session() {
	adopt_worktree_session
	echo "Session: $SESSION_NAME"
	echo "Socket:  $SOCKET"
	echo "tmux:    $TMUX_BIN"
	if tm has-session -t "$SESSION_NAME" 2>/dev/null; then
		echo "State:   running"
		tm list-panes -t "$SESSION_NAME" -F "  pane #{pane_index}: #{pane_current_command}"
	else
		echo "State:   stopped"
	fi
	local fe be
	fe="$(read_port "$FRONTEND_PORT_FILE")"
	be="$(read_port "$BACKEND_PORT_FILE")"
	echo "Frontend port: ${fe:-missing}"
	echo "Backend port:  ${be:-missing}"
}

usage() {
	echo "Usage: $0 [start|stop|attach|status]"
	echo ""
	echo "Runs the plain dev stack (pnpm run dev) through portless in a detached"
	echo "tmux session on a private socket, kept alive independently of the"
	echo "launching terminal. Prints the worktree's stable .localhost URL."
	echo ""
	echo "Commands:"
	echo "  start   Start (or report) the session, then print the Portless URL + ports (default)."
	echo "          One session per worktree path: a session started under another name is adopted,"
	echo "          extra ones are stopped. A new stack checks the machine-wide budget first;"
	echo "          start --force (or VPK_DEV_FORCE=1) starts over budget."
	echo "  stop    Kill the session (letting portless remove this worktree's route) and remove its dev port files"
	echo "  attach  Attach to the running session (Ctrl-b then d to detach)"
	echo "  status  Show session and port state"
	echo ""
	echo "Environment overrides:"
	echo "  VPK_TMUX_BIN               Path to the tmux binary to use"
	echo "  VPK_TMUX_SOCKET            Private socket name (default: vpk-dev)"
	echo "  VPK_DEV_TMUX_SESSION       Exact session name override"
	echo "  VPK_DEV_TMUX_SESSION_PREFIX Prefix for the auto session name (default: vpk-dev)"
}

command="${1:-start}"
if [[ "$command" == "--" ]]; then
	shift
	command="${1:-start}"
fi
[[ $# -gt 0 ]] && shift
for arg in "$@"; do
	case "$arg" in
		--force) FORCE_START=1 ;;
		--) ;;
		*)
			echo "Unknown option: $arg"
			usage
			exit 1
			;;
	esac
done
if [[ "${VPK_DEV_FORCE:-0}" == "1" ]]; then
	FORCE_START=1
fi

case "$command" in
	start) start_session ;;
	stop) stop_session ;;
	attach) attach_session ;;
	status) status_session ;;
	-h | --help | help) usage ;;
	*)
		echo "Unknown command: $command"
		usage
		exit 1
		;;
esac

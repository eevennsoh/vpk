#!/usr/bin/env bash
printf '%s\n' "$*" >> "${FAKE_TMUX_LOG:-/dev/null}"
state="${FAKE_TMUX_STATE:-/dev/null}"

fake_serve() {
	set -- ${FAKE_READY_PORTS:-}
	[ "$#" -eq 2 ] || return 0
	printf '%s' "$1" > .dev-frontend-port; printf '%s' "$2" > .dev-backend-port
	printf '%s %s\n' "$1" "$2" >> "${FAKE_LISTEN_FILE:-/dev/null}"
}

# resolve_session <name-or-prefix> <exact:0|1>: print the one session it names.
resolve_session() {
	local name="$1" exact="$2" matches
	if [ -f "$state" ] && grep -q "^${name}|" "$state"; then echo "$name"; return 0; fi
	if [ "$exact" = 0 ] && [ -f "$state" ]; then
		matches=$(cut -d'|' -f1 "$state" | grep "^${name}")
		if [ -n "$matches" ] && [ "$(printf '%s\n' "$matches" | wc -l | tr -d ' ')" = 1 ]; then echo "$matches"; return 0; fi
	fi
	if [ "${FAKE_TMUX_HAS_SESSION:-0}" = 1 ]; then echo "$name"; return 0; fi
	echo "can't find session: $name" >&2
	return 1
}

session_target() {
	local t="${1%%:*}"
	if [ "${t#=}" != "$t" ]; then resolve_session "${t#=}" 1; else resolve_session "$t" 0; fi
}

window_target() {
	local t="$1"
	[ -n "$t" ] || { echo "current"; return 0; }
	if [ "${t#=}" != "$t" ] && [ "${t#*:}" = "$t" ]; then
		echo "no such window: $t" >&2
		return 1
	fi
	session_target "$t"
}

command_name=""; target=""; name=""; dir="$PWD"; rest=()
while [ "$#" -gt 0 ]; do
	case "$1" in
		-L|-S|-f) shift 2 ;;
		-t) target="$2"; shift 2 ;;
		-s) name="$2"; shift 2 ;;
		-c) dir="$2"; shift 2 ;;
		-F|-n|-T) shift 2 ;;
		-*) shift ;;
		*)
			if [ -z "$command_name" ]; then command_name="$1"; else rest+=("$1"); fi
			shift ;;
	esac
done

# FAKE_TMUX_FAIL=<command>: that command fails, as a real tmux error would.
if [ -n "${FAKE_TMUX_FAIL:-}" ] && [ "$command_name" = "$FAKE_TMUX_FAIL" ]; then
	echo "fake tmux: $command_name failed" >&2
	exit 1
fi

case "$command_name" in
	has-session|kill-session|attach|attach-session|list-windows)
		session=$(session_target "$target") || exit 1 ;;
	send-keys|pipe-pane|list-panes|set-option|set|set-window-option|setw|select-pane|split-window|select-layout|display-message|new-window)
		session=$(window_target "$target") || exit 1 ;;
esac

case "$command_name" in
	new-session) printf '%s|%s\n' "$name" "$dir" >> "$state" ;;
	kill-session) [ -f "$state" ] && { grep -v "^${session}|" "$state" > "$state.next" || true; mv "$state.next" "$state"; } ;;
	list-sessions) [ -f "$state" ] && cat "$state" ;;
	list-panes) echo "  pane 0: bash" ;;
	send-keys)
		for arg in "${rest[@]}"; do
			case "$arg" in
				*"portless run"*) echo "$session" >> "${FAKE_SERVER_LOG:-/dev/null}"; fake_serve ;;
				*dev-rovo-port.js*|*dev:frontend*|*dev:backend*) echo "$session" >> "${FAKE_SERVER_LOG:-/dev/null}" ;;
			esac
		done ;;
esac
exit 0

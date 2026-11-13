#!/bin/zsh
# vpk-system-clean.sh
# Keeps a 24/7 Mac from drowning in local-development churn. Seven guards:
#  1. RUNAWAY DEV SERVER (CPU): a `next-server` stuck at high CPU is a
#     Turbopack watch/recompile thrash loop. Detected by sampling CPU twice so a
#     normal bursty compile is NOT mistaken for a runaway. Killed (with its
#     `next dev` parent) so it can be restarted clean. This is the live "fix".
#  2. BLOATED DEV SERVER (MEMORY): a `next-server` IDLING at multi-GB memory is
#     a leaking server (arm64 MAP_JIT leak). Measured as vmmap Physical
#     footprint, NOT ps RSS — the JIT/native mappings barely count toward RSS
#     (an 11.1GB-footprint server showed 0.19GB RSS). A healthy compile burst
#     can also peak in the double digits before Turbopack's eviction reclaims
#     it (observed 12.9GB -> 1.7GB in one run), so CPU is sampled across a
#     settle window and the server is only killed if still bloated AND its
#     median CPU sample is idle — an idle server holding this much memory is
#     the leak; a busy one is a normal burst. Killed (with its `next dev`
#     parent) to restart clean. Under memory pressure (swap or the kernel
#     pressure level past a limit) the bloat limit drops, the idle-CPU limit
#     rises, and Codex stacks count as idle sooner.
#  3. IDLE DEV STACKS (PORTS): leftover `vpk-dev-*` tmux sessions whose
#     worktree still exists keep next-server, Express, and Portless routes
#     bound. Stopped only when unattached, older than a grace window, and not
#     the primary checkout. Occupancy is a running executable named exactly
#     `claude`, `caffeinate`, `lazygit`, `cursor-agent`, or `codex` whose cwd
#     is that worktree — worktree directory names are ignored. Uses the
#     worktree's own `dev-tmux-plain.sh stop` (SIGINT so Portless drops THIS
#     route). A Codex Desktop worktree is stopped only when the read-only
#     thread-recency probe finds every Codex thread for that exact cwd idle
#     past its threshold; no thread, no database, or an unknown schema keeps
#     it. Never
#     `portless prune`. Legacy sessions on tmux's default socket get SIGINT
#     and an exact kill-session; their worktree launcher owns a different socket.
#  4. RUNAWAY .next CACHES: Turbopack's .next/dev grows unbounded (15GB seen);
#     every file feeds macOS FSEvents and amplifies the thrash. Deleted PER
#     WORKTREE when over threshold AND that worktree has no live dev server (each
#     running server's cwd is matched to the cache's worktree root) — so idle
#     caches are reclaimed even while OTHER worktrees keep a live build. Idle
#     stacks are stopped first so their caches can be reclaimed in the same run.
#  5. STALE TMUX SESSIONS: when a worktree directory is deleted, the
#     `vpk-dev-<worktree>` session is orphaned. Killed when its path is gone
#     AND no client is attached (SIGINT then kill-session; no Portless prune).
#  6. RUNAWAY ALMD: Atlassian's /usr/local/bin/almd can get stuck consuming a
#     CPU core for hours. Restarted only after exact-path verification, a
#     minimum process age, and three sustained-hot samples. Its user LaunchAgent
#     retries it automatically.
#  7. fseventsd LEAK: the FS-events daemon leaks CPU/RAM over long uptimes
#     (22GB seen). Restarted if ballooned (needs the sudoers rule from install).
#
# Safe unattended: never deletes a live build's cache, and only kills a process
# that matches its exact guard conditions. Each run appends a parseable
# "summary:" line.
set -u
setopt NULL_GLOB

# launchd gives a bare PATH. Append common bins so `node` is found without
# shadowing a caller-provided PATH (tests put fakes first).
export PATH="${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}:/opt/homebrew/bin:/usr/local/bin"

LOG="$HOME/Library/Logs/vpk-system-clean.log"
NEXT_MAX_GB=3            # delete .next only once it grows past this
FSEVENTS_MAX_MB=2048     # restart fseventsd only above this RSS
NEXT_CPU_HOT=150         # a next-server sustained above this %CPU is a runaway
KILL_RUNAWAY_NEXT=1      # 1 = kill sustained-hot dev servers; 0 = report only
NEXT_MEM_MAX_GB=6        # a next-server above this physical footprint (GB) is bloated/leaking
KILL_BLOATED_NEXT=1      # 1 = kill bloated dev servers; 0 = report only
NEXT_MEM_SETTLE_SECS=30  # settle window before re-checking a bloated candidate
NEXT_MEM_IDLE_CPU_MAX=20 # median %CPU below which a still-bloated server counts as idle (leak, not a compile burst)
NEXT_MEM_IDLE_SAMPLES=5  # CPU samples spread across the settle window; their median decides idle
# Memory-pressure mode (values provisional). Entered when swap in use or the
# kernel memory-pressure level reaches these. It lowers the bloat limit, raises
# the idle-CPU limit (a real compile runs at 100%+), and uses the Codex probe's
# shorter idle threshold. `--pressure-check` runs the sweep only in this mode.
PRESSURE_SWAP_USED_GB=16          # swap in use (GB) that enters pressure mode
PRESSURE_LEVEL_MIN=4              # kern.memorystatus_vm_pressure_level: 1 normal, 2 warn, 4 critical
PRESSURE_NEXT_MEM_MAX_GB=4        # NEXT_MEM_MAX_GB in pressure mode
PRESSURE_NEXT_MEM_IDLE_CPU_MAX=50 # NEXT_MEM_IDLE_CPU_MAX in pressure mode
ALMD_PATH="/usr/local/bin/almd"
ALMD_CPU_HOT=50          # minimum %CPU for every sample before almd is reset
ALMD_MIN_AGE_SECS=900    # never reset almd during its first 15 minutes
ALMD_SAMPLE_COUNT=3      # three observations avoid treating a brief burst as runaway
ALMD_SAMPLE_SECS=10      # 20-second confirmation window after the first sample
ALMD_TERM_GRACE_SECS=5   # allow graceful exit before a guarded SIGKILL fallback
KILL_RUNAWAY_ALMD=1      # 1 = reset sustained-hot almd; 0 = report only
IDLE_STACK_MIN_AGE_SECS=1800  # leftover stacks younger than 30m are still warming
KILL_IDLE_STACKS=1       # 1 = stop idle unattached leftover stacks; 0 = report only
# Read-only Codex thread-recency probe; install.sh copies it next to this
# script. Its IDLE_HOURS (PRESSURE_IDLE_HOURS in pressure mode) is the Codex
# idle threshold.
CODEX_RECENCY_PROBE="${0:A:h}/codex-thread-recency.js"

# --pressure-check: exit quietly unless the machine is under memory pressure
#   (run often from its own LaunchAgent; the full sweep keeps its schedule).
# --print-mode: print `pressure|<reasons>` or `normal|<readings>` and exit;
#   status.sh uses it so the thresholds live only here.
PRESSURE_CHECK_ONLY=0; PRINT_MODE_ONLY=0
for arg in "$@"; do
	case "$arg" in
		--pressure-check) PRESSURE_CHECK_ONLY=1 ;;
		--print-mode) PRINT_MODE_ONLY=1 ;;
		*) print -u2 -- "vpk-system-clean: unknown flag $arg (use --pressure-check or --print-mode)"; exit 2 ;;
	esac
done

# Whole GB of swap in use, from `used = 37580.80M`; empty when unreadable.
swap_used_gb() {
	sysctl -n vm.swapusage 2>/dev/null | awk '{
		for (i = 1; i < NF; i++) if ($i == "used") {
			v = $(i + 2); u = substr(v, length(v)); n = v + 0
			if (u == "G") print int(n); else if (u == "M") print int(n / 1024); else if (u == "K") print 0
			exit
		}
	}'
}

PRESSURE=0
swap_gb=$(swap_used_gb)
pressure_level=$(sysctl -n kern.memorystatus_vm_pressure_level 2>/dev/null | tr -d '[:space:]')
pressure_reasons=()
[[ "$swap_gb" == <-> ]] && (( swap_gb >= PRESSURE_SWAP_USED_GB )) && pressure_reasons+="swap ${swap_gb}GB in use >= ${PRESSURE_SWAP_USED_GB}GB"
[[ "$pressure_level" == <-> ]] && (( pressure_level >= PRESSURE_LEVEL_MIN )) && pressure_reasons+="memory-pressure level ${pressure_level} >= ${PRESSURE_LEVEL_MIN}"
if (( ${#pressure_reasons} )); then
	PRESSURE=1
	MODE_LINE="pressure|${(j:, :)pressure_reasons}"
	NEXT_MEM_MAX_GB=$PRESSURE_NEXT_MEM_MAX_GB
	NEXT_MEM_IDLE_CPU_MAX=$PRESSURE_NEXT_MEM_IDLE_CPU_MAX
else
	MODE_LINE="normal|swap ${swap_gb:-unknown}GB in use, memory-pressure level ${pressure_level:-unknown}"
fi
MODE_NOTE="${MODE_LINE%%|*} mode (${MODE_LINE#*|})"
if (( PRINT_MODE_ONLY )); then
	print -r -- "$MODE_LINE"
	exit 0
fi
(( PRESSURE_CHECK_ONLY && ! PRESSURE )) && exit 0

resolve_repo_root() {
	local root
	if [[ -n "${VPK_REPO_ROOT:-}" ]]; then
		print -r -- "$VPK_REPO_ROOT"
		return 0
	fi
	root=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
	print -r -- "$root"
}

MAIN_WORKTREE=$(resolve_repo_root) || {
	print -u2 -- "vpk-system-clean: run from the repository or set VPK_REPO_ROOT"
	exit 1
}

NEXT_DIRS=( "$MAIN_WORKTREE/.next" )
for worktree_root in ${(f)"$(git -C "$MAIN_WORKTREE" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p')"}; do
	NEXT_DIRS+=( "$worktree_root/.next" )
done
NEXT_DIRS+=( "$HOME"/.superset/worktrees/*/*/.next )

ts() { date "+%Y-%m-%d %H:%M:%S"; }
log() { print -r -- "[$(ts)] $*" >> "$LOG"; }
cpu_of() { ps -o %cpu= -p "$1" 2>/dev/null | tr -d ' '; }   # decaying avg %CPU
exe_of() { lsof -a -d txt -p "$1" -Fn 2>/dev/null | sed -n 's/^n//p' | head -1; }
elapsed_secs_of() {
	local raw days=0 hours=0 minutes=0 seconds=0
	local -a parts
	raw=$(ps -o etime= -p "$1" 2>/dev/null | tr -d '[:space:]')
	[[ -n "$raw" ]] || return 1
	if [[ "$raw" == *-* ]]; then
		days="${raw%%-*}"
		raw="${raw#*-}"
	fi
	parts=( ${(s/:/)raw} )
	case ${#parts} in
		3) hours="${parts[1]}"; minutes="${parts[2]}"; seconds="${parts[3]}" ;;
		2) minutes="${parts[1]}"; seconds="${parts[2]}" ;;
		*) return 1 ;;
	esac
	print -- $(( days * 86400 + hours * 3600 + minutes * 60 + seconds ))
}
# Whole GB of real memory. vmmap Physical footprint is the truth for the MAP_JIT
# leak (ps RSS undercounts it ~50x); ~1s per pid is fine for a scheduled sweep.
# Falls back to ps RSS if vmmap is unavailable or fails.
mem_gb_of() {
	local gb
	gb=$(vmmap -summary "$1" 2>/dev/null | awk '/^Physical footprint:/{v=$3; u=substr(v,length(v)); if (u=="G") print int(v+0); else print 0; exit}')
	if [[ -n "$gb" ]]; then
		print -r -- "$gb"
	else
		ps -o rss= -p "$1" 2>/dev/null | awk '{print int($1/1024/1024)}'
	fi
}
cwd_of() { lsof -a -d cwd -p "$1" -Fn 2>/dev/null | sed -n 's/^n//p' | head -1; }

tmux_cmd() {
	local socket="$1"
	shift
	if [[ "$socket" == "default" ]]; then
		tmux "$@"
	else
		tmux -L "$socket" "$@"
	fi
}

# Occupancy: a process whose *executable name* is one of these, and whose cwd
# is this worktree. Worktree folder/session names are not consulted.
# Do not broaden to agent-browser leftovers or ChatGPT.app Codex helpers.
worktree_has_operator() {
	local root="$1" p c
	local -a pids
	pids=(
		${(f)"$(pgrep -x claude 2>/dev/null)"}
		${(f)"$(pgrep -x caffeinate 2>/dev/null)"}
		${(f)"$(pgrep -x lazygit 2>/dev/null)"}
		${(f)"$(pgrep -x cursor-agent 2>/dev/null)"}
		${(f)"$(pgrep -x codex 2>/dev/null)"}
	)
	for p in $pids; do
		[[ -n "$p" ]] || continue
		c=$(cwd_of "$p")
		[[ -n "$c" ]] || continue
		[[ "$c" == "$root" || "$c" == "$root/"* ]] && return 0
	done
	return 1
}

is_codex_desktop_worktree() {
	local root="$1"
	[[ "$root" == "$HOME/.codex/worktrees/"* ]] && return 0
	[[ -n "${CODEX_HOME:-}" && "$root" == "$CODEX_HOME/worktrees/"* ]] && return 0
	return 1
}

# Prints `verdict|newest_age_secs|thread_count|reason` for the Codex threads
# whose cwd is exactly this worktree. Anything but `idle` means keep the stack.
codex_thread_recency() {
	local root="$1" line=""
	local -a pressure_flag=()
	(( PRESSURE )) && pressure_flag=( --pressure )
	if [[ -f "$CODEX_RECENCY_PROBE" ]]; then
		line=$(node "$CODEX_RECENCY_PROBE" --cwd "$root" $pressure_flag 2>/dev/null | head -1)
	fi
	if [[ "$line" != *"|"*"|"*"|"* ]]; then
		line="unknown|-|-|thread-recency probe unavailable at $CODEX_RECENCY_PROBE"
	fi
	print -r -- "$line"
}

stop_idle_stack() {
	local socket="$1" sname="$2" spath="$3"
	local stop_script="$spath/scripts/dev-tmux-plain.sh"
	if [[ "$socket" == "default" ]]; then
		# The plain launcher uses the private vpk-dev socket. Calling it for a
		# legacy default-socket session could stop a newer stack in this worktree.
		tmux_cmd default send-keys -t "$sname" C-c 2>/dev/null || true
		sleep 1
		tmux_cmd default kill-session -t "$sname" 2>/dev/null
		return $?
	fi
	if [[ -f "$stop_script" ]]; then
		if (cd "$spath" && VPK_DEV_TMUX_SESSION="$sname" /bin/bash "$stop_script" stop) >/dev/null 2>&1; then
			return 0
		fi
		return 1
	fi
	tmux_cmd "$socket" send-keys -t "$sname" C-c 2>/dev/null || true
	sleep 1
	tmux_cmd "$socket" kill-session -t "$sname" 2>/dev/null
}

# Keep the log bounded on a 24/7 box (cap ~500 lines).
if [[ -f "$LOG" ]] && (( $(wc -l < "$LOG") > 500 )); then
	tail -n 200 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

log "run start"
log "mode: $MODE_NOTE; bloat limit ${NEXT_MEM_MAX_GB}GB, idle below median ${NEXT_MEM_IDLE_CPU_MAX}% CPU"
freed=0; count=0; killed=0; bloated=0; almd_resets=0; idle_stopped=0; stale_killed=0

# --- 1. runaway dev server -----------------------------------------------------
# First pass: which next-server pids are hot right now?
hot1=()
for p in ${(f)"$(pgrep -f 'next-server' 2>/dev/null)"}; do
	c=$(cpu_of "$p"); [[ -n "$c" ]] || continue
	(( ${c%%.*} >= NEXT_CPU_HOT )) && hot1+="$p"
done
# Second pass after a short settle: still hot => genuine runaway, not a burst.
if (( ${#hot1} )); then
	sleep 4
	for p in $hot1; do
		c=$(cpu_of "$p"); [[ -n "$c" ]] || continue
		if (( ${c%%.*} >= NEXT_CPU_HOT )); then
			if (( KILL_RUNAWAY_NEXT )); then
				pp=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
				kill "$p" 2>/dev/null
				[[ -n "$pp" && "$pp" != 1 ]] && kill "$pp" 2>/dev/null
				killed=$(( killed + 1 ))
				log "killed runaway next-server pid $p (~${c}% CPU, parent $pp) — restart dev server to recover"
			else
				log "runaway next-server pid $p (~${c}% CPU) — KILL_RUNAWAY_NEXT=0, left running"
			fi
		fi
	done
fi

# --- 2. bloated dev server -----------------------------------------------------
# First pass: which next-server pids are over the memory threshold right now?
# Measured as vmmap Physical footprint — ps RSS misses the MAP_JIT leak.
server_where() {
	local c
	c=$(cwd_of "$1")
	if [[ -n "$c" && ( "$c" == "$MAIN_WORKTREE" || "$c" == "$MAIN_WORKTREE/"* ) ]]; then
		print -r -- "primary checkout $c"
	else
		print -r -- "${c:-cwd unknown}"
	fi
}
bloat1=()
for p in ${(f)"$(pgrep -f 'next-server' 2>/dev/null)"}; do
	gb=$(mem_gb_of "$p"); [[ -n "$gb" ]] || continue
	if (( gb >= NEXT_MEM_MAX_GB )); then
		bloat1+="$p"
	else
		log "kept next-server pid $p (~${gb}GB < ${NEXT_MEM_MAX_GB}GB bloat limit; $(server_where "$p"))"
	fi
done
# Second pass: sample CPU NEXT_MEM_IDLE_SAMPLES times across the settle window
# and kill only if still bloated AND the median sample is idle. One sample at a
# hard edge deferred a 9GB idle server at 20.1%; a busy compile burst (100%+)
# is still not a leak, even at double-digit GB.
if (( ${#bloat1} )); then
	typeset -A cpu_samples
	sample_gap=$(( NEXT_MEM_SETTLE_SECS / NEXT_MEM_IDLE_SAMPLES ))
	for (( round = 1; round <= NEXT_MEM_IDLE_SAMPLES; round++ )); do
		sleep "$sample_gap"
		for p in $bloat1; do
			c=$(cpu_of "$p")
			[[ -n "$c" ]] && cpu_samples[$p]="${cpu_samples[$p]:-} $c"
		done
	done
	for p in $bloat1; do
		samples=( ${=cpu_samples[$p]:-} )
		gb=$(mem_gb_of "$p")
		if [[ -z "$gb" ]] || (( ${#samples} == 0 )); then
			log "next-server pid $p exited during the settle window"
			continue
		fi
		sorted=( ${(on)samples} )
		median="${sorted[$(( (${#sorted} + 1) / 2 ))]}"
		window="median ${median}% CPU over ${#samples} samples [${(j:, :)samples}]"
		where=$(server_where "$p")
		if (( gb >= NEXT_MEM_MAX_GB )) && (( ${median%%.*} < NEXT_MEM_IDLE_CPU_MAX )); then
			bloated=$(( bloated + 1 ))
			if (( KILL_BLOATED_NEXT )); then
				pp=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
				kill "$p" 2>/dev/null
				[[ -n "$pp" && "$pp" != 1 ]] && kill "$pp" 2>/dev/null
				log "killed bloated next-server pid $p (~${gb}GB physical footprint, idle: ${window} < ${NEXT_MEM_IDLE_CPU_MAX}%, parent $pp; ${where}; ${MODE_LINE%%|*} mode) — restart dev server to recover"
			else
				log "bloated next-server pid $p (~${gb}GB physical footprint, idle: ${window}; ${where}) — KILL_BLOATED_NEXT=0, left running"
			fi
		elif (( gb < NEXT_MEM_MAX_GB )); then
			log "kept next-server pid $p (settled to ~${gb}GB < ${NEXT_MEM_MAX_GB}GB; ${where})"
		else
			log "kept next-server pid $p (~${gb}GB but busy: ${window} >= ${NEXT_MEM_IDLE_CPU_MAX}%; ${where}) — deferred to next sweep"
		fi
	done
fi

# --- 3. idle leftover stacks + 5. orphaned tmux sessions ----------------------
# Walk vpk-dev-* sessions on both sockets. Orphans (worktree path gone) are
# SIGINT + kill-session. Leftover stacks whose path still exists are stopped
# through that worktree's own stop script so Portless drops this route only.
# Keep attached sessions, the primary checkout, stacks still in their grace
# window, and worktrees with a matching tool process cwd.
tmux_action="not-checked"
if command -v tmux >/dev/null 2>&1; then
	now_epoch=$(date +%s)
	for socket in default vpk-dev; do
		socket_stale=0
		socket_idle=0
		rows=( ${(f)"$(tmux_cmd "$socket" list-sessions -F '#{session_name}|#{session_path}|#{session_attached}|#{session_created}' 2>/dev/null)"} )
		for row in $rows; do
			sname="${row%%|*}"; rest="${row#*|}"
			spath="${rest%%|*}"; rest="${rest#*|}"
			sattached="${rest%%|*}"; screated="${rest##*|}"
			[[ -n "$sname" ]] || continue
			[[ "$sname" == vpk-dev-* ]] || continue
			if [[ -z "$spath" ]]; then
				spath=$(tmux_cmd "$socket" display-message -t "$sname" -p '#{pane_current_path}' 2>/dev/null)
			fi

			if [[ -z "$spath" || ! -d "$spath" ]]; then
				if [[ "$sattached" == 1 ]]; then
					log "kept tmux session $sname on $socket socket (orphaned path '${spath:-}' but attached)"
					continue
				fi
				tmux_cmd "$socket" send-keys -t "$sname" C-c 2>/dev/null || true
				sleep 1
				if tmux_cmd "$socket" kill-session -t "$sname" 2>/dev/null; then
					stale_killed=$(( stale_killed + 1 ))
					socket_stale=$(( socket_stale + 1 ))
					log "killed stale tmux session $sname on $socket socket (worktree path '${spath:-}' gone)"
				else
					log "FAILED to kill tmux session $sname on $socket socket"
				fi
				continue
			fi

			if [[ "$sattached" == 1 ]]; then
				log "kept tmux session $sname on $socket socket (attached)"
				continue
			fi
			if [[ "$sname" == "vpk-dev-main" || "$spath" == "$MAIN_WORKTREE" ]]; then
				log "kept tmux session $sname on $socket socket (primary checkout)"
				continue
			fi
			if [[ -z "$screated" || "$screated" == "0" ]]; then
				log "kept tmux session $sname on $socket socket (unknown age)"
				continue
			fi
			sage=$(( now_epoch - screated ))
			if (( sage < IDLE_STACK_MIN_AGE_SECS )); then
				log "kept tmux session $sname on $socket socket (${sage}s old < ${IDLE_STACK_MIN_AGE_SECS}s minimum)"
				continue
			fi
			if worktree_has_operator "$spath"; then
				log "kept tmux session $sname on $socket socket (tool process cwd is '$spath')"
				continue
			fi
			codex_note=""
			if is_codex_desktop_worktree "$spath"; then
				recency=$(codex_thread_recency "$spath")
				verdict="${recency%%|*}"
				reason="${recency##*|}"
				if [[ "$verdict" != "idle" ]]; then
					log "kept tmux session $sname on $socket socket (Codex threads $verdict: $reason)"
					continue
				fi
				codex_note="; Codex threads idle: $reason"
			fi
			if (( ! KILL_IDLE_STACKS )); then
				log "idle tmux session $sname on $socket socket ('$spath', ${sage}s old${codex_note}) — KILL_IDLE_STACKS=0, left running"
				continue
			fi
			if stop_idle_stack "$socket" "$sname" "$spath"; then
				idle_stopped=$(( idle_stopped + 1 ))
				socket_idle=$(( socket_idle + 1 ))
				log "stopped idle tmux session $sname on $socket socket (worktree '$spath', ${sage}s old${codex_note})"
			else
				log "FAILED to stop idle tmux session $sname on $socket socket (worktree '$spath')"
			fi
		done
		log "checked tmux socket $socket (${socket_stale} stale session(s) killed, ${socket_idle} idle stack(s) stopped)"
	done
	tmux_action="checked default+vpk-dev sockets; ${stale_killed} stale session(s) killed; ${idle_stopped} idle stack(s) stopped"
fi

# --- 4. .next cleanup (per-worktree) ------------------------------------------
# Map each running dev server to the worktree it serves (by its cwd), then
# delete only the .next caches whose OWN worktree has no live server. This keeps
# the "never touch a live build" guarantee while still reclaiming idle caches —
# the previous all-or-nothing skip freed nothing whenever any server was up.
busy_roots=()
for p in ${(f)"$(pgrep -f 'next dev|next-server' 2>/dev/null)"}; do
	c=$(cwd_of "$p"); [[ -n "$c" ]] && busy_roots+="$c"
done

for nx in ${(u)NEXT_DIRS}; do
	[[ -d "$nx" ]] || continue
	root="${nx:h}"                       # worktree root = parent dir of .next
	busy=0
	for b in $busy_roots; do
		# busy if a live server's cwd is this worktree root or nested under it
		[[ "$b" == "$root" || "$b" == "$root/"* ]] && { busy=1; break; }
	done
	if (( busy )); then
		log "kept $nx (dev server live in this worktree)"
		continue
	fi
	gb=$(du -sg "$nx" 2>/dev/null | awk '{print $1}'); gb=${gb:-0}
	if (( gb >= NEXT_MAX_GB )); then
		if rm -rf "$nx"; then
			freed=$(( freed + gb )); count=$(( count + 1 )); log "removed $nx (${gb}G, no live server)"
		else
			log "FAILED to remove $nx"
		fi
	else
		log "kept $nx (${gb}G < ${NEXT_MAX_GB}G)"
	fi
done

# --- 6. runaway almd ----------------------------------------------------------
# almd is a user LaunchAgent that retries every five minutes. Reset only the
# exact deployed binary, only after it is old enough to be past startup work,
# and only when every sample in a 20-second window remains hot.
almd_action="not-running"
almd_pids=( ${(f)"$(pgrep -x almd 2>/dev/null)"} )
if (( ${#almd_pids} )); then
	almd_action="ok"
	for p in $almd_pids; do
		exe=$(exe_of "$p")
		if [[ "$exe" != "$ALMD_PATH" ]]; then
			almd_action="kept-unrecognized"
			log "kept almd pid $p (unexpected executable '${exe:-unknown}', expected $ALMD_PATH)"
			continue
		fi

		age=$(elapsed_secs_of "$p"); age=${age:-0}
		if (( age < ALMD_MIN_AGE_SECS )); then
			almd_action="warming"
			log "kept almd pid $p (${age}s old < ${ALMD_MIN_AGE_SECS}s minimum)"
			continue
		fi

		c=$(cpu_of "$p"); [[ -n "$c" ]] || continue
		(( ${c%%.*} >= ALMD_CPU_HOT )) || continue

		sustained=1
		for (( sample = 2; sample <= ALMD_SAMPLE_COUNT; sample++ )); do
			sleep "$ALMD_SAMPLE_SECS"
			if [[ "$(exe_of "$p")" != "$ALMD_PATH" ]]; then
				sustained=0
				almd_action="exited-during-check"
				break
			fi
			c=$(cpu_of "$p"); [[ -n "$c" ]] || { sustained=0; break; }
			if (( ${c%%.*} < ALMD_CPU_HOT )); then
				sustained=0
				almd_action="settled"
				log "kept almd pid $p (settled to ${c}% CPU during confirmation)"
				break
			fi
		done

		(( sustained )) || continue
		if (( ! KILL_RUNAWAY_ALMD )); then
			almd_action="hot-report-only"
			log "runaway almd pid $p (~${c}% CPU, ${age}s old) — KILL_RUNAWAY_ALMD=0, left running"
			continue
		fi

		if ! kill "$p" 2>/dev/null; then
			almd_action="reset-failed"
			log "FAILED to terminate runaway almd pid $p (~${c}% CPU, ${age}s old)"
			continue
		fi

		signal="TERM"
		sleep "$ALMD_TERM_GRACE_SECS"
		if kill -0 "$p" 2>/dev/null; then
			if [[ "$(exe_of "$p")" != "$ALMD_PATH" ]] || ! kill -9 "$p" 2>/dev/null; then
				almd_action="reset-failed"
				log "FAILED to force-stop runaway almd pid $p after TERM"
				continue
			fi
			signal="KILL"
		fi

		almd_resets=$(( almd_resets + 1 ))
		almd_action="reset ${almd_resets}"
		log "stopped runaway almd pid $p with $signal (~${c}% CPU, ${age}s old; LaunchAgent will retry)"
	done
	(( almd_resets > 0 )) && almd_action="reset ${almd_resets}"
fi

# --- 7. fseventsd reset --------------------------------------------------------
fse_action="not-checked"
fp=$(pgrep -x fseventsd | head -1)
if [[ -n "$fp" ]]; then
	rss=$(ps -o rss= -p "$fp" 2>/dev/null | awk '{print int($1/1024)}'); rss=${rss:-0}
	if (( rss > FSEVENTS_MAX_MB )); then
		if /usr/bin/sudo -n /usr/bin/pkill -x fseventsd 2>/dev/null; then
			fse_action="restarted (was ${rss}MB)"; log "restarted fseventsd (was ${rss}MB; auto-respawns)"
		else
			fse_action="skipped-no-sudoers (${rss}MB)"; log "fseventsd at ${rss}MB but no passwordless sudo -> skipped"
		fi
	else
		fse_action="ok (${rss}MB)"; log "fseventsd ok (${rss}MB <= ${FSEVENTS_MAX_MB}MB)"
	fi
fi

log "summary: ${MODE_LINE%%|*} mode; killed ${killed} runaway server(s); bloated ${bloated} server(s); freed ${freed}G from ${count} cache(s); tmux ${tmux_action}; almd ${almd_action}; fseventsd ${fse_action}"
log "run done"

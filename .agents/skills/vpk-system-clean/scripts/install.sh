#!/bin/zsh
# install.sh — (re)install or repair the vpk-system-clean maintenance setup.
# Idempotent; safe to run any time. The skill is the source of truth: this copies
# the canonical script into place and GENERATES the launchd plist for the current
# user (so the versioned skill stays free of machine-specific absolute paths).
#
# Schedule is read from a persisted config (written by schedule.sh) so repairs
# preserve the user's chosen timer instead of resetting it. Default: daily 04:17.
#
# It deliberately never runs sudo. The fseventsd-restart privilege is granted
# once by the user via the printed sudoers commands — least privilege.
set -u
setopt NULL_GLOB

SKILL_DIR="${0:A:h:h}"                        # .../vpk-system-clean
SRC_SH="$SKILL_DIR/scripts/vpk-system-clean.sh"
DST_SH="$HOME/.local/bin/vpk-system-clean.sh"
SRC_PROBE="$SKILL_DIR/scripts/codex-thread-recency.js"
DST_PROBE="$HOME/.local/bin/codex-thread-recency.js"
USER_ID="$(id -un)"
LABEL="com.${USER_ID}.vpk-system-clean"
DST_PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
SUDOERS="/etc/sudoers.d/vpk-system-clean"
SCHED_CONF="$HOME/.config/vpk-system-clean/schedule.env"
REPO_ROOT="$(git -C "$SKILL_DIR" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | head -1)"
if [[ -z "$REPO_ROOT" ]]; then
	print -u2 -- "✗ could not resolve the primary checkout from $SKILL_DIR"
	exit 1
fi

mkdir -p "$HOME/.local/bin" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cp "$SRC_SH" "$DST_SH" && chmod +x "$DST_SH" && echo "✓ script -> $DST_SH"
# The sweep looks for its Codex thread-recency probe next to itself.
cp "$SRC_PROBE" "$DST_PROBE" && chmod 644 "$DST_PROBE" && echo "✓ probe  -> $DST_PROBE"

# --- resolve schedule ---------------------------------------------------------
MODE="daily"; HOUR=4; MINUTE=17; INTERVAL=21600; TIMES=""
if [[ -f "$SCHED_CONF" ]]; then
	source "$SCHED_CONF"
fi

if [[ "$MODE" == "interval" ]]; then
	SCHED_XML="	<key>StartInterval</key>
	<integer>${INTERVAL}</integer>"
	SCHED_HUMAN="every ${INTERVAL}s"
elif [[ "$MODE" == "times" ]]; then
	entries=""; human=""
	for t in ${=TIMES}; do
		h=${t%%:*}; m=${t##*:}
		entries+="		<dict><key>Hour</key><integer>${h}</integer><key>Minute</key><integer>${m}</integer></dict>
"
		human+=$(printf "%02d:%02d " "$h" "$m")
	done
	SCHED_XML="	<key>StartCalendarInterval</key>
	<array>
${entries}	</array>"
	SCHED_HUMAN="daily at ${human}"
else
	SCHED_XML="	<key>StartCalendarInterval</key>
	<dict>
		<key>Hour</key><integer>${HOUR}</integer>
		<key>Minute</key><integer>${MINUTE}</integer>
	</dict>"
	SCHED_HUMAN=$(printf "daily at %02d:%02d" "$HOUR" "$MINUTE")
fi

# --- generate plist for this user/home ---------------------------------------
cat > "$DST_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${LABEL}</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/zsh</string>
		<string>${DST_SH}</string>
	</array>
	<key>WorkingDirectory</key>
	<string>${REPO_ROOT}</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>VPK_REPO_ROOT</key>
		<string>${REPO_ROOT}</string>
	</dict>
${SCHED_XML}
	<key>RunAtLoad</key>
	<false/>
	<key>StandardOutPath</key>
	<string>${HOME}/Library/Logs/vpk-system-clean.out.log</string>
	<key>StandardErrorPath</key>
	<string>${HOME}/Library/Logs/vpk-system-clean.err.log</string>
</dict>
</plist>
PLIST
echo "✓ plist  -> $DST_PLIST  (${SCHED_HUMAN})"

if ! plutil -lint "$DST_PLIST" >/dev/null; then
	echo "✗ plist failed validation — aborting load"; exit 1
fi

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
if launchctl bootstrap "gui/$(id -u)" "$DST_PLIST"; then
	echo "✓ launchd agent loaded ($LABEL, ${SCHED_HUMAN})"
else
	echo "✗ launchd bootstrap failed"; exit 1
fi

if [[ -f "$SUDOERS" ]]; then
	echo "✓ sudoers rule present ($SUDOERS)"
else
	echo ""
	echo "⚠ sudoers rule missing — the nightly fseventsd reset will be skipped."
	echo "  Run these THREE commands once (they need your password):"
	echo ""
	echo "    echo '${USER_ID} ALL=(root) NOPASSWD: /usr/bin/pkill -x fseventsd' | sudo tee $SUDOERS >/dev/null"
	echo "    sudo chmod 440 $SUDOERS"
	echo "    sudo visudo -c"
	echo ""
fi

echo "Done."

#!/bin/zsh
# uninstall.sh — remove everything vpk-system-clean installed on this machine.
# Knows every location install/schedule created and tears it down in one pass.
#
# Flags:
#   --dry-run   show what would be removed, change nothing
#   --logs      also delete the run logs (default: keep them as records)
#
# Two things it does NOT auto-remove (by design): the root-owned sudoers rule
# (prints the sudo command) and the skill source dir it is running from (prints
# the path). Everything else is removed directly.
set -u
setopt NULL_GLOB

DRY=0; RM_LOGS=0
for a in "$@"; do
	case "$a" in
		--dry-run) DRY=1 ;;
		--logs)    RM_LOGS=1 ;;
		*) print -- "unknown flag: $a (use --dry-run, --logs)"; exit 1 ;;
	esac
done

USER_ID="$(id -un)"
LABEL="com.${USER_ID}.vpk-system-clean"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
SCRIPT="$HOME/.local/bin/vpk-system-clean.sh"
PROBE="$HOME/.local/bin/codex-thread-recency.js"
CONF_DIR="$HOME/.config/vpk-system-clean"
SUDOERS="/etc/sudoers.d/vpk-system-clean"
SKILL_DIR="${0:A:h:h}"
LOGS=(
	"$HOME/Library/Logs/vpk-system-clean.log"
	"$HOME/Library/Logs/vpk-system-clean.out.log"
	"$HOME/Library/Logs/vpk-system-clean.err.log"
)

act() {  # act <description> <command>
	if (( DRY )); then print -- "would: $1"
	else eval "$2" >/dev/null 2>&1 && print -- "✓ $1" || print -- "… $1 (already gone)"; fi
}

print -- "vpk-system-clean uninstall${DRY:+ (dry-run)}"
print -- ""

# 1. launchd agent (stop the schedule)
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
	act "unload launchd agent $LABEL" "launchctl bootout gui/$(id -u)/$LABEL"
else
	print -- "• launchd agent not loaded"
fi

# 2. plist
[[ -f "$PLIST" ]] && act "remove plist  $PLIST" "rm -f '$PLIST'" || print -- "• no plist"

# 3. live script
[[ -f "$SCRIPT" ]] && act "remove script $SCRIPT" "rm -f '$SCRIPT'" || print -- "• no installed script"
[[ -f "$PROBE" ]] && act "remove probe  $PROBE" "rm -f '$PROBE'" || print -- "• no installed probe"

# 4. schedule config
[[ -d "$CONF_DIR" ]] && act "remove config $CONF_DIR" "rm -rf '$CONF_DIR'" || print -- "• no schedule config"

# 5. logs — kept unless --logs
if (( RM_LOGS )); then
	for l in $LOGS; do [[ -f "$l" ]] && act "remove log   $l" "rm -f '$l'"; done
else
	for l in $LOGS; do [[ -f "$l" ]] && print -- "• kept log $l  (pass --logs to delete)"; done
fi

# 6. sudoers rule — root-owned, never auto-removed
if [[ -f "$SUDOERS" ]]; then
	print -- ""
	print -- "⚠ sudoers rule present — remove it yourself (needs your password):"
	print -- "    sudo rm -f $SUDOERS && sudo visudo -c"
fi

# 7. the skill source itself
print -- ""
print -- "Skill source (the uninstaller lives here, so it's left in place):"
print -- "    $SKILL_DIR"
print -- "To delete the skill entirely:  rm -rf '$SKILL_DIR'   (commit if tracked)"

print -- ""
(( DRY )) && print -- "Dry run only — nothing was changed." || print -- "Done — live cleanup automation removed."

# Maintenance details

Read this reference for thresholds and tuning, schedule management, launchd and
sudoers repair, cleanup records, or uninstall behavior. The scripts directory is
canonical; install copies the guard to `~/.local/bin/` and generates the
per-user `com.<user>.vpk-system-clean` LaunchAgent.

## Detection thresholds and guards

The top of `scripts/vpk-system-clean.sh` defines:

- `NEXT_CPU_HOT` (150): sustained CPU percentage that marks `next-server` hot.
- `KILL_RUNAWAY_NEXT` (1): set to 0 to report without restarting CPU runaways.
- `NEXT_MEM_MAX_GB` (6): `vmmap` physical-footprint threshold for a bloated
  server candidate. Healthy Next 16.3 servers are generally low single-digit
  GB; a busy compile may peak higher, so the script settles and requires idle
  CPU on its second sample.
- `KILL_BLOATED_NEXT` (1): set to 0 to report memory candidates only.
- `NEXT_MAX_GB` (3): minimum `.next` cache size for deletion, and only while no
  dev server uses that cache.
- `ALMD_CPU_HOT` (50): CPU floor across all three samples.
- `ALMD_MIN_AGE_SECS` (900): protects the first 15 minutes after `almd` starts.
- `KILL_RUNAWAY_ALMD` (1): set to 0 for report-only behavior.
- `FSEVENTS_MAX_MB` (2048): RSS threshold for restarting `fseventsd`.
- `IDLE_STACK_MIN_AGE_SECS` (1800): leftover `vpk-dev-*` stacks younger than
  30 minutes are treated as still warming and are not stopped.
- `KILL_IDLE_STACKS` (1): set to 0 to report idle leftover stacks without
  stopping them. The primary checkout (`vpk-dev-main`, resolved from Git),
  attached sessions, and worktrees that still have a process named exactly
  `claude`, `caffeinate`, `lazygit`, `cursor-agent`, or `codex` whose cwd is
  that directory are always kept. The unattended idle-stack pass also keeps
  Codex Desktop worktrees because task activity is not visible through process
  cwd. Use the task-aware ports-only workflow in `SKILL.md` to stop one
  deliberately.
  Worktree folder names are ignored.

Do not replace the Next memory measure with `ps` RSS. The observed arm64
`MAP_JIT` leak lives in JIT/native mappings: an 11.1 GB physical-footprint
process was visible as roughly 0.19 GB RSS.

To tune, edit the canonical script values, review the guard interaction, then
rerun install so the installed copy matches source:

```bash
zsh scripts/install.sh
zsh scripts/status.sh
```

If a legitimate compile is repeatedly restarted, raise `NEXT_CPU_HOT` or set
`KILL_RUNAWAY_NEXT=0` and rely on doctor-driven remediation. If an agent
worktree is stopped while still warming up, raise `IDLE_STACK_MIN_AGE_SECS`
or set `KILL_IDLE_STACKS=0`. Do not weaken the resampling, idle-state,
executable-path, cache-liveness, tool-process-cwd, or artifact guards.

## Schedule

`scripts/schedule.sh` persists configuration to
`~/.config/vpk-system-clean/schedule.env` and reapplies install:

```bash
zsh scripts/schedule.sh 03:30
zsh scripts/schedule.sh every 6h
zsh scripts/schedule.sh show
```

Intervals have a 10-minute minimum. A frequent interval such as `every 2h` may
catch recurring runaway servers sooner than a nightly job. Confirm the saved and
live schedule with `show` and then `scripts/status.sh`.

## Install and launchd repair

`scripts/install.sh` is idempotent. It copies the canonical sweep, generates and
validates the plist for the current user, honors the saved schedule, reloads the
LaunchAgent, and checks the `fseventsd` sudoers rule. The generated LaunchAgent
stores the repository root as its working directory and `VPK_REPO_ROOT`, so the
installed script does not depend on the checkout directory name.

```bash
zsh scripts/install.sh
zsh scripts/status.sh
```

The skill itself never runs `sudo`. When the rule is missing, install prints the
commands for the user. The rule must whitelist exactly:

```text
/usr/bin/pkill -x fseventsd
```

This least-privilege command lets the scheduled sweep restart only the named
daemon, which macOS respawns. Without the rule, a bloated daemon is logged and
skipped. A user may run `sudo pkill -x fseventsd` for an immediate one-off reset,
then follow install's printed repair commands and confirm with status.

If launchd is absent or stale, use install rather than manually composing a
plist. Verify the generated agent, loaded schedule, installed script, log path,
and sudoers result through `scripts/status.sh`.

## Records and log inspection

`scripts/records.sh` aggregates total runs, servers restarted, caches removed,
approximate GB reclaimed, orphaned tmux sessions stopped, idle leftover stacks
stopped, `almd` resets, `fseventsd` resets, and the last eight runs.

```bash
zsh scripts/records.sh
zsh scripts/records.sh --removed
zsh scripts/records.sh --raw
```

Use `--removed` for each cache path and `--raw` for the full log. The scheduled
log lives at `~/Library/Logs/vpk-system-clean.log`. A successful sweep may have
no stdout; status and records are the authoritative inspection surfaces when the
user asks for deeper proof.

## What the sweep is allowed to affect

The sweep may act on sustained-hot or settled-bloated `next-server`, its
`next dev` parent, leftover unattached `vpk-dev-*` stacks (through the
worktree launcher on the private socket, or SIGINT and an exact session stop
on tmux's legacy default socket), qualifying inactive `.next` caches, orphaned
unattached `vpk-dev-*` tmux sessions on their discovered socket, old
sustained-hot exact `/usr/local/bin/almd`, and over-threshold `fseventsd` with
the sudoers guard.

It never targets `artifacts/**`, active build caches, attached tmux sessions,
the primary checkout, worktrees with a matching tool-process cwd, the
Portless proxy, other worktrees' routes, `atlassian-otel-collector`, Jamf,
osquery, Apple `ecosystem*` services, or merely similar process names. The sweep
resolves the primary checkout from `VPK_REPO_ROOT` or the current Git checkout,
then enumerates registered worktrees through `git worktree list`. Superset
worktrees remain an additional discovered cache family.

The idle-stack pass additionally keeps Codex Desktop worktrees until a
task-aware manual check confirms the port stack is unused. Other sweep guards,
such as proven runaway or bloated `next-server`, still apply to their servers.

## Uninstall

Preview first:

```bash
zsh scripts/uninstall.sh --dry-run
zsh scripts/uninstall.sh
zsh scripts/uninstall.sh --logs
```

Uninstall removes the generated LaunchAgent/plist, installed local script, and
schedule configuration. Logs remain unless `--logs` is passed. It cannot remove
the root-owned sudoers rule; it prints the explicit user command for that
separate action. It also does not remove the skill source directory from which
it runs.

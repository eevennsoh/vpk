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
- `NEXT_MEM_IDLE_SAMPLES` (5) and `NEXT_MEM_IDLE_CPU_MAX` (20): a bloated
  candidate's CPU is sampled five times across `NEXT_MEM_SETTLE_SECS`; it
  counts as idle when the median sample is below the limit. One sample at a
  hard edge once deferred an idle 9 GB server at 20.1%.
- `KILL_BLOATED_NEXT` (1): set to 0 to report memory candidates only.
- Pressure mode (values provisional): entered when swap in use reaches
  `PRESSURE_SWAP_USED_GB` (16) or `kern.memorystatus_vm_pressure_level`
  reaches `PRESSURE_LEVEL_MIN` (4, critical; level 2 "warn" is common on a
  healthy machine). It sets the bloat limit to `PRESSURE_NEXT_MEM_MAX_GB` (4),
  the idle-CPU limit to `PRESSURE_NEXT_MEM_IDLE_CPU_MAX` (50), and asks the
  Codex probe for `PRESSURE_IDLE_HOURS` (6). Every run logs its mode, and each
  `next-server` and stack it keeps with the reason. Install adds a second
  LaunchAgent, `com.<user>.vpk-system-clean.pressure`, that runs the sweep
  with `--pressure-check` every 300 seconds; that exits at once unless the
  machine is under pressure. `--print-mode` prints the mode only.
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
  that directory are always kept. A Codex Desktop worktree is stopped only
  when `scripts/codex-thread-recency.js` returns `idle` for its exact cwd.
  Worktree folder names are ignored.
- `IDLE_HOURS` (24) and `PRESSURE_IDLE_HOURS` (6), both provisional, at the
  top of `scripts/codex-thread-recency.js`: a Codex worktree is idle once every
  thread whose cwd is that worktree was last updated at least this long ago.
  The probe opens Codex's newest `state_N.sqlite` read-only; no matching
  thread, a missing database, or an unrecognised schema returns `unknown`,
  which keeps the stack. Install copies the probe next to the installed sweep.

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

The idle-stack pass additionally keeps a Codex Desktop worktree unless the
thread-recency probe finds every thread for its cwd idle. Other sweep guards,
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

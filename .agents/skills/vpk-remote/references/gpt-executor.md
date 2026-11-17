# GPT Executor Reference (Sol/Terra/Luna via Codex CLI → Proximity)

The GPT lane for `/vpk-remote` workers. Each worker is a `codex exec` process
in a background Bash call, routed to Proximity's localhost gateway with an
isolated per-worker `CODEX_HOME`. The contract is intentionally
self-contained: it does not rely on the user's aliases, `~/.codex/config.toml`,
or login state. Flags verified against **codex-cli 0.166.0** (2026-11-17:
`codex exec --help`, `codex exec resume --help`, and real runs of the
canonical command through Proximity); re-run them and update this doc if a
newer CLI drifts.

## Preflight

```bash
codex --version
node scripts/vpk-remote-preflight.js --app codex --model <resolved-model-id>
```

Use the exact requested model after resolving aliases from `defaults.env`.
The helper validates streaming tool transport on the selected inference route;
model discovery is not a health gate. On failure, preserve the actual code and
message, stop before worker dispatch, and follow the root skill's repair rules.

## Canonical first run

Substitute `<model>` (the full GPT ID — resolve aliases and defaults from
`~/.config/litellm-proximity/defaults.env`) and
`<effort>` (`medium` | `high` | `xhigh` | `max`; `low` is accepted by the CLI
but deliberately not offered by this skill — see
[invocation-flags-and-effort.md § Choosing effort](invocation-flags-and-effort.md#choosing-effort)) from the dispatch grammar. Create one directory per worker; never
copy anything from `~/.codex` into it. Besides `home/`, it holds the planner's
`brief.md` and `task.json`, this `run.sh` with the `run.sh.exit` the surface
wrapper writes, and `report.md`; `scripts/vpk-remote-status.js` reads them. Luna at `max` was verified end-to-end
through Proximity on 2026-08-03.

When writing `run.sh`, expand `worker_root` and `scripts` to absolute
**main-checkout** paths, `tree` to the absolute task worktree, and
`<branch>` to `task.json`'s `branch` (`vpk/<type>-<slug>`). Under
`--no-worktree`, `tree` is the current checkout and the grant line takes
`--no-worktree` instead of `--worktree` and `--branch`. Keep every expansion
in double quotes; paths may hold spaces.

```bash
worker_root="$PWD/output/remote-gpt/vpk-<type>-<slug>"
tree="$PWD/.claude/worktrees/vpk-<type>-<slug>"
scripts="$PWD/scripts"
mkdir -p "$worker_root/home"

# Commit access to the task record's branch, or {} when anything is off; see "Commits".
git_write="$(node "$scripts/vpk-remote-git-grant.js" --worktree "$tree" --branch "<branch>")"
[ -n "$git_write" ] || git_write='{}'

env -u OPENAI_API_KEY -u CODEX_API_KEY \
  CODEX_HOME="$worker_root/home" \
  codex exec --ignore-user-config -C "$tree" \
  -m "<model>" \
  -c 'model_provider="openai-gw"' \
  -c 'model_reasoning_effort="high"' \
  -c 'approval_policy="never"' \
  -c 'model_providers.openai-gw.name="AI Gateway (Proximity)"' \
  -c 'model_providers.openai-gw.base_url="http://localhost:29576/openai/v1"' \
  -c 'model_providers.openai-gw.wire_api="responses"' \
  -c 'model_providers.openai-gw.requires_openai_auth=false' \
  -c 'default_permissions="vpk-worker"' \
  -c 'permissions.vpk-worker.extends=":workspace"' \
  -c 'permissions.vpk-worker.network.enabled=true' \
  -c "permissions.vpk-worker.filesystem=$git_write" \
  --output-last-message "$worker_root/report.md" \
  - < "$worker_root/brief.md"
```

The `vpk-worker` permissions profile stands in for `--sandbox workspace-write`
plus `sandbox_workspace_write.network_access=true`, because only a profile
can carry the git grant. Do not add `--sandbox` to it: with `--sandbox` the
profile's filesystem entries are not applied. What was tested, on
codex-cli 0.166.0 (2026-11-17), with real `gpt-6.1-sol` workers running the
same probe script:

- `--sandbox workspace-write` with `network_access=true`, and this profile
  with a `{}` grant, gave identical results. Both print
  `sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)`;
  the workspace, `/tmp` and `$TMPDIR` were writable; the workspace's
  `.agents/`, `.codex/` and `.git`, the worktree's git index, `$HOME` and a
  directory outside the workspace were not; loopback listen and connect
  worked.
- The profile flags plus `--sandbox workspace-write` printed no network,
  loopback failed, and the git grant did not apply.

Nothing else was compared.

Run via Bash with `run_in_background: true`; the harness notifies on exit.
A Codex planner has no background notification: run it in the foreground
(see [planner-detection.md § Codex as the planner](planner-detection.md#codex-as-the-planner)).
Fan-out = several of these in one message, each with its own `worker_root`
(`vpk-<type>-<slug>-<n>`).
For read-only briefs, `--sandbox read-only` is a tighter fit.

Why each isolation layer exists:

- `CODEX_HOME` keeps worker sessions and state away from the user's Codex
  home (Desktop or CLI).
- `--ignore-user-config` prevents provider, model, plugin, or approval drift
  from `~/.codex/config.toml`.
- Unsetting `OPENAI_API_KEY`/`CODEX_API_KEY` prevents ambient credentials
  from changing the request path.
- The **`name` key is required** — `--ignore-user-config` builds the provider
  block from scratch, and omitting `model_providers.openai-gw.name` fails
  with `provider name must not be empty` (observed on 0.144.5).
- `requires_openai_auth=false` stops Codex from requiring or attaching a
  login; Proximity authenticates upstream itself.
- `wire_api="responses"` is the wire format Proximity's OpenAI path speaks.
- Explicit model + effort pins mean an alias or config change cannot
  silently redirect the run.
- The `vpk-worker` profile contains the worker's commands to the task
  worktree, `/tmp` and `$TMPDIR`, plus the git grant below; do not escalate
  to `--dangerously-bypass-approvals-and-sandbox` or
  `--sandbox danger-full-access`, not even for browser tests or commits.
- The leading `env` is an external command, so a same-name shell function
  (`codex` is one in the user's zshrc) cannot intercept the invocation.

Read **only** the `--output-last-message` file afterwards. Never parse the
stdout/JSONL stream — that is raw worker material and stays out of the
planner's context.

## Resume a single worker

Reuse the same `CODEX_HOME` and repeat every override. Build the grant again
with the same expected branch from `task.json`: the script checks the
worktree afresh and yields `{}` if the worker moved `HEAD` off that branch.
A run that uses a browser server starts its own in the follow-up script
(`run-<k>.sh`), exactly as in [Browser tests](#browser-tests-playwright):
the first run's trap stopped the first server. Exec-level flags must come
**before** the `resume` subcommand (`codex exec resume --last --sandbox …`
fails with `unexpected argument`).

```bash
worker_root="$PWD/output/remote-gpt/vpk-<type>-<slug>"
tree="$PWD/.claude/worktrees/vpk-<type>-<slug>"
scripts="$PWD/scripts"

git_write="$(node "$scripts/vpk-remote-git-grant.js" --worktree "$tree" --branch "<branch>")"
[ -n "$git_write" ] || git_write='{}'
# Browser runs: the five server lines from "Browser tests" go here.

env -u OPENAI_API_KEY -u CODEX_API_KEY \
  CODEX_HOME="$worker_root/home" \
  codex exec --ignore-user-config -C "$tree" \
  -m "<model>" \
  -c 'model_provider="openai-gw"' \
  -c 'model_reasoning_effort="high"' \
  -c 'approval_policy="never"' \
  -c 'model_providers.openai-gw.name="AI Gateway (Proximity)"' \
  -c 'model_providers.openai-gw.base_url="http://localhost:29576/openai/v1"' \
  -c 'model_providers.openai-gw.wire_api="responses"' \
  -c 'model_providers.openai-gw.requires_openai_auth=false' \
  -c 'default_permissions="vpk-worker"' \
  -c 'permissions.vpk-worker.extends=":workspace"' \
  -c 'permissions.vpk-worker.network.enabled=true' \
  -c "permissions.vpk-worker.filesystem=$git_write" \
  --output-last-message "$worker_root/report.md" \
  resume --last - < "$worker_root/followup-1.md"
```

For a browser run, add `PW_TEST_CONNECT_WS_ENDPOINT="$endpoint" \` after the
`CODEX_HOME` line and end the script with the two status lines, as in the
first run.

Resuming keeps the session's prompt cache warm — a fresh `codex exec`
re-pays the whole cold-start context read. Use `resume --last` only when this
is the sole active/recent session in its isolated home; **never resume during
or immediately after fan-out** (the selected session is ambiguous).

## Commits

`scripts/vpk-remote-git-grant.js` builds the `git_write` grant that lets a
worker in a linked task worktree run `git add` and `git commit` on its own
branch. Without it, anything that writes the index fails with
`Operation not permitted`: the worktree's git directory
(`<repo>/.git/worktrees/<name>`) lies outside the workspace and `:workspace`
keeps it read-only. `sandbox_workspace_write.writable_roots=["<repo>/.git"]`
does not help, and neither does a profile entry for all of `<repo>/.git`;
entries for the exact paths do.

The planner passes the worktree and the branch from `task.json`; the script
never takes the branch from the worktree, so a worker cannot choose which
branch a later run may move. It prints only the grant on stdout. It prints
`{}` (no git writes), says why on stderr, and exits 0 when: the directory is
not the top of a linked worktree; `HEAD` is detached; `HEAD` is not on the
expected branch; the branch name is outside `[A-Za-z0-9._-]` components
joined by `/`, each starting with a letter or digit (no `..`, no `.lock` or
`.` endings); a git query fails; the branch's ref or log directory is
missing; or a path holds a control character, a backslash or `*?[]{}`.
`--no-worktree` always yields `{}`. Keys are written as escaped TOML
strings, so a quote in a path cannot add an entry.

What the grant opens for writing, and nothing else (found by running
`git add` and `git commit` under the profile; codex-cli 0.166.0, git 2.53):

| Path | Why |
| --- | --- |
| `<repo>/.git/worktrees/<name>/index`, `index.lock` | staging |
| `…/worktrees/<name>/COMMIT_EDITMSG` | the commit message |
| `…/worktrees/<name>/logs/HEAD` | `HEAD`'s reflog |
| `…/worktrees/<name>/HEAD.lock` | a commit locks `HEAD` to log the update; it never renames the lock over `HEAD` |
| `…/worktrees/<name>/AUTO_MERGE.lock` | git 2.53 tries to clear `AUTO_MERGE` after a commit and prints an `error:` without it |
| `<repo>/.git/objects/` | new blobs, trees and commits |
| `<repo>/.git/refs/heads/<branch>` and its `.lock` | moving the task branch |
| `<repo>/.git/logs/refs/heads/<branch>` | the branch's reflog |
| `<repo>/.git/packed-refs.lock` | taken on every ref update when `packed-refs` exists; without it git prints an `error:` |

`HEAD` itself stays read-only, so the worker cannot switch its worktree to
another branch; `commondir`, `gitdir`, `config.worktree`, `ORIG_HEAD`, every
other branch, `refs/stash`, `<repo>/.git/config`, `<repo>/.git/hooks` and
everything else directly under `<repo>/.git` stay read-only too, so
`git stash`, switching branches, creating or moving another branch,
`git config` and `git worktree add` fail for the worker.

What the grant trusts the worker with:

- **The object store.** `<repo>/.git/objects/` is shared by every branch
  and worktree, and a worker with this grant can delete or corrupt any
  object in it, not only add its own. Granting commits trusts the worker
  with the repository's objects. A planner who does not want that builds
  no grant (`--no-worktree`, which yields `{}`) and uses the uncommitted
  flow: the worker leaves its changes uncommitted and proposes a commit
  subject in its report, and the planner commits after verifying the diff.
- **Hooks.** Read-only `config` and `hooks` do not stop
  `git -c core.hooksPath=<dir> commit`; hooks chosen that way run, inside the
  sandbox with the worker's own permissions.
- **Its own branch.** The worker can point the task branch at any commit
  (`git reset --soft`, `git update-ref`), so the planner checks the branch's
  log from where the task started, not only the final diff.
- **Locks.** A worker can leave `HEAD.lock` or `packed-refs.lock` behind,
  which makes later git commands fail until the planner removes the file.

Verified 2026-11-17 on 0.166.0 with real `gpt-6.1-sol` workers, in a linked
worktree of a scratch repository with Git LFS hooks and a `packed-refs`
file: `git add` and `git commit` succeeded; writing `HEAD` (directly, with
`git symbolic-ref`, by renaming `HEAD.lock`, with `git checkout <other>`),
another branch's ref, a new branch through the task branch's lock,
`<repo>/.git/config` (`git config`, `git config --worktree`, an append),
`packed-refs`, `hooks/`, the worktree's `gitdir` and `ORIG_HEAD`, and a new
file directly under `<repo>/.git` were all refused. With `HEAD` detached
before launch the script printed `{}` and the worker's `git add` failed with
`Operation not permitted`.

If a commit fails, the worker reports its proposed subject and the planner
commits.

## Browser tests (Playwright)

**What this gives the worker.** The worker's own commands stay sandboxed,
but the browser connection gives it capabilities on the host. Use it only
for workers and briefs you would trust without the sandbox for browser
purposes. The sandbox still stops accidental writes by the worker's
commands; the Claude lane has no sandbox at all. Per the installed
Playwright 1.64.1 source
(`node_modules/.pnpm/playwright-core@1.64.1/node_modules/playwright-core/lib/coreBundle.js`:
`filterLaunchOptions` in the bundled `remote/playwrightServer.ts`, and the
`CDPSession`, `Browser` and `Artifact` dispatchers), a client of this server:

- cannot choose `args`, `executablePath`, `env`, `downloadsPath` or
  `artifactsDir` at launch (`filterLaunchOptions` drops them; it was
  `tracesDir` in older releases);
- can open a raw CDP session (`newBrowserCDPSession`) and send any CDP
  command, such as `Browser.setDownloadBehavior` with any host
  `downloadPath`;
- can navigate to `file://` URLs and read host files the planner can read;
- can ask the server to save an artifact (download, video, trace) to any host
  path (`ArtifactDispatcher.saveAs` copies to the path the client sends).

So a worker set on it can write files outside its workspace through the
browser, which could lead to running code on the host. The endpoint
listens on loopback without authentication, so any local process can use
that browser while it runs. A fixed-browser `launchServer()` would remove
the client's launch choices but keep the CDP and artifact powers. Checked against this server on
2026-11-17: `file:///etc/hosts` loaded, a download after a CDP
`Browser.setDownloadBehavior` landed in a host directory, and a raw
`saveAs` call wrote to a host path.

Inside the sandbox Chromium cannot start. A Playwright test fails with

```text
browserType.launch: Target page, context or browser has been closed
```

and the browser log shows the cause:

```text
bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.<pid>: Permission denied (1100)
```

Seatbelt denies the Mach port lookup Chromium needs. Everything else a
browser test needs works in the sandbox: building, a dev server on a local
port (Playwright's `webServer` included), and connecting to localhost.

The recipe runs the browser outside the sandbox and lets the worker's test
runner connect to it. `scripts/vpk-remote-browser-server.js start` runs
`playwright run-server --host 127.0.0.1` from the task's own Playwright,
waits until it listens, writes `browser-server.json` in the worker directory,
and returns; `endpoint` prints the live server's endpoint. Setting
`PW_TEST_CONNECT_WS_ENDPOINT` makes `playwright test` connect to that server
instead of launching a browser, and the variable reaches the worker's
commands despite `--ignore-user-config`. Add these lines to `run.sh` before
the `env` command:

```bash
stop_browser() { node "$scripts/vpk-remote-browser-server.js" stop --worker-dir "$worker_root" >&2; }
trap stop_browser EXIT
trap 'exit 129' HUP INT TERM
node "$scripts/vpk-remote-browser-server.js" start --project "$tree" --worker-dir "$worker_root" >&2 || exit 1
endpoint="$(node "$scripts/vpk-remote-browser-server.js" endpoint --worker-dir "$worker_root")" || exit 1
```

then put the endpoint in the `env` prefix and end the script with the
worker's status:

```bash
env -u OPENAI_API_KEY -u CODEX_API_KEY \
  CODEX_HOME="$worker_root/home" \
  PW_TEST_CONNECT_WS_ENDPOINT="$endpoint" \
  codex exec --ignore-user-config -C "$tree" \
  …                                  # every other flag as in the canonical run
status=$?
exit "$status"
```

- **One server per run script.** The trap is installed before the server
  starts, so it stops the server however `run.sh` ends: the worker exits or
  fails, the start or endpoint step fails, or the pane closes. `run.sh` then
  exits with the worker's status. A `resume` script starts and traps its own.
  `stop` ends the server and its browser processes, and is safe to repeat;
  run it by hand only for a server started outside a run script. The server
  also ends itself after `--ttl-minutes` (default 180) and if its supervisor
  is killed. Two starts for one worker directory never leave two servers:
  the second fails while the first is starting or running. To find strays:
  `ps -axww -o pid,command | grep '[v]pk-remote-browser-server.js supervise'`
  shows each one's `--state <worker-dir>/browser-server.json`; stop it with
  that worker directory.
- **Same version.** Client and server must run the same Playwright version,
  so `--project` is the package directory inside the task worktree whose
  tests the worker runs (`$tree` for VPK), after `pnpm install`. The script
  resolves `@playwright/test`, else `playwright`, from there and fails
  naming the directory if neither resolves.
- **Limits.** Only Playwright's test runner honours the variable. A test or
  script that calls `browserType.launch()`, `chromium.launch()` or
  `launchPersistentContext()` itself still fails with the error above, and
  headed runs (`--headed`, `--debug`, `--ui`) are out on the worker side.

Verified 2026-11-17 on 0.166.0 with Playwright 1.64.1 and real
`gpt-6.1-sol` workers: a `run.sh` built from these lines passed one spec
(`1 passed`), exited 0 with the worker, and left no server; a `resume`
script built the same way passed it again. With a stand-in worker exiting 7
the script exited 7, and on SIGHUP it exited 129; both stopped the server.
Without the endpoint the same spec failed with the Mach error above.

## Other limits of the lane

- `:workspace` keeps the workspace root's `.agents/` and `.codex/` read-only,
  so a GPT worker cannot edit VPK skills, rules or Codex config. Send such
  briefs to the Claude lane.

## Advisor consults

This lane serves advisor consults on the `sol` model (resolved from
`defaults.env`, never a pinned ID) at `xhigh` when the work
under review came from the **Claude** lane, including plans written by the
Claude planner itself — see the independence rule in
[advisor-pattern.md](advisor-pattern.md). Use `--sandbox read-only`, an
`output/remote-gpt/vpk-<type>-<slug>-review/` directory (see
[naming-and-worktrees.md](naming-and-worktrees.md)), and a read-only brief.

## Failure handling

- Missing CLI, unreachable gateway, model rejection, authentication prompts,
  or an absent/empty report file are infrastructure blockers. Re-dispatch an
  absent-report brief once to a fresh worker; report everything else.
- Do not retry through `openai-no-ws`, a default provider, the planner's
  `CODEX_HOME`, or any shell alias.
- A worker that searched its scope and reported "not found" succeeded — that
  is a finding, not a failure.

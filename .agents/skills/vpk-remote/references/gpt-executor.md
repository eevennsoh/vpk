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

Expand `worker_root` to the absolute **main-checkout** path and `tree` to the
absolute task worktree (the current checkout under `--no-worktree`) when
writing `run.sh`.

```bash
worker_root="$PWD/output/remote-gpt/vpk-<type>-<slug>"
tree="$PWD/.claude/worktrees/vpk-<type>-<slug>"
mkdir -p "$worker_root/home"

# Commit access to this worktree's own branch only; see "Commits" below.
gitdir="$(git -C "$tree" rev-parse --absolute-git-dir)"
common="$(git -C "$tree" rev-parse --path-format=absolute --git-common-dir)"
ref="$(git -C "$tree" symbolic-ref HEAD)"
git_write='{}'
[ "$gitdir" != "$common" ] && git_write="{\"$gitdir\"=\"write\", \"$gitdir/commondir\"=\"read\", \"$gitdir/gitdir\"=\"read\", \"$gitdir/config.worktree\"=\"read\", \"$common/objects\"=\"write\", \"$common/$ref\"=\"write\", \"$common/$ref.lock\"=\"write\", \"$common/logs/$ref\"=\"write\", \"$common/packed-refs.lock\"=\"write\"}"

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

The `vpk-worker` permissions profile is the workspace-write sandbox: it extends
the built-in `:workspace` profile, and codex still prints
`sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)`.
It replaces `--sandbox workspace-write` plus
`sandbox_workspace_write.network_access=true` because codex applies a
profile's filesystem entries only without `--sandbox`; with it, the profile
is silently ignored. Both forms were checked side by side on 0.166.0: the
same paths are writable (the workspace, `/tmp`, `$TMPDIR`), the same are
read-only (the workspace root's `.git`, `.agents`, `.codex`, `.aws`, and
everything outside the workspace), and loopback listen and connect work.

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
- Workspace-write (the `vpk-worker` profile) contains implementation to the
  task worktree plus the narrow git grant below; do not escalate to
  `--dangerously-bypass-approvals-and-sandbox` or
  `--sandbox danger-full-access`, not even for browser tests or commits.
- The leading `env` is an external command, so a same-name shell function
  (`codex` is one in the user's zshrc) cannot intercept the invocation.

Read **only** the `--output-last-message` file afterwards. Never parse the
stdout/JSONL stream — that is raw worker material and stays out of the
planner's context.

## Resume a single worker

Reuse the same `CODEX_HOME` and repeat every override, including the
`git_write` lines from the first run (and the browser endpoint, when the run
uses one). Exec-level flags must come **before** the `resume` subcommand
(`codex exec resume --last --sandbox …` fails with `unexpected argument`).

```bash
worker_root="$PWD/output/remote-gpt/vpk-<type>-<slug>"
tree="$PWD/.claude/worktrees/vpk-<type>-<slug>"
# gitdir, common, ref, git_write: the same four lines as the first run.

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

Resuming keeps the session's prompt cache warm — a fresh `codex exec`
re-pays the whole cold-start context read. Use `resume --last` only when this
is the sole active/recent session in its isolated home; **never resume during
or immediately after fan-out** (the selected session is ambiguous).

## Commits

The `git_write` grant lets a worker in a linked task worktree commit to its
own branch. Without it, `git add`, `git commit`, `git checkout -- <path>` and
anything else that writes the index fail with `Operation not permitted`: the
worktree's git directory (`<repo>/.git/worktrees/<name>`) lies outside the
workspace and `:workspace` keeps it read-only.
`sandbox_workspace_write.writable_roots=["<repo>/.git"]` does not help, and
neither does a profile entry granting all of `<repo>/.git`: the narrower
read-only protection on the worktree's git directory wins over a broader
grant. Entries for the exact paths do.

What the grant opens for writing, and nothing else:

| Path | Why |
| --- | --- |
| `<repo>/.git/worktrees/<name>/` | the worktree's index, `HEAD`, reflog, `COMMIT_EDITMSG` |
| `<repo>/.git/objects/` | new blobs, trees and commits (shared by every branch, append-only in practice) |
| `<repo>/.git/refs/heads/<branch>` and its `.lock` | moving the task branch |
| `<repo>/.git/logs/refs/heads/<branch>` | the task branch's reflog |
| `<repo>/.git/packed-refs.lock` | git 2.53 takes it on every ref update and prints a harmless `error:` without it |

The worktree's `commondir`, `gitdir` and `config.worktree` stay read-only,
so a worker cannot repoint its worktree or set hooks through per-worktree
config (VPK sets `extensions.worktreeConfig`). Every other branch, `main`,
`refs/stash`, `<repo>/.git/config`, `<repo>/.git/hooks` and remote-tracking
refs stay read-only too, so `git stash`, `git branch -f <other>`,
`git config` and `git worktree add` fail for the worker. Verified 2026-11-17
on 0.166.0: a real worker committed in a linked VPK worktree (with its Git LFS
hooks installed) and was refused when it tried to move another branch.

The grant needs the branch's loose ref directory (`refs/heads/vpk/`) to
exist, which it does once any `vpk/*` branch is loose; `git worktree add -b`
creates it. If a commit fails with `unable to create directory for
…/refs/heads/…`, the worker reports its proposed subject and the planner
commits. Under `--no-worktree` the grant is `{}` (the checkout's `.git` is
the workspace root's own and stays protected), so the worker leaves its
changes uncommitted.

## Browser tests (Playwright)

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

The fix keeps the sandbox: run the browser outside it and let the worker's
test runner connect. `scripts/vpk-remote-browser-server.js start` runs
`playwright run-server --host 127.0.0.1` from the task's own Playwright,
waits until it listens, records `browser-server.json` in the worker
directory, and returns. Setting `PW_TEST_CONNECT_WS_ENDPOINT` makes
`playwright test` connect to that server instead of launching a browser, and
the variable reaches the worker's commands despite `--ignore-user-config`.
Add these lines to `run.sh` before the `env` command, with `server` expanded
to the absolute main-checkout path:

```bash
server="$PWD/scripts/vpk-remote-browser-server.js"
node "$server" start --project "$tree" --worker-dir "$worker_root" || exit 1
trap 'node "$server" stop --worker-dir "$worker_root" >/dev/null' EXIT
trap 'exit 129' HUP INT TERM
endpoint="$(node -p 'require(process.argv[1]).endpoint' "$worker_root/browser-server.json")"
```

and put the endpoint in the `env` prefix:

```bash
env -u OPENAI_API_KEY -u CODEX_API_KEY \
  CODEX_HOME="$worker_root/home" \
  PW_TEST_CONNECT_WS_ENDPOINT="$endpoint" \
  codex exec --ignore-user-config -C "$tree" \
  …                                  # every other flag as in the canonical run
```

- **Start before dispatch, stop after exit.** The traps tie the server to
  `run.sh`: it stops when the worker exits, fails, or its pane closes. A
  follow-up `run-<k>.sh` starts its own. Run `stop --worker-dir` by hand only
  for a server started outside `run.sh`; it is safe to repeat. The server
  also ends itself after `--ttl-minutes` (default 180). To find strays:
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
  The browser runs outside the sandbox with the planner's network and file
  access, so brief the worker to load only the task's own pages.

Verified 2026-11-17 on 0.166.0 with Playwright 1.64.1: the same small spec
passed with the endpoint and failed with the Mach error without it.

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

# Symphony

VPK runs the upstream OpenAI Symphony Elixir reference implementation
through `pnpm run symphony`. The local repo owns only the launcher, workflow
template, and repo-specific Codex skill resources. The Elixir runtime itself is pulled
from `openai/symphony` at startup.

Upstream reference: <https://github.com/openai/symphony/blob/main/elixir/README.md>

Repo-owned files:

- `WORKFLOW.md`: VPK workflow template rendered for upstream Symphony.
- `scripts/symphony.sh`: prepares a fresh upstream Elixir checkout, builds
  `./bin/symphony`, renders the workflow, and launches the service.
- `.agents/skills/vpk-symphony/SKILL.md`: repo-local Symphony workflow skill
  covering raw Linear GraphQL, git sync/commit/push/land flow, stuck-run
  debugging, workpad rules, and Playwright CLI browser evidence.

## Configuration

Required:

```bash
LINEAR_API_KEY=<linear-personal-api-key>
SYMPHONY_LINEAR_PROJECT_SLUG=<linear-project-slug>
```

Required local commands:

```bash
mise --version
pnpm --version
```

Optional browser evidence command:

```bash
playwright-cli --version
```

The repo-local `.agents/skills/vpk-symphony/SKILL.md` teaches workers when and
how to use the command; it does not install the command. When `playwright-cli`
is available, UI-visible issues should include the requested screenshot or video
evidence. When it is unavailable, Symphony still starts and workers should skip
browser media capture, record that limitation in the workpad, and continue with
the best non-browser validation available for the issue.

`LINEAR_API_KEY` can live in ignored `.env.local` or the shell environment. Never
commit a real Linear key to `.env.local.example`, docs, issues, or comments. The
project slug comes from the Linear project URL. Local `vpk-symphony` invocations
use these values as the default direct Linear GraphQL path because company
policy does not expose an injected `linear_graphql` tool to Codex workers.

Optional overrides:

```bash
LINEAR_ASSIGNEE=me
SYMPHONY_SOURCE_REPO_URL=git@github.com:<owner>/<repository>.git
SYMPHONY_GITHUB_REPO=<owner>/<repository>
SYMPHONY_WORKSPACE_ROOT=/tmp/symphony-workspaces
SYMPHONY_ENV_LOCAL_SOURCE=/absolute/path/to/repository/.env.local
SYMPHONY_UPSTREAM_REPO=https://github.com/openai/symphony.git
SYMPHONY_UPSTREAM_REF=main
SYMPHONY_UPSTREAM_DIR=.tmp/symphony/openai-symphony
SYMPHONY_RUNTIME_DIR=.tmp/symphony/runtime
```

`SYMPHONY_UPSTREAM_DIR` is reset to the requested upstream ref on every launch
with `git fetch`, `git checkout --detach FETCH_HEAD`, `git reset --hard`, and a
scoped `git clean -fdx`. This intentionally discards local edits inside the
cached upstream checkout while preserving `elixir/deps`, `elixir/_build`, and
`elixir/bin` so restarts do not re-fetch and recompile Hex dependencies.

If the Elixir cache is already corrupted, remove those preserved directories
from `SYMPHONY_UPSTREAM_DIR/elixir/` once and restart Symphony.

`SYMPHONY_ENV_LOCAL_SOURCE` is optional. When set, the workspace hook copies it
to each issue workspace as `.env.local`. After workspace checkout and optional
env copy, the hook runs `pnpm install` so each Symphony issue workspace starts
with local dependencies available.

## Run

Run with the optional Phoenix dashboard:

```bash
pnpm run symphony -- --port 4567
```

Run without the dashboard:

```bash
pnpm run symphony
```

The wrapper follows the upstream Elixir README flow:

```bash
git clone https://github.com/openai/symphony
cd symphony/elixir
mise trust
mise install
mise exec -- mix setup
mise exec -- mix build
mise exec -- ./bin/symphony /path/to/WORKFLOW.md
```

The wrapper renders `WORKFLOW.md` into `SYMPHONY_RUNTIME_DIR` at startup. After
changing workflow front matter or prompt text, stop and restart Symphony so the
running process uses a fresh rendered workflow.

The wrapper also passes upstream Symphony the required
`--i-understand-that-this-will-be-running-without-the-usual-guardrails` flag.
With `--port`, upstream Symphony exposes:

- `/`: Phoenix LiveView dashboard.
- `/api/v1/state`: JSON snapshot of running, retrying, and blocked work.
- `/api/v1/<issue_identifier>`: one issue's running or retrying status.
- `/api/v1/refresh`: `POST` endpoint that requests an immediate poll.

## Workflow

Ad-hoc `vpk-symphony` invocations are an agent-side ticket bootstrap, not a
launcher flag. When the skill is invoked and no existing Linear issue is
provided, the worker should first try to create a `Todo` Linear issue in the
configured Symphony project. The best proven creation path is direct Linear
GraphQL over HTTPS with local `LINEAR_API_KEY` and
`SYMPHONY_LINEAR_PROJECT_SLUG`; company policy does not expose an injected
`linear_graphql` tool to Codex workers. This applies to tiny direct file edits,
generated artifact updates, meta support, answer-only work, and implementation
work. If the current sandbox or network allowlist blocks `api.linear.app`, the
worker should immediately rerun the same direct GraphQL bootstrap with the
required approval/escalation in the same turn. It should record a blocker only
when the escalated request is denied or still fails; it should not bypass Linear
issue creation. If the user explicitly says not to create Linear work items for
a meta/setup correction to the Symphony harness itself, honor that instruction.
After the issue exists, the normal
workflow decides whether the ticket is answer-only work that ends in the workpad
or implementation work that needs a branch, PR, Agent Review, and merge. The
launcher itself still polls Linear for existing active issues.

After an ad-hoc ticket is created, the safer default is to leave it in `Todo`
for `pnpm run symphony` to claim. That path creates a fresh issue workspace via
the launcher hook. A local Codex thread may continue executing immediately only
when the user explicitly asks for that or when the current checkout is already a
Symphony issue workspace; the workpad should then say that no new workspace was
created and why local execution was used.

`WORKFLOW.md` is based on upstream `elixir/WORKFLOW.md` and keeps VPK-specific
customization in the YAML hooks plus the repository contract section.

### Issue states

This table is the one list of Symphony issue states and the moves between them.
`WORKFLOW.md` (its `tracker.active_states` and `tracker.terminal_states`, status
map, Step 0 routing and phase prompts) and the phase prompts in
`.agents/skills/vpk-symphony/references/lifecycle.md` must agree with it;
`scripts/symphony-issue-states.test.js` checks that.

| State | Tracker list | Who acts | Moves to |
| --- | --- | --- | --- |
| `Backlog` | none | a human; not routed for implementation | `Todo` |
| `Todo` | active | kickoff worker: moves the issue on, then creates or reuses the `## Codex Workpad` | `In Progress` |
| `In Progress` | active | implementer, continuing from the workpad | `Agent Review`, `Done`, `Human Review` |
| `Agent Review` | active | fresh read-only adversarial reviewer of the linked PR | `Merging`, `In Progress`, `Human Review` |
| `Human Review` | none | a human: risk gate for security/privacy exposure, data loss, irreversible schema or migration changes, destructive production behavior, or missing permissions/secrets | `In Progress`, `Merging` |
| `Merging` | active | landing worker, following `references/git/land.md` | `Done`, `Agent Review`, `In Progress`, `Human Review` |
| `Done` | terminal | nobody | none |
| `Closed` | terminal | nobody | none |
| `Cancelled` | terminal | nobody | none |
| `Canceled` | terminal | nobody | none |
| `Duplicate` | terminal | nobody | none |

Recommended Linear flow:

```text
Backlog -> Todo -> In Progress -> Agent Review -> Merging -> Done
```

The other moves: `In Progress -> Done` is for answer-only work, and
`In Progress -> Human Review` for a blocked-access escape. `Agent Review` sends
gaps back to `In Progress` and super-risk to `Human Review`. `Merging` moves to
`Done` only after a current-head passing Symphony Agent Review, green checks,
clean mergeability, and a GitHub-reported merge commit; it goes back to
`Agent Review` when the PR head changes after review, and to `In Progress` when
the review requests changes. Only states in the active list get a worker;
`Backlog` and `Human Review` wait for a human.

Symphony PRs should carry the `symphony` label and should not require
`automerge:allowed`; Symphony owns the guarded merge path for this workflow.
GitHub native auto-merge remains disabled because this repo currently has no
branch-protection-required checks for `main`.

Workers keep exactly one active `## Codex Workpad` comment. The workpad should
be concise and current: environment stamp, plan, acceptance criteria,
validation, evidence, decisions, branch, PR, and handoff.

`WORKFLOW.md` also includes compact phase prompts for each Linear state (the
"Who acts" column of [Issue states](#issue-states)). These prompts are part of
the runtime worker prompt, not only documentation.

For UI, browser-observable, generated/offline HTML, or visual artifact changes,
workers use the repo-local `vpk-symphony` browser evidence reference during
`In Progress` when `playwright-cli` is available. Artifacts are kept under
`output/playwright/<issue-identifier>/` in the issue workspace and only the
required screenshots or short WebM recordings are uploaded to Linear through
direct Linear GraphQL. The uploaded links belong in the single
`## Codex Workpad` comment, not in separate progress comments. A before artifact
is only required when it proves the bug or requested baseline; an after artifact
is required before moving browser-observable work to `Agent Review` or `Done`
when browser media capture is available. Ignored `output/` HTML is still
browser-observable; source search alone is not enough evidence. Screenshot
uploads, plus short animated GIF previews when inline motion proof is needed,
should use markdown image syntax
(`![alt text](<asset-url>)`) in the workpad so Linear renders an inline preview.
Uploaded WebM recordings should be kept as the canonical recording evidence, but
Linear `fileUpload` WebM assets may render only as downloadable links. Place the
WebM asset URL on its own line and include an inline GIF preview separately when
the ticket or demo needs motion evidence to be visible inside Linear.

Upstream Symphony re-dispatches an issue when a Codex turn completes while the
issue is still in an active state. For that reason, VPK workers should not end a
normal turn with completed or blocked work still in `In Progress`; they should
write the handoff or blocker into the workpad. Completed implementation work
should move to `Agent Review`; super-risk blockers move to `Human Review`; and
answer-only work should move to `Done`.

If Codex reports required operator input, an approval request, or MCP
elicitation, upstream Symphony keeps the issue claimed and exposes it as blocked
in the runtime state, JSON API, and dashboard. The blocked map is in memory only;
restarting Symphony clears it, so any still-active Linear issue can be
dispatched again after restart.

Answer-only issues, such as “explain this codebase” or operational questions,
do not need a branch or PR. Workers should do a bounded targeted read, put the
answer in the workpad handoff, and move the issue to `Done`.

Validation is issue-specific. Workers should prefer the narrowest proof that
covers the touched behavior. Run dependency installation, `pnpm run lint`,
`pnpm run typecheck`, browser checks, accessibility checks, or PR feedback
sweeps only when the issue, touched surface, existing PR feedback, or merge
state requires them.

Workers should also keep command output bounded. Avoid broad repository
inventories and large file-list dumps; use exact searches and short file ranges
so a small issue does not become a large repeated context window.

## Runtime Knobs

The workflow keeps the upstream defaults visible where local choices matter:

- `polling.interval_ms`: `5000`, matching the upstream sample cadence.
- `agent.max_concurrent_agents`: `10`, matching the upstream sample.
- `agent.max_turns`: `20`, matching the upstream sample so a larger task can
  continue through multiple Codex turns before Symphony returns control to the
  orchestrator.
- `agent.max_concurrent_agents_by_state.Merging`: `1`, the only local per-state
  cap, so merge work does not run in parallel across several issues.
- `codex.command`: upstream-style `codex ... app-server` with inherited shell
  environment plus explicit `gpt-5.5` and `xhigh` reasoning settings.
- `codex.approval_policy`: `on-request`, matching the enterprise-managed Codex
  policy set that rejects `never` for app-server thread settings.
- `codex.thread_sandbox`: `workspace-write`, matching the enterprise-managed
  Codex sandbox set. The per-turn sandbox policy is omitted so upstream
  Symphony generates its workspace-write default for each issue workspace.
  Browser evidence that requires broader OS access may be unavailable in this
  mode; workers should record that limitation in the workpad and continue with
  the best non-browser validation available.
- `codex.turn_timeout_ms`: `300000`, `codex.read_timeout_ms`: `5000`, and
  `codex.stall_timeout_ms`: `120000`, local guards that prevent long-running or
  silent turns from burning indefinitely.

Upstream also supports SSH workers with `worker.ssh_hosts` and
`worker.max_concurrent_agents_per_host`. VPK leaves those unset for local
runs.

## Lifecycle Hooks

`after_create` prepares an issue workspace by:

- cloning `SYMPHONY_SOURCE_REPO_URL`,
- checking out or creating `symphony/<issue-id>`,
- copying `.env.local` when `SYMPHONY_ENV_LOCAL_SOURCE` is configured,
- running `pnpm install`.

`before_remove` delegates terminal-workspace cleanup to upstream
`mix workspace.before_remove` from the fresh Elixir checkout. The hook passes
the VPK GitHub repo slug and issue branch name so upstream cleanup can close
open PRs for branches whose Linear issues reached a terminal state without
merge.

## Debugging

The wrapper writes upstream logs under `.tmp/symphony/runtime/log` by default.
Start with the ticket key, then narrow to the Codex session:

```bash
rg -n "issue_identifier=VEN-123" .tmp/symphony/runtime/log/symphony.log*
rg -o "session_id=[^ ;]+" .tmp/symphony/runtime/log/symphony.log* | sort -u
rg -n "session_id=<thread>-<turn>" .tmp/symphony/runtime/log/symphony.log*
rg -n "Issue stalled|turn_timeout|turn_failed|Codex session failed|Codex session ended with error" .tmp/symphony/runtime/log/symphony.log*
```

If a worker repeatedly fails before the first Codex turn, inspect
`hook=after_create` and app-server startup lines first. If a worker spends time
inside a turn, inspect `thread/tokenUsage/updated`, `item/started`,
`item/completed`, and Linear GraphQL errors around the same `session_id`.

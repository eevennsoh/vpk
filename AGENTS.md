# VPK (Venn Prototype Kit)

> Provider-neutral project context for AI coding assistants (Cursor, Claude Code, Codex, and others).
> Canonical source: `AGENTS.md`. There is deliberately no `CLAUDE.md` — Claude Code loads `AGENTS.md` as project instructions by default (`instructionFiles: "claude-md-or-agents-md"`); do not recreate one. Provider dirs (`.cursor/`, `.claude/`, `.codex/`, `.rovo/`) contain provider-specific config plus symlinks back to `.agents/`.

Next.js 16 (React 19, Tailwind CSS v4) + Express backend with AI SDK (Vercel), AI Gateway, and Rovo Serve integration.

## Start Here

- Read this file top-to-bottom once. Quick start: `pnpm install`, then `pnpm run rovo`.
- Production uses one Express process serving the static export plus `/api/*`.
- Frontend edits live mainly in `components/projects/`, `components/blocks/`, `components/arts/`, `components/ui-custom/`, `components/visual/`, `components/website/`, and `app/`.
- Before building or changing UI, read `DESIGN.md` for the shared visual contract.
- Backend/API ownership: `backend/app.js` composes Express; `backend/server.js` owns startup/static serving/listen/WebSockets; `backend/routes/*.js`, `backend/chat/*.js`, `backend/services/*`, and `backend/middleware/*` own their domains; `app/api/**/route.ts` owns dev proxies and route adapters.
- Validate every change with `pnpm run check` (all repository guards, ESLint on changed files and their importers, the full typecheck and related unit suites, reported together); `pnpm run ci:pr` stays the merge gate. UI changes also need visual and accessibility checks.
- When the user corrects you, fix the environment as well as the diff: push the lesson to the lowest rung that can hold it — (1) codebase: one paved path, delete the copy you nearly followed; (2) lint/types/CI: an `error` rule, existing violations baselined in `eslint-suppressions.json`; (3) rules; (4) skills; (5) `DESIGN.md`. Codex doesn't auto-load `.agents/rules/` and Cursor loads only `.mdc`, so anything mechanical belongs in rungs 1–2. Procedure: `.agents/docs/playbooks/push-corrections-down-the-ladder.md`. Propose new or subjective policy instead of enforcing it globally.
- For browser verification after editing code served by the local Next.js app, load and follow `next-dev-loop`; it owns the `/_next/mcp` plus `agent-browser` runtime cross-check. Use the `pnpm control-vpk session` ID for that loop and leave the browser running between checks (`pnpm control-vpk park` stops an animated page using CPU); close it explicitly with `pnpm control-vpk cleanup --browser` only when no longer needed. For browser work that is not verifying a Next.js edit, default to `agent-browser` (`npx agent-browser`) and load its skill first. Keep artifacts under ignored `output/agent-browser/`. If `agent-browser` is unavailable or blocked, use Playwright CLI after loading its skill.
- Browser entry: resolve the requested component, block, or project's exact route before opening a browser. Use the supplied route or the current route/catalog map, then navigate directly on this worktree's origin (`pnpm control-vpk open-target <route>`). Do not start at the bare origin, `localhost:3000`, or a category landing page and browse for the object. Start at home only when the task explicitly verifies catalog navigation or that entry point (then pass `--entry-point` to `open-target`/`capture`); confirm the target URL and route marker before debugging.
- Symphony browser evidence is the exception: use `vpk-symphony` so issue evidence lands under ignored `output/playwright/` per `WORKFLOW.md` and `.agents/docs/symphony.md`.
- Native desktop apps (non-browser GUIs, simulators): built-in computer use first, then `agent-desktop`; never for web pages. Procedure: `.agents/docs/workflows-extended.md` (Native Desktop Apps).

## Documentation Index

**Project References**:

| When you need... | Read |
| --- | --- |
| Which code owns a route, and what renders a file | `.agents/knowledge/repo-map.json` (`appPages.pages[].primaryOwner`), `pnpm control-vpk where <path\|slug>` |
| Drive a route into a state and capture proof | `.agents/skills/vpk-verify/SKILL.md`, recipes in `.agents/skills/vpk-verify/features/` |
| Turning a correction into a lasting guard | `.agents/docs/playbooks/push-corrections-down-the-ladder.md` |
| UI performance decisions and shared mechanisms | `.agents/docs/playbooks/improve-ui-performance.md` |
| Maintained upstream runtime-library adoption | `.agents/docs/playbooks/adopt-upstream-runtime.md` |
| Reference-video motion acceptance and replay | `.agents/docs/playbooks/recreate-reference-motion.md` |
| Component architecture rules | `.agents/skills/vpk-tidy/SKILL.md` |
| Design-system lint contracts and maintenance | `eslint.config.mjs`, `.agents/rules/component-architecture.md`, `scripts/eslint-boundary-rules.test.js` |
| React patterns reference (1000+ lines) | `.agents/skills/vpk-tidy/references/patterns.md` |
| Shared visual contract | `DESIGN.md` |
| Design token catalog (200+ tokens) | `.agents/skills/vpk-design/references/tokens.md` |
| Figma inspection, asset export, and code pipeline | `.agents/skills/vpk-design/SKILL.md` |
| Deployment guide | `.agents/skills/vpk-deploy/references/guide-deployment.md` |
| Setup walkthrough | `.agents/skills/vpk-setup/references/guide-setup.md` |
| Local skills catalog (generated) | `.agents/skills/INDEX.md` |
| Endpoint tables (generated) | `.agents/knowledge/api-surfaces.md` |
| AI SDK chat integration | `rovo/config.js`, `app/contexts/context-rovo-chat.tsx` |
| AI Gateway helpers | `backend/lib/ai-gateway-helpers.js` |
| Rovo Serve gateway (agent loop) | `backend/lib/rovo-gateway.js`, `backend/lib/rovo-client.js` |
| UI message types and data parts | `lib/rovo-ui-messages.ts` |
| Repository skills for Rovo | `scripts/sync-rovo-skills.js`, `backend/lib/rovo-skills-overlay.js` |
| Architecture overview | `.agents/docs/architecture-overview.md` |
| Extended workflows | `.agents/docs/workflows-extended.md` |
| herdr panes, tabs, and agent topology | `.agents/docs/herdr.md`, `scripts/agent-surface.js` |
| Step-by-step task playbooks | `.agents/docs/playbooks/` |
| Cursor Cloud environment setup | `.agents/docs/cursor-cloud.md` |
| Symphony orchestrator | `.agents/skills/vpk-symphony/SKILL.md`, `.agents/docs/symphony.md`, `WORKFLOW.md`, `scripts/symphony.sh` |

**Global Skills** — installed agent skills (outside repo):

| When you need... | Read |
| --- | --- |
| Component design fundamentals | `~/.agents/skills/building-components/references/` |
| React composition patterns | `~/.agents/skills/vercel-composition-patterns/rules/` |
| React/Next.js performance rules | `~/.agents/skills/vercel-react-best-practices/rules/` |
| Motion-effect naming | `~/.agents/skills/animation-vocabulary/SKILL.md` |
| AGENTS.md best practices | `~/.agents/skills/claude-md-improver/references/` |

**External Documentation** — fetch via tools when needed:

| When you need... | URL |
| --- | --- |
| Atlassian Design System | `atlas ads` CLI first (see **ADS Lookups**), then `https://atlassian.design` |
| shadcn/ui components | `https://ui.shadcn.com/docs` |
| Tailwind CSS | `https://tailwindcss.com/docs` |

## Core Rules (Highest Priority)

### Rule Priority

If instructions overlap, use this precedence:

1. Direct user instruction for the current task
2. This file
3. Tool/runtime constraints
4. Skill-specific docs (for the chosen skill)
5. Supplemental references in `.agents/rules/appendix-reference.md`

### Non-negotiable Defaults

- Package manager: `pnpm`; indentation: tabs; imports: use `@/` alias.
- React 19: `use(Context)`, `<Context value={}>`, and `ref` as a regular prop; not `useContext()`, `<Context.Provider>`, or `forwardRef` (lint + source guardrails).
- Conditional rendering: use ternary (`cond ? <X /> : null`), not `&&` patterns that can render `0` (lint-enforced for rendered children; boolean props keep `&&`).
- Prefer semantic token classes; do not introduce `bg-[var(--ds-...)]` / `text-[var(--ds-...)]` in VPK components.
- Figma links and assets: load `vpk-design` and use the official Figma MCP first. Its tools may be lazy/deferred, so discover the exact `mcp__figma__*` capability and use `whoami` for access diagnostics before declaring Figma unavailable. Do not jump to browser login or `FIGMA_TOKEN` while the configured MCP is callable.
- ADS content (components, tokens, icons, docs): query the `atlas ads` CLI first; ADS MCP tools are fallback only. See `.agents/rules/ads-lookups.md`.
- Custom CSS classes: prefer `@utility name { … }` (Tailwind v4 idiom) over `@layer components`. Full rules in `.agents/rules/token-priority.md`.

## Engineering Standards

### Code Style

UI primitives, icons, logos, images, shadows, dates, key imports, and the CSS Baseline: `.agents/rules/ui-code-style.md`.

### Dependency Pinning

Framework core is pinned exactly, coordinated families live in the `catalog:` block of `pnpm-workspace.yaml`, and the rest take minor (`^`) or patch (`~`) updates. Read `.agents/rules/dependency-pinning.md` before adding or updating a dependency.

### UI and Token Standards

Selection priority: semantic shadcn/ADS utilities, accent Tailwind classes from `app/tailwind-theme.css`, then raw `token()` or `var(--ds-...)`. Use shadcn naming in `components/ui/*` and ADS semantic naming in VPK feature code.

- Motion: name a vaguely described effect with `animation-vocabulary` first; implement with VPK duration/easing tokens and reduced-motion handling per `.agents/rules/motion-decisions.md`.

### ADS Lookups

`atlas ads <cmd>` (an Atlas CLI plugin; there is no bare `ads` binary; elsewhere `npx @atlaskit/ads-cli <cmd>`) comes before the ADS MCP. Command table and the MCP-only exceptions: `.agents/rules/ads-lookups.md`.

## Workflows

### Development

- Install dependencies: `pnpm install`.
- Run `pnpm run rovo` for Rovo Serve + backend + frontend. First time, copy its printed `ROVO_SESSION_TOKEN` into `.env.local`, then restart.
- Local dev/browser verification: `pnpm run dev:tmux:start` is worktree-aware, detached, and survives turns; stop only this worktree with `pnpm run dev:tmux:stop`. Navigate to the stable Portless `🌐 https://…` URL from `pnpm ports`; use `.dev-frontend-port` only if no Portless route exists, and never assume a default port.
- Foreground fallback: `pnpm run dev`; Rovo-selected flows still require Rovo Serve.
- Symphony: `pnpm run symphony` (requires `LINEAR_API_KEY`, `SYMPHONY_LINEAR_PROJECT_SLUG`, and `mise`).
- Repair the repository skills symlink with `pnpm run sync:rovo:skills`.
- Full launcher matrix (Rovo tmux variants, service-only launchers, attach/status, and Portless): `.agents/docs/workflows-extended.md`.

### Build and deploy

`pnpm run build` verifies; production uses `pnpm run build:export` (never `NEXT_OUTPUT=export pnpm run build` directly); redeploy with `pnpm run deploy:micros` once `.deploy.local` exists. Details: `.agents/docs/workflows-extended.md`.

### Testing

- There is no single `pnpm test` script in `package.json`.
- Repo tests span `backend/`, `lib/`, `scripts/`, `app/`, `components/`, and `rovo/`; run targeted `node --test` commands against relevant `.test.js` or `.test.ts` files.
- Source-contract tests, rendering UI in tests (`renderComponent()`), suite naming and the unit gate, Playwright specs, CI jobs, and perf budgets: `.agents/rules/testing.md`.
- UI work also needs browser evidence and accessibility checks (`atlas ads docs a11y`, then the MCP-only analyzers): `.agents/rules/ads-lookups.md`.

### Debugging

Inside herdr (`HERDR_ENV=1`), use the `herdr` skill and `herdr pane read <pane> --source recent-unwrapped` to inspect the failing pane before guessing. Outside herdr, run `pnpm run doctor` (preflight, ports, stack, env settings as SET/MISSING, `/api/health`; `--json`) and read the stack's output in `output/logs/<worktree>/dev.log`. Details: `.agents/docs/herdr.md`.

## Gotchas

- Durable generated deliverables belong under `artifacts/**`; disposable browser evidence belongs under `output/**`. Unattended automation must never modify anything under `artifacts/`; interactive `vpk-html` sessions may write under `artifacts/vpk-html/`. Deletion requires an explicit request naming the exact path.
- Worktrees isolate browser automation through deterministic ports, unique Portless origins, and persistent `vpk-dev-<worktree>` tmux sessions. `pnpm run dev:tmux:stop` affects only this worktree. Only `tmux kill-server` and `portless prune` cascade globally — never use either for per-worktree cleanup; use the stop command or `portless alias --remove <name>`.
- Never import transitive pnpm dependencies directly — pnpm's strict isolation only allows imports from `package.json` direct dependencies. Use internal mechanisms (e.g., `globalThis.__PLATFORM_FEATURE_FLAGS__`) or add the package explicitly.
- The repo is public: never commit tokens or secrets. Registry routing and where npm tokens live: `.agents/rules/dependency-pinning.md`.
- Ports, port files, memory, worktree bootstrap and env seeding gotchas: `.agents/docs/dev-environment.md`.

## Architecture

Two runtime modes: **dev** (Next.js proxy + Express, with optional Rovo Serve for selected chat/tool flows) and **prod** (single Express process serving static export). Key dirs: `app/` (routes), `components/` (UI), `backend/` (API), `rovo/` (AI config). See `.agents/docs/architecture-overview.md` for full details before making architectural changes.

### Architecture Quality Bar

New behavior gets a clear owner instead of expanding an already-busy file. Before implementing a non-trivial feature or refactor, check these constraints:

- Keep route/shell/top-level files shallow and put behavior in its canonical layer; shared primitives stay generic, while domain behavior belongs behind adapters, hooks, strategies, or render callbacks.
- Normalize data at boundaries with typed models/resolvers/reducers/dispatchers; repeated conditionals, nullable modes, booleans, casts, and fallbacks signal a weak state model.
- Treat 1000-line files as a decomposition alarm. Do not push a file past that size, or add another concern to an already-oversized owner, unless the structure is clearly intentional and still easy to scan.
- When introducing a shared abstraction, migrate the old local copies and delete the duplicate behavior in the same change. Do not let old and new card, directory, toolbar, reducer, parser, or converter implementations coexist.
- Split orchestration from business logic. Long reset/generation/chat flows should move state transitions into reducers or dedicated helpers, keep independent async work parallel when practical, and avoid half-applied UI/backend state.
- For responsiveness work or changes to component mounting/subscriptions, follow `.agents/docs/playbooks/improve-ui-performance.md`: measure the interaction, reuse shared mechanisms, and verify state lifetime before changing defaults.
- Prefer stable, deterministic contract tests around extracted helpers or data boundaries. Add exact-file tests to the repo unit gate when they protect real behavior; avoid relying on broad source-grep tests for durable architecture contracts.

> Before endpoint or chat changes, read `.agents/rules/api-surfaces.md` and `.agents/rules/chat-architecture.md`.

## Behavioral Rules

### Execution Discipline

- Skill routing: do not select `vpk-component` merely because a task touches a component. Use it only when the user explicitly invokes it, names or links an upstream ADS/Atlaskit/shadcn/Base UI component source, or requests parity with one. Ordinary edits, bug fixes, copy changes, layout changes, motion changes, and maintenance of existing VPK components follow the normal workflow without `vpk-component`.
- Reuse before building: before writing any UI, search `components/ui-custom/`, `components/ui/`, and the screen the user references for an existing component or asset (SVG, animation) and reuse it verbatim. Do not write custom/creative markup, add style overrides, copy a component piece-by-piece, or re-implement what already exists. When the user names an existing component/asset, make only the minimal additive change requested (e.g. "add the publish button on the far right") and never substitute a different-but-related component on your own judgment.

### Code Quality

- Verify exact file location before UI edits by searching for distinctive text/classes.
- Use macOS/BSD-safe shell patterns (for example `sed -E`, not GNU-only flags). Edit files with the edit or patch tool at a literal path, not `sed -i` (see `.agents/rules/agent-operations.md`).
- When fixing a bug, add a regression test that reproduces the original failure.
- After a UI edit, prove it on the exact route the user will see: `pnpm control-vpk capture <route>` saves one light-theme screenshot plus console, page-error, and a11y results. Add states or viewports only when the change depends on them or the user asks. When the user says they'll verify it themselves, stop browser checks for that task (`VPK_VERIFY=manual` makes `capture` a no-op).
- When changing a pattern or default, migrate every old instance in the same change so old and new never coexist.

## Contextual Rules

Rules live in `.agents/rules/` (canonical; `.claude/rules` and `.cursor/rules` symlink to it). Loading is per-provider, and it is not lazy everywhere:

- Claude Code: reads through the `.claude/rules` symlink. A `.md` rule without `paths:` frontmatter loads every session; a rule with `paths:` loads once a matching file is read. `.mdc` files are not injected. This file plus the unscoped rules are a standing context cost on every session, so keep additions proportionate and scope new rules.
- Cursor: reads `.mdc` files only. `.agents/rules/cursor/*.mdc` are generated mirrors of each `.md` rule (`globs:` = `paths:`); after editing a rule, run `node scripts/generate-cursor-rules.js` (`verify:cursor-rules` checks drift). `browser-screenshots.mdc` is hand-written.
- Codex and Rovo: no auto-load. Before editing files matching a rule's scope, read that rule first; `pnpm control-vpk where <path>` lists the rules that cover a path.

Each rule's `paths:` frontmatter is its canonical scope; `scripts/agent-rule-scopes.test.js` keeps this table equal to it.

| Rule file | Read before editing |
| --- | --- |
| `token-priority.md` | `**/*.tsx`, `**/*.css` |
| `ui-code-style.md` | `**/*.tsx`, `**/*.css` |
| `component-architecture.md` | `components/**`, `app/**/*.tsx`, `hooks/**`, `eslint.config.mjs`, `scripts/eslint-boundary-rules.test.js` |
| `chat-architecture.md` | `app/contexts/**`, `app/api/chat-sdk/**`, `backend/chat/**`, `backend/routes/**`, `backend/lib/**`, `rovo/**`, `lib/rovo-*.ts`, `components/projects/rovo*/**`, `components/projects/studio/**` |
| `api-surfaces.md` | `app/api/**`, `backend/**` |
| `gotchas-ui.md` | `components/**/*.tsx`, `app/**/*.tsx` |
| `gotchas-chat.md` | `app/contexts/**`, `app/api/chat-sdk/**`, `backend/chat/**`, `backend/routes/**`, `backend/lib/**`, `rovo/**`, `lib/rovo-*.ts`, `components/projects/rovo*/**`, `components/projects/studio/**` |
| `gotchas-react.md` | `**/*.tsx` |
| `motion-base-ui.md` | `**/*.tsx`, `**/*.jsx` |
| `motion-decisions.md` | `components/**/*.tsx`, `app/**/*.tsx`, `**/*.css`, `lib/motion.ts` |
| `ads-lookups.md` | `components/**/*.tsx`, `app/**/*.tsx`, `**/*.css` |
| `dependency-pinning.md` | `package.json`, `backend/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` |
| `testing.md` | `**/*.test.*`, `tests/**`, `playwright.config.ts`, `scripts/run-js-unit-tests.mjs`, `scripts/js-unit-test-*.mjs` |
| `agent-operations.md` | `.agents/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.rovo/**`, `scripts/validate-agents*.js`, `scripts/validate-skills*.js` |
| `appendix-reference.md` | `backend/**`, `app/contexts/**`, `app/providers.tsx`, `.agents/**` |
| `browser-screenshots.mdc` | `*` (always) |

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

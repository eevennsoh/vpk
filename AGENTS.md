# VPK (Venn Prototype Kit)

> Provider-neutral project context for AI coding assistants (Cursor, Claude Code, Codex, and others).
> Canonical source: `AGENTS.md`. There is deliberately no `CLAUDE.md` — Claude Code loads `AGENTS.md` as project instructions by default (`instructionFiles: "claude-md-or-agents-md"`); do not recreate one. Provider dirs (`.cursor/`, `.claude/`, `.codex/`, `.rovo/`) contain provider-specific config plus symlinks back to `.agents/`.

Next.js 16 (React 19, Tailwind CSS v4) + Express backend with AI SDK (Vercel), AI Gateway, and Rovo Serve integration.

## Start Here

- Read this file top-to-bottom once. Quick start: `pnpm install`, then `pnpm run rovo`.
- Production uses one Express process serving the static export plus `/api/*`.
- Frontend edits live mainly in `components/projects/`, `components/blocks/`, `components/arts/`, `components/ui-custom/`, `components/ui-audio/`, `components/visual/`, `components/website/`, and `app/`.
- Backend/API ownership: `backend/app.js` composes Express; `backend/server.js` owns startup/static serving/listen/WebSockets; `backend/routes/*.js`, `backend/chat/*.js`, `backend/services/*`, and `backend/middleware/*` own their domains; `app/api/**/route.ts` owns dev proxies and route adapters.
- Validate every change with `pnpm run lint` and `pnpm run typecheck`; UI changes also need visual and accessibility checks.
- UI feedback and recurring component misuse: assess lint prevention before handoff. Read the **Design-system lint maintenance** section in `.agents/rules/component-architecture.md`; tighten established policy in the narrowest contract and add executable lint cases. Propose uncertain new policy rather than enforcing it globally. Run `pnpm run lint:design-system` and `node --test scripts/eslint-boundary-rules.test.js` when changing those contracts.
- For browser verification after editing code served by the local Next.js app, load and follow `next-dev-loop`; it owns the `/_next/mcp` plus `agent-browser` runtime cross-check. For browser work that is not verifying a Next.js edit, default to `agent-browser` (`npx agent-browser`) and load its skill first. Keep artifacts under ignored `output/agent-browser/`. If `agent-browser` is unavailable or blocked, use Playwright CLI after loading its skill.
- Browser entry: resolve the requested component, block, or project's exact route before opening a browser. Use the supplied route or the current route/catalog map, then navigate directly on this worktree's origin (`control-vpk open-target <route>`). Do not start at the bare origin, `localhost:3000`, or a category landing page and browse for the object. Start at home only when the task explicitly verifies catalog navigation or that entry point; confirm the target URL and route marker before debugging.
- Symphony browser evidence is the exception: use `vpk-symphony` so issue evidence lands under ignored `output/playwright/` per `WORKFLOW.md` and `.agents/docs/symphony.md`.

## Documentation Index

**Project References**:

| When you need...                       | Read                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| UI performance decisions and shared mechanisms | `.agents/docs/playbooks/improve-ui-performance.md`          |
| Maintained upstream runtime-library adoption | `.agents/docs/playbooks/adopt-upstream-runtime.md`         |
| Reference-video motion acceptance and replay | `.agents/docs/playbooks/recreate-reference-motion.md`      |
| Component architecture rules           | `.agents/skills/vpk-tidy/SKILL.md`                          |
| Design-system lint contracts and maintenance | `eslint.config.mjs`, `.agents/rules/component-architecture.md`, `scripts/eslint-boundary-rules.test.js` |
| React patterns reference (1000+ lines) | `.agents/skills/vpk-tidy/references/patterns.md`            |
| Shared visual contract                 | `DESIGN.md`                                                 |
| Design token catalog (200+ tokens)     | `.agents/skills/vpk-design/references/tokens.md`            |
| Figma inspection, asset export, and code pipeline | `.agents/skills/vpk-design/SKILL.md`                        |
| Deployment guide                       | `.agents/skills/vpk-deploy/references/guide-deployment.md`  |
| Setup walkthrough                      | `.agents/skills/vpk-setup/references/guide-setup.md`        |
| Local skills catalog (generated)       | `.agents/skills/INDEX.md`                                   |
| Endpoint tables (generated)            | `.agents/knowledge/api-surfaces.md`                         |
| AI SDK chat integration                | `rovo/config.js`, `app/contexts/context-rovo-chat.tsx`      |
| AI Gateway helpers                     | `backend/lib/ai-gateway-helpers.js`                         |
| Rovo Serve gateway (agent loop)        | `backend/lib/rovo-gateway.js`, `backend/lib/rovo-client.js` |
| UI message types and data parts        | `lib/rovo-ui-messages.ts`                                   |
| Repository skills for Rovo            | `scripts/sync-rovo-skills.js`, `backend/lib/rovo-skills-overlay.js` |
| Architecture overview                  | `.agents/docs/architecture-overview.md`                     |
| Extended workflows                     | `.agents/docs/workflows-extended.md`                        |
| cmux inter-agent messaging             | `.agents/docs/cmux-messaging.md`                            |
| Step-by-step task playbooks            | `.agents/docs/playbooks/`                                   |
| Cursor Cloud environment setup         | `.agents/docs/cursor-cloud.md`                               |
| Symphony orchestrator                  | `.agents/skills/vpk-symphony/SKILL.md`, `.agents/docs/symphony.md`, `WORKFLOW.md`, `scripts/symphony.sh` |

**Global Skills** — installed agent skills (outside repo):

| When you need...                | Read                                                  |
| ------------------------------- | ----------------------------------------------------- |
| Component design fundamentals   | `~/.agents/skills/building-components/references/`    |
| React composition patterns      | `~/.agents/skills/vercel-composition-patterns/rules/` |
| React/Next.js performance rules | `~/.agents/skills/vercel-react-best-practices/rules/` |
| Motion-effect naming            | `~/.agents/skills/animation-vocabulary/SKILL.md`      |
| AGENTS.md best practices        | `~/.agents/skills/claude-md-improver/references/`     |

**External Documentation** — fetch via tools when needed:

| When you need...        | URL                                                                      |
| ----------------------- | ------------------------------------------------------------------------ |
| Atlassian Design System | `atlas ads` CLI first (see **ADS Lookups**), then `https://atlassian.design` |
| shadcn/ui components    | `https://ui.shadcn.com/docs`                                             |
| Tailwind CSS            | `https://tailwindcss.com/docs`                                           |

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
- React 19: `use(Context)`, `<Context value={}>`, and `ref` as a regular prop; not `useContext()`, `<Context.Provider>`, or `forwardRef`.
- Conditional rendering: use ternary (`cond ? <X /> : null`), not `&&` patterns that can render `0`.
- Prefer semantic token classes; do not introduce `bg-[var(--ds-...)]` / `text-[var(--ds-...)]` in VPK components.
- Figma links and assets: load `vpk-design` and use the official Figma MCP first. Its tools may be lazy/deferred, so discover the exact `mcp__figma__*` capability and use `whoami` for access diagnostics before declaring Figma unavailable. Do not jump to browser login or `FIGMA_TOKEN` while the configured MCP is callable.
- ADS content (components, tokens, icons, docs): query the `atlas ads` CLI first; ADS MCP tools are fallback only. See **ADS Lookups**.
- Custom CSS classes: prefer `@utility name { … }` (Tailwind v4 idiom) over `@layer components`. Full rules in `.agents/rules/token-priority.md`.

## Engineering Standards

### Code Style

- UI primitives: `components/ui/*`; icons: `@atlaskit/icon/core/*`, then `@atlaskit/icon-lab/core/*`; product logos: `@/components/ui/logo`.
- Use `next/image` with explicit dimensions. Put static assets in `public/`, reference absolute paths, and group them under `1p/`, `3p/`, `illustration/`, or `illustration-ai/`.
- Shadows: `token("elevation.shadow.raised")` or `token("elevation.shadow.overlay")`
- Dates: `Intl.DateTimeFormat("en-US", { dateStyle: "medium" })` (always specify locale to avoid SSR/client hydration mismatch)

Key imports:

```tsx
import { token } from "@/lib/tokens"; // spacing, shadows, dynamic values only
import { cn } from "@/lib/utils"; // class merging (all className props)
import { Button } from "@/components/ui/button";
import { useChat } from "@ai-sdk/react"; // chat message state + streaming
import { DefaultChatTransport, type UIMessage } from "ai"; // transport + message types
```

### Dependency Pinning

Pin dependencies so routine in-range updates stay semver-safe; the lockfile is the gate. **Float** (`^x.y.z`) libraries take patch + minor updates; **Cautious** (`~x.y.z`) libraries take patches only; **Locked** exact versions cover framework core (`react`, `react-dom`, `next`, `eslint-config-next`, `recharts`, `@modelcontextprotocol/sdk`) and coordinated families.

- Coordinated tiptap, json-render, and remotion families live in the `catalog:` block of `pnpm-workspace.yaml`; update it once, never individual `"catalog:"` references.
- Use `overrides:` only to force one version across the whole tree, including transitives.

- Survey what is behind: `pnpm run deps:check` (wraps `pnpm outdated` with an explicit status line — bare `pnpm outdated` prints nothing and exits 0 when current, which reads as silence)
- Pull all in-range Float/Cautious updates and report status: `pnpm run deps:update` (runs `pnpm update`, then `deps:check`)
- For Locked deps edit `package.json`; for catalog families edit `pnpm-workspace.yaml`; then run `pnpm install`.
- After any update run `pnpm run lint` and `pnpm run typecheck`; for major bumps also smoke-test `pnpm run dev`

### UI and Token Standards

Selection priority: semantic shadcn/ADS utilities, accent Tailwind classes from `app/tailwind-theme.css`, then raw `token()` or `var(--ds-...)`. Use shadcn naming in `components/ui/*` and ADS semantic naming in VPK feature code.

- Use `~/.agents/skills/animation-vocabulary/SKILL.md` when a user describes a motion effect vaguely or asks what an effect is called. Name or disambiguate the effect first; the skill is glossary help, not implementation guidance.
- For implementation, reuse existing patterns, then follow `.agents/rules/motion-decisions.md`, `.agents/rules/token-priority.md`, the global `motion` skill for Motion for React, and `.agents/rules/motion-base-ui.md` for Base UI.
- Use VPK duration/easing tokens, avoid layout-thrashing motion, and add explicit reduced-motion handling for any motion you introduce or modify.

### ADS Lookups

Retrieve ADS content with the `atlas ads` CLI first — same structured content as the ADS MCP, but faster and cheaper, and the MCP server has hung here for minutes on a single call. It ships as an Atlas CLI plugin (`/opt/atlassian/bin/atlas`), so the command is `atlas ads <cmd>`; there is no bare `ads` binary. Portable fallback on other machines: `npx @atlaskit/ads-cli <cmd>`. Add `--json` when you will parse the output, and use `atlas ads batch --command … --command …` when several lookups serve one decision.

| When you need...                        | Run                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan a UI (components + tokens + icons) | `atlas ads batch --command "search <terms> --type component" --command "search <terms> --type token" --command "search <terms> --type icon"`, or `atlas ads search <terms>` for one unified sweep |
| Search one kind                         | `atlas ads search <q> --type component` / `--type token` / `--type icon` (`[--limit N]`)                                                                                              |
| Exact single lookup                     | `atlas ads component <Name>` / `atlas ads token <name>` / `atlas ads icon <IconName>`                                                                                                 |
| Whole catalog                           | `atlas ads component --all` / `atlas ads token --all` / `atlas ads icon --all`                                                                                                        |
| Foundations guidelines                  | `atlas ads docs <topic...>` (e.g. `atlas ads docs spacing`)                                                                                                                           |
| Accessibility guidelines                | `atlas ads docs a11y <buttons\|forms\|images\|colors\|focus\|keyboard\|screenReaders\|aria\|wcag\|general>`                                                                            |
| ESLint rule docs                        | `atlas ads lint-rules [term...] [--limit N]`                                                                                                                                          |
| Migration guides                        | `atlas ads docs migration <avatar-xsmall-to-xxsmall\|jira-spotlight\|single-step\|multi-step\|motion>`                                                                                 |

Reach for the ADS MCP only when the CLI is unavailable or erroring, or for capabilities with no CLI equivalent: `ads_analyze_a11y`, `ads_analyze_localhost_a11y`, `ads_suggest_a11y_fixes`, `ads_i18n_conversion_guide`, and the broader non-ADS `atlaskit_search_components` / `atlaskit_get_components` catalog.

### Browser Support

Allow Newly Available CSS features (Baseline 2023+) without `@supports` fallbacks.
For Limited-Availability features (e.g. `container-type: scroll-state`, scroll-driven animations),
treat them as progressive enhancement — degrade silently, no polyfill.

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

- Verify the Next.js build locally: `pnpm run build`
- Build the static export used in production deployment: `pnpm run build:export` (do not run `NEXT_OUTPUT=export pnpm run build` directly; the wrapper temporarily moves runtime-only App Router API routes before invoking the export build)
- Fast redeploy to Micros after `.deploy.local` exists: `pnpm run deploy:micros`

### Testing

- There is no single `pnpm test` script in `package.json`.
- Repo tests span `backend/`, `lib/`, `scripts/`, `app/`, `components/`, and `rovo/`; run targeted `node --test` commands against relevant `.test.js` or `.test.ts` files.
- When changing source guarded by a source-contract test, run the colocated exact-file suite before `pnpm run ci:pr`. If implementation moves between owners, relocate the assertion instead of deleting the contract; prefer behavioral, typed, or helper-level proof over incidental prop, class, or source ordering.
- Classify every new or renamed `components/**` `node:test` suite in `scripts/js-unit-test-manifest.mjs` as `stable` or `source-contract`, then verify CI discovery through unfiltered `node scripts/run-js-unit-tests.mjs`. The `--file` option force-runs a named path and does not prove manifest inclusion; unclassified component suites default to `legacy-drift` and are skipped by the CI unit gate.
- Browser coverage is under `tests/**/*.spec.ts`; run targeted specs with `pnpm exec playwright test <spec>` after `pnpm install`.
- GitHub Actions verifies lockfile registry URLs, runs `pnpm install --frozen-lockfile`, then `pnpm run ci:pr` for repository guards, lint, typecheck, and tests. It is required by branch protection on `main` — `/vpk-git-ship` auto-merge waits for it.
- Validation freshness:
  <!-- validation-freshness:begin -->
  Last validated: 2026-09-21
  Commands: `pnpm run validate:preflight`, `pnpm run verify:route-manifest`,
  `pnpm run verify:api-surfaces`, `pnpm run verify:repo-map`,
  `pnpm run verify:vpk-feature-map`, `pnpm run verify:file-size`, `pnpm run verify:catalog`,
  `pnpm run verify:lazy-load`, `pnpm run verify:source-guardrails`,
  `pnpm run verify:doc-scripts`, `pnpm run lint`, `pnpm run lint:design-system`,
  `pnpm run typecheck`.
  Reference docs: `.agents/docs/architecture-overview.md`,
  `.agents/docs/workflows-extended.md`, `.agents/rules/api-surfaces.md`,
  `.agents/rules/token-priority.md`,
  `.agents/rules/component-architecture.md`,
  `.agents/rules/agent-operations.md`.
  <!-- validation-freshness:end -->
- Bundle work: use `pnpm run perf:budget:warn`, strict `pnpm run perf:budget` before shipping, and `pnpm run perf:baseline:timing -- --base-url <URL>` for route timing. Do not commit `output/perf-baseline.json`.
- UI work also needs browser evidence and accessibility checks: fetch the rules with `atlas ads docs a11y <topic>`, then scan the code with the MCP-only `ads_analyze_a11y` / `ads_analyze_localhost_a11y` (and `ads_suggest_a11y_fixes` for remediation — these have no CLI equivalent); see the extended workflow checklist.

### Debugging

Inside cmux, use the `/cmux` skill and `cmux read-screen` to inspect the failing pane before guessing. Outside cmux, inspect `.dev-rovo-port`, `.dev-rovo-ports`, `.dev-frontend-port`, and `.dev-backend-port`. Details: `.agents/docs/cmux-messaging.md`.

## Gotchas

- Durable generated deliverables belong under `artifacts/**`; disposable browser evidence belongs under `output/**`. Automation must never modify anything under `artifacts/`; deletion requires an explicit request naming the exact path.
- Worktree ports are deterministic. Use `pnpm ports` or `pnpm ports watch` (arrows select, Enter opens, `k` confirms kill, `q` quits). The dashboard discovers active worktrees; browser tools use its Portless `🌐` URL, falling back to `.dev-frontend-port`, never a hardcoded port.
- `pnpm run mem` reports each `next-server`'s CPU, port, worktree, and physical footprint via vmmap; `ps` RSS undercounts it ~50x. Next ≥16.3 is healthy at low single-digit GB; `vpk-system-clean` restarts servers at ≥6 GB.
- Worktrees isolate browser automation through deterministic ports, unique Portless origins, and persistent `vpk-dev-<worktree>` tmux sessions. `pnpm run dev:tmux:stop` affects only this worktree. Only `tmux kill-server` and `portless prune` cascade globally — never use either for per-worktree cleanup; use the stop command or `portless alias --remove <name>`.
- Runtime port files: `.dev-rovo-port`, `.dev-rovo-ports`, `.dev-frontend-port`, `.dev-backend-port`
- Dev API calls traverse Next.js proxy then Express; debug both layers.
- TypeScript excludes only `node_modules`; all project directories are type-checked.
- Never import transitive pnpm dependencies directly — pnpm's strict isolation only allows imports from `package.json` direct dependencies. Use internal mechanisms (e.g., `globalThis.__PLATFORM_FEATURE_FLAGS__`) or add the package explicitly.
- Tracked `.npmrc` contains token-free routing: public `@atlaskit/*` uses npmjs and `@atlassian/logo-third-party` uses `atlassian-npm`. Keep tokens in user `~/.npmrc` (as CI does) or ignored `.npmrc.local`.
- Keep `@layer theme, base, components, utilities;` atop `app/globals.css`; it fixes cascade order so component layers do not lose to preflight.
- Theme switching uses `setGlobalTheme()` from `@atlaskit/tokens`; toggling only the HTML `dark` class does not update ADS tokens.
- Fresh worktrees need their own `node_modules`. Managed worktrees copy ignored `.env*` and clone matching dependencies or run `CI=true pnpm install --prefer-offline`; manual worktrees must do this themselves. Do not run parallel pnpm validations until warmup completes.
- Tmux/Rovo launchers (`pnpm run dev:tmux:start`, `pnpm run rovo`, `pnpm run dev:rovo`, `pnpm run rovo:tmux:start`) seed `.env.local` from main or `.env.local.example`; copy/symlink it manually only for direct backend/frontend startup or provider bootstrap.
- `ASAP_PRIVATE_KEY` in `.env.local` already includes surrounding double quotes and literal `\n` escapes — do not add extra quotes.

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
- Use macOS/BSD-safe shell patterns (for example `sed -i ''`).
- For Figma work, front-load key specs: spacing, radius, width constraints, shadow token.
- When editing icons, check consistency across all icons in the component.
- When fixing a bug, add a regression test that reproduces the original failure.
- After a UI edit, verify the change on the live route the user will see (screenshot it), across relevant states and viewports; when changing a pattern or default, migrate every old instance in the same change so old and new never coexist.

## Contextual Rules

Rules live in `.agents/rules/` (canonical; provider dirs `.cursor/`, `.claude/`, `.codex/`, `.rovo/` symlink to it). Loading is per-provider, and it is not lazy everywhere:

- Claude Code: reads through the `.claude/rules` symlink and injects every `.md` in that directory into the system prompt at session start. Nothing narrows this — every `.md` rule loads on every session regardless of the scope table below — and `.mdc` files are not injected. Every byte of `.agents/rules/*.md` is a standing context cost on top of this file — run `wc -c .agents/rules/*.md` to size it, and keep added rule content proportionate.
- Cursor: auto-attaches `.mdc` files only (currently just `browser-screenshots.mdc`), scoped by that file's `globs:` frontmatter. The `.md` rules carry no frontmatter scope and are not auto-attached — reach them through the table below.
- Codex and Rovo: no auto-load. Before editing files matching a rule's scope, read that rule first.

The table below stays the scope reference for every provider — it says which rule governs which files, whether or not your provider preloaded it.

| Rule file | Read before editing |
| --- | --- |
| `token-priority.md` | `*` (always) — most often `components/**/*.tsx`, `app/**/*.tsx`, `*.css` |
| `component-architecture.md` | `components/**/*.tsx`, `app/contexts/**/*.tsx` |
| `chat-architecture.md` | `context-rovo-chat.tsx`, `backend/chat/**`, `backend/routes/chat-*.js`, `backend/routes/rovo-*.js`, `backend/lib/rovo-*.js`, `rovo/**` |
| `api-surfaces.md` | `backend/routes/**/*.js`, `backend/app.js`, `backend/server.js`, `app/api/**/*.ts`, `backend/lib/*.js` |
| `gotchas-ui.md` | `components/**/*.tsx` |
| `gotchas-chat.md` | `context-rovo-chat.tsx`, `rovo-*.js` |
| `gotchas-react.md` | `**/*.tsx` |
| `motion-base-ui.md` | `*.tsx`, `*.jsx` |
| `motion-decisions.md` | `components/**/*.tsx`, `app/**/*.tsx`, `*.css` |
| `agent-operations.md` | `.agents/skills/**`, `.agents/agents/**` |
| `appendix-reference.md` | `backend/**`, `app/contexts/**`, `app/providers.tsx`, `.agents/skills/**` |
| `browser-screenshots.mdc` | `*` (always) |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

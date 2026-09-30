---
name: vpk-verify
description: Drive the VPK web app (catalog, docs, theme, Studio shell) in a real browser and capture proof. Use when proving a UI or routing change works, checking a live route, verifying user-facing behavior, or when the user says vpk-verify or /vpk-verify.
---

# VPK Verify

VPK (Venn Prototype Kit) is a Next.js 16 catalog and prototype host with an Express `/api/*` backend. A user browses component and project surfaces in the browser. This skill is the scripted way to launch this worktree's app, drive it as a user would, and keep evidence.

Read [features/README.md](features/README.md) before a run. For component, block or project debugging, resolve the exact object route before opening the browser and start directly there on this worktree's origin. Use the supplied path/query/hash or current route/catalog metadata, not a guessed slug or a homepage detour. Drive from the matching feature file; a missing recipe does not require browsing home. Other surfaces exist (Express APIs, Rovo Serve chat, Playwright specs under `tests/**/*.spec.ts`); they are not the primary user path. Do not send a Studio/Rovo chat message unless the feature file says to and `control-vpk doctor --require-backend` passes.

## Launch

From the worktree root:

```bash
.agents/skills/vpk-verify/scripts/control-vpk launch
ORIGIN="$(.agents/skills/vpk-verify/scripts/control-vpk url)"
```

`launch` reuses this worktree's already-healthy frontend (the common case while `pnpm run dev:tmux:start` is up). If nothing is serving, it starts the detached worktree stack (`pnpm run dev:tmux:start` through Portless) and records that this run created it.

Ready when `control-vpk doctor` prints `"ok": true`: this worktree's `.dev-frontend-port` is listening and `GET $ORIGIN/` returns 2xx. The origin is the Portless `https://…localhost` URL when one is routed to that port; otherwise `http://127.0.0.1:<frontend-port>`. Never hardcode `:3000` or another worktree's hostname.

`.env.local` is seeded by the tmux launcher. Catalog, docs, and theme do not need Rovo or ASAP. Studio *send* does.

Teardown is **Cleanup**, not a process-name kill.

## Doctor

Run this first, and again after any failed drive:

```bash
.agents/skills/vpk-verify/scripts/control-vpk doctor
```

Worth driving only when `"ok": true` for **this** worktree path. `"ok"` is frontend-only. `"backendOk": true` means `GET $ORIGIN/api/health` returned JSON `status: "OK"`. A 503 with `Cannot connect to backend server` is normal when the Express process is down; catalog/docs/theme still verify. Pass `--require-backend` only for features that hit `/api/*` or send chat.

Refuse to drive:

- another worktree's Portless URL from `pnpm ports`
- a frontend port that is not this checkout's `.dev-frontend-port`
- a shared instance you cannot health-check

Two worktrees can run side by side (deterministic ports, unique Portless origins, `vpk-dev-<worktree>` tmux sessions). Two browsers against the **same** origin share `localStorage` (`ui-theme`) — do not double-drive one instance.

## What to re-check, then prove it

1. **What must I re-check?** `control-vpk where <path|slug|/route> [--json]` walks a changed file or directory up to its owner (catalog entry such as `components/projects/<x>`, or the nearest `components/<group>/<x>`) and prints the app routes that render it, one level of `@/` importers with their routes, and the feature recipes and `tests/**/*.spec.ts` specs that mention those routes or paths. It reads `.agents/knowledge/repo-map.json` only; it does not start anything. The owner line shows the catalog `status` (`live`, `frozen`, `superseded`) and `basedOn`; a frozen or superseded owner prints a warning — confirm the user means that variant before editing it.
2. **Prove this change (default step).** `control-vpk capture <route>` validates the route like `open-target`, opens it on this worktree's origin in the scoped session, sets the viewport (default `1280x720`) and **light** media, reloads, then writes `capture.png`, `capture.aria.txt`, console, page-error and a11y JSON, and `manifest.json` (`route`, `url`, `viewport`, `media`, `variants`, `colorMode`, `counts`, `files`, `ok`) to `output/agent-browser/vpk-verify/<id>/`. It exits non-zero on console errors, page errors, a failed step, or a route that paints only the app shell (no text or media) — a blank screenshot is not proof. A11y violations are reported but non-fatal unless `--strict-a11y`.

```bash
.agents/skills/vpk-verify/scripts/control-vpk where components/projects/jira-team-eu26-end
.agents/skills/vpk-verify/scripts/control-vpk capture /jira-team-eu26-end --wait-text "Jira Design"
.agents/skills/vpk-verify/scripts/control-vpk capture /jira-team-eu26 --variant autoArrange --variant sessionPeel=off --id eu26-auto-arrange
```

Capture one screenshot of the exact route in the light theme by default. Capture more states (`--media dark`, `--viewport 390x844`, `--variant <id>[=on|off]`, each with its own `--id`) only when the user asks or the change is state-specific. `--variant` is repeatable and forces a Settings **Properties** design variant for that load by merging `?variants=<id>,-<id>` into the route's query (see `State entry` in [features/README.md](features/README.md)); it writes no storage, so it does not change the user's settings. An unknown id fails before the browser opens and lists the valid ids. If the summary warns that `data-color-mode` differs from the requested media, a stored theme preference won. Switch it with the header theme control, then capture again. When `VPK_VERIFY=manual` is set, the user has opted into manual verification. `capture` then opens no browser and exits 0. Hand the route to the user instead. Interactions (drag, menus, Settings) still follow the feature recipe through `control-vpk browser`.

## Drive

Harness: `agent-browser` via `control-vpk open-target` for the first object navigation, then `control-vpk browser` for interactions. Both inject a worktree-scoped session (`agent-browser session id --scope worktree --prefix vpk-verify`). Load `agent-browser skills get core` once per session if you are unsure of flags. After a Next.js code edit, also follow `next-dev-loop` (`/_next/mcp` plus this same browser).

Every browser subprocess is bounded to 35 seconds by default. Set
`VPK_VERIFY_BROWSER_TIMEOUT_MS` to an integer from 1000 through 300000 only
when a known command needs a different bound. A timeout closes only this
worktree's scoped browser session. Only browser-starting `open`/`connect`
commands close and retry a stale session once. A non-navigation command against
an inactive session stops immediately; reopen the exact feature entrypoint and
revalidate its route marker before retrying.

```bash
SESSION="$(.agents/skills/vpk-verify/scripts/control-vpk session)"
export AGENT_BROWSER_SESSION="$SESSION"
export AGENT_BROWSER_RESTORE="$SESSION"
.agents/skills/vpk-verify/scripts/control-vpk open-target /jira-team-eu26 --headed
```

Replace the example route with the requested object route. `open-target` validates an explicit mapped repository path, preserves query/hash, and derives this worktree's origin. It rejects root/category landing pages and unmapped paths before browser launch. Confirm the resulting URL and route marker before debugging. When a runtime check requires other browser launch flags, use `control-vpk browser open` with the full target URL and those flags. Raw home/category opens are for explicitly requested catalog or entry-path verification; a direct URL does not prove a catalog title link works.

Prefer ARIA roles, accessible names, and `id` / `href` handles from the feature map. Do not use click coordinates. `find` requires an action (`click`, `fill`, `check`, `hover`, `text`). Presence checks use `find role … text --name`. A bare `find role … --name` fails as `assertion_failure`. Stable handles:

| Handle | What it is |
| --- | --- |
| `#home-category-tab-projects`, `#home-category-tab-ui` | Category tabs (do not click by name `UI` — that substring also matches `UI — Audio`) |
| `a[href='/components/projects/jira-for-you']` | Home project card title |
| `a[href='/components/ui/accordion']` | Accordion catalog/doc link |
| `a[aria-label='Go to projects']` | Sidebar rail logo (prefer this over `find role link --name`) |
| `role=button` name `Close sidebar` / `Open sidebar` | Sidebar rail toggle |
| `role=searchbox` name `Search components` | Sidebar filter (`#sidebar-search`) |
| `role=button` name `Clear search` | Clears the sidebar filter |
| `role=button` name `Light theme` / `Dark theme` / `System theme` | Header theme cycle |
| `role=navigation` name `Breadcrumb` | Component doc trail |
| `role=textbox` name `Message` | Studio composer (placeholder `Describe the agent you want to build`) |
| `role=button` name `Browse all agents` | Studio home |

`pnpm exec playwright test <spec>` is fallback only when `agent-browser` is missing or blocked; it is not this skill's proof path.

### Failure handoff

`control-vpk browser` classifies failures as `timeout`, `stale_session`,
`missing_binary`, or `assertion_failure`. The diagnostic includes the exact
forwarded command and says that existing files under
`output/agent-browser/vpk-verify/` are retained while the failed command is not
accepted as proof. Do not silently continue with a partial screenshot or curl.

If a browser-starting command cannot recover, or the binary is unavailable,
load the Playwright skill and run the narrow fallback named in the diagnostic.
For an inactive non-navigation command, reopen the scoped browser and revalidate
the feature entrypoint first; stale state alone is not a reason to weaken proof
to Playwright or curl. Report the classification and evidence boundary.

## Evidence

Put every proof file under `output/agent-browser/vpk-verify/<feature-id>/` (gitignored `output/`). Always pass an explicit screenshot path — never the agent-browser default cwd dump. `control-vpk capture` does this for a route's loaded state. Use the commands below for states reached mid-interaction.

```bash
EVIDENCE="$(.agents/skills/vpk-verify/scripts/control-vpk evidence-dir)/jira-team-eu26"
mkdir -p "$EVIDENCE"
.agents/skills/vpk-verify/scripts/control-vpk browser snapshot -i --compact --depth 8 > "$EVIDENCE/state.aria.txt"
.agents/skills/vpk-verify/scripts/control-vpk browser screenshot "$EVIDENCE/state.png"
.agents/skills/vpk-verify/scripts/control-vpk browser get url > "$EVIDENCE/url.txt"
.agents/skills/vpk-verify/scripts/control-vpk browser eval --stdin <<'JS'
document.documentElement.getAttribute("data-color-mode")
JS
```

Proof standards:

- Exercise the real route a user opens (`/`, `/ui`, `/components/ui/accordion`, `/studio`), not a test-only endpoint or an internal setter.
- Capture the action and the resulting state (URL + ARIA snapshot or screenshot with VPK identity visible: sidebar `VPK`, heading, or doc `h1`).
- Theme proof includes `document.documentElement.getAttribute("data-color-mode")` plus the theme button's accessible name, not only a screenshot.
- Sidebar search proof includes a visible match and a missing non-match, then the restored nav after clear.
- Do not treat a Studio composer screenshot as proof that chat works. Sending a message is a different, backend-gated path.
- Record the feature ID and entry point with the artifacts.

## Cleanup

```bash
.agents/skills/vpk-verify/scripts/control-vpk cleanup
```

This closes only the `vpk-verify` agent-browser session. It runs `pnpm run dev:tmux:stop` **only** when `launch` started the stack for this run. It never uses `tmux kill-server`, `portless prune`, or `killall node`. It deletes `output/vpk-verify/.run/` scratch state. Proof files under `output/agent-browser/vpk-verify/` stay.

After a failed iteration, run the same cleanup so stranded browsers do not accumulate. If a feature recipe changed theme, restore the original accessible theme-control name by cycling that same user-facing control before cleanup. Do not restore theme by mutating storage, attributes, classes, or ADS variables.

## Helpers

All invocations are from the worktree root. The script is executable.

```bash
.agents/skills/vpk-verify/scripts/control-vpk launch
.agents/skills/vpk-verify/scripts/control-vpk doctor
.agents/skills/vpk-verify/scripts/control-vpk doctor --require-backend
.agents/skills/vpk-verify/scripts/control-vpk url
.agents/skills/vpk-verify/scripts/control-vpk session
.agents/skills/vpk-verify/scripts/control-vpk evidence-dir
.agents/skills/vpk-verify/scripts/control-vpk open-target /components/ui/accordion
.agents/skills/vpk-verify/scripts/control-vpk where components/ui/accordion.tsx
.agents/skills/vpk-verify/scripts/control-vpk capture /components/ui/accordion [--id <label>] [--viewport WxH] [--media light|dark] [--variant <id>[=on|off]]... [--wait-text <text>] [--headed] [--strict-a11y]
.agents/skills/vpk-verify/scripts/control-vpk cleanup
pnpm run verify:vpk-feature-map
```

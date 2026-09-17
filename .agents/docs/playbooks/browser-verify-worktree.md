# Browser Verify Worktree

Use this when verifying UI behavior, screenshots, responsive layout, or local routes in a worktree.

## Start Server

Prefer the detached worktree-aware stack:

```bash
pnpm run dev:tmux:start
pnpm ports
```

Use the stable Portless URL printed as `https://...localhost`. Fall back to `.dev-frontend-port` only when no Portless route exists.

## Open the requested object directly

Resolve the target route before opening a browser. Preserve a supplied component, block, or project path and requested query/hash; use this worktree's origin. If only an object or source file is named, inspect its current catalog metadata and `.agents/knowledge/repo-map.json` to find the canonical docs, preview, or live project route appropriate to the task. Do not guess a route from the directory name or discard the path when discovering the origin.

For example, an Agent Session Column docs task opens `/components/blocks/agent-session-column`; a Team EU26 interaction task opens `/jira-team-eu26`. Use the existing checked entrypoint:

```bash
.agents/skills/vpk-verify/scripts/control-vpk doctor
.agents/skills/vpk-verify/scripts/control-vpk open-target /jira-team-eu26
```

The first browser navigation must be the target object's URL. Confirm the URL and its heading, variant or other route marker before inspecting or interacting. Do not open the bare origin, a category landing page, or `localhost:3000` to search for the object. A health request to the origin does not establish target-route proof. If the route is unknown, resolve it from source/metadata first and report any remaining ambiguity.

Use home-first navigation only when the task explicitly verifies the catalog, a title link, or another entry path. Run that entry-path check separately: opening a direct URL does not prove catalog navigation works. Apply the same target-route rule to `agent-browser`, Next runtime checks and Playwright fallbacks.

## Browser Tooling

1. After editing code served by the local Next.js app, load and follow `next-dev-loop` for the `/_next/mcp` plus `agent-browser` runtime cross-check.
2. For browser work that is not verifying a Next.js edit, load the `agent-browser` skill and use `npx agent-browser` for screenshots, UI probes, public pages, and unauthenticated checks.
3. Put ad-hoc artifacts under `output/agent-browser/`.
4. Use Playwright CLI only when `agent-browser` is unavailable or blocked.

## Checks

For UI changes, cover the edited route plus nearby states:

- default and empty states
- hover or reveal controls
- narrow viewport
- light and dark theme when theme affects the surface

## Failure Modes

- Navigating to a hardcoded port can test another worktree.
- Opening the correct worktree origin without the object path tests the catalog landing page, not the requested component, block or project.
- Restarting a detached server unnecessarily can hide the state a previous turn was using.

---
name: vpk-artifact
description: Package a VPK route, demo, or generated file and publish or update it as an Atlassian Artifact (hello.atlassian.net/artifacts) through the TWG CLI. Use when asked to "publish as an artifact", "share this as an Atlassian Artifact", "host this prototype for coworkers", "upload to Artifacts", "update my artifact", or to turn a VPK demo into a single-file HTML for sharing.
metadata:
  validation_command: node --test scripts/build-artifact-html.test.mjs scripts/publish-artifact.test.mjs scripts/verify-artifact-html.test.mjs
---

# VPK artifact

Publish files to the Atlassian Artifacts app so coworkers can open, share, embed (as a
Smart Link), and search them. For VPK UI, first package the demo into one self-contained
HTML file, prove it survives the viewer's sandbox, then publish or update it.

## When to use

- Share a VPK demo, route, or component with coworkers without deploying a server.
- Publish a generated file: HTML report, CSV, PDF, PPTX, MP4, and similar.
- Refresh an artifact you published before, keeping its URL, embeds, and sharing.

Do not use it for prototypes that need the VPK backend, chat, AI, or WebSockets at runtime
(use `vpk-deploy`), for Jira or Confluence attachments (use the product commands), or to
write an editorial document (write it with `vpk-html`, then publish it here).

## Preconditions

- **TWG must be signed in to production.** In this repo's environment TWG defaults to
  staging (`--env stg`), where `hello` resolves to `hello.jira-dev.com` and every call fails
  with "Access blocked … not in the Atlassian organization associated with your OAuth
  token". Pass `--env prod` on every command; `scripts/publish-artifact.mjs` does this.
  Check with `twg --env prod whoami`. If it is not signed in, ask the user to run
  `twg --env prod login --site hello` in their terminal (it is a browser device flow).
- **Sandboxed shells:** TWG token refresh writes `~/.config/twg`, the build downloads fonts
  from Google Fonts, and the verify step drives WebGL in Chromium. Run those commands
  outside the sandbox when they fail with a write, network, or GPU denial.
- **Publishing is outward-facing.** Confirm the file, name, access level, and create versus
  update with the user before running the publish command.

## Workflow

### 1. Choose the input

| Input | Next step |
| --- | --- |
| A VPK demo under `components/website/demos/<category>/<slug>-demo.tsx` | Build it (step 2). |
| Any component module with a default export | Build it with `--entry <path> --slug <slug>`. |
| A finished file (HTML, CSV, PDF, …) | Skip to verify (HTML only) or publish. |

A finished HTML file must be self-contained: inline its CSS, JS, fonts, and images, and do
not rely on other network hosts (see the viewer constraints below).

### 2. Build a single-file HTML

```bash
node scripts/build-artifact-html.mjs --demo arts/awake --title Awake
```

This writes `artifacts/<slug>/<slug>.html`. It bundles the demo inside the app's real
`Providers`, compiles Tailwind and the ADS tokens using only the classes in the bundle,
embeds only the fonts the page references, and turns `public/` assets such as sounds and
images into data URIs. Read the printed summary: file size, inlined assets, and any
target-hook note such as the date the embedded data runs out.

### 3. Verify under the viewer's CSP

```bash
node scripts/verify-artifact-html.mjs artifacts/awake/awake.html
```

The script loads the file in an `about:srcdoc` iframe under the viewer's Content Security
Policy and prints JSON with `blockedRequests`, `consoleErrors`, `pageErrors`, the rendered
text, and a screenshot under `output/artifact-html/`. Look at the screenshot. Each entry in
`blockedRequests` is a feature that goes blank in the viewer: either accept that or add a
target hook (below). Any entry in `pageErrors` is a failure to fix before publishing.

### 4. Publish or update

Dry-run first, show the user the plan, and publish after they confirm:

```bash
node scripts/publish-artifact.mjs artifacts/awake/awake.html --name Awake --dry-run
node scripts/publish-artifact.mjs artifacts/awake/awake.html --name Awake
```

The script looks up the slug (the `artifacts/<slug>/` folder name, or `--slug`) in
`~/.config/vpk/artifacts.json`. A recorded slug is **updated in place**, which keeps its
URL, embeds, and sharing; `--name` is always re-sent, because TWG otherwise renames the
artifact after the file. A new slug is **created private**. Use `--access shared|open` only
when the user asks. Use `--new` to create a second copy on purpose, and `--description` to
improve search indexing.

The registry lives outside the repo so it survives worktree cleanup. If the user mentions an
artifact the registry does not know, ask for its URL (the ID is the last path segment) and
add it to the registry rather than creating a duplicate.

### 5. Report

Give the user the artifact URL (`https://hello.atlassian.net/artifacts/<id>`), its access
level, and what degrades in the viewer. Next steps for them: **Share** in the artifact's
header sets who can see it, and pasting the URL into Confluence or Jira and switching the
Smart Link to **Embed** shows it inline. Never repeat the signed `object-store…?authToken=`
raw-file URL that TWG prints: anyone holding it can download the file until it expires.

## Viewer constraints

The Artifacts viewer runs HTML in a sandboxed srcdoc frame whose `connect-src` only allows
Atlassian origins. Inline scripts, styles, fonts, and data URIs work; `fetch`, XHR, and
WebSocket calls to any other host are refused. Storage may throw; the build installs an
in-memory fallback. The full policy, what fails, and the build-time data pattern are in
[references/viewer-constraints.md](references/viewer-constraints.md).

## Target hooks

When a demo needs outside data at runtime, add
`scripts/lib/artifact-targets/<slug>.mjs` exporting
`prepare({ fetchOk, loadSourceModule })`, and register it in `TARGET_HOOKS` in
`scripts/build-artifact-html.mjs`. `prepare` can fetch data at build time and return a
`banner`: a self-contained runtime shim serialized with `invokeInBanner` from
`scripts/lib/artifact-runtime.mjs`. It can also return a `summary` line. Follow
`scripts/lib/artifact-targets/awake.mjs`: try the live request first, fall back to the
embedded data, and fail rather than show stale values when the data runs out. Add a test to
`scripts/build-artifact-html.test.mjs` that runs the serialized banner in a `vm` context.

## Alternative: Atlassian MCP v2

Any MCP client connected to `https://mcp.atlassian.com/v2/mcp` can upload artifacts when
asked to "publish this as an artifact to the Atlassian Artifacts app". The packaging and CSP
constraints are the same; the TWG path here is preferred because it records IDs for in-place
updates.

| Client | Configuration | Sign in |
| --- | --- | --- |
| Claude Code | `claude mcp add atlassian --transport http https://mcp.atlassian.com/v2/mcp -s user` | `claude mcp login atlassian`, then restart the session |
| Cursor | `"atlassian": { "url": "https://mcp.atlassian.com/v2/mcp" }` in `~/.cursor/mcp.json` | Cursor Settings → MCP, or `cursor-agent mcp login atlassian` |
| Codex | Keep `url = "https://mcp.atlassian.com/v1/mcp"` exactly | `codex mcp login atlassian` |

Codex runs under Atlassian's managed requirements (`~/.codex/cloud-requirements-cache.json`),
which allowlist MCP servers by exact URL. As of 2026-09-30 only `https://mcp.atlassian.com/v1/mcp`
is allowed, so v2 and `…/v1/mcp/authv2` show "disabled: requirements" in `codex mcp list`. Do not
work around the policy; v1 is scheduled to start serving v2 automatically. Check `codex mcp list`
under the real `CODEX_HOME`, because a temporary home skips the cached policy.

---
name: vpk-tunnel
description: "Share a live VPK localhost prototype through Atlas Tunnel, privately by default or publicly with explicit --public intent and an exposure warning. Clean Atlas tunnels after use. Use when the user says \"vpk-tunnel\", \"share my prototype\", \"make this localhost link public\", \"send a customer a prototype link\", or asks to start, inspect, or stop an Atlas Tunnel for a VPK Portless URL."
purpose: Share one live VPK Portless frontend through a short-lived Atlas Tunnel with explicit access mode and cleanup.
owner: VPK
category: workflow
inputs: Optional Portless URL, action (start, status, or stop), and explicit --public flag.
outputs: Private or public prototype URL, access mode, local source URL, tunnel status, or shutdown and cleanup result.
required_tools: shell, node, pnpm, atlas, cloudflared, tmux
validation_command: node --test .agents/skills/vpk-tunnel/scripts/vpk-tunnel.test.js
generated_artifacts: None. Runtime state is limited to a target-scoped tmux session.
common_failure_modes: Local prototype is unresponsive, Portless URL is stale, Atlas Tunnel or cloudflared is missing, the catalog root was shared instead of the project route, Next.js blocked Atlas Tunnel hosts in allowedDevOrigins, or the react-grab development control is still visible on the public URL.
---

# VPK Tunnel

Share a live VPK prototype through Atlas Tunnel, privately by default.
This workflow is for short research sessions, feedback rounds, and live reviews;
it is not production or long-term hosting.

## Interface

```text
vpk-tunnel
vpk-tunnel https://feature.<project>.localhost/path
vpk-tunnel https://feature.<project>.localhost/path --public
vpk-tunnel status [Portless URL]
vpk-tunnel stop [Portless URL]
```

With no URL, derive the persistent main worktree's stable Portless hostname
from this repository's package metadata. Run `pnpm ports once` to see the exact
URL. A supplied Portless URL selects another live frontend. Preserve its path,
query, and fragment in the tunnel link. Pass raw URLs in terminal commands,
not Markdown links.

## Share the route people should open

The catalog homepage (`/`) embeds project cards in iframes. Those previews look
empty on a tunnel even when the real project works. Do not hand reviewers
the catalog unless they explicitly asked for it.

- If the user named a project or path, share that route
  (for example `/jira-golden-journeys-v4`), not `/` or `/preview/projects/...`.
- If `vpk-tunnel` is invoked with no path, resolve the hostname, then ask which
  route people should open before starting. Do not infer the catalog.
- After resolve, `isCatalogRoot: true` means you still need a share path.

## Private versus external sharing

Default to **private** for a bare invocation or an unspecified audience. Start
without `--public`; neither `--private` nor a confirmation flag is needed.
Tell the user that private tunnels are accessible through Atlassian VPN and
whitelist proxies, so external participants cannot use that link. Private
access is a network restriction; restricted tunnels additionally require
authentication.

Use **public** only when the user explicitly requests external/public sharing
or supplies `--public`. Before starting, show the exact local URL and warn:
**`--public` exposes the local application to the internet; anyone who can
reach the link can access it.** Invoking this skill alone does not authorize
public access. If the intended audience is unclear and external access might
be needed, ask whether they want private VPN access or public internet access,
with private as the default. An explicit external/customer/public request
already selects public access; show the warning without repeating approval.
Do not add an unrelated synthetic-data confirmation.

The helper supports private and public modes. For an explicitly requested
restricted tunnel, Atlas supports `--restricted`; for both access types,
Atlas supports `--public --private`. Do not silently select either advanced
mode or pass unsupported flags to the helper.

## One-time setup

The helper checks dependencies but does not install or upgrade them. If its
preflight reports missing Atlas Tunnel or `cloudflared`, ask before making any
machine-level change, then use the relevant commands:

```bash
atlas upgrade
atlas plugin install --name tunnel
atlas plugin upgrade -n tunnel
brew install cloudflared
```

## Start

1. Run `pnpm ports once` so the user can see the live worktrees and Portless
   URLs. If a custom URL was supplied, require an exact hostname match in that
   inventory.
2. Resolve the target without exposing it:

   ```bash
   node .agents/skills/vpk-tunnel/scripts/vpk-tunnel.js resolve [Portless URL]
   ```

3. If resolution or the HTTP health probe fails, do not start a tunnel. Explain
   whether the prototype must be started, its route fixed, or its Portless URL
   corrected. Use `pnpm run dev:tmux:start` in the owning worktree only when the
   user asks to start it.
4. If resolve reports `isCatalogRoot: true` and the user named a project or
   screen, switch the target to that path and resolve again. If they did not
   name one, ask before continuing.
5. Show the resolved local URL, selected access mode, and its access warning.
   For public sharing, apply the boundary above before adding `--public`.
   Also explain that cleanup deletes **all** CLI-created Atlas tunnels,
   configuration files, and logs, so other Atlas sessions may be disrupted.
6. Start the scoped tunnel:

   ```bash
   vpk-tunnel [Portless URL]
   ```

   Add `--public` only for explicitly selected public sharing. The helper
   prints the access warning before starting and reports `access` and
   `tunnelUrl`. Its `publicUrl` is null for private access.

   The helper refuses to start when `next.config.ts` `allowedDevOrigins` is
   missing `*.public.atlastunnel.com` and `*.atlastunnel.com`. Add those hosts,
   restart that worktree's frontend, re-resolve (the port may change), then
   start again. Do not leave a tunnel bound to the previous port.

   Atlas commands may need permission to write their machine-local cache or use
   the network. Request that permission through the active tool rather than
   weakening the preflight.
7. Open the returned `tunnelUrl` and confirm it is not a blank shell. Private
   links require VPN/whitelist access. Body text
   that is only `Skip to content` means Next.js blocked `/_next` chunks from the
   tunnel host. HTTP 200 is not enough. Also confirm the react-grab development
   control is hidden — the floating cursor/chevron pill and any
   `[data-react-grab]` or `[data-react-grab-toolbar]` nodes. Atlas Tunnel hosts
   skip that tooling automatically. Do not hide it with injected CSS or by
   clicking the pill. Do not hand off the link until the intended UI is visible
   and that control is gone.
8. Report the returned `tunnelUrl`, its private/public access mode, and the
   `localUrl`. State that the link works only while the local server, scoped
   tunnel session, laptop, and network connection remain active.

The helper runs one of these commands in a hostname-scoped tmux session:

```bash
atlas tunnel start --port <resolved-frontend-port>
# Only for explicitly requested public/external access:
atlas tunnel start --port <resolved-frontend-port> --public
```

Starting the same hostname again reuses its existing tunnel only when the
frontend port and access mode match. A different mode or port stops and cleans
the old tunnel before starting another. Existing sessions from the former
public-only helper are replaced rather than assumed private. Different paths
on one hostname share a tunnel and receive path-specific links.

Atlas Tunnel hosts automatically hide the react-grab development
control. Local Portless URLs keep it for development.

## Status and stop

Inspect only the selected hostname's tunnel:

```bash
node .agents/skills/vpk-tunnel/scripts/vpk-tunnel.js status [Portless URL]
```

Stop that hostname's local tunnel session and clean Atlas resources:

```bash
node .agents/skills/vpk-tunnel/scripts/vpk-tunnel.js stop [Portless URL]
```

**Every time a tunnel finishes, run `atlas tunnel clean`.** This includes
normal completion, explicit stop, interruption, and failed startup after a
session was launched. The helper installs an exit trap and runs cleanup again
on `stop`, including when the session has already exited. For a manually run
Atlas command, always finish with:

```bash
atlas tunnel clean
```

Cleanup deletes all tunnels created by the CLI, plus configuration files and
logs; it is not a hostname-scoped remote deletion. Do not promise that other
Atlas tunnels remain available. If cleanup fails, report the error and retry
`atlas tunnel clean` before restarting or claiming cleanup completed. Abrupt
machine shutdown or force-killing outside the helper can prevent exit traps;
run the stop command or manual cleanup on return.

Do not stop the VPK dev server unless the user separately asks for it, or
`allowedDevOrigins` must change. After any frontend restart, re-resolve and
start the tunnel again.

## Troubleshooting

- **Atlas Tunnel errors:** first check the installed plugin version with
  `atlas plugin installed`; upgrade a stale plugin with
  `atlas plugin upgrade -n tunnel` after approval for that machine-level change.
- **External participant cannot open a private link:** explain the VPN/proxy
  restriction. Switch to `--public` only when public access is explicitly
  selected, with the internet-exposure warning.
- **Unknown Portless URL:** run `pnpm ports once` and use an exact listed URL.
- **Recorded route but dead port:** start or repair that worktree's frontend.
- **HTTP probe times out or returns an error:** open the local route and fix it
  before exposing it; port liveness alone is not enough.
- **Public page is blank / catalog cards are empty white boxes:** Next.js
  blocked `/_next` chunks from the Atlas Tunnel host. Confirm
  `allowedDevOrigins` includes `*.public.atlastunnel.com` and
  `*.atlastunnel.com`, restart the owning frontend, re-resolve, then start
  again. Check `.next/dev/logs/next-development.log` for
  `Blocked cross-origin request` if the page is still empty.
- **Shared the homepage and it looks empty:** share the project route
  (for example `/jira-golden-journeys-v4`), not the catalog iframe.
- **Public page still shows the react-grab control:** Atlas Tunnel hosts skip
  `DevReactGrabMount`. Hard-refresh the public URL. If the floating
  cursor/chevron pill remains, the frontend may be serving a stale bundle —
  restart that worktree's frontend, re-resolve, then start again.
- **Frontend restarted and the tunnel died:** the frontend port likely
  changed. Re-resolve, then start again. The helper replaces a session whose
  stored port no longer matches.
- **Missing Atlas Tunnel plugin:** run the one-time Atlas commands after user
  approval, then retry.
- **Missing `cloudflared`:** install it with Homebrew after user approval.
- **Tunnel session exists but has no public URL:** inspect `status`; if Atlas
  exited or authentication failed, stop the scoped session and retry after
  fixing the reported error.

## Report format

For a successful start, keep the handoff compact:

```text
Access: Private (VPN/whitelist proxies) or Public (internet accessible)
Link: <tunnel URL>
Local source: <Portless URL>
Status: Live while the local server, tunnel, laptop, and network stay running.
Stop: vpk-tunnel stop <Portless URL>
Cleanup: atlas tunnel clean runs after use and deletes all CLI-created tunnels.
```

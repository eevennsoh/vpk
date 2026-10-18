---
name: vpk-domain
description: Give a local VPK prototype a presentation-friendly HTTPS hostname. Use for vpk-domain, masking localhost, a fake demo domain, or setting up, inspecting, or removing a local presentation URL. For links other people can access, use vpk-tunnel or hosting instead.
---

# VPK domain

Map a presentation hostname to the existing local frontend through Portless.
The browser displays a real locally resolved HTTPS URL. This does not register
a public domain or make the prototype remotely accessible.

## Requests

These are agent invocations, not an installed shell command:

```text
vpk-domain <local URL> as jira.atlassian.test
vpk-domain <local URL> as keynote.localhost
vpk-domain status jira.atlassian.test
vpk-domain remove jira.atlassian.test
```

With no source, resolve the current worktree and requested project route. Ask
for the route only if context does not identify it. With no hostname, recommend
`jira.atlassian.test` for a Jira presentation or a descriptive `<demo>.test`.
Use the user's chosen hostname when supplied. Prefer reserved `.test` over an
invented suffix such as `.next`; `.localhost` is the smallest setup change.
Do not substitute a live company, login, or production hostname. If one was
requested, explain that overriding it diverts this machine's real traffic and
offer a `.test` equivalent before changing resolution.

## Resolve before changing anything

1. Read the current worktree instructions. Run `pnpm ports once` and
   `.agents/skills/vpk-verify/scripts/control-vpk doctor` in that checkout.
   For an extracted app, inspect its own launcher and actual listener instead.
   Match the frontend port to the owning process/worktree; port files alone
   can be stale. Preserve the source URL's path, query, and fragment.
2. Check the exact source route responds and renders. If the requested app is
   stopped, start its existing launcher as part of setup, then resolve again.
   VPK uses `pnpm run dev:tmux:start`. Do not start a duplicate Next server.
3. Prefer the repo CLI consistently throughout the session:

   ```bash
   pnpm exec portless --version
   pnpm exec portless --help
   pnpm exec portless list
   pnpm exec portless doctor
   ```

   The global CLI can be older than the dependency. Custom TLD instructions
   below were checked against repo Portless 0.15.6; inspect installed help
   before applying them elsewhere. Do not upgrade dependencies automatically.
4. Inspect the active proxy's state directory, listener, TLS mode, suffixes,
   service configuration, and route table. Record these and the source port in
   ignored `output/vpk-domain/<hostname>/` with the intended alias and exact
   cleanup command. Store no private keys there. Reuse an identical alias;
   if a hostname belongs to another target, choose another name or resolve
   that conflict with the user. Do not use `--force` by default.

Creating or editing this skill does not itself request a live domain setup.
During setup, normal runtime permission prompts cover hosts-file, certificate
trust, and privileged listener changes. Describe their concrete effects before
executing them; do not repeat authorization already given. Never bypass TLS
checks or use a browser ignore-certificate-errors flag to claim success.

## Configure the hostname

Use the existing proxy and certificate authority. Portless handles HTTPS,
WebSockets, and hosts-file synchronization, so VPK does not need a Python
static server, a second reverse proxy, or a separate mkcert authority.

### Existing suffix

If the proxy already serves the selected suffix, register the alias directly.
Replace the example name and placeholder with the resolved values:

```bash
pnpm exec portless alias keynote <verified-frontend-port>
pnpm exec portless list
```

With the default suffix this yields `https://keynote.localhost`. Alias creation
does not start the proxy or app. If the proxy is stopped, start it with its
recorded settings before verification.

### Custom suffix such as .test

Custom suffixes are shared proxy settings. Preserve every existing suffix,
TLS setting, port, and state directory. If a running proxy needs a new suffix,
prepare the exact restart and restoration commands first. Explain the brief
interruption to all its routes; obtain approval for that shared interruption
unless it is already authorized. Leave useful independent work complete.

For a default HTTPS proxy using only `.localhost` on port 443, the change is:

```bash
pnpm exec portless proxy stop
PORTLESS_LAN=0 pnpm exec portless proxy start --https --port 443 --tld localhost --tld test
pnpm exec portless alias jira.atlassian <verified-frontend-port>
pnpm exec portless list
```

Use the verified existing settings instead when they differ. Keep the proxy
on loopback; do not enable LAN mode, a tunnel, or public sharing for this task.
If a startup service manages it, inspect that service first and use its
supported configuration lifecycle rather than racing a second daemon. Do not
install a boot service merely for a presentation.

With both suffixes configured, this alias registers
`jira.atlassian.localhost` and `jira.atlassian.test`. Record all returned names
and check all of them for conflicts before registration. Portless applies
every configured suffix to the base alias. Supplying a full hostname does not
restrict registration to that suffix.

Run `pnpm exec portless hosts sync` if resolution is missing and
`pnpm exec portless trust` if the browser does not trust the local CA, using
the runtime's permission flow where needed. `/etc/hosts` does not support
wildcards: each presentation hostname needs a record even if a certificate
covers multiple names. If port 443 belongs to another service, do not kill it.
Coordinate reuse or offer a verified unprivileged port with its visible URL
suffix. Never promise a port-free URL when the listener is on a nonstandard port.

## Preserve app behavior

- Proxy the whole origin to the verified frontend HTTP port, not the backend
  or Portless's own port. Keep `/_next`, `/api`, streaming, and WebSocket
  traffic on the same upstream. Each app/worktree gets its own hostname.
- Keep the route path by default. A hostname alias does not turn `/jira-demo`
  into `/`. If the user also wants to hide the path, treat that as a separate
  route-mounting requirement. Use the existing `vpk-build` workflow when an
  extracted root-route app is appropriate; do not blindly prefix asset/API URLs.
- For Next development, read the installed Next docs for `allowedDevOrigins`
  and add only the required hostname to the existing config when absent.
  Follow repo edit validation and `next-dev-loop` for that change. Restart only
  the owning frontend, re-resolve its port, and update this task's alias if it
  changed. Do not weaken the allowlist to `*`.
- New origins have separate localStorage, IndexedDB, cookies, and service
  workers. Prepare presentation state on the new origin. Authentication
  callbacks, absolute redirects, and CORS rules may need an exact origin entry;
  inspect the actual failure before changing them. Do not copy auth cookies.
- Alias records persist after the frontend stops. Recheck upstream ownership
  before every rehearsal so a reused port cannot silently show another app.

## Verify and hand off

Verify normal hostname resolution and HTTPS trust without `curl -k` or a DNS
override. A `curl --resolve` probe is only a routing diagnostic, not DNS proof.
Use `agent-browser` per repo guidance to navigate directly to the final URL,
including its preserved route. Confirm the expected screen renders, refresh
works, assets load, and no TLS or console errors appear. Exercise the demo's
API/streaming flow and development WebSocket connection when used. Save proof
under `output/agent-browser/vpk-domain/`. Honor explicit manual verification.

Report the clickable presentation URL, source URL, hostname mappings added,
any shared settings changed, and the exact removal invocation. State that it
works only on this configured machine while the frontend and proxy run. If
DNS, trust, or browser proof is blocked, report that boundary instead of calling
the URL ready. A hosts-file alias is not a share link.

## Status and removal

For status, inspect the recorded mapping, current `portless list` and `doctor`,
actual upstream owner, and final route response. Do not mutate configuration.

For removal, verify the alias still points to this task's recorded target and
that its associated names have not been reassigned. With the same suffix
configuration used above:

```bash
pnpm exec portless alias --remove jira.atlassian
pnpm exec portless list
```

This removes both suffix variants. If proxy settings changed since setup,
inspect which names the command would remove before running it. Confirm the
owned routes and hosts entries are gone and other routes remain; reconcile
with `hosts sync` if needed. Remove only this task's artifacts. Keep the app
running unless asked to stop it. Do not run `portless clean`, `hosts clean`,
`prune`, or uninstall the shared CA for alias cleanup. Restore shared proxy
settings only if requested and no remaining route depends on the added suffix.

## Guide adaptation

Based on the supplied screenshots of [Make AI Protobox look like a real browser
tab](https://hello.atlassian.net/wiki/spaces/teamkeynote/pages/7951884086).
The useful model is local name resolution plus trusted TLS plus a proxy on
443. Portless supplies these for VPK. This also avoids the guide's static
server limitations, all-interface binding, certificates beside served files,
and inconsistent example certificate filenames. Keep existing `/_next` paths;
separate hostnames allow multiple apps without rewriting assets as relative.

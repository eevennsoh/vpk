# Artifacts viewer constraints

Observed on `hello.atlassian.net/artifacts` on 2026-09-30, while the app was in beta. Re-check
the console of a live artifact when behavior changes, and update `VIEWER_CSP` in
`scripts/verify-artifact-html.mjs` to match.

## How HTML is rendered

- The viewer page loads the artifact into an `iframe` through `srcdoc`, so the document's
  URL is `about:srcdoc` and it inherits the host page's Content Security Policy.
- Relative URLs do not resolve against anything useful. Every asset has to be inline or a
  data URI, which is what `scripts/build-artifact-html.mjs` produces.
- `localStorage` and `sessionStorage` may throw in the sandboxed frame. The build installs an
  in-memory fallback, so settings work for a visit but reset on reload.

## Content Security Policy

| Directive | Effect |
| --- | --- |
| `connect-src 'self' hello.atlassian.net` plus a fixed list of Atlassian services (API gateway, media, Forge, object store) | `fetch`, XHR, EventSource, and WebSocket calls to any other host are refused. |
| `style-src 'self' 'nonce-…'`, report-only | Inline `<style>` blocks produce console warnings but still apply today. Treat this as a policy that may be enforced later. |

A refused request logs two console errors in Chromium:

```text
Connecting to '<url>' violates the following Content Security Policy directive: "connect-src …". The action has been blocked.
Fetch API cannot load <url>. Refused to connect because it violates the document's Content Security Policy.
```

## What that means for VPK demos

| Works | Fails in the viewer |
| --- | --- |
| React UI, Motion, WebGL and canvas shaders, audio from data URIs | Third-party APIs called from the browser (weather, geocoding, maps tiles, analytics) |
| ADS tokens, Tailwind, and fonts embedded as data URIs | VPK `/api/*` routes, chat, AI, and Rovo Serve |
| Build-time data embedded in the bundle | Links that rely on relative routes or Next.js navigation |

## Handling outside data

1. **Accept the gap** when the feature is optional and already shows an empty or error
   state without crashing.
2. **Embed data at build time** with a target hook (see the skill). Fetch what the demo needs,
   serialize it into the bundle banner, and wrap `fetch` so the live request is tried first
   and the embedded data answers only when it fails. Prefer time-indexed data, such as an
   hourly forecast, over a single snapshot, and fail rather than show values after the data
   runs out. `scripts/lib/artifact-targets/awake.mjs` is the reference implementation.
3. **Ask the Artifacts team** to allow a host if the demo needs live data.

Do not send requests through an allowlisted Atlassian service, such as the Forge outbound
proxy, to reach a host the policy refuses. That gets around a security control; artifacts
doing it may be flagged or break when the policy tightens.

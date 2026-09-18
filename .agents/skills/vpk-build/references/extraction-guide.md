# Extraction guide

Use this reference after selecting a route and before approving the scaffold.

## Contents

- [Plan interpretation](#plan-interpretation)
- [Backend-backed exports](#backend-backed-exports)
- [Scaffold behavior](#scaffold-behavior)
- [Existing sibling refresh](#existing-sibling-refresh)
- [Verification and failures](#verification-and-failures)
- [Ports and local runtime](#ports-and-local-runtime)
- [Deployment handoff](#deployment-handoff)
- [Out of scope](#out-of-scope)

## Plan interpretation

The trace plan reports source files, npm packages, public assets, backend routes,
cross-route links, skipped dispatchers, and summary counts. The known
`demo-registry-loader.ts` skip is resolved through the `loadDemoComponent`
special case; investigate other unexpected skipped dispatchers as potential
missing graph edges.

If `backendRouteCount` is nonzero, choose explicitly:

- Stop a pure standalone extraction until the user supplies a backend or proxy
  plan.
- For an intentional Studio, chat, Rovo, wiki, realtime, or scripted-tour app,
  preserve the full source-backed runtime described below.
- Create local fake APIs only when the user asks for a mocked presentation demo.

Non-literal dynamic imports, unresolved dependencies, and cross-route navigation
also require review before scaffold approval. A zero `backendRouteCount` does
not clear runtime `/api/*` fetch warnings: trace can discover calls behind
shared components without linking backend routes. Check whether the selected
route reaches those calls and preserve the full backend when it does.

## Backend-backed exports

Studio, live chat, Rovo browsing, wiki-backed memory, realtime voice, reset-demo
controls, and scripted tours depend on the VPK backend. Preserve copied app
source byte-for-byte where possible and place export behavior in the harness.

The target `pnpm run dev` must start both the extracted frontend and source VPK
backend. Discover an adjacent source checkout when possible and accept a
`VPK_ROOT=/path/to/repository` override; generated harnesses should continue to
accept the deprecated `VPK_ROVO_ROOT` name as a fallback during migration. A
common harness builds and serves the static frontend on port 3001 while invoking
`pnpm run dev:backend` in the source checkout.

Proxy real routes rather than recreating them. Depending on the app, this
includes:

- `/api/rovo/*`
- `/api/wiki/*`
- `/api/agents/rfp-demo/*`
- `/api/realtime/*`

Static export removes Next API routes, so the harness must answer
`/api/realtime/ws-url` with the backend WebSocket base and proxy upgrades for
`/api/realtime/audio-conversation`.

Keep realtime model selection in the backend. The source uses
`OPENAI_REALTIME_MODEL` with its configured fallback; do not hardcode a model in
the extracted client. For deployed voice demos, keep the service stash aligned
with the source deployment.

When deploying, use the full backend rather than the minimal Micros scaffold.
If global CORS middleware is present, allow same-host production origins before
static serving. Browser font requests include `Origin` and can fail even when a
plain asset curl succeeds.

For a broken tour or voice flow, verify backend startup, the WebSocket URL,
upgrade proxy, and source parity of the Studio/sidebar-chat/realtime files
before patching application behavior.

## Scaffold behavior

The scaffold keeps repo-relative paths so `@/*` imports remain unchanged. It
copies the full `public` tree, local `cssImports`, ambient `types/*.d.ts`,
sibling `*.d.ts` next to copied `.js`, and the source token-free `.npmrc`.
It replaces the catalog-dispatched route entry with a direct demo import,
generates layout/provider ordering, creates the Micros files, initializes Git,
and links only `vpk-setup` and `vpk-deploy`.

The generated `app/globals.css` begins from VPK's source file and filters
`@import`/`@source` directives whose packages are absent from the traced set.
It always keeps Tailwind, PostCSS, `tw-animate-css`, and `shadcn`. Bare
`@import "shadcn/tailwind.css"` is rewritten to
`@import "../node_modules/shadcn/dist/tailwind.css";` because Turbopack cannot
resolve the bare specifier from an extracted project (`FileSystemPath("").join`
leaves the filesystem root). The scaffold injects `tw-animate-css` and `shadcn`
because TypeScript tracing cannot see CSS dependencies.

Target `package.json` must not contain `"catalog:"`. Resolve those specifiers
against the source `pnpm-workspace.yaml` `catalog:` block. When the graph has
`react-leaflet`, also add `leaflet` + `@types/leaflet`; when it has `three`,
add `@types/three`.

The generated layout imports `getThemeStyles` from
`@atlaskit/tokens/get-theme-styles` (not `@atlaskit/tokens`), loads the default
Atlassian and demo font families, and mounts the client feature-flag shim.
It wraps only providers whose required props are children-only; skip
`WorkItemModalProvider` and any export that needs instance props such as
`isOpen` / `onClose` / `workItem`. Keep font links for any family referenced
by the copied route.

`next.config.ts` disables the floating Next dev indicator and sets
`allowedDevOrigins: ["127.0.2.2", "localhost"]`. Preview via
`http://localhost:3001`. The Network URL on `127.0.2.2` is blocked from
`/_next/*` without that allow-list, which renders as unstyled overlapping HTML.

The harness also writes a minimal `next-env.d.ts` (no `.next/dev` imports) and
`types/jsx-namespace.d.ts` so React 19 files that still use `JSX.Element`
typecheck without rewriting copied source.

The linked skills use relative paths back to VPK and will break if the
source checkout moves independently. Re-run the scaffold or repair the symlinks
after such a move.

## Existing sibling refresh

Freeze the selected source Git SHA and checkout state before tracing. Recheck
both before copying; work that appears later is a separate source selection. The
trace plan records the Git SHA and dirty state. `scaffold-target.mjs` refuses a
plan when HEAD differs before it writes the staging target. If the source remains
dirty, inspect the selected files again because an edit can change their bytes
without changing the SHA or dirty flag. If the VPK checkout switches branch
after a staging extract, refresh the sibling from those reviewed staged files
and keep the selected SHA in its provenance; trace the new branch only when it
is the intended new release source.

Inspect the sibling's Git status, `.deploy.local` presence, descriptor identity,
and local launcher before editing. The scaffold refuses `--force` on an existing
Git checkout or configured service.

Scaffold the plan into a disposable staging directory with `--backend-backed`
when the route has live API, chat, or realtime behavior. Compare file contents
or hashes with the sibling; modification times can mark thousands of identical
files as changed. Copy only reviewed source, CSS, type, asset, dependency-policy,
and deploy-launcher updates. Preserve the sibling's `.deploy.local`,
`service-descriptor.yml`, README, `.dockerignore`, `.gitignore`, Git state,
provider skill links, and unrelated target work. The staging harness generates
`scripts/dev-backend-backed.mjs` relative to the staging directory; retain or
regenerate the sibling's own launcher rather than copying that path. Keep the
full `public/` tree and list old-only files for review before any deletion.

For backend-backed refreshes, compare `backend/`, `lib/`, `rovo/`, and
`scripts/lib/` against the selected source. Review any changed backend owner
and security/static-serving behavior before copying it. Run `verify-target.sh`
in the sibling, then prove its live route, API proxy, URL discovery, and
WebSocket upgrade. `pnpm install` may update the sibling lockfile after a source
workspace-policy change; include that reviewed lockfile in the local handoff.
Update the sibling's existing provenance notes after verification rather than
replacing them with the staging README.

## Verification and failures

`verify-target.sh` runs install, typecheck, and build. Diagnose failures at the
narrowest owner:

| Symptom | Likely owner |
| --- | --- |
| Install failure | Target dependency version mismatch |
| `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC` | Target `package.json` still has `"catalog:"` — resolve against source `pnpm-workspace.yaml` |
| `@atlassian/logo-third-party` 404 / wrong registry | Source token-free `.npmrc` was not copied |
| Missing `@/` import | Trace edge or copied file missing |
| Unresolved Tailwind class/build failure | `app/globals.css` import chain |
| Missing CSS / module not found | Local `cssImports` or `globals.css` `@import "./…"` not copied. If the file exists and the bundler still cannot resolve it, delete target `.next` and rebuild |
| Overlapping tabs / unstyled chrome | `shadcn` CSS stripped or bare `@import "shadcn/tailwind.css"` crashed Turbopack. Restore `@import "../node_modules/shadcn/dist/tailwind.css";` and the `shadcn` dep. Proof: tabs `getComputedStyle(...).flexDirection === "column"` and `hasShadcnCss` |
| Blank or unstyled runtime | Tailwind utilities were not emitted |
| Unstyled overlapping HTML on Network URL | `/_next/*` blocked from `127.0.2.2`. Add `allowedDevOrigins` and preview via `http://localhost:3001` |
| `getThemeStyles` is not a function | Layout imported from `@atlaskit/tokens` instead of `@atlaskit/tokens/get-theme-styles` |
| Layout crash on `WorkItemModalProvider` | Provider requires `isOpen` / `onClose` / `workItem`. Skip providers whose required props are not children-only |
| `JSX.Element` / missing ambient types | Copy `types/*.d.ts`, sibling `lib/*.d.ts`, generate `next-env.d.ts` (no `.next/dev`) and `types/jsx-namespace.d.ts` |
| `leaflet` / `three` type or runtime miss | Add `leaflet` + `@types/leaflet` with `react-leaflet`, and `@types/three` with `three` |
| Named fonts fall back | Generated layout lacks the font link |
| Browser requests `/favicon.ico` with 404 | Generated layout omitted VPK's SVG icon links. Keep the fallback and light/dark links in the extraction harness and copy `public/website/` rather than adding a fake icon file. |
| Feature-gate console warning | Client shim missing or not mounted |
| Broken logos/product icons | Full `public` tree not copied |
| API 404 or mutation 405 | Static server lacks source backend proxy |
| `pnpm run lint` reports `eslint: command not found` | The minimal target currently has no bundled ESLint binary/config. Run VPK source lint on verbatim copied files; record the target limitation until standalone lint is added to the scaffold contract. |
| AI works but chat/tour fails | Realtime URL or WebSocket upgrade missing |
| Agent output diverges | Local fallback/shim or copied source drift |
| Browser font returns 500 | Same-host CORS rejects browser-shaped request |

Do not dismiss a browser-only failure as cache until a request with `Origin`,
`Referer`, `Sec-Fetch-Dest: font`, and `Sec-Fetch-Mode: cors` succeeds.

After the build, run the target and inspect its actual route, console, fonts,
assets, navigation, and stateful behavior. Backend-backed flows require live API
and WebSocket proof.

`verify-target.sh` plus a headless a11y snapshot can still hide a broken
headed/narrow window when CSS variants are missing. After verify, inspect
computed layout (Jira header tabs `flex-direction: column` when
`data-horizontal`) in a real viewport, not only an accessibility snapshot.

## Ports and local runtime

Extracted frontends default to port 3001 so VPK can remain on 3000. An
`EADDRINUSE` on 3001 is a listener collision, not a build failure. Stop the
existing frontend or select another port. Preview via `http://localhost:3001`.
Next may advertise a Network URL on `127.0.2.2`; that origin needs
`allowedDevOrigins` or `/_next/*` is blocked. Backend-backed `pnpm run dev` must
start or reuse the source backend as well as the extracted frontend.

After stopping Next dev, inspect the target's ignored `next-env.d.ts`. Next may
rewrite it with a `.next/dev` reference that the standalone scaffold does not
need. Restore the two-reference version generated by `scaffold-target.mjs`
before the final target typecheck or refresh diff.

## Deployment handoff

After target verification:

```bash
cd ../vpk-<route-slug>
# invoke vpk-deploy --initial
# later: pnpm run deploy:micros
```

The minimal `references/micros` scaffold suits routes without live backend
dependencies. Replace it with the full backend implementation for API, SSE,
WebSocket, AI, or voice behavior, while preserving runtime security and static
serving.

## Out of scope

- Rewriting internal cross-route links automatically; report and rewire them.
- Extracting multiple routes into one target.
- Generating a replacement backend from detected API calls.
- Inferring provider dependency ordering beyond the scaffold's generated order;
  reorder the target layout when a real cross-provider dependency requires it.

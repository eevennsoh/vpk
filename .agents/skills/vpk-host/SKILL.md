---
name: vpk-host
description: Host or update a static VPK project, extracted route, HTML file, or export directory on Atlassian Statlas. Use for vpk-host, Statlas hosting, or uploading a prototype to Atlassian's static CDN. Use vpk-deploy for a project that needs an Express runtime.
---

# VPK host

Publish ready-to-serve files to `https://statlas.prod.atl-paas.net/<namespace>/<path>`.
Statlas hosts static files. It does not run Next.js, Express, API proxies, SSE,
or WebSocket servers. Viewing files needs no additional Statlas login within
the Atlassian network; upload permissions do not restrict who can view them.

Read [the Statlas commands and troubleshooting](references/statlas.md) before
setup or upload. Installed CLI help takes precedence over examples in the guides.

## Choose the input and destination

Examples of skill requests:

```text
/vpk-host /<route> --namespace <name> --auth-group <group> --subdirectory <project>/
/vpk-host <extracted-project> --namespace <name> --auth-group <group>
/vpk-host <export-directory-or-html-file> --namespace <name> --auth-group <group>
```

These identify the input and hosting destination; there is no separate
`vpk-host` executable. Resolve the actual namespace, publishing Slauth group,
optional subdirectory, entry file, and any requested lifecycle before uploading.
Reuse a supplied URL or existing binding. Do not guess group membership or
replace another project's namespace. If a required choice is missing, ask for
it while preparing the local export.

For a new publication, prefer a separate project/release subdirectory when
appropriate. Changing the prefix requires rebuilding a Next.js project.
For an update, preserve the requested URL and inspect the existing files first.

| Input | Preparation |
| --- | --- |
| A VPK route | Load `.agents/skills/vpk-build/SKILL.md`, trace the slash-prefixed route, and extract it using that workflow. |
| An extracted Next.js project | Inspect its source, configuration, and runtime dependencies; build its static export. |
| A finished export directory or HTML file | Review the files and asset references; do not add a framework or rebuild unnecessarily. |

## Check runtime compatibility

Inspect the import trace and actual requests, including interactions beyond
initial paint. A zero backend-route count does not rule out runtime API calls.
Classify the requested experience before claiming that Statlas can host it:

- Local UI and bundled/static data can run entirely on Statlas.
- An already deployed external backend can work only when the client supports
  its URL and the backend permits the Statlas origin, authentication, and any
  required streaming/WebSocket transport. Verify those interactions.
- Same-origin `/api/*`, Next server features, and an undeployed VPK backend
  require a runtime plan. Explain the gap and use `vpk-deploy` when authorized.

Do not strip working features, inject mock APIs, put gateway credentials in
browser code, or silently turn a backend-dependent project into a static demo.
Creating a static-only variant requires the user's agreement. A successful
export is not proof that the hosted experience works.

## Build for the hosted prefix

Compute the prefix from the full destination, for example `/my-team/demo` for
namespace `my-team` and subdirectory `demo/`.

For Next.js, read the installed static-export and `basePath` guides before
editing the target. Preserve its configuration and set build-time `basePath`
to the full prefix, `trailingSlash: true`, and static export mode. Keep image
optimization disabled for a static export. `assetPrefix` alone does not handle
application routes or files under `public/`.

Next links apply `basePath`; raw image/audio/video URLs, `next/image` sources,
CSS URLs, plain anchors, fetches, and runtime-generated asset paths need their
own review. Reuse any existing asset resolver. Make extraction-specific changes
in the extracted target and preserve source design and behavior. Do not prefix
an external backend URL or double-prefix a Next link. Rebuild after a prefix
change; do not fix compiled bundles with search-and-replace.

Use the target's existing static export command. In VPK or a backend-backed
extract that has it, run `pnpm run build:export`; the wrapper excludes runtime
App Router APIs temporarily. A minimal static extract's `pnpm run build`
already exports. Review the resulting `out/` tree and keep all required files,
including `_next/`, public assets, nested HTML, and Next navigation payloads.

Run the target's applicable lint/typecheck/tests and verify the export at its
exact prefix on a local static server. Test initial paint, hydration, lazy
assets, fonts, local interactions, navigation, and a direct reload of nested
routes. A development server can mask missing static files and routing errors.
For a non-Next project, use its own base-URL and routing mechanism; do not
replace Next's router with the Vite guide's HashRouter example.

## Prepare and publish

1. Check Atlas/Statlas help, Kerberos status, and namespace permissions with
   the read-only commands in the reference. If setup is needed, resolve the
   namespace's owner and publishing group first. Keep existing grants.
2. Record the selected source revision and dirty state, destination prefix,
   export inventory, and archive checksum under ignored `output/statlas/`.
   Review public content and bundled values. Package only the reviewed static
   export, never the checkout, `.next/`, credentials, or local reports.
3. Build a fresh ZIP from inside the export directory. It must contain
   `index.html`, `_next/...`, and other files at the archive root, without an
   extra `out/` or `dist/` wrapper. Inspect its file list before uploading.
4. State the exact namespace, path, entry URL, and viewer access. An explicit
   hosting/update request with a resolved destination authorizes that upload;
   a request for research or a local package does not. Continue without another
   confirmation when the current request already authorizes publication.
5. Upload with `atlas statlas post` to unpack the ZIP. If ZIP upload hangs or
   fails, inspect Kerberos and remote files before retrying. Use individual
   `put` uploads as the documented fallback, uploading assets/navigation
   payloads before HTML entry files. An interrupted upload may be partial;
   Statlas uploads are not assumed atomic.

Do not grant additional groups, delete namespaces, or prune remote files as
part of publishing. For an explicitly requested deletion, follow Statlas's
CPRS process and keep it separate from upload. Record any requested lifecycle;
do not promise indefinite hosting from an undocumented default.

## Verify and report

Check remote listing/metadata and request the hosted entry and representative
JS/CSS/font/image assets. Confirm status, MIME types, and the expected release
content; a `200` response can contain an error page or older HTML. Test the
actual hosted URL in a fresh browser, including nested-route reloads, changed
interactions, console/network errors, and an accessibility check. Use the
`agent-browser` skill first and keep proof under `output/agent-browser/`.
If the user chooses manual verification, respect that and label it unverified.

Use the working entry URL, including `index.html` when necessary. The guide
does not establish directory-index, rewrite, cache-purge, or atomic-release
guarantees. Verify the shorter URL before sharing it. For an update, compare
the served HTML/new chunks with the selected export before claiming success.

Report the hosted URL, source/export identity, tested capabilities, viewer
access and any requested lifecycle, plus remaining runtime or verification
gaps. Distinguish prepared, uploaded, and verified states. Do not imply that
Git delivery or a separate backend deployment happened.

## Skill validation

```bash
node scripts/validate-skills.js --target .agents/skills/vpk-host
pnpm run verify:doc-scripts
git diff --check
```

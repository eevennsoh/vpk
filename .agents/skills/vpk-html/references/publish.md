# Publish and share

Read this only when the user asks to publish or share a finished artifact.
Publishing is outward-facing: the HTML must pass step 5 of SKILL.md first, and
every target except GitHub Pages under `/vpk-html --github` is plan-then-confirm.

| Target | Command | Readers get | Notes |
| --- | --- | --- | --- |
| Atlassian Artifacts | `--publish artifacts <file>` | an org-internal page, view and copy only | private by default; updates in place |
| Secret gist | `--publish gist <file>` | the HTML as source; Raw gives the file | anyone with the link can read it |
| GitHub Pages | `--github <file>` | a public or private Pages URL | see [GitHub Pages](github-pages.md) |

## Commands

```bash
# Plan only (default): preflight, viewer check, and the create/update plan
node .agents/skills/vpk-html/scripts/build.mjs --publish artifacts artifacts/vpk-html/<slug>/<slug>.html [--access private|open|shared] [--name <t>] [--description <t>] [--new]
node .agents/skills/vpk-html/scripts/build.mjs --publish gist artifacts/vpk-html/<slug>/<slug>.html [--public] [--new]

# Publish, after the user agrees to the printed plan
node .agents/skills/vpk-html/scripts/build.mjs --publish artifacts artifacts/vpk-html/<slug>/<slug>.html --confirm
node .agents/skills/vpk-html/scripts/build.mjs --publish gist artifacts/vpk-html/<slug>/<slug>.html --confirm
```

Shared options: `--include-review` allows embedded review comments (P4), and
`--allow-local-paths` downgrades P2 to a warning. There is no
`--publish github`; `--github` runs the same preflight.

Exit codes: 0 when the plan or the publish succeeded, 1 for a preflight error or
a failed publish, 2 for an unknown target or a missing file.

## Agent rules

- Run without `--confirm` first. Show the user the plan: target, name, access, and create or update. Re-run with `--confirm` only after they agree.
- `/vpk-html --github` authorizes the GitHub Pages track. An ordinary render request authorizes no publishing.
- Use `--access private` for an unreviewed draft and `open` once the user has reviewed it.
- Never print or store the signed `object-store…?authToken=` URL.
- Report the URL, the access level, and what degrades in that viewer (table below).
- With no target requested, end with a one-line offer (GitHub Pages, a gist, or Atlassian Artifacts) instead of publishing.

## Preflight

`--publish` runs every row; `--github` has already run the standard checks and
runs the rest. Findings print as `✗ P1 secret: GitHub token at offset 1234 (ghp_…)`
and `⚠ P6 size: …`.

| Id | Severity | Rule |
| --- | --- | --- |
| checks | error | `--check-placeholders`, `--verify` and `check-html` pass |
| content | error / warning | `--check-content` on the HTML (sidecar found beside it) |
| P1 `secret` | error, no override | a credential pattern from `scripts/secret-scan.mjs` matches; previews never echo the secret |
| P2 `local-path` | error (warning with `--allow-local-paths`) | `/Users/<name>/`, `/home/<name>/`, `C:\Users\` or `file:///`, after URLs are blanked so `https://example.com/home/x/` never matches |
| P3 `local-url` | warning | `localhost`, `127.0.0.1`, `0.0.0.0` or `*.localhost` URLs |
| P4 `review-data` | error unless `--include-review` | the `data-vpk-review` island holds comments |
| P5 `data-needed` | warning | `[DATA NEEDED:` markers remain |
| P6 `size` | warning | over the 1.57 MB data-URL budget; Artifacts and Pages load it, data: URL previews render it blank |

`data:` URIs are blanked before scanning, so base64 fonts, images and films do
not false-match key shapes.

## Atlassian Artifacts

1. **Viewer check.** `scripts/verify-artifact-html.mjs` opens the file the way the Artifacts viewer does (sandboxed srcdoc iframe, viewer CSP) in local Chromium and saves `artifact-viewer.png` beside the review captures. Blocked requests print as warnings; missing assets, page errors or an empty render stop the run.
2. **Plan.** `scripts/publish-artifact.mjs` `planPublish` decides create or update from the registry `~/.config/vpk/artifacts.json` (override `VPK_ARTIFACT_REGISTRY`), keyed by the file's slug. Name and description default to the document's `<title>` and `<meta name="description">`. A create defaults to `private`; an update keeps the current access unless `--access` is given. `--new` forces a create.
3. **Publish.** With `--confirm`, the same script runs `twg --env prod artifacts file …` and records the result. This is the vpk-artifact skill's own path; there is no second implementation.

Outside the VPK repository (no `scripts/publish-artifact.mjs`), the command
prints the equivalent `twg --env prod artifacts file create <file> --name … --access private -o json`
and exits 1.

**MCP fallback**, when twg is unavailable but the Atlassian MCP is connected:

1. `LEN=$(wc -c < file)` and `SUM=$(openssl dgst -sha256 -binary file | openssl base64 -A)`.
2. `discover createArtifactsUpload`, then `executeWrite` with `{ cloudId, length, checksum }`; upload to the returned URL as instructed.
3. `executeWrite publishArtifact` with `{ cloudId, name, description, contentId, contentType: "text/html", id? }`.
4. Append `{ id, name, artifactUrl, file, createdAt, updatedAt }` under the slug in `~/.config/vpk/artifacts.json`, so later `--publish artifacts` runs update in place.
5. Use `shareArtifact` only for named people.

## Gists

- The registry is `~/.config/vpk/gists.json` (override `VPK_GIST_REGISTRY`), keyed by slug, with `{ id, url, fileName, file, public, createdAt, updatedAt }`.
- Create: `gh gist create <file> --desc "vpk-html: <title>"`, secret unless `--public` is passed explicitly.
- Update: `gh gist edit <id> --filename <fileName> <file>`.
- GitHub shows gist HTML as source: recipients open Raw, save the file and open it in a browser. Prefer Pages or Artifacts for viewing, and a gist for handing over the file.

## What each viewer allows

Probed 2026-10-11 in headless Chromium with the Artifacts harness
(`sandbox="allow-scripts"`, the strictest plausible flags). Re-run
`node .agents/skills/vpk-html/scripts/probes/artifacts-viewer-capabilities.mjs`
(unsandboxed) and update this table when the numbers change.

| Viewer | Renders | localStorage | Download (JSON, reviewed copy) | Copy for agent | Popups (X intents) | Live send |
| --- | --- | --- | --- | --- | --- | --- |
| Local file (`file://`, Chromium) | yes | yes; all local files share one origin | yes | yes | yes | no |
| GitHub Pages | yes | yes | yes | yes | yes | no |
| Atlassian Artifacts (`sandbox="allow-scripts"`) | yes (srcdoc, opaque origin) | throws; the runtimes fall back to memory | blocked | `execCommand` fallback only; the Clipboard API is blocked | blocked | no (CSP `connect-src`) |
| Gist | source only | n/a | via Raw | n/a | n/a | no |
| Inside VPK, dev only (`/html` iframe) | yes | yes | yes | yes | yes | yes: catalog pages, srcdoc and local artifacts in VPK dev; production frames are sandboxed behind a dev-only banner |
| Slack upload, email attachment, Confluence attachment preview | pending the review loop's manual transport matrix | | | | | |

Rule from the probe: Artifacts is a **view-and-copy** channel. A reviewer who
must download a review or save a reviewed copy gets the HTML file itself. With
`allow-scripts allow-downloads allow-popups`, downloads and popups work but the
Clipboard API stays blocked. The live viewer's real flags are confirmed only by
a user-approved live publish.

## Sandbox notes

- `--publish … --confirm` writes `~/.config/vpk/*.json`, outside the agent sandbox's write allowlist: run it unsandboxed.
- The viewer check and the probe launch Chromium: run them unsandboxed. `build.mjs --doctor` reports when Chromium cannot start.
- Run `gh` as `env -u GITHUB_TOKEN gh …` when a stray `GITHUB_TOKEN` overrides stored auth.
- `publish-artifact.mjs` always passes `--env prod`; plain `twg` defaults to staging.

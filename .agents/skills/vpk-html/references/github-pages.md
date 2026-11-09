# GitHub Pages publishing

Owner of GitHub Pages publishing for [SKILL.md](../SKILL.md). Load when you publish to GitHub Pages (`/vpk-html --github`).

`/vpk-html --github` means: produce the normal validated HTML artifact, then publish it as a live GitHub Pages site that a user can browse.

## Publish only an authenticated, checked artifact

| Precondition | Check |
| --- | --- |
| An active GitHub account with repo permissions | `gh auth status` |
| The artifact exists | `artifacts/vpk-html/<slug>/<slug>.html` |
| The normal vpk-html checks pass | The publish helper runs them automatically |
| Visibility | Public unless the user explicitly asks for `--private`; public is the least surprising path for shareable Pages URLs |

## Command

```bash
node .agents/skills/vpk-html/scripts/build.mjs --github artifacts/vpk-html/<slug>/<slug>.html
```

Optional:

```bash
node .agents/skills/vpk-html/scripts/build.mjs --github artifacts/vpk-html/<slug>/<slug>.html --repo owner/name
node .agents/skills/vpk-html/scripts/build.mjs --github artifacts/vpk-html/<slug>/<slug>.html --private
```

`--github` now also runs the shared publish preflight (secrets, local paths, embedded review data, content IR, size); see `publish.md`. Pass `--include-review` or `--allow-local-paths` to relax those two rules.

## Publishing contract

The helper publishes from the artifact folder itself as a nested standalone Git repo:

1. Validate placeholders, browser render, font load, console cleanliness, and static HTML validity.
2. Copy `<slug>.html` to `index.html`.
3. Create `.nojekyll`.
4. Initialize the artifact folder as a Git repo on `main` if needed.
5. Locally exclude the original `<slug>.html` and `screenshots/` so the publish repo stays clean.
6. Commit only `index.html` and `.nojekyll`.
7. Create or reuse the GitHub repo.
8. Push `main`.
9. Enable GitHub Pages from `main` and `/`.
10. Print the Pages URL and latest Pages build status.

The canonical URL is the Pages root:

```text
https://<owner>.github.io/<repo>/
```

Do not create a wrapper page that links to the artifact. The artifact itself is published as `index.html`.

## The repo is named after the slug

| Artifact | Default repo |
| --- | --- |
| `artifacts/vpk-html/symphony-explainer/symphony-explainer.html` | `<active-gh-login>/symphony-explainer` |
| Any, with `--repo owner/name` | `owner/name`; use it when the target owner or repository name matters |

## A rerun updates the same site, never another remote

| State | Rerun does |
| --- | --- |
| Staged payload changed | Updates `index.html`, commits, pushes `main` |
| Pages already serves `main` + `/` | Reuses the existing configuration |
| The GitHub repo exists but local `origin` points elsewhere | Stops instead of force-changing the remote, protecting unrelated publish repos |

## Publish index.html and .nojekyll only

| Wrong | → Right |
| --- | --- |
| `screenshots/` browser evidence pushed | → excluded |
| PDFs and local iteration captures pushed | → excluded |
| The original `<slug>.html` beside `index.html` | → excluded once `index.html` exists |
| The whole folder by habit | → extra assets only when the page references them or the user asks for the whole folder |

## Verification

After publish, use GitHub’s Pages API as the source of truth:

```bash
gh api repos/<owner>/<repo>/pages --jq '{html_url,source,https_enforced,public}'
gh api repos/<owner>/<repo>/pages/builds/latest --jq '{status,error,commit,updated_at}'
```

If direct network access to `github.io` is available, also check:

```bash
curl -I https://<owner>.github.io/<repo>/
```

Report the URL only after Pages configuration succeeds. If the Pages build is still `building`, say so explicitly and include the URL.

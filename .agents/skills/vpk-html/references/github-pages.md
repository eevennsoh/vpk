# GitHub Pages publishing

`/vpk-html --github` means: produce the normal validated HTML artifact, then
publish it as a live GitHub Pages site that a user can browse.

## Preconditions

- `gh auth status` must show an active GitHub account with repo permissions.
- The artifact must exist at `artifacts/vpk-html/<slug>/<slug>.html`.
- Run the normal vpk-html checks first; the publish helper does this
  automatically.
- Use a public repo unless the user explicitly asks for private. Public is the
  least surprising path for shareable Pages URLs.

## Command

```bash
node .agents/skills/vpk-html/scripts/build.mjs --github artifacts/vpk-html/<slug>/<slug>.html
```

Optional:

```bash
node .agents/skills/vpk-html/scripts/build.mjs --github artifacts/vpk-html/<slug>/<slug>.html --repo owner/name
node .agents/skills/vpk-html/scripts/build.mjs --github artifacts/vpk-html/<slug>/<slug>.html --private
```

`--github` now also runs the shared publish preflight (secrets, local paths,
embedded review data, content IR, size); see `publish.md`. Pass
`--include-review` or `--allow-local-paths` to relax those two rules.

## Publishing contract

The helper publishes from the artifact folder itself as a nested standalone Git
repo:

1. Validate placeholders, browser render, font load, console cleanliness, and
   static HTML validity.
2. Copy `<slug>.html` to `index.html`.
3. Create `.nojekyll`.
4. Initialize the artifact folder as a Git repo on `main` if needed.
5. Locally exclude the original `<slug>.html` and `screenshots/` so the publish
   repo stays clean.
6. Commit only `index.html` and `.nojekyll`.
7. Create or reuse the GitHub repo.
8. Push `main`.
9. Enable GitHub Pages from `main` and `/`.
10. Print the Pages URL and latest Pages build status.

The canonical URL is the Pages root:

```text
https://<owner>.github.io/<repo>/
```

Do not create a wrapper page that links to the artifact. The artifact itself is
published as `index.html`.

## Repo naming

Default repo name comes from `<slug>`. For
`artifacts/vpk-html/symphony-explainer/symphony-explainer.html`, the default repo
is `<active-gh-login>/symphony-explainer`.

Use `--repo owner/name` when the target owner or repository name matters.

## Reruns and updates

Re-running the command updates `index.html`, commits if the staged payload
changed, pushes `main`, and reuses the existing Pages configuration when it is
already `main` + `/`.

If the GitHub repo already exists but local `origin` points elsewhere, stop
instead of force-changing the remote. That protects unrelated publish repos.

## What not to publish by default

- `screenshots/` browser evidence.
- PDFs.
- local iteration captures.
- The original `<slug>.html` once `index.html` has been created.

Publish extra assets only when the page references them or the user explicitly
asks for the whole folder.

## Verification

After publish, use GitHub's Pages API as the source of truth:

```bash
gh api repos/<owner>/<repo>/pages --jq '{html_url,source,https_enforced,public}'
gh api repos/<owner>/<repo>/pages/builds/latest --jq '{status,error,commit,updated_at}'
```

If direct network access to `github.io` is available, also check:

```bash
curl -I https://<owner>.github.io/<repo>/
```

Report the URL only after Pages configuration succeeds. If the Pages build is
still `building`, say so explicitly and include the URL.

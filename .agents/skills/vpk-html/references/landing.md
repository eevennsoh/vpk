# Landing / product-site track

The document path produces one offline single file. The **landing track** is for
screen-first product pages and docs sites, which have different needs: they live
on the web, may load remote assets (analytics, OG images), and ship **companion
files** (sitemap, robots, llms.txt, vercel.json).

This mode is opt-in and tightly scoped. A landing page is marked
`data-vpk-landing="true"` on `<html>` — exactly parallel to the
`data-vpk-upstream-demo` opt-in. That attribute loosens **only** the remote-asset
and external-stylesheet checks in `check-html.mjs`. Every other offline invariant
still applies: embedded fonts, the dark-mode token block, a `<main>` landmark,
accessibility markers, and no unresolved `{{...}}`. The default document path is
completely unaffected — without the attribute, the strict single-file rules hold.

## Shells

`assets/landing/` ships two generated shells (regenerate with
`node scripts/landing.mjs`):

- `landing-page.html` — hero + features + grayscale pill CTA + footer.
- `docs-site.html` — sticky two-column nav + content.

Both use the shared vpk-html identity (Geist + Geist Mono, ADS paper/ink
tokens, grayscale ink chrome), inline their fonts, and are responsive at
**1280 / 880 / 480** with `prefers-reduced-motion` honored. The page eyebrow
uses the single breadcrumb-style uppercase role; CTA chrome uses the 34px
grayscale pill-button tokens. They are starting points — replace the copy with
real content.

## Companion files

`assets/landing/companion/` holds `.example` templates with `{{SITE_ORIGIN}}` /
`{{CANONICAL_URL}}` placeholders:

- `sitemap.xml.example`
- `robots.txt.example`
- `llms.txt.example`
- `vercel.json.example`

## Export

```bash
node scripts/build.mjs --landing artifacts/vpk-html/acme-site/acme-site.html \
  --out artifacts/vpk-html/acme-site/site --origin https://yoursite.com
```

This:

1. **Emits filled companions** into `--out` (defaults to the file's directory):
   strips `.example`, substitutes `{{SITE_ORIGIN}}` / `{{CANONICAL_URL}}`.
2. **Responsive-verifies** the page at 1280 / 880 / 480 — fails on horizontal
   overflow, font load failure, console errors, or failed requests.

## Authoring notes

- Keep the `data-vpk-landing="true"` attribute — it is the only thing that
  relaxes the offline rules, and only for this file.
- Even with the relaxation, prefer inlined/local assets where you can; the
  exemption exists for genuine product-site needs, not as an escape hatch for
  ordinary documents.

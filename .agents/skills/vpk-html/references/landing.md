# Landing / product-site track

Owner of the landing track for [SKILL.md](../SKILL.md). Load when you derive a landing site.

The document path produces one offline single file. The **landing track** is for screen-first product pages and docs sites, which have different needs: they live on the web, may load remote assets (analytics, OG images), and ship **companion files** (sitemap, robots, llms.txt, vercel.json).

A landing page is marked `data-vpk-landing="true"` on `<html>`, exactly parallel to the `data-vpk-upstream-demo` opt-in. That attribute loosens **only** the remote-asset and external-stylesheet checks in `check-html.mjs`. Every other offline invariant still applies: embedded fonts, the dark-mode token block, a `<main>` landmark, accessibility markers, and no unresolved `{{...}}`. The default document path is unaffected: without the attribute, the strict single-file rules hold.

## Start from one of two generated shells

`assets/landing/` ships two generated shells (regenerate with `node scripts/landing.mjs`):

| Shell | Layout |
| --- | --- |
| `landing-page.html` | Hero + features + grayscale pill CTA + footer |
| `docs-site.html` | Sticky two-column nav + content |

Both use the shared vpk-html identity (Geist + Geist Mono, ADS paper/ink tokens, grayscale ink chrome), inline their fonts, and are responsive at **1280 / 880 / 480** with `prefers-reduced-motion` honored. The page eyebrow uses the single breadcrumb-style uppercase role; CTA chrome uses the 34px grayscale pill-button tokens. They are starting points; replace the copy with real content.

## Companions ship as filled examples

`assets/landing/companion/` holds `.example` templates with `{{SITE_ORIGIN}}` / `{{CANONICAL_URL}}` placeholders; `--landing` strips `.example` and fills them:

| Template | Emitted as |
| --- | --- |
| `sitemap.xml.example` | `sitemap.xml` |
| `robots.txt.example` | `robots.txt` |
| `llms.txt.example` | `llms.txt` |
| `vercel.json.example` | `vercel.json` |

## Export

```bash
node scripts/build.mjs --landing artifacts/vpk-html/acme-site/acme-site.html \
  --out artifacts/vpk-html/acme-site/site --origin https://yoursite.com
```

This:

1. **Emits filled companions** into `--out` (defaults to the file’s directory): strips `.example`, substitutes `{{SITE_ORIGIN}}` / `{{CANONICAL_URL}}`.
2. **Responsive-verifies** the page at 1280 / 880 / 480 and fails on horizontal overflow, font load failure, console errors, or failed requests.

## The landing attribute relaxes one file, not the rules

| Wrong | → Right |
| --- | --- |
| Dropping `data-vpk-landing="true"` while editing | → keep it: it is the only thing that relaxes the offline rules, and only for this file |
| Remote images because the check now allows them | → inlined or local assets where you can; the exemption is for genuine product-site needs |
| `data-vpk-landing` on an ordinary document to silence a remote-asset failure | → inline the asset |

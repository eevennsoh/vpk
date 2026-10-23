#!/usr/bin/env node
/*
 * landing — vpk-html's optional landing / product-site track.
 *
 * Unlike the document path (one offline single file), a landing page is
 * screen-first and may legitimately load remote assets and ship companion files
 * (sitemap, robots, llms.txt, vercel.json). Shells are marked
 * data-vpk-landing="true", which loosens ONLY the remote-asset + external-
 * stylesheet checks in check-html.mjs — every other offline invariant holds, and
 * the shells generated here stay self-contained (fonts inlined) anyway.
 *
 *   node scripts/landing.mjs                 # (re)generate assets/landing/ shells
 *   node scripts/build.mjs --landing <file> [--out <dir>] [--origin <url>]
 *
 * The build.mjs --landing path emits filled companion files next to the output
 * and runs a responsive verification (1280 / 880 / 480) on the page.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildFaviconLinkBlock, buildSharedCssBlock } from "./shared.mjs";
import { retrofitThemeRuntime } from "./theme.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, "..");
const LANDING_DIR = path.join(SKILL_ROOT, "assets", "landing");
const COMPANION_DIR = path.join(LANDING_DIR, "companion");

const LANDING_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper-background);
    color: var(--ink);
    font-family: "Geist Mono Numeric", var(--font-body);
    font-size: 17px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 880px; margin: 0 auto; padding: clamp(2rem, 5vw, 5rem) clamp(1.25rem, 4vw, 2.5rem); }
  .eyebrow {
    font-family: var(--font-mono); font-size: 12px; font-weight: 600; letter-spacing: 2px;
    text-transform: uppercase; color: var(--muted-text); margin: 0 0 60px;
  }
  h1 { font-family: var(--font-display); font-weight: 500; font-size: 36px; line-height: 1.14; margin: 0 0 16px; color: var(--headline); }
  h2 { font-family: var(--font-display); font-weight: 500; font-size: 26px; margin: 48px 0 12px; color: var(--headline); }
  .lead { font-size: 17px; color: var(--muted-text); max-width: 60ch; }
  a { color: var(--link); text-decoration-line: underline; text-decoration-color: transparent; text-decoration-thickness: 1px; text-underline-offset: 4px; transition: color 180ms ease, text-decoration-color 180ms ease, opacity 180ms ease; }
  a:hover { color: var(--ink); text-decoration-color: currentColor; }
  a:focus-visible { border-radius: 2px; box-shadow: 0 0 0 2px var(--focus-ring); outline: 0; text-decoration-color: currentColor; }
  .cta { display: inline-flex; align-items: center; height: 34px; margin-top: 24px; padding: 0 14px; background: var(--pill-fill); color: var(--inverse-text); border: 2px solid var(--pill-fill); border-radius: 24px; font-family: var(--font-body); font-size: 13px; font-weight: 500; letter-spacing: 0; transition: background-color 180ms ease; }
  .cta, .cta:hover, .docs nav a, footer a { text-decoration-line: none; }
  .cta:hover { background: var(--pill-fill-hover); border-color: var(--pill-fill-hover); color: var(--inverse-text); }
  .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 24px; }
  .feature h3 { font-family: var(--font-display); font-size: 16px; margin: 0 0 6px; color: var(--headline); }
  .feature p { margin: 0; color: var(--muted-text); font-size: 15px; }
  .rule { height: 1px; background: var(--rule); border: 0; margin: 48px 0; }
  footer { color: var(--subtlest-text); font-size: 13px; font-family: var(--font-mono); margin-top: 48px; }
  /* Docs layout */
  .docs { display: grid; grid-template-columns: 220px 1fr; gap: 40px; }
  .docs nav { font-family: var(--font-mono); font-size: 13px; position: sticky; top: 24px; align-self: start; }
  .docs nav a { display: block; padding: 4px 0; color: var(--muted-text); }
  .docs nav a:hover { color: var(--link); }
  @media (max-width: 880px) { .features { grid-template-columns: 1fr 1fr; } .docs { grid-template-columns: 1fr; } .docs nav { position: static; } }
  @media (max-width: 480px) { .features { grid-template-columns: 1fr; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

function shell({ title, description, bodyHtml }) {
	return retrofitThemeRuntime(`<!DOCTYPE html>
<html lang="en" data-vpk-landing="true">
<head>
<meta charset="utf-8">
<meta name="generator" content="vpk-html">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="/">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
${buildFaviconLinkBlock()}
<style>
${buildSharedCssBlock()}
${LANDING_CSS}
</style>
</head>
<body data-vpk-chrome="landing">
<main>
${bodyHtml}
</main>
</body>
</html>
`);
}

function landingPageBody() {
	return `<div class="wrap">
  <p class="eyebrow">vpk-html · product site</p>
  <h1>Ship an offline-first product page with the Algebrica editorial identity.</h1>
  <p class="lead">A screen-first landing shell that shares vpk-html's tokens, type, and calm paper canvas — responsive from 1280 down to 480, with embedded fonts so it renders anywhere.</p>
  <a class="cta" href="#features">See what's included</a>
  <hr class="rule">
  <h2 id="features">What's in the box</h2>
  <div class="features">
    <div class="feature"><h3>Tokenised theme</h3><p>Light and dark via the same white surface, ink, and figure-tone tokens the documents use.</p></div>
    <div class="feature"><h3>Embedded fonts</h3><p>Geist and Geist Mono are inlined as data URIs — no network fetch.</p></div>
    <div class="feature"><h3>Companion files</h3><p>sitemap, robots, llms.txt, and vercel.json emitted on export.</p></div>
  </div>
  <footer>Generated by vpk-html · landing track</footer>
</div>`;
}

function docsSiteBody() {
	return `<div class="wrap">
  <p class="eyebrow">vpk-html · docs site</p>
  <div class="docs">
    <nav aria-label="Docs sections">
      <a href="#intro">Introduction</a>
      <a href="#install">Install</a>
      <a href="#usage">Usage</a>
      <a href="#deploy">Deploy</a>
    </nav>
    <div>
      <h1 id="intro">Documentation</h1>
      <p class="lead">A two-column docs shell on the same identity — sticky nav on wide screens, stacked on narrow ones.</p>
      <h2 id="install">Install</h2>
      <p>Describe installation here. This shell is a starting point; replace the copy with real content.</p>
      <h2 id="usage">Usage</h2>
      <p>Document the primary workflows. Keep paragraphs short and scannable.</p>
      <h2 id="deploy">Deploy</h2>
      <p>The emitted <code>vercel.json</code> companion gives clean URLs out of the box.</p>
      <footer>Generated by vpk-html · landing track</footer>
    </div>
  </div>
</div>`;
}

const COMPANIONS = {
	"sitemap.xml.example": `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{{CANONICAL_URL}}</loc></url>
</urlset>
`,
	"robots.txt.example": `User-agent: *
Allow: /
Sitemap: {{SITE_ORIGIN}}/sitemap.xml
`,
	"llms.txt.example": `# {{SITE_ORIGIN}}

> One-line description of this site for LLM consumers.

## Pages
- [Home]({{CANONICAL_URL}})
`,
	"vercel.json.example": `{
  "cleanUrls": true,
  "trailingSlash": false
}
`,
};

export function buildLandingShells() {
	fs.mkdirSync(COMPANION_DIR, { recursive: true });
	fs.writeFileSync(path.join(LANDING_DIR, "landing-page.html"),
		shell({ title: "vpk-html — product site", description: "Offline-first product landing shell with the Algebrica editorial identity.", bodyHtml: landingPageBody() }));
	fs.writeFileSync(path.join(LANDING_DIR, "docs-site.html"),
		shell({ title: "vpk-html — docs site", description: "Two-column documentation shell on the vpk-html identity.", bodyHtml: docsSiteBody() }));
	for (const [name, body] of Object.entries(COMPANIONS)) {
		fs.writeFileSync(path.join(COMPANION_DIR, name), body);
	}
	console.log(`✓ wrote landing shells + ${Object.keys(COMPANIONS).length} companion templates → ${path.relative(process.cwd(), LANDING_DIR)}`);
}

/* Emit filled companion files next to an output dir. */
export function emitCompanions(outDir, { origin = "https://example.com", canonical } = {}) {
	const canon = canonical || origin + "/";
	fs.mkdirSync(outDir, { recursive: true });
	const written = [];
	for (const [name, body] of Object.entries(COMPANIONS)) {
		const filled = body.replaceAll("{{SITE_ORIGIN}}", origin).replaceAll("{{CANONICAL_URL}}", canon);
		const outName = name.replace(/\.example$/, "");
		fs.writeFileSync(path.join(outDir, outName), filled);
		written.push(outName);
	}
	return written;
}

/* Responsive verification: no horizontal overflow at 3 widths, fonts load, no errors. */
export async function verifyLanding(htmlPath) {
	const abs = path.resolve(htmlPath);
	if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	const issues = [];
	try {
		for (const width of [1280, 880, 480]) {
			const ctx = await browser.newContext({ viewport: { width, height: 900 } });
			const page = await ctx.newPage();
			page.on("pageerror", e => issues.push(`@${width}: pageerror: ${e.message}`));
			page.on("console", m => { if (m.type() === "error") issues.push(`@${width}: console.error: ${m.text()}`); });
			page.on("requestfailed", r => issues.push(`@${width}: failed request: ${r.url()}`));
			await page.goto(pathToFileURL(abs).href, { waitUntil: "domcontentloaded", timeout: 15_000 });
			try { await page.waitForLoadState("networkidle", { timeout: 4_000 }); } catch { /* fine */ }
			const overflow = await page.evaluate(() => {
				const el = document.documentElement;
				return Math.max(0, el.scrollWidth - el.clientWidth);
			});
			if (overflow > 1) issues.push(`@${width}: horizontal overflow of ${overflow}px`);
			await ctx.close();
		}
	} finally {
		await browser.close();
	}
	return { ok: issues.length === 0, issues };
}

export async function processLanding(htmlPath, { out, origin } = {}) {
	const abs = path.resolve(htmlPath);
	const outDir = out ? path.resolve(out) : path.dirname(abs);
	const companions = emitCompanions(outDir, { origin });
	const verify = await verifyLanding(abs);
	return { companions, outDir, verify };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	buildLandingShells();
}

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
	DEMOS,
	DIAGRAMS,
	ILLUSTRATIONS,
	ROOT,
	TEMPLATES,
	addLabeledMainLandmark,
	buildAlgebricaComponentCssBlock,
	buildFontFaceBlock,
	ensureFaviconLinks,
} from "./shared.mjs";
import { refreshChartRuntime, refreshSharedCss } from "./retrofit.mjs";

const LANDING = path.join(ROOT, "assets", "landing");
const HTML_EFFECTIVENESS = path.join(ROOT, "assets", "html-effectiveness");
const V2_OVERRIDE_START = "/* vpk-algebrica-v2:start */";
const V2_OVERRIDE_END = "/* vpk-algebrica-v2:end */";
const V2_OVERRIDE_BLOCK = `${V2_OVERRIDE_START}
${buildAlgebricaComponentCssBlock()}

html,
body {
\tbackground: var(--paper-background) !important;
\tcolor: var(--ink) !important;
\tfont-family: "Geist Mono Numeric", var(--font-body) !important;
\tfont-size: 17px !important;
\tline-height: 23px !important;
\tletter-spacing: 0 !important;
}

body {
\tmin-height: 100vh;
}

p,
li,
dd,
dt,
blockquote {
\tfont-family: "Geist Mono Numeric", var(--font-body) !important;
\tfont-size: 17px !important;
\thyphens: auto !important;
\tline-height: 23px !important;
\toverflow-wrap: break-word !important;
}

.post-content p,
.post-section p,
.prose p,
article p {
\ttext-align: justify !important;
}

h1,
.cover-title,
.doc-title,
.resume-name,
.deck-cover .title,
.hero h1,
.title-block h1,
.letter-subject,
.masthead-title {
\tcolor: var(--headline) !important;
\tfont-family: var(--font-display) !important;
\tfont-size: 36px !important;
\tfont-weight: 500 !important;
\tletter-spacing: 0 !important;
\tline-height: 1.4 !important;
}

h2,
.section-title,
.module-title,
.panel-title {
\tcolor: var(--headline) !important;
\tfont-family: var(--font-display) !important;
\tfont-size: 24px !important;
\tfont-weight: 500 !important;
\tletter-spacing: 0 !important;
\tline-height: 1.3 !important;
}

h3,
.card-title,
.metric-title {
\tcolor: var(--ink) !important;
\tfont-family: var(--font-display) !important;
\tfont-size: 19px !important;
\tfont-weight: 500 !important;
\tletter-spacing: 0 !important;
\tline-height: 1.28 !important;
}

h4,
h5,
h6 {
\tcolor: var(--ink) !important;
\tfont-family: var(--font-display) !important;
\tfont-size: 15px !important;
\tfont-weight: 500 !important;
\tletter-spacing: 0 !important;
\tline-height: 1.35 !important;
}

.post-header-breadcrumb,
.breadcrumb-eyebrow,
.eyebrow,
.kicker,
.cover-eyebrow {
\tcolor: var(--muted-text) !important;
\tfont-family: var(--font-mono) !important;
\tfont-size: 12px !important;
\tfont-weight: 600 !important;
\tletter-spacing: 2px !important;
\tline-height: 1.4 !important;
\ttext-transform: uppercase !important;
}

.label,
.meta,
.meta-mono,
.figure-tag,
.fig-num,
.gutter-tag,
.margin-label,
.section-kicker,
.source-label,
.caption,
.tag,
.badge,
.pill,
.chip,
.stat-label,
.vpk-presenter-kicker {
\tcolor: var(--muted-text) !important;
\tfont-family: var(--font-body) !important;
\tfont-size: 13px !important;
\tfont-weight: 400 !important;
\tletter-spacing: 0 !important;
\tline-height: 1.4 !important;
}

code,
kbd,
samp,
pre,
.mono,
.meta-mono,
.fig-num,
.gutter-tag,
svg text {
\tfont-family: var(--font-mono) !important;
}

a,
a:visited {
\tcolor: var(--link) !important;
\ttext-decoration-line: none !important;
\ttext-decoration-color: transparent !important;
\ttext-decoration-thickness: 1px !important;
\ttext-underline-offset: 4px !important;
}

a:hover {
\tcolor: var(--ink) !important;
}

.post-content a,
.post-section a,
.prose a,
article a,
.toc a,
.toc-item,
.module-index-post__title a,
.demo-row,
.in-review-item__title {
\ttext-decoration-line: underline !important;
\ttext-decoration-color: transparent !important;
}

.post-content a:hover,
.post-section a:hover,
.prose a:hover,
article a:hover,
.toc a:hover,
.toc-item:hover,
.module-index-post__title a:hover,
.demo-row:hover,
.in-review-item__title:hover,
.post-content a:focus-visible,
.post-section a:focus-visible,
.prose a:focus-visible,
article a:focus-visible,
.toc a:focus-visible,
.toc-item:focus-visible,
.module-index-post__title a:focus-visible,
.demo-row:focus-visible,
.in-review-item__title:focus-visible {
\ttext-decoration-color: currentColor !important;
}

.post-header-breadcrumb a,
.breadcrumb-eyebrow a,
.eyebrow a,
.kicker a,
.cover-eyebrow a,
.post-header-meta a,
.sidebar-list a,
.sidebar__bottom-links a,
.docnav-controls a,
.docnav-controls button,
footer a,
.footer-list-vertical a,
.header-users-btn,
.pill-button,
.button,
.btn {
\ttext-decoration-line: none !important;
}

table,
.kami-table {
\tborder: 1px solid var(--rule) !important;
\tborder-collapse: collapse !important;
\tborder-radius: 0 !important;
\tbox-shadow: none !important;
\tfont-family: var(--font-body) !important;
\tfont-size: 12px !important;
\tmargin: 0 auto 30px !important;
\twidth: auto !important;
}

th,
td,
.kami-table th,
.kami-table td {
\tborder: 1px solid var(--rule) !important;
\tpadding: 8px 12px !important;
\ttext-align: center !important;
\tvertical-align: middle !important;
\twhite-space: nowrap !important;
}

th,
.kami-table th {
\tbackground: var(--table-header) !important;
\tfont-weight: 500 !important;
}

figure,
.pb-svg {
\tdisplay: flex !important;
\tjustify-content: center !important;
\tmargin: 0 0 30px !important;
\ttext-align: center !important;
}

figure {
\talign-items: center !important;
\tflex-direction: column !important;
}

.review-code,
.code-card {
\tbackground: var(--code-surface) !important;
\tborder-radius: 8px !important;
\tfont-family: var(--font-mono) !important;
\tfont-size: 14px !important;
\tfont-weight: 500 !important;
\tpadding: 30px !important;
}

.frame,
.page,
section,
.card,
.metric,
.metric-card,
.header,
.hero,
.cover,
.doc-cover,
.quote,
.pull-quote,
.callout,
.verdict,
.panel {
\tbox-shadow: none !important;
}
${V2_OVERRIDE_END}`;

function listHtmlFiles(directory) {
	if (!fs.existsSync(directory)) return [];
	return fs.readdirSync(directory)
		.filter(name => name.endsWith(".html"))
		.map(name => path.join(directory, name));
}

function replaceFontFaces(html) {
	const fontBlock = buildFontFaceBlock();
	return html.replace(
		/(?:@font-face\s*\{[\s\S]*?\}\s*)+(?=(?:\/\* vpk-shared:start \*\/|:root\s*\{))/i,
		`${fontBlock}\n`,
	);
}

const FONT_REPLACEMENTS = [
	["Atlassian Mono Numeric", "Geist Mono Numeric"],
	["Atlassian Mono", "Geist Mono"],
	["JetBrains Mono", "Geist Mono"],
	["Geist Pixel", "Geist Mono"],
	["Charlie Display", "Geist"],
	["Charlie Text", "Geist"],
	["Charlie + Geist Mono", "Geist + Geist Mono"],
	["Charlie + Atlassian Mono", "Geist + Geist Mono"],
	["Charlie display/body type", "Geist display/body type"],
	["Atlassian deck", "Algebrica editorial"],
	["atlassian deck", "Algebrica editorial"],
	["ADS blue", "Algebrica grayscale"],
	["primary blue", "darkest-ink focal"],
	["Primary blue", "Darkest-ink focal"],
	["muted green chrome", "grayscale ink chrome"],
	["Muted green chrome", "Grayscale ink chrome"],
	["green chrome", "grayscale chrome"],
	["Green chrome", "Grayscale chrome"],
	["brand-color emphasis", "ink emphasis"],
	["brand color emphasis", "ink emphasis"],
	["rare Pixel garnish", "quiet mono metadata"],
	["rare page-chrome garnish", "quiet mono metadata"],
	["Drop the <svg> block", "Drop the SVG block"],
	["drop the <svg> block", "drop the SVG block"],
	["darkest-ink focal focal", "darkest-ink focal"],
];

function replaceTextIdentity(source) {
	let output = source;
	for (const [from, to] of FONT_REPLACEMENTS) {
		output = output.split(from).join(to);
	}
	return output
		.replace(/Drop the <svg\b[^>]*> block/g, "Drop the SVG block")
		.replace(/drop the <svg\b[^>]*> block/g, "drop the SVG block");
}

function rewriteNonSvgIdentity(source) {
	return source
		.replace(/var\(--primary-blue-tint-strong\)/g, "var(--accent-soft-strong)")
		.replace(/var\(--primary-blue-tint\)/g, "var(--accent-soft)")
		.replace(/var\(--primary-blue\)/g, "var(--accent)")
		.replace(/--primary-blue-tint-strong\b/g, "--accent-soft-strong")
		.replace(/--primary-blue-tint\b/g, "--accent-soft")
		.replace(/--primary-blue\b/g, "--accent")
		.replace(/#0c66e4/gi, "var(--accent)")
		.replace(/#579dff/gi, "var(--accent)")
		.replace(/#0055cc/gi, "var(--accent)")
		.replace(/#e9f2ff/gi, "var(--accent-soft)")
		.replace(/#2f6f4f/gi, "var(--accent)")
		.replace(/#5a9e7c/gi, "var(--accent)")
		.replace(/rgba\(\s*47\s*,\s*111\s*,\s*79\s*,\s*(?:0?\.0[0-9]+|0?\.1[0-9]+)\s*\)/gi, "var(--accent-soft)")
		.replace(/rgba\(\s*47\s*,\s*111\s*,\s*79\s*,\s*(?:0?\.2[0-9]+|0?\.3[0-9]+|0?\.4[0-9]+|0?\.5[0-9]+)\s*\)/gi, "var(--accent-soft-strong)")
		.replace(/rgba\(\s*90\s*,\s*158\s*,\s*124\s*,\s*(?:0?\.0[0-9]+|0?\.1[0-9]+)\s*\)/gi, "var(--accent-soft)")
		.replace(/rgba\(\s*90\s*,\s*158\s*,\s*124\s*,\s*(?:0?\.2[0-9]+|0?\.3[0-9]+|0?\.4[0-9]+|0?\.5[0-9]+)\s*\)/gi, "var(--accent-soft-strong)");
}

function rewriteSvgIdentity(svg) {
	return svg
		.replace(/var\(--primary-blue-tint-strong\)/g, "var(--ill-tone2)")
		.replace(/var\(--primary-blue-tint\)/g, "var(--ill-tone1)")
		.replace(/var\(--primary-blue\)/g, "var(--focal)")
		.replace(/var\(--accent-soft-strong\)/g, "var(--ill-tone2)")
		.replace(/var\(--accent-soft\)/g, "var(--ill-tone1)")
		.replace(/var\(--accent-primary\)/g, "var(--focal)")
		.replace(/var\(--accent\)/g, "var(--focal)")
		.replace(/var\(--link(?:-pressed)?\)/g, "var(--focal)")
		.replace(/var\(--panel\)/g, "var(--surface-raised)")
		.replace(/var\(--line\)/g, "var(--ill-line)")
		.replace(/var\(--oat\)/g, "var(--ill-tone1)")
		.replace(/var\(--slate\)/g, "var(--ill-line)")
		.replace(/var\(--clay\)/g, "var(--focal)")
		.replace(/var\(--selected\)/g, "var(--ill-tone1)")
		.replace(/var\(--accent-(?:lime|purple|saffron|orange|navy|green|red)\)/g, "var(--ill-tone2)")
		.replace(/var\(--collection-(?:software|product|service)\)/g, "var(--ill-tone3)")
		.replace(/(fill|stroke)=["']url\(#dots\)["']/gi, '$1="var(--paper-background)"')
		.replace(/(fill|stroke)=["']white["']/gi, '$1="var(--paper)"')
		.replace(/font-family=(["'])[^"']*?\1/gi, 'font-family="Geist Mono, monospace"')
		.replace(/font-family\s*:\s*[^;"']+/gi, "font-family: var(--font-mono)")
		.replace(/stroke-width=(["'])3(?:\.0+)?\1/g, 'stroke-width="2"')
		.replace(/stroke-width=(["'])4(?:\.0+)?\1/g, 'stroke-width="2.5"')
		.replace(/stroke-width\s*:\s*3(?:\.0+)?/g, "stroke-width: 2")
		.replace(/stroke-width\s*:\s*4(?:\.0+)?/g, "stroke-width: 2.5")
		.replace(/#0c66e4|#579dff|#0055cc/gi, "var(--focal)")
		.replace(/#e9f2ff/gi, "var(--ill-tone1)")
		.replace(/#2f6f4f|#5a9e7c/gi, "var(--focal)")
		.replace(/rgba\(\s*(?:47\s*,\s*111\s*,\s*79|90\s*,\s*158\s*,\s*124)\s*,\s*[^)]+\)/gi, "var(--ill-tone1)");
}

function rewriteBySvgContext(html) {
	let output = "";
	let cursor = 0;
	const svgPattern = /<svg\b[\s\S]*?<\/svg>/gi;
	let match;
	while ((match = svgPattern.exec(html)) !== null) {
		output += rewriteNonSvgIdentity(html.slice(cursor, match.index));
		output += rewriteSvgIdentity(match[0]);
		cursor = match.index + match[0].length;
	}
	output += rewriteNonSvgIdentity(html.slice(cursor));
	return output;
}

function rewriteChromeBlocks(html) {
	return html
		.replace(/\.hl,\s*mark,\s*strong\s*\{[^}]*\}/g, ".hl, mark, strong { color: var(--ink) !important; background: var(--accent-soft) !important; font-weight: 500 !important; }")
		.replace(/a\s*\{\s*color:\s*var\(--accent\);([^}]*)\}/g, "a { color: var(--link);$1}")
		.replace(/a:hover\s*\{\s*color:\s*var\(--link-pressed\);([^}]*)\}/g, "a:hover { color: var(--muted-text);$1}")
		.replace(/\(var\(--ink\)\), darkest-ink focal \(var\(--accent\)\),/g, "(var(--ink)), grayscale ink chrome (var(--accent)), darkest-ink focal (var(--focal)),")
		.replace(/\.ascii-rule/g, ".ascii-rule");
}

function rewriteV2CssSyntax(html) {
	return html
		.replace(/^[\t ]*--font-pixel:\s*[^;]+;\n/gm, "")
		.replace(/font-family:\s*(?:var\(--font-pixel\)|"Geist Pixel")([^;]*);/g, (match, suffix) => {
			if (!/Geist Pixel|--font-pixel/.test(match)) return match;
			return `font-family: var(--font-mono)${suffix};`;
		})
		.replace(/text-transform:\s*uppercase(\s*!important)?\s*;/gi, "")
		.replace(/text-transform:\s*none(\s*!important)?\s*;/gi, "")
		.replace(/letter-spacing:\s*(?!0(?:\s*!important)?\s*;)[^;]+;/gi, "letter-spacing: 0;")
		.replace(/letter-spacing=(["'])(?!0\1)[^"']+\1/gi, 'letter-spacing="0"')
		.replace(/font-weight:\s*(?:700|800|900)(\s*!important)?\s*;/gi, (_, important = "") => `font-weight: 500${important};`)
		.replace(/font-size:\s*(?:4[0-9]|5[0-9]|6[0-9])px(\s*!important)?\s*;/gi, (_, important = "") => `font-size: 36px${important};`)
		.replace(/font-size:\s*18px(\s*!important)?\s*;/gi, (_, important = "") => `font-size: 17px${important};`)
		.replace(/line-height:\s*1\.75(\s*!important)?\s*;/gi, (_, important = "") => `line-height: 1.6${important};`);
}

function rewriteLinkGrammar(html) {
	return html
		.replace(/Links: darkest-ink focal with restrained editorial underline\./g, "Links: content underline reveals on hover; chrome links stay unadorned.")
		.replace(/text-decoration:\s*underline\s+dashed\s+[^;]+;/gi, "text-decoration-line: underline;\n\ttext-decoration-style: dashed;\n\ttext-decoration-color: transparent;")
		.replace(/text-decoration:\s*underline(\s*!important)?\s*;/gi, (_, important = "") => `text-decoration-line: underline${important};`)
		.replace(/text-decoration-color:\s*var\(--rule-strong\)(\s*!important)?\s*;/gi, (_, important = "") => `text-decoration-color: transparent${important};`)
		.replace(/text-decoration-color:\s*color-mix\(\s*in\s+srgb\s*,\s*var\(--clay\)\s+45%\s*,\s*transparent\s*\)(\s*!important)?\s*;/gi, (_, important = "") => `text-decoration-color: transparent${important};`)
		.replace(/a:hover\s*\{\s*color:\s*var\(--muted-text\)(\s*!important)?;\s*\}/g, (_, important = "") => `a:hover { color: var(--ink)${important}; text-decoration-color: currentColor${important}; }`);
}

function applyV2OverrideBlock(html) {
	const blockPattern = new RegExp(`${V2_OVERRIDE_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${V2_OVERRIDE_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
	if (blockPattern.test(html)) {
		return html.replace(blockPattern, V2_OVERRIDE_BLOCK);
	}
	return html.replace(/<\/style>/i, `${V2_OVERRIDE_BLOCK}\n</style>`);
}

function migrateHtml(html) {
	let output = replaceTextIdentity(html);
	output = replaceFontFaces(output);
	output = refreshSharedCss(output);
	output = refreshChartRuntime(output);
	output = rewriteBySvgContext(output);
	output = rewriteChromeBlocks(output);
	output = rewriteV2CssSyntax(output);
	output = rewriteLinkGrammar(output);
	output = refreshSharedCss(output);
	output = refreshChartRuntime(output);
	output = applyV2OverrideBlock(output);
	output = ensureFaviconLinks(output);
	return output;
}

function migrateSourceSnapshot(html) {
	let output = replaceTextIdentity(html);
	output = rewriteBySvgContext(output);
	output = rewriteChromeBlocks(output);
	output = rewriteV2CssSyntax(output);
	output = rewriteLinkGrammar(output);
	return output;
}

function markLiteralDoubleBraces(html) {
	if (/data-vpk-literal-double-braces=["']true["']/.test(html)) return html;
	return html.replace(/<html\b([^>]*)>/i, '<html$1 data-vpk-literal-double-braces="true">');
}

function ensureFirstSvgLabel(html, label) {
	return html.replace(/<svg\b(?![^>]*\baria-(?:label|hidden|labelledby)=)([^>]*)>/i, `<svg aria-label="${label}"$1>`);
}

function normalizeDiagramPage(html, filePath) {
	if (!filePath.includes(`${path.sep}assets${path.sep}diagrams${path.sep}`)) return html;
	const name = path.basename(filePath, ".html").replace(/-/g, " ");
	let output = markLiteralDoubleBraces(html);
	output = addLabeledMainLandmark(output, "vpk-html diagram primitive");
	output = ensureFirstSvgLabel(output, `${name} diagram primitive`);
	return output;
}

function migrateFile(filePath) {
	const before = fs.readFileSync(filePath, "utf8");
	const isSourceSnapshot = filePath.includes(`${path.sep}assets${path.sep}html-effectiveness${path.sep}`);
	let after = isSourceSnapshot ? migrateSourceSnapshot(before) : migrateHtml(before);
	after = normalizeDiagramPage(after, filePath);
	if (after === before) return false;
	fs.writeFileSync(filePath, after, "utf8");
	return true;
}

export function shouldRunLegacyMigration(argv) {
	return argv.includes("--legacy-one-shot");
}

const RETIRED_MESSAGE = "migrate-identity is the 2026-07 one-shot identity migration. Re-running it rewrites 207 committed files (+46k lines) and corrupts @font-face descriptors. Use build.mjs --refresh-library. Pass --legacy-one-shot only to replay the historical migration on a scratch copy.";

function main() {
	if (!shouldRunLegacyMigration(process.argv.slice(2))) {
		console.error(RETIRED_MESSAGE);
		process.exitCode = 1;
		return;
	}
	const files = [
		...listHtmlFiles(TEMPLATES),
		...listHtmlFiles(DIAGRAMS),
		...listHtmlFiles(ILLUSTRATIONS),
		...listHtmlFiles(DEMOS),
		...listHtmlFiles(LANDING),
		...listHtmlFiles(HTML_EFFECTIVENESS),
		path.join(ROOT, "index.html"),
	].filter(file => fs.existsSync(file));

	let changed = 0;
	for (const file of files) {
		if (migrateFile(file)) changed += 1;
	}
	console.log(`migrate-identity complete: ${changed} changed, ${files.length - changed} unchanged`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}

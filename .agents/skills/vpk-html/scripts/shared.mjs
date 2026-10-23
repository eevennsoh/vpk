import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT = path.resolve(__dirname, "..");
export const TEMPLATES = path.join(ROOT, "assets", "templates");
export const DIAGRAMS = path.join(ROOT, "assets", "diagrams");
export const ILLUSTRATIONS = path.join(ROOT, "assets", "illustrations");
export const DEMOS = path.join(ROOT, "assets", "demos");
export const FONTS_DIR = path.join(ROOT, "assets", "fonts");
export const TOKENS_FILE = path.join(ROOT, "references", "tokens.json");
export const STYLES_FILE = path.join(ROOT, "styles.css");
export const SHARED_CSS_START = "/* vpk-shared:start */";
export const SHARED_CSS_END = "/* vpk-shared:end */";

export const FONT_STACKS = {
	display: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
	body: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
	mono: '"Geist Mono", ui-monospace, "SFMono-Regular", Consolas, monospace',
	numeric: '"Geist Mono Numeric", "Geist Mono", ui-monospace, "SFMono-Regular", Consolas, monospace',
};

FONT_STACKS.sans = FONT_STACKS.body;

const FONT_METADATA = {
	otf: { format: "opentype", mime: "font/otf" },
	ttf: { format: "truetype", mime: "font/ttf" },
	woff2: { format: "woff2", mime: "font/woff2" },
};

export const FONT_FILES = [
	{ family: "Geist", file: "Geist[wght].woff2", weight: "100 900" },
	{ family: "Geist Mono", file: "GeistMono[wght].woff2", weight: "100 900" },
	{ family: "Geist Mono Numeric", file: "GeistMono[wght].woff2", weight: "100 900", unicodeRange: "U+0030-0039" },
].map(font => {
	const extension = path.extname(font.file).slice(1).toLowerCase();
	const metadata = FONT_METADATA[extension];
	if (!metadata) throw new Error(`Unsupported font type: ${font.file}`);
	return {
		style: "normal",
		...metadata,
		...font,
	};
});

const VPK_FAVICON_SVGS = {
	fallback: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#121212"/><circle cx="11" cy="21" r="5" fill="white"/><circle cx="21" cy="21" r="5" fill="white"/><circle cx="11" cy="11" r="5" fill="white"/><circle cx="21" cy="11" r="5" fill="white"/></svg>',
	dark: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="23" r="5" fill="#121212"/><circle cx="23" cy="23" r="5" fill="#121212"/><circle cx="9" cy="9" r="5" fill="#121212"/><circle cx="23" cy="9" r="5" fill="#121212"/></svg>',
	light: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="23" r="5" fill="white" stroke="#121212" stroke-width="1.25"/><circle cx="23" cy="23" r="5" fill="white" stroke="#121212" stroke-width="1.25"/><circle cx="9" cy="9" r="5" fill="white" stroke="#121212" stroke-width="1.25"/><circle cx="23" cy="9" r="5" fill="white" stroke="#121212" stroke-width="1.25"/></svg>',
};

function svgDataUrl(svg) {
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const FAVICON_LINKS = [
	{ variant: "fallback", href: svgDataUrl(VPK_FAVICON_SVGS.fallback) },
	{ variant: "dark", href: svgDataUrl(VPK_FAVICON_SVGS.dark), media: "(prefers-color-scheme: light)" },
	{ variant: "light", href: svgDataUrl(VPK_FAVICON_SVGS.light), media: "(prefers-color-scheme: dark)" },
];

export function buildFaviconLinkBlock() {
	return FAVICON_LINKS.map(({ href, media }) => {
		const mediaAttribute = media ? ` media="${media}"` : "";
		return `<link rel="icon" type="image/svg+xml" sizes="any"${mediaAttribute} href="${href}">`;
	}).join("\n");
}

export function stripSelfReferentialCustomProperties(source) {
	return source.replace(/^[\t ]*(--[\w-]+)\s*:\s*var\(\1\);\s*$/gm, "");
}

export function hasVpkFaviconLinks(html) {
	return FAVICON_LINKS.every(({ href, media }) => {
		const hrefPattern = escapeRegExp(href);
		const mediaPattern = media ? `(?=[^>]*\\bmedia=["']${escapeRegExp(media)}["'])` : "";
		const pattern = new RegExp(`<link\\b(?=[^>]*\\brel=["'][^"']*\\bicon\\b[^"']*["'])(?=[^>]*\\bhref=["']${hrefPattern}["'])${mediaPattern}[^>]*>`, "i");
		return pattern.test(html);
	});
}

export function collectFaviconIssues(html) {
	if (!/<meta\s+name=["']generator["']\s+content=["']vpk-html["']/i.test(html)) {
		return [];
	}
	if (hasVpkFaviconLinks(html)) {
		return [];
	}
	return ["missing vpk favicon link set"];
}

export function ensureFaviconLinks(html) {
	if (hasVpkFaviconLinks(html)) {
		return html;
	}

	const faviconBlock = buildFaviconLinkBlock();
	const generatorMeta = /(<meta\s+name=["']generator["']\s+content=["']vpk-html["']\s*\/?>\s*)/i;
	if (generatorMeta.test(html)) {
		return html.replace(generatorMeta, `$1\n${faviconBlock}\n`);
	}

	const viewportMeta = /(<meta\s+name=["']viewport["'][^>]*>\s*)/i;
	if (viewportMeta.test(html)) {
		return html.replace(viewportMeta, `$1\n${faviconBlock}\n`);
	}

	return html.replace(/(<style\b)/i, `${faviconBlock}\n$1`);
}

const TOKEN_ORDER = [
	"paper",
	"paperBackground",
	"surfaceRaised",
	"surfaceOverlay",
	"surfaceSunken",
	"headline",
	"bodyText",
	"ink",
	"mutedText",
	"subtlestText",
	"inverseText",
	"accent",
	"accentSoft",
	"accentSoftStrong",
	"focal",
	"illLine",
	"illTone1",
	"illTone2",
	"illTone3",
	"illHatch",
	"illInk50",
	"illGuide",
	"illGuideDashed",
	"illFrame",
	"illFill",
	"illFillAlt",
	"rule",
	"ruleStrong",
	"tableHeader",
	"chipBorder",
	"chipText",
	"chipSelected",
	"pillBorder",
	"pillFill",
	"pillFillHover",
	"searchBorder",
	"searchFocus",
	"metaText",
	"reviewMeta",
	"heat0",
	"heat1",
	"heat2",
	"heat3",
	"heat4",
	"link",
	"linkPressed",
	"selected",
	"accentLime",
	"accentPurple",
	"accentSaffron",
	"accentOrange",
	"accentNavy",
	"accentGreen",
	"accentRed",
	"collectionSoftware",
	"collectionProduct",
	"collectionService",
	"focusRing",
	"codeSurface",
	"codeInk",
	"codeInverse",
	"syntaxKeyword",
	"syntaxIdentifier",
	"syntaxString",
	"syntaxComment",
	"syntaxLiteral",
	"mathHighlight",
	"success",
	"successTint",
	"warning",
	"warningTint",
	"danger",
	"dangerTint",
	"info",
	"infoTint",
	"diffAddText",
	"diffDelText",
	"diffAddTint",
	"diffDelTint",
];

const ROOT_BLOCK = /:root\s*\{([^}]*)\}/s;
const DARK_BLOCK = /\[data-theme=["']dark["']\]\s*\{([^}]*)\}/s;
const CSS_VAR = /(--[\w-]+)\s*:\s*([^;]+);/g;

export function cssVarName(key) {
	return `--${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}`;
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeCss(css) {
	return css.trim().replace(/\r\n/g, "\n");
}

function pushThemeAliases(lines) {
	lines.push(`\t--font-display: ${FONT_STACKS.display};`);
	lines.push(`\t--font-body: ${FONT_STACKS.body};`);
	lines.push(`\t--font-mono: ${FONT_STACKS.mono};`);
	lines.push(`\t--font-numeric: ${FONT_STACKS.numeric};`);
	lines.push("\t--font-sans: var(--font-body);");
	lines.push("\t--brand: var(--accent);");
	lines.push("\t--primary: var(--accent);");
	lines.push("\t--accent-primary: var(--accent);");
	lines.push("\t--ease-out: cubic-bezier(0.16,1,0.3,1);");
	lines.push("\t--ease-in-out: cubic-bezier(0.65,0,0.35,1);");
	lines.push("\t--vpk-dur-fast: 140ms;");
	lines.push("\t--vpk-dur-enter: 140ms;");
	lines.push("\t--vpk-dur-slide-out: 120ms;");
	lines.push("\t--vpk-stagger: 20ms;");
	lines.push("\t--vpk-chart-draw-duration: 640ms;");
	lines.push("\t--vpk-chart-grow-duration: 520ms;");
	lines.push("\t--vpk-chart-pulse-duration: 900ms;");
	lines.push("\t--vpk-enter-y: 8px;");
	lines.push("\t--vpk-enter-blur: 2px;");
	lines.push("\t--collection-accent-software: var(--collection-software);");
	lines.push("\t--collection-accent-product: var(--collection-product);");
	lines.push("\t--collection-accent-service: var(--collection-service);");
	lines.push("\t--paper-rule: var(--rule);");
	lines.push("\t--page-max-width: 210mm;");
	lines.push("\t--page-pad-x: 22mm;");
	lines.push("\t--page-pad-y: 20mm;");
	lines.push("\t--page-pad-x-compact: clamp(18px, 5vw, 32px);");
	lines.push("\t--page-pad-y-compact: clamp(24px, 6vw, 40px);");
}

export function buildMotionCssBlock() {
	return `/* vpk motion system */
@keyframes vpk-enter {
\tfrom {
\t\topacity: 0;
\t\ttransform: translateY(var(--vpk-enter-y));
\t}
\tto {
\t\topacity: 1;
\t\ttransform: translateY(0);
\t}
}

/* Page text blurs into focus as it enters (the house-catalogue reference video), 2px (--vpk-enter-blur) over the enter
   duration. A separate animation with backwards fill, on text blocks only (never a figure or its SVG): once it ends no filter
   remains, so nothing stays a composited layer. Only under prefers-reduced-motion: no-preference; print sets animation: none. */
@keyframes vpk-focus {
\tfrom {
\t\tfilter: blur(var(--vpk-enter-blur));
\t}
}

@keyframes vpk-slide-in {
\tfrom {
\t\topacity: 0;
\t\ttransform: var(--vpk-slide-enter-from, translateX(24px));
\t}
\tto {
\t\topacity: 1;
\t\ttransform: var(--vpk-slide-enter-to, translateX(0));
\t}
}

@keyframes vpk-slide-out {
\tfrom { opacity: 1; }
\tto { opacity: 0; }
}

@keyframes vpk-chart-draw {
\tfrom { stroke-dashoffset: var(--vpk-draw-length, 1); }
\tto { stroke-dashoffset: 0; }
}

@keyframes vpk-chart-grow {
\tfrom {
\t\topacity: 0;
\t\ttransform: scaleY(0);
\t}
\tto {
\t\topacity: 1;
\t\ttransform: scaleY(1);
\t}
}

@keyframes vpk-chart-reveal {
\tfrom {
\t\topacity: 0;
\t\ttransform: translateY(4px);
\t}
\tto {
\t\topacity: 1;
\t\ttransform: translateY(0);
\t}
}

@keyframes vpk-chart-focal-pulse {
\t0%, 100% {
\t\topacity: 1;
\t\ttransform: scale(1);
\t}
\t50% {
\t\topacity: .72;
\t\ttransform: scale(1.08);
\t}
}

body[data-vpk-motion] main > * {
\tanimation: vpk-enter var(--vpk-dur-enter) var(--ease-out) both;
}

@media (prefers-reduced-motion: no-preference) {
\tbody[data-vpk-motion] main > :is(h1, h2, h3, p, header, hgroup) {
\t\tanimation: vpk-enter var(--vpk-dur-enter) var(--ease-out) both, vpk-focus var(--vpk-dur-enter) var(--ease-out) backwards;
\t}
}

body[data-vpk-motion] main > *:nth-child(1) { animation-delay: 0ms; }
body[data-vpk-motion] main > *:nth-child(2) { animation-delay: calc(var(--vpk-stagger) * 1); }
body[data-vpk-motion] main > *:nth-child(3) { animation-delay: calc(var(--vpk-stagger) * 2); }
body[data-vpk-motion] main > *:nth-child(4) { animation-delay: calc(var(--vpk-stagger) * 3); }
body[data-vpk-motion] main > *:nth-child(5) { animation-delay: calc(var(--vpk-stagger) * 4); }
body[data-vpk-motion] main > *:nth-child(n + 6) { animation-delay: calc(var(--vpk-stagger) * 5); }

/* Scroll-driven section reveal. Not under prefers-reduced-motion: reduce, where a section would stay
   faint until it scrolled into view (B2 decision 14); there the time-based vpk-enter above still lands. */
@media (prefers-reduced-motion: no-preference) {
\t@supports (animation-timeline: view()) {
\t\tbody[data-vpk-motion="document"] main section {
\t\t\tanimation-name: vpk-enter;
\t\t\tanimation-duration: var(--vpk-dur-enter);
\t\t\tanimation-fill-mode: both;
\t\t\tanimation-timing-function: var(--ease-out);
\t\t\tanimation-timeline: view();
\t\t\tanimation-range: entry 0% entry 40%;
\t\t}
\t}
}

.vpk-chart {
\toverflow: visible;
}

.vpk-chart [data-series] {
\ttransition:
\t\topacity 180ms var(--ease-out),
\t\tstroke-opacity 180ms var(--ease-out),
\t\tfill-opacity 180ms var(--ease-out);
}

.vpk-chart [data-series].is-muted,
.vpk-chart [data-series][aria-hidden="true"] {
\topacity: .18;
}

.vpk-chart [data-vpk-point] {
\tcursor: crosshair;
\toutline: none;
}

.vpk-chart [data-vpk-point]:focus-visible {
\toutline: none;
\tstroke-width: 2.5;
}

.vpk-chart-draw {
\tanimation: vpk-chart-draw var(--vpk-chart-draw-duration) var(--ease-out) both;
\tanimation-delay: calc(var(--vpk-stagger-index, 0) * var(--vpk-stagger));
\tstroke-dasharray: var(--vpk-draw-length, 1);
\tstroke-dashoffset: var(--vpk-draw-length, 1);
}

.vpk-chart-grow {
\tanimation: vpk-chart-grow var(--vpk-chart-grow-duration) var(--ease-out) both;
\tanimation-delay: calc(var(--vpk-stagger-index, 0) * var(--vpk-stagger));
\ttransform-box: fill-box;
\ttransform-origin: center bottom;
}

.vpk-chart-reveal {
\tanimation: vpk-chart-reveal var(--vpk-dur-enter) var(--ease-out) both;
\tanimation-delay: calc(var(--vpk-stagger-index, 0) * var(--vpk-stagger));
}

.vpk-chart-focal-pulse {
\tanimation: vpk-chart-focal-pulse var(--vpk-chart-pulse-duration) var(--ease-in-out) both;
\tanimation-delay: calc(var(--vpk-stagger-index, 0) * var(--vpk-stagger));
\ttransform-box: fill-box;
\ttransform-origin: center;
}

.vpk-chart-tooltip {
\tbackground: var(--surface-raised);
\tborder: 1px solid var(--rule-strong);
\tborder-radius: 8px;
\tbox-shadow: var(--shadow);
\tcolor: var(--ink);
\tfont-family: var(--font-mono);
\tfont-size: 12px;
\tline-height: 1.35;
\tmax-width: 220px;
\tpadding: 8px 10px;
\tpointer-events: none;
\tposition: fixed;
\tz-index: 100000;
}

.vpk-chart-tooltip[hidden] {
\tdisplay: none;
}

.vpk-chart-legend {
\tdisplay: flex;
\tflex-wrap: wrap;
\tgap: 8px;
\tjustify-content: center;
\tmargin: 12px 0 0;
}

.vpk-chart-legend button {
\tgap: 8px;
}

.vpk-chart-legend button[aria-pressed="false"] {
\topacity: .55;
}

.vpk-chart-swatch {
\tborder-radius: 9999px;
\tdisplay: inline-block;
\theight: 8px;
\twidth: 18px;
}

.vpk-chart-swatch.is-focal {
\tbackground: var(--focal);
}

.vpk-chart-swatch.is-muted {
\tbackground: var(--muted-text);
}

a,
button,
summary,
[role="button"],
.toc a,
.demo-row {
\ttransition:
\t\tbackground-color var(--vpk-dur-fast) var(--ease-out),
\t\tborder-color var(--vpk-dur-fast) var(--ease-out),
\t\tbox-shadow var(--vpk-dur-fast) var(--ease-out),
\t\tcolor var(--vpk-dur-fast) var(--ease-out),
\t\topacity var(--vpk-dur-fast) var(--ease-out),
\t\ttext-decoration-color var(--vpk-dur-fast) var(--ease-out),
\t\ttransform var(--vpk-dur-fast) var(--ease-out);
}

button:active,
[role="button"]:active,
.demo-row:active {
\ttransform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
\t:root {
\t\t--vpk-enter-y: 0px;
\t\t--vpk-enter-blur: 0px;
\t\t--vpk-stagger: 0ms;
\t}

\tbody[data-vpk-motion] *,
\tbody[data-vpk-motion] *::before,
\tbody[data-vpk-motion] *::after {
\t\tanimation-duration: 200ms !important;
\t\ttransition-duration: 200ms !important;
\t}

\tbody[data-vpk-motion] .slide.is-active,
\tbody[data-vpk-motion] .slide.is-leaving {
\t\ttransform: var(--vpk-slide-enter-to, none) !important;
\t}

\t.vpk-chart-draw {
\t\tstroke-dashoffset: 0 !important;
\t}

\t.vpk-chart-grow {
\t\topacity: 1 !important;
\t\ttransform: scaleY(1) !important;
\t}

\t.vpk-chart-reveal {
\t\topacity: 1 !important;
\t\ttransform: translateY(0) !important;
\t}

\t.vpk-chart-focal-pulse {
\t\topacity: 1 !important;
\t\ttransform: scale(1) !important;
\t}
}

@media print {
\t*,
\t*::before,
\t*::after {
\t\tanimation: none !important;
\t\ttransition: none !important;
\t\ttransform: none !important;
\t\topacity: 1 !important;
\t}

\t.vpk-chart-draw {
\t\tstroke-dashoffset: 0 !important;
\t}
}`;
}

export function buildAlgebricaComponentCssBlock() {
	return `/* algebrica component vocabulary */
/* Prose rhythm scale: base 8px. Eyebrow gap 40, heading after content 48/40/32,
   heading bottom 32/24/16, paragraph gap 24, section gap 56. */
.post-header {
\tmargin-bottom: 56px;
}

.post-header-breadcrumb,
.breadcrumb-eyebrow,
.eyebrow,
.kicker,
.cover-eyebrow {
\tcolor: var(--muted-text);
\tfont-family: var(--font-mono);
\tfont-size: 12px;
\tfont-weight: 600;
\tletter-spacing: 2px;
\tline-height: 1.4;
\tmargin-bottom: 40px;
\ttext-transform: uppercase;
}

.post-header-title {
\tcolor: var(--headline);
\tfont-family: var(--font-display);
\tfont-size: 36px;
\tfont-weight: 500;
\tline-height: 1.4;
\tmargin: 0 0 28px;
}

.post-header-meta {
\tcolor: var(--muted-text);
\tdisplay: flex;
\tflex-wrap: wrap;
\tfont-size: 13px;
\tgap: 20px;
\tline-height: 1.4;
}

.post-content {
\tcolor: var(--ink);
\tfont-family: "Geist Mono Numeric", var(--font-body);
}

.post-section {
\tcolor: var(--ink);
\tfont-family: "Geist Mono Numeric", var(--font-body);
\tfont-size: 17px;
\thyphens: auto;
\tline-height: 23px;
\toverflow-wrap: break-word;
\tpadding-bottom: 56px;
\ttext-align: justify;
}

.post-section:not(:last-child) {
\tborder-bottom: 1px solid var(--rule-strong);
\tmargin-bottom: 56px;
}

.post-section h2 {
\tcolor: var(--headline);
\tfont-family: var(--font-display);
\tfont-size: 26px;
\tfont-weight: 500;
\tline-height: 1.3;
\tmargin: 0 0 32px;
\ttext-align: left;
}

.post-section h3 {
\tcolor: var(--ink);
\tfont-family: var(--font-display);
\tfont-size: 19px;
\tfont-weight: 500;
\tline-height: 1.35;
\tmargin: 0 0 24px;
\ttext-align: left;
}

.post-section h4,
.post-section h5,
.post-section h6 {
\tcolor: var(--ink);
\tfont-family: var(--font-display);
\tfont-size: 15px;
\tfont-weight: 500;
\tline-height: 1.4;
\tmargin: 0 0 16px;
\ttext-align: left;
}

.post-section > * + h2 {
\tmargin-top: 48px;
}

.post-section > * + h3 {
\tmargin-top: 40px;
}

.post-section > * + h4,
.post-section > * + h5,
.post-section > * + h6 {
\tmargin-top: 32px;
}

.post-section p:not(:last-child),
.post-content p:not(:last-child) {
\tmargin-bottom: 24px;
}

.post-paragraph {
\tposition: relative;
}

.post-paragraph-content {
\thyphens: auto;
\toverflow-wrap: break-word;
\ttext-align: justify;
}

.post-paragraph-number {
\tcolor: var(--subtlest-text);
\tfont-size: 17px;
\tleft: -56px;
\tposition: absolute;
\ttext-align: right;
\ttop: 0;
\ttransform: translateY(1px);
\twidth: 26px;
}

a,
a:visited {
\tcolor: var(--link);
\ttext-decoration-line: none;
\ttext-decoration-color: transparent;
\ttext-decoration-thickness: 1px;
\ttext-underline-offset: 4px;
}

a:hover {
\tcolor: var(--ink);
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
\tcolor: var(--link);
\ttext-decoration-line: underline;
\ttext-decoration-color: transparent;
\ttext-decoration-thickness: 1px;
\ttext-underline-offset: 4px;
}

.post-content a:hover,
.post-section a:hover,
.prose a:hover,
article a:hover,
.toc a:hover,
.toc-item:hover,
.module-index-post__title a:hover,
.demo-row:hover,
.in-review-item__title:hover {
\tcolor: var(--ink);
\ttext-decoration-color: currentColor;
}

.post-content a:focus-visible,
.post-section a:focus-visible,
.prose a:focus-visible,
article a:focus-visible,
.toc a:focus-visible,
.toc-item:focus-visible,
.module-index-post__title a:focus-visible,
.demo-row:focus-visible,
.in-review-item__title:focus-visible {
\ttext-decoration-color: currentColor;
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
\ttext-decoration-line: none;
}

.post-header-breadcrumb a:hover,
.breadcrumb-eyebrow a:hover,
.eyebrow a:hover,
.kicker a:hover,
.cover-eyebrow a:hover,
.post-header-meta a:hover,
.sidebar-list a:hover,
.sidebar__bottom-links a:hover,
.docnav-controls a:hover,
.docnav-controls button:hover,
footer a:hover,
.footer-list-vertical a:hover {
\tcolor: var(--muted-text);
}

a:focus-visible,
button:focus-visible,
[role="button"]:focus-visible {
\tborder-radius: 2px;
\tbox-shadow: 0 0 0 2px var(--focus-ring);
\toutline: 0;
}

table,
.kami-table {
\tborder: 1px solid var(--rule);
\tborder-collapse: collapse;
\tborder-radius: 0;
\tbox-shadow: none;
\tfont-family: var(--font-body);
\tfont-size: 12px;
\tmargin: 0 auto 30px;
\twidth: auto;
}

th,
td,
.kami-table th,
.kami-table td {
\tborder: 1px solid var(--rule);
\tpadding: 8px 12px;
\ttext-align: center;
\tvertical-align: middle;
\twhite-space: nowrap;
}

th,
.kami-table th {
\tbackground: var(--table-header);
\tfont-weight: 500;
}

figure,
.pb-svg {
\tdisplay: flex;
\tjustify-content: center;
\tmargin: 0 0 30px;
\ttext-align: center;
}

figure {
\talign-items: center;
\tflex-direction: column;
}

figure > svg,
.pb-svg > svg {
\tdisplay: block;
\theight: auto;
\tmax-width: 100%;
}

figcaption {
\tcolor: var(--muted-text);
\tfont-size: 13px;
\tline-height: 1.4;
\tmargin-top: 12px;
\tmax-width: 62ch;
\ttext-align: center;
}

.MathJax {
\tfont-size: 17px !important;
}

.post-section .MathJax {
\tmargin: 0 !important;
\ttext-align: center !important;
}

table .MathJax,
blockquote .MathJax {
\tfont-size: 13px !important;
}

.module-index__title {
\tborder-top: 1px solid var(--rule-strong);
\tcolor: var(--headline);
\tfont-family: var(--font-display);
\tfont-size: 36px;
\tfont-weight: 500;
\tline-height: 1.2;
\tmargin-bottom: 30px;
\tpadding-top: 40px;
}

.module-index-section {
\tmargin-bottom: 50px;
}

.module-index-section:last-child {
\tmargin-bottom: 0;
}

.module-index-section-header {
\theight: 32px;
\tline-height: 32px;
}

.module-index-heading {
\talign-items: baseline;
\tdisplay: flex;
\tfont-size: 15px;
\tfont-weight: 600;
\tgap: 5px;
\tpadding-bottom: 6px;
}

.module-index-number {
\tcolor: var(--muted-text);
\tflex: 0 0 52px;
\tfont-variant-numeric: tabular-nums;
\twidth: 52px;
}

.module-index-posts {
\tdisplay: flex;
\tflex-direction: column;
\tgap: 5px;
}

.module-index-post {
\talign-items: center;
\tdisplay: flex;
\tfont-size: 15px;
\tgap: 5px;
\tmin-height: 32px;
}

.module-index-post__number {
\tfont-size: 13px;
}

.module-index-post__title {
\tflex: 1 1 auto;
\tmin-width: 0;
}

.in-review-item__count {
\talign-items: center;
\tcolor: var(--meta-text);
\tdisplay: flex;
\tflex: 0 0 auto;
\tfont-size: 13px;
\tgap: 20px;
\tline-height: 1.35;
\twhite-space: nowrap;
}

.module-index-post__views {
\tcolor: var(--muted-text);
\tfont-weight: 500;
\tmin-width: 32px;
\ttext-align: right;
}

.in-review {
\tborder: 1px solid var(--rule);
\tborder-radius: 12px;
\tmargin-top: 40px;
\toverflow: hidden;
}

.in-review-item {
\talign-items: center;
\tborder-top: 1px solid var(--rule);
\tdisplay: flex;
\tfont-size: 15px;
\tgap: 20px;
\tjustify-content: space-between;
\tline-height: 1.35;
\tpadding: 14px;
}

.in-review-item:first-child {
\tborder-top: 0;
}

.in-review-item__title {
\tcolor: var(--ink);
}

.reviews-vote-count,
.vote-chip {
\tborder: 1px solid var(--chip-border);
\tborder-radius: 4px;
\tcolor: var(--chip-text);
\tdisplay: inline-block;
\tfont-size: 13px;
\tfont-weight: 700;
\theight: 22px;
\tline-height: 22px;
\tmin-width: 22px;
\toverflow: hidden;
\ttext-align: center;
}

.is-voted .reviews-vote-count,
.vote-chip.is-active {
\tbackground: var(--chip-border);
\tcolor: var(--chip-selected);
}

.module-contributions {
\tborder-top: 1px solid var(--rule-strong);
\tcolor: var(--ink);
\tfont-size: 12px;
\tline-height: 1.2;
\tmargin: 20px 0 30px;
\tpadding: 40px 0 30px;
}

.module-contributions__title {
\tcolor: var(--headline);
\tfont-family: var(--font-display);
\tfont-size: 36px;
\tfont-weight: 500;
\tline-height: 1.2;
\tmargin-bottom: 30px;
}

.module-contributions__total {
\tcolor: var(--ink);
\tfont-size: 14px;
\tfont-weight: 500;
\tmargin-bottom: 20px;
\tmin-height: 18px;
}

.module-contributions table {
\tborder: 0;
\tborder-collapse: separate;
\tborder-spacing: 4px;
\tmargin-bottom: 0;
\ttable-layout: fixed;
}

.module-contributions td {
\tborder: 0;
\theight: 10px;
\tline-height: 10px;
\tpadding: 0;
}

.heat-dot,
.module-contributions__cell {
\tborder-radius: 50%;
\tdisplay: inline-block;
\theight: 10px;
\tmargin: 0 auto;
\twidth: 10px;
}

.heat-0 { background: var(--heat0); }
.heat-1 { background: var(--heat1); }
.heat-2 { background: var(--heat2); }
.heat-3 { background: var(--heat3); }
.heat-4 { background: var(--heat4); }

.review-code,
.code-card {
\tbackground: var(--code-surface);
\tborder: 0;
\tborder-radius: 8px;
\tcolor: var(--code-ink);
\tfont-family: var(--font-mono);
\tfont-size: 14px;
\tfont-weight: 500;
\tmargin: 0 auto;
\tmax-width: 547px;
\tpadding: 30px;
}

.header-users-btn,
.pill-button,
.button,
.btn,
button {
\talign-items: center;
\tbackground: transparent;
\tborder: 2px solid var(--pill-border);
\tborder-radius: 24px;
\tcolor: var(--muted-text);
\tdisplay: inline-flex;
\tfont-family: var(--font-body);
\tfont-size: 13px;
\tfont-weight: 500;
\theight: 34px;
\tjustify-content: center;
\tpadding: 0 14px;
\ttransition:
\t\tbackground-color var(--vpk-dur-fast) var(--ease-out),
\t\topacity var(--vpk-dur-fast) var(--ease-out);
}

.support-button,
.pill-button.is-filled,
.button.primary,
.btn.primary {
\tbackground: var(--pill-fill);
\tborder-color: var(--pill-fill);
\tcolor: var(--inverse-text);
}

.support-button:hover,
.pill-button.is-filled:hover,
.button.primary:hover,
.btn.primary:hover {
\tbackground: var(--pill-fill-hover);
\tborder-color: var(--pill-fill-hover);
}

.in-review-head,
.centered-section-head {
\tmargin: 0 auto 20px;
\tmax-width: 500px;
\ttext-align: center;
}

.in-review-head-title,
.centered-section-title {
\tcolor: var(--headline);
\tfont-family: var(--font-display);
\tfont-size: 32px;
\tfont-weight: 500;
\tline-height: 1.25;
\tmargin-bottom: 20px;
}

.in-review-head-content,
.centered-section-lede {
\tcolor: var(--meta-text);
\tfont-size: 15px;
\tline-height: 1.5;
}

.pb-steps-community ul,
.steps-list {
\tfont-size: 14px;
\tlist-style: none;
\tmargin: 0 0 30px;
\toverflow: hidden;
\tpadding-left: 30px;
\tposition: relative;
}

.pb-steps-community ul::before,
.steps-list::before {
\tborder-left: 1px solid var(--rule-strong);
\tcontent: "";
\theight: 1000px;
\tleft: 10px;
\tposition: absolute;
\ttop: 0;
}

.pb-steps-community li,
.steps-list li {
\tposition: relative;
}

.pb-steps-community li:not(:last-child),
.steps-list li:not(:last-child) {
\tmargin-bottom: 10px;
}

.pb-steps-community li::before,
.steps-list li::before {
\tbackground: var(--subtlest-text);
\tborder: 2px solid var(--paper-background);
\tborder-radius: 50%;
\tcontent: "";
\theight: 8px;
\tleft: -37px;
\tposition: absolute;
\ttop: 8px;
\twidth: 8px;
}

@media (max-width: 1130px) {
\t.post-header-breadcrumb,
\t.breadcrumb-eyebrow,
\t.eyebrow,
\t.kicker,
\t.cover-eyebrow {
\t\tmargin-bottom: 40px;
\t}

\t.post-paragraph-number {
\t\tdisplay: none;
\t}

\t.in-review {
\t\tpadding: 14px;
\t}

\t.in-review-item {
\t\talign-items: flex-start;
\t\tgap: 6px;
\t}
}`;
}

export function buildResponsiveCssBlock() {
	return `/* vpk compact page tier */
@media screen and (max-width: 840px) {
\thtml {
\t\tbackground: var(--paper-background);
\t}

\tbody:not([data-vpk-chrome]):not([data-vpk-motion="deck"]) {
\t\tmax-width: 100% !important;
\t\tmin-width: 0 !important;
\t\toverflow-x: hidden;
\t\tpadding: var(--page-pad-y-compact) var(--page-pad-x-compact) !important;
\t\twidth: 100% !important;
\t}

\tbody[data-vpk-motion="deck"] {
\t\tmax-width: 100% !important;
\t\twidth: 100% !important;
\t}

\tmain,
\t.page,
\t.sheet,
\t.doc-page,
\t.document-page {
\t\tmax-width: 100% !important;
\t\tmin-width: 0 !important;
\t}

\tbody:not([data-vpk-chrome]):not([data-vpk-motion="deck"]) .page,
\tbody:not([data-vpk-chrome]):not([data-vpk-motion="deck"]) .sheet,
\tbody:not([data-vpk-chrome]):not([data-vpk-motion="deck"]) .doc-page,
\tbody:not([data-vpk-chrome]):not([data-vpk-motion="deck"]) .document-page {
\t\tpadding-left: var(--page-pad-x-compact) !important;
\t\tpadding-right: var(--page-pad-x-compact) !important;
\t}

\timg,
\tsvg,
\tcanvas,
\tvideo,
\tpre,
\ttable {
\t\tmax-width: 100%;
\t}

\tpre,
\tcode {
\t\toverflow-wrap: anywhere;
\t}

\t.post-section,
\t.post-paragraph-content {
\t\ttext-align: left;
\t}
}`;
}

export function buildThemeToggleCssBlock() {
	return `/* vpk theme toggle */
.vpk-theme-toggle {
\talign-items: center;
\tbackdrop-filter: blur(10px);
\tbackground: color-mix(in srgb, var(--paper) 88%, transparent);
\tborder: 1px solid var(--rule);
\tborder-radius: 999px;
\tbottom: 18px;
\tbox-shadow: var(--shadow);
\tcolor: var(--ink);
\tcursor: pointer;
\tdisplay: inline-flex;
\tfont-family: var(--font-mono);
\tfont-size: 12px;
\tfont-weight: 500;
\tgap: 6px;
\theight: 34px;
\tleft: 18px;
\tletter-spacing: 0;
\tline-height: 1;
\tpadding: 0 10px;
\tposition: fixed;
\tz-index: 60;
}

.vpk-theme-toggle:hover,
.vpk-theme-toggle:focus-visible {
\tborder-color: var(--focus-ring);
\tcolor: var(--ink);
}

.vpk-theme-toggle__state {
\tcolor: var(--muted-text);
\tfont-variant-numeric: tabular-nums;
}

@media print {
\t.vpk-theme-toggle {
\t\tdisplay: none !important;
\t}
}`;
}

export function buildChartInteractionScriptBlock() {
	return `<script data-vpk-chart-runtime>
(() => {
\tconst charts = document.querySelectorAll("[data-vpk-chart]");
\tif (!charts.length) return;

\tfunction ensureTooltip(chart, index) {
\t\tlet tooltip = chart.parentElement && chart.parentElement.querySelector(".vpk-chart-tooltip");
\t\tif (tooltip) return tooltip;
\t\ttooltip = document.createElement("div");
\t\ttooltip.className = "vpk-chart-tooltip";
\t\ttooltip.id = chart.id ? chart.id + "-tooltip" : "vpk-chart-tooltip-" + index;
\t\ttooltip.setAttribute("role", "tooltip");
\t\ttooltip.hidden = true;
\t\t(chart.parentElement || document.body).appendChild(tooltip);
\t\treturn tooltip;
\t}

\tfunction moveTooltip(tooltip, event, target) {
\t\tconst rect = target.getBoundingClientRect();
\t\tconst left = event && "clientX" in event ? event.clientX + 12 : rect.left + rect.width / 2 + 12;
\t\tconst top = event && "clientY" in event ? event.clientY + 12 : rect.top + rect.height / 2 + 12;
\t\ttooltip.style.left = Math.min(left, window.innerWidth - 240) + "px";
\t\ttooltip.style.top = Math.max(8, top) + "px";
\t}

\tcharts.forEach((chart, index) => {
\t\tconst tooltip = ensureTooltip(chart, index);
\t\tconst points = Array.from(chart.querySelectorAll("[data-vpk-point]"));
\t\tconst toggles = Array.from((chart.parentElement || chart).querySelectorAll("[data-vpk-legend-toggle][data-series]"));

\t\tpoints.forEach((point, pointIndex) => {
\t\t\tif (!point.hasAttribute("tabindex")) point.setAttribute("tabindex", "0");
\t\t\tif (!point.hasAttribute("role")) point.setAttribute("role", "button");
\t\t\tpoint.addEventListener("pointerenter", event => {
\t\t\t\tconst text = point.getAttribute("data-tooltip");
\t\t\t\tif (!text) return;
\t\t\t\ttooltip.textContent = text;
\t\t\t\ttooltip.hidden = false;
\t\t\t\tpoint.setAttribute("aria-describedby", tooltip.id);
\t\t\t\tmoveTooltip(tooltip, event, point);
\t\t\t});
\t\t\tpoint.addEventListener("pointermove", event => moveTooltip(tooltip, event, point));
\t\t\tpoint.addEventListener("pointerleave", () => {
\t\t\t\ttooltip.hidden = true;
\t\t\t\tpoint.removeAttribute("aria-describedby");
\t\t\t});
\t\t\tpoint.addEventListener("focus", event => {
\t\t\t\tconst text = point.getAttribute("data-tooltip");
\t\t\t\tif (!text) return;
\t\t\t\ttooltip.textContent = text;
\t\t\t\ttooltip.hidden = false;
\t\t\t\tpoint.setAttribute("aria-describedby", tooltip.id);
\t\t\t\tmoveTooltip(tooltip, event, point);
\t\t\t});
\t\t\tpoint.addEventListener("blur", () => {
\t\t\t\ttooltip.hidden = true;
\t\t\t\tpoint.removeAttribute("aria-describedby");
\t\t\t});
\t\t\tpoint.addEventListener("keydown", event => {
\t\t\t\tconst keyMap = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
\t\t\t\tlet nextIndex = pointIndex;
\t\t\t\tif (event.key in keyMap) nextIndex = (pointIndex + keyMap[event.key] + points.length) % points.length;
\t\t\t\telse if (event.key === "Home") nextIndex = 0;
\t\t\t\telse if (event.key === "End") nextIndex = points.length - 1;
\t\t\t\telse return;
\t\t\t\tevent.preventDefault();
\t\t\t\tpoints[nextIndex].focus();
\t\t\t});
\t\t});

\t\ttoggles.forEach(toggle => {
\t\t\ttoggle.addEventListener("click", () => {
\t\t\t\tconst series = toggle.getAttribute("data-series");
\t\t\t\tconst pressed = toggle.getAttribute("aria-pressed") === "true";
\t\t\t\ttoggle.setAttribute("aria-pressed", String(!pressed));
\t\t\t\tchart.querySelectorAll('[data-series="' + series + '"]').forEach(target => {
\t\t\t\t\tif (target === toggle) return;
\t\t\t\t\ttarget.classList.toggle("is-muted", pressed);
\t\t\t\t\ttarget.setAttribute("aria-hidden", pressed ? "true" : "false");
\t\t\t\t});
\t\t\t});
\t\t});
\t});
})();
</script>`;
}

function listHtmlFiles(directory) {
	if (!fs.existsSync(directory)) return [];
	return fs.readdirSync(directory)
		.filter(name => name.endsWith(".html"))
		.map(name => path.join(directory, name));
}

function collectBlockVars(source, blockPattern) {
	const block = blockPattern.exec(source)?.[1];
	if (!block) return null;

	const vars = new Map();
	for (const match of block.matchAll(CSS_VAR)) {
		if (!vars.has(match[1])) vars.set(match[1], match[2].trim());
	}
	return vars;
}

function collectStyleVars(source) {
	return {
		root: collectBlockVars(source, ROOT_BLOCK),
		dark: collectBlockVars(source, DARK_BLOCK),
	};
}

function compareStyleVars(filePath, expected, actual) {
	const issues = [];
	for (const mode of ["root", "dark"]) {
		const expectedVars = expected[mode];
		const actualVars = actual[mode];
		if (!expectedVars || !actualVars) {
			issues.push(`${path.relative(ROOT, filePath)} missing ${mode === "root" ? ":root" : "[data-theme=\"dark\"]"} token block`);
			continue;
		}
		for (const [name, expectedValue] of expectedVars) {
			const actualValue = actualVars.get(name);
			if (actualValue !== undefined && actualValue.toLowerCase() !== expectedValue.toLowerCase()) {
				issues.push(`${path.relative(ROOT, filePath)}: ${name} expected ${expectedValue}, got ${actualValue}`);
			}
		}
	}
	return issues;
}

export function loadTokens() {
	return readJson(TOKENS_FILE);
}

export function buildStylesCssFromTokens(tokens = loadTokens()) {
	const lines = [":root {", "\tcolor-scheme: light dark;"];
	for (const key of TOKEN_ORDER) {
		if (!tokens.semantic[key]) throw new Error(`Missing semantic token: ${key}`);
		lines.push(`\t${cssVarName(key)}: ${tokens.semantic[key]};`);
	}
	pushThemeAliases(lines);
	lines.push(`\t--shadow: ${tokens.semantic.shadow};`);
	lines.push("}", "");
	lines.push('[data-theme="dark"] {');
	for (const key of TOKEN_ORDER) {
		if (!tokens.dark[key]) throw new Error(`Missing dark token: ${key}`);
		lines.push(`\t${cssVarName(key)}: ${tokens.dark[key]};`);
	}
	pushThemeAliases(lines);
	lines.push(`\t--shadow: ${tokens.dark.shadow};`);
	lines.push("}", "");
	lines.push("@media (prefers-reduced-motion: reduce) {");
	lines.push("\t*,");
	lines.push("\t*::before,");
	lines.push("\t*::after {");
	lines.push("\t\tanimation-duration: 0.001ms !important;");
	lines.push("\t\tscroll-behavior: auto !important;");
	lines.push("\t\ttransition-duration: 0.001ms !important;");
	lines.push("\t}");
	lines.push("}");
	lines.push("");
	lines.push(buildMotionCssBlock());
	lines.push("");
	lines.push(buildAlgebricaComponentCssBlock());
	lines.push("");
	lines.push(buildResponsiveCssBlock());
	lines.push("");
	lines.push(buildThemeToggleCssBlock());
	return `${lines.join("\n")}\n`;
}

export function readStylesCss() {
	if (!fs.existsSync(STYLES_FILE)) {
		throw new Error(`Styles file not found: ${STYLES_FILE}`);
	}
	return fs.readFileSync(STYLES_FILE, "utf8").trim();
}

export function wrapSharedCss(css = readStylesCss()) {
	if (css.includes(SHARED_CSS_START) && css.includes(SHARED_CSS_END)) return css;
	return `${SHARED_CSS_START}\n${css.trim()}\n${SHARED_CSS_END}`;
}

export function checkStyleSource() {
	const expected = normalizeCss(buildStylesCssFromTokens());
	const actual = normalizeCss(readStylesCss());
	if (actual === expected) return [];
	return [
		"styles.css does not match references/tokens.json",
		"run: node .agents/skills/vpk-html/scripts/build.mjs --write-styles",
	];
}

export function writeStylesCssFromTokens() {
	fs.writeFileSync(STYLES_FILE, buildStylesCssFromTokens(), "utf8");
}

export function checkStyleConsumers() {
	const sharedCss = readStylesCss();
	const expected = collectStyleVars(sharedCss);
	const files = [
		...listHtmlFiles(TEMPLATES),
		...listHtmlFiles(DIAGRAMS),
		...listHtmlFiles(ILLUSTRATIONS),
		...listHtmlFiles(DEMOS),
	];
	const drift = [];
	for (const filePath of files) {
		const content = fs.readFileSync(filePath, "utf8");
		drift.push(...compareStyleVars(filePath, expected, collectStyleVars(content)));
	}
	return drift;
}

export function inlineFont(fileName, mime = "font/woff2") {
	const filePath = path.join(FONTS_DIR, fileName);
	if (!fs.existsSync(filePath)) {
		throw new Error(`Font file not found: ${filePath}`);
	}
	return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

export function buildFontFaceBlock() {
	return FONT_FILES.map(({ family, file, format, mime, weight, style, unicodeRange }) => {
		const unicodeRangeRule = unicodeRange ? `\n\tunicode-range: ${unicodeRange};` : "";
		return `@font-face {
\tfont-family: "${family}";
\tsrc: url("${inlineFont(file, mime)}") format("${format}");
\tfont-weight: ${weight};
\tfont-style: ${style};
\tfont-display: swap;
${unicodeRangeRule}}`;
	}).join("\n");
}

export function buildSharedCssBlock() {
	return `${buildFontFaceBlock()}\n${wrapSharedCss()}`;
}

// Wrap the body's visible content in a <main> landmark, closing before any
// trailing <script> (or </body> when there is none). Idempotent. Slice-based
// placement; used by the editorial templates (see scripts/build.test.js).
export function addMainLandmark(text) {
	if (/<main\b/i.test(text)) return text;
	const bodyOpenMatch = /<body([^>]*)>/i.exec(text);
	if (!bodyOpenMatch) return text;
	const bodyOpenEnd = bodyOpenMatch.index + bodyOpenMatch[0].length;
	const bodyTail = text.slice(bodyOpenEnd);
	const bodyCloseMatch = /<\/body>/i.exec(bodyTail);
	if (!bodyCloseMatch) return text;
	const bodyContent = bodyTail.slice(0, bodyCloseMatch.index);
	const bodyScriptMatch = /<script\b/i.exec(bodyContent);
	const mainCloseOffset = bodyOpenEnd + (bodyScriptMatch ? bodyScriptMatch.index : bodyCloseMatch.index);
	return `${text.slice(0, bodyOpenEnd)}\n<main>${text.slice(bodyOpenEnd, mainCloseOffset)}\n</main>${text.slice(mainCloseOffset)}`;
}

// Regex two-step landmark with an aria-label, used by the curated + upstream demo
// families. Distinct whitespace handling from addMainLandmark — kept separate so
// each family's output stays byte-for-byte stable. Idempotent.
export function addLabeledMainLandmark(html, label) {
	if (/<main\b/i.test(html)) return html;
	return html
		.replace(/<body([^>]*)>/i, `<body$1>\n<main aria-label="${label}">`)
		.replace(/(\s*)(<script\b|<\/body>)/i, `\n</main>$1$2`);
}

// Neutral page shell for figure exemplars and figure demos (integration R31, K14).
//
// illustrationPage() is the only shell for standalone figure pages: build-illustrations.mjs (legacy
// exemplars and iso-kit brief exemplars), iso/build-figure.mjs (brief → page) and ws4b's
// figures/build-engine-demo.mjs all call it. It writes the same head and CSS as the v1
// build-illustrations page(), and it writes no runtime: callers run the ws0 runtime pipeline
// (runtime/pipeline.mjs applyRuntimePipeline) on the result, which inserts the canonical SMIL starter,
// the iso/anatomy blocks and, for demos, the enhancement block.
//
// The document-level figure-engine record (integration R4, K11) lives here too, so every builder
// derives and inserts <meta name="vpk-figure-engine"> the same way:
//   - deriveFigureEngine(html): "none" | "iso-kit" | "anatomy-hero" | "both", from the engine roots present;
//   - ensureFigureEngineMeta(html, engine?): inserts the meta when it is absent and never overwrites one.
// Roots are found with figures/check-figures.mjs engineRoots (element start tags outside script and style
// text), the same scan E1–E3 apply, so CSS selectors and runtime strings never count as roots.
// No file reads at module top level beyond shared.mjs's own imports.

import { buildFaviconLinkBlock, buildSharedCssBlock } from "../shared.mjs";
import { engineRoots } from "./check-figures.mjs";

export const FIGURE_ENGINE_VALUES = Object.freeze(["none", "iso-kit", "anatomy-hero", "both", "hairline"]);

const ENGINE_META = /<meta\b[^>]*\bname\s*=\s*["']vpk-figure-engine["'][^>]*>/i;

function escapeText(value) {
	return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value) {
	return escapeText(value).replace(/"/g, "&quot;");
}

// Engine record derived from the element roots present: no roots → "none". Hairline roots record "hairline"
// ("both" stays iso-kit plus anatomy-hero); a page that mixes hairline with another engine passes its meta explicitly.
export function deriveFigureEngine(html) {
	const roots = new Set(engineRoots(String(html)).map(root => String(root.engine).toLowerCase()));
	const kinds = new Set([...roots].filter(engine => engine === "iso-kit" || engine === "anatomy-hero"));
	if (kinds.size === 2) return "both";
	if (kinds.size === 1) return [...kinds][0];
	return roots.has("hairline") ? "hairline" : "none";
}

export function figureEngineMetaTag(engine) {
	if (!FIGURE_ENGINE_VALUES.includes(engine)) {
		throw new RangeError(`vpk-figure-engine must be one of ${FIGURE_ENGINE_VALUES.join("|")}, got ${JSON.stringify(engine)}`);
	}
	return `<meta name="vpk-figure-engine" content="${engine}">`;
}

// Inserts <meta name="vpk-figure-engine"> when the document has none (R4: never overwrite). The value
// is `engine` when given, else derived from the roots. A document with no roots and no explicit engine
// is returned unchanged, because an absent meta already means "none".
export function ensureFigureEngineMeta(html, engine = undefined) {
	const source = String(html);
	if (ENGINE_META.test(source)) return source;
	const value = engine ?? deriveFigureEngine(source);
	if (engine === undefined && value === "none") return source;
	const tag = figureEngineMetaTag(value);
	const generator = /<meta\b[^>]*\bname\s*=\s*["']generator["'][^>]*>/i.exec(source);
	if (generator) {
		const at = generator.index + generator[0].length;
		return `${source.slice(0, at)}\n${tag}${source.slice(at)}`;
	}
	const head = /<\/head>/i.exec(source);
	if (!head) throw new Error("ensureFigureEngineMeta: document has no </head>");
	return `${source.slice(0, head.index)}${tag}\n${source.slice(head.index)}`;
}

const PAGE_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; }

html {
\tbackground: var(--paper-background);
\tcolor: var(--ink);
\tfont-family: "Geist Mono Numeric", var(--font-body);
\tline-height: 1.6;
}

body {
\tbackground: var(--paper-background);
\tmin-height: 100vh;
\tpadding: clamp(24px, 5vw, 56px);
}

main {
\tdisplay: grid;
\tgap: 24px;
\tmargin: 0 auto;
\tmax-width: 1080px;
}

.eyebrow {
\tcolor: var(--muted-text);
\tfont-family: var(--font-body);
\tfont-size: 13px;
\tletter-spacing: 0;
\ttext-transform: none;
}

h1 {
\tcolor: var(--headline);
\tfont-family: var(--font-display);
\tfont-size: 36px;
\tfont-weight: 500;
\tletter-spacing: 0;
\tline-height: 1.14;
}

.summary {
\tcolor: var(--muted-text);
\tfont-size: 17px;
\tline-height: 1.6;
\tmax-width: 64ch;
}

.figure-frame {
\tbackground: var(--paper);
\tborder: 1px solid var(--rule);
\tborder-radius: 6px;
\tpadding: clamp(18px, 4vw, 36px);
}

svg[data-vpk-illustration] {
\tdisplay: block;
\theight: auto;
\tmargin: 0 auto;
\tmax-width: 920px;
\twidth: 100%;
}

.caption {
\tborder-top: 1px solid var(--rule);
\tcolor: var(--muted-text);
\tfont-size: 14px;
\tmargin-top: 18px;
\tpadding-top: 12px;
}

@media print {
\tbody { background: var(--paper); padding: 18mm; }
\t.figure-frame { break-inside: avoid; }
}`;

/**
 * Standalone figure page.
 *
 * @param {object} options
 * @param {string} options.slug         file stem; used in the eyebrow and keywords
 * @param {string} options.title        plain text (escaped); <title> and <h1>
 * @param {string} options.summary      plain text (escaped); meta description and the summary paragraph
 * @param {string} options.figureHtml   raw HTML placed after the summary (an iso plate, a hero region, or a
 *                                      legacy <figure class="figure-frame"> wrapper)
 * @param {string} [options.figureEngine] "none" | "iso-kit" | "anatomy-hero" | "both"; default: derived
 *                                      from the roots in the page (no meta when there are none)
 * @param {string} [options.eyebrow]    plain text; default `technical illustration · <slug>`
 * @param {string} [options.beforeHtml] raw HTML between the summary and the figure
 * @param {string} [options.afterHtml]  raw HTML after the figure, still inside <main>
 * @param {string} [options.extraCss]   CSS appended to the page stylesheet (tokens only; check-html applies)
 * @returns {string} the page without any runtime block
 */
export function illustrationPage({ slug, title, summary, figureHtml, figureEngine = undefined, eyebrow = undefined, beforeHtml = "", afterHtml = "", extraCss = "" }) {
	if (!slug || typeof slug !== "string") throw new TypeError("illustrationPage: slug is required");
	if (typeof figureHtml !== "string") throw new TypeError("illustrationPage: figureHtml must be a string");
	const css = extraCss ? `${PAGE_CSS}\n\n${extraCss.trim()}` : PAGE_CSS;
	const before = beforeHtml ? `\n${beforeHtml}` : "";
	const after = afterHtml ? `\n${afterHtml}` : "";
	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeText(title)} · vpk-html illustration</title>
<meta name="author" content="vpk-html">
<meta name="description" content="${escapeAttr(summary)}">
<meta name="keywords" content="vpk-html, technical illustration, ${escapeAttr(slug)}">
<meta name="generator" content="vpk-html">
${buildFaviconLinkBlock()}
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${buildSharedCssBlock()}

${css}
</style>
</head>
<body data-vpk-motion="document">
<main>
\t<p class="eyebrow">${escapeText(eyebrow ?? `technical illustration · ${slug}`)}</p>
\t<h1>${escapeText(title)}</h1>
\t<p class="summary">${escapeText(summary)}</p>${before}
${figureHtml}${after}
</main>
</body>
</html>
`;
	return ensureFigureEngineMeta(html, figureEngine);
}

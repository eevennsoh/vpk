#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { collectFaviconIssues, cssVarName, loadTokens } from "./shared.mjs";
import { isDeck } from "./presentation.mjs";
import { collectFigureEngineIssues } from "./figures/check-figures.mjs";
import { collectFontFaceIssues } from "./font-faces.mjs";
import { collectSmilMotionIssues, listSmilElements, readSmilAttribute } from "./runtime/smil-starter.mjs";

// Timing and gating rules live with the starter; build.mjs and callers import them from here.
export { collectSmilMotionIssues };

const __filename = fileURLToPath(import.meta.url);

function collectMatches(regex, source) {
	const matches = [];
	let match;
	while ((match = regex.exec(source)) !== null) {
		matches.push(match[0]);
	}
	return matches;
}

export function collectColorTokenIssues(source, label = "document") {
	if (/[/\\]assets[/\\]html-effectiveness[/\\]/.test(label)) return [];
	if (/data-vpk-raw-colors-allowed=["']true["']/.test(source)) return [];

	const stripped = source
		// The vendored hairline engine's fade() mask (core/stage.ts) writes white gradient stops: mask luminance sets
		// the reflection's opacity, it is never paint, so the theme has nothing to map. Exempt that literal only, and
		// only inside the hairline runtime script (figure-engines.md § 10).
		.replace(/<script data-vpk-hairline-runtime>[\s\S]*?<\/script>/g, block => block.replaceAll('"stop-color":"#fff"', '"stop-color":"mask-white"'))
		// The vendored anatomy-figures bundle (anatomy-gl engine, figure-engines.md § 11) carries upstream's five built-in
		// theme tables as hex; the page never uses them, because the boot hands every figure the vpk token map. Exempt the
		// one runtime script, nothing else.
		.replace(/<script data-vpk-anatomy-gl-runtime>[\s\S]*?<\/script>/g, "<script data-vpk-anatomy-gl-runtime></script>")
		.replace(/<svg\b(?=[^>]*\bdata-vpk-external-asset\b)[\s\S]*?<\/svg>/gi, "<svg data-vpk-external-asset></svg>")
		.replace(/url\(["']?data:font\/(?:woff2|otf|ttf);base64,[^)]+?\)/g, "url(data:font/...,...)")
		.replace(/url\(["']?data:image\/[^)]+?\)/g, "url(data:image/...)")
		.replace(/\[[^\]]*(?:fill|stroke)=["']#[0-9A-Fa-f]{3,8}["'][^\]]*\]/g, "[svg-color-selector]")
		.replace(/\b(?:href|id|for|aria-controls|aria-labelledby)=["']#[^"']+["']/gi, "fragment-ref")
		.replace(/\b(?:PR|Pull Request)\s+#[0-9A-Fa-f]{3,8}\b/g, "issue-ref")
		.replace(/&#[0-9A-Fa-f]+;/g, "numeric-entity");

	const issues = [];
	const colorPattern = /#[0-9A-Fa-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/gi;
	const lines = stripped.split("\n");
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const matches = [...line.matchAll(colorPattern)]
			.map(match => match[0])
			.filter(match => !(line.includes("<") && /^#[0-9]{3,8}$/.test(match)));
		if (matches.length === 0) continue;

		const isTokenDeclaration = isAllowedTokenColorDeclaration(line);
		const isBrandOverrideFallback = /var\(--ds-brand-override,\s*#[0-9A-Fa-f]{3,8}\)/.test(line);
		const isAllowedGeneratedNoise = /sourceMappingURL=/.test(line);

		if (!isTokenDeclaration && !isBrandOverrideFallback && !isAllowedGeneratedNoise) {
			issues.push(`line ${index + 1}: ${[...new Set(matches)].join(", ")}`);
			if (issues.length >= 12) break;
		}
	}

	if (issues.length > 0) {
		return [`contains raw color literals outside the vpk semantic alias layer (${issues.join("; ")})`];
	}
	return [];
}

function normalizeColorDeclarationValue(value) {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// Token values that earlier releases shipped and later changed. Documents built before the change keep an
// inline copy of the shared token block, so they stay valid here; new builds always use references/tokens.json.
// B2 decision 16: light --muted-text moved from #706e6e (4.44:1 on --paper) to a value that clears AA.
const LEGACY_TOKEN_DECLARATIONS = {
	"--muted-text": ["#706e6e"],
};

function buildAllowedTokenDeclarations() {
	const tokens = loadTokens();
	const declarations = new Map();
	for (const mode of ["semantic", "light", "dark"]) {
		for (const [key, value] of Object.entries(tokens[mode] ?? {})) {
			const cssName = key === "shadow" ? "--shadow" : cssVarName(key);
			if (!declarations.has(cssName)) declarations.set(cssName, new Set());
			declarations.get(cssName).add(normalizeColorDeclarationValue(value));
		}
	}
	for (const [cssName, values] of Object.entries(LEGACY_TOKEN_DECLARATIONS)) {
		if (!declarations.has(cssName)) declarations.set(cssName, new Set());
		for (const value of values) declarations.get(cssName).add(normalizeColorDeclarationValue(value));
	}
	return declarations;
}

let allowedTokenDeclarations;

function isAllowedTokenColorDeclaration(line) {
	const match = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
	if (!match) return false;
	allowedTokenDeclarations ??= buildAllowedTokenDeclarations();
	const allowedValues = allowedTokenDeclarations.get(match[1]);
	return allowedValues?.has(normalizeColorDeclarationValue(match[2])) ?? false;
}

// Exported read-only for iso/palette.test.mjs (ws3 S1c): the iso kit's tokens must be a subset.
export const ALLOWED_FIGURE_TOKENS = new Set([
	"--paper",
	"--paper-background",
	"--surface-raised",
	"--surface-overlay",
	"--surface-sunken",
	"--headline",
	"--body-text",
	"--ink",
	"--muted-text",
	"--subtlest-text",
	"--inverse-text",
	"--focal",
	"--ill-line",
	"--ill-tone1",
	"--ill-tone2",
	"--ill-tone3",
	"--ill-hatch",
	"--ill-ink50",
	"--ill-guide",
	"--ill-guide-dashed",
	"--ill-frame",
	"--ill-fill",
	"--ill-fill-alt",
	"--ill-accent",
	"--ill-accent-ink",
	"--rule",
	"--rule-strong",
	"--selected",
	"--heat0",
	"--heat1",
	"--heat2",
	"--heat3",
	"--heat4",
	"--code-surface",
	"--code-ink",
	"--code-inverse",
	"--math-highlight",
	"--success",
	"--success-tint",
	"--warning",
	"--warning-tint",
	"--danger",
	"--danger-tint",
	"--info",
	"--info-tint",
]);

export function isAllowedFigureColorValue(value) {
	const normalized = value.trim().replace(/\s+/g, " ");
	if (/^(none|transparent|currentColor|inherit)$/i.test(normalized)) return true;
	const token = normalized.match(/^var\((--[\w-]+)\)$/);
	if (token) return ALLOWED_FIGURE_TOKENS.has(token[1]);
	const mix = normalized.match(/^color-mix\(\s*in\s+srgb\s*,\s*var\((--[\w-]+)\)\s+[\d.]+%\s*,\s*(?:transparent|var\((--[\w-]+)\))\s*\)$/i);
	if (mix) {
		return ALLOWED_FIGURE_TOKENS.has(mix[1]) && (!mix[2] || ALLOWED_FIGURE_TOKENS.has(mix[2]));
	}
	return false;
}

function findLineNumber(source, index) {
	return source.slice(0, index).split("\n").length;
}

// ws3 S1b: `url(#id)` paint is legal for fill/stroke only when it names a <pattern> in the same
// SVG (hatching). Returns null when the value is not a url() paint, "" when it is legal, else the
// issue text.
const svgRoot = svg => svg.match(/^<svg\b[^>]*>/i)?.[0] ?? "";
const isIsoRoot = svg => /\sdata-vpk-iso[\s>=]/.test(svgRoot(svg));
// Spectrum rays (illustrations.md § rays): an iso root marked data-vpk-iso-spectrum may stroke these three tokens.
export const ISO_RAY_TOKENS = Object.freeze(["--ill-ray-r", "--ill-ray-g", "--ill-ray-b"]);
const RAY_PAINT = new RegExp(`^var\\((?:${ISO_RAY_TOKENS.join("|")})\\)$`);

function localPatternIds(svg) {
	const ids = new Set([...svg.matchAll(/<pattern\b[^>]*\bid=["']([^"']+)["']/gi)].map(match => match[1]));
	// Iso glow gradients (vpk-iso-<id>-glow-*) are local paint servers too; their stops are checked below.
	if (isIsoRoot(svg)) for (const match of svg.matchAll(/<(?:linearGradient|radialGradient)\b[^>]*\bid=["'](vpk-iso-[\w-]+-glow-[^"']*)["']/gi)) ids.add(match[1]);
	return ids;
}

function localPaintUrlIssue(property, value, patternIds) {
	const url = /^url\(\s*["']?#([^"')\s]+)["']?\s*\)$/i.exec(value.trim());
	if (!url || !/^(?:fill|stroke)$/i.test(property)) return null;
	return patternIds.has(url[1]) ? "" : `${property} references url(#${url[1]}) that is not a local <pattern>`;
}

function collectSvgColorIssues(svg, baseLine) {
	const issues = [];
	const patternIds = localPatternIds(svg);
	const spectrum = isIsoRoot(svg) && /\sdata-vpk-iso-spectrum[\s>=]/.test(svgRoot(svg));
	const check = (property, value, index, render) => {
		if (spectrum && RAY_PAINT.test(value.trim())) return;
		const urlIssue = localPaintUrlIssue(property, value, patternIds);
		if (urlIssue === "") return;
		if (urlIssue) issues.push(`line ${baseLine + findLineNumber(svg, index) - 1}: ${urlIssue}`);
		else if (!isAllowedFigureColorValue(value)) issues.push(`line ${baseLine + findLineNumber(svg, index) - 1}: ${render} must use grayscale figure tokens`);
	};
	const attrPattern = /\b(fill|stroke|stop-color|color)=["']([^"']+)["']/gi;
	let match;
	while ((match = attrPattern.exec(svg)) !== null) {
		if (match[1].toLowerCase() === "fill") {
			const tagStart = svg.lastIndexOf("<", match.index);
			const tag = tagStart >= 0 ? svg.slice(tagStart, match.index) : "";
			if (/^<\s*(?:animate|animateTransform|animateMotion|set)\b/i.test(tag)) continue;
		}
		check(match[1], match[2], match.index, `${match[1]}="${match[2]}"`);
	}

	const styleAttrPattern = /\bstyle=["']([^"']+)["']/gi;
	while ((match = styleAttrPattern.exec(svg)) !== null) {
		const style = match[1];
		for (const property of style.matchAll(/\b(fill|stroke|stop-color|color)\s*:\s*([^;]+)/gi)) {
			check(property[1], property[2], match.index, `${property[1]}:${property[2].trim()}`);
		}
	}

	const styleBlockPattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
	while ((match = styleBlockPattern.exec(svg)) !== null) {
		for (const property of match[1].matchAll(/\b(fill|stroke|stop-color|color)\s*:\s*([^;}]+)/gi)) {
			check(property[1], property[2], match.index, `${property[1]}:${property[2].trim()}`);
		}
	}
	return issues;
}

const SMIL_PAINT_ATTRIBUTES = new Set(["fill", "stroke", "stop-color", "color", "flood-color", "lighting-color"]);

// SMIL paint animations (locked decision 2): every values item and from/to/by use grayscale figure tokens.
function collectSmilPaintIssues(svg, baseLine) {
	const issues = [];
	for (const element of listSmilElements(svg)) {
		const attributeName = readSmilAttribute(element.attrs, "attributeName")?.trim();
		if (!attributeName || !SMIL_PAINT_ATTRIBUTES.has(attributeName)) continue;
		const values = (readSmilAttribute(element.attrs, "values") ?? "").split(";").map(value => value.trim()).filter(Boolean);
		for (const name of ["from", "to", "by"]) {
			const value = readSmilAttribute(element.attrs, name);
			if (value !== null) values.push(value.trim());
		}
		for (const value of values) {
			if (!isAllowedFigureColorValue(value)) {
				issues.push(`line ${baseLine + findLineNumber(svg, element.index) - 1}: SMIL ${element.name} attributeName="${attributeName}" value "${value}" must use grayscale figure tokens`);
			}
		}
	}
	return issues;
}

function collectSvgFontIssues(svg, baseLine) {
	const issues = [];
	const pattern = /\bfont-family=["']([^"']+)["']|\bfont-family\s*:\s*([^;}"']+)/gi;
	let match;
	while ((match = pattern.exec(svg)) !== null) {
		const family = (match[1] ?? match[2] ?? "").trim();
		if (!/(Geist Mono|var\(--font-mono\)|var\(--font-numeric\)|Geist Mono Numeric)/i.test(family)) {
			issues.push(`line ${baseLine + findLineNumber(svg, match.index) - 1}: SVG font-family must resolve to Geist Mono, got "${family}"`);
		}
	}
	return issues;
}

function collectSvgStrokeWidthIssues(svg, baseLine) {
	const issues = [];
	const pattern = /\bstroke-width=["']?([^"'\s>]+)["']?|\bstroke-width\s*:\s*([^;}"']+)/gi;
	let match;
	while ((match = pattern.exec(svg)) !== null) {
		const raw = (match[1] ?? match[2] ?? "").trim();
		if (/^(?:var|calc)\(/i.test(raw)) continue;
		const value = Number(raw);
		if (!Number.isFinite(value) || value < 0.5 || value > 2.5) {
			issues.push(`line ${baseLine + findLineNumber(svg, match.index) - 1}: stroke-width "${raw}" must be numeric within 0.5-2.5`);
		}
	}
	return issues;
}

export function collectSvgGrammarIssues(source) {
	const issues = [];
	// SVG built at run time inside the vendored anatomy-gl runtime (shader-lit plates, soot gradients) is upstream's own
	// drawing, not authored markup; the grammar applies to the document's SVG, so that one script is skipped.
	source = source.replace(/<script data-vpk-anatomy-gl-runtime>[\s\S]*?<\/script>/g, "<script data-vpk-anatomy-gl-runtime></script>");
	const svgPattern = /<svg\b[\s\S]*?<\/svg>/gi;
	let match;
	while ((match = svgPattern.exec(source)) !== null) {
		const svg = match[0];
		const root = svg.match(/^<svg\b[^>]*>/i)?.[0] ?? "";
		if (/\bdata-vpk-external-asset\b/i.test(root)) continue;
		const baseLine = findLineNumber(source, match.index);

		// Iso glow (illustrations.md § glow): an iso root may carry gradients whose ids are all vpk-iso-<id>-glow-*; their stop
		// colours are still checked by collectSvgColorIssues. Filters and drop shadows stay banned everywhere.
		const gradientIds = [...svg.matchAll(/<(?:linearGradient|radialGradient)\b[^>]*\sid="([^"]*)"/gi)].map(m => m[1]);
		const gradientCount = (svg.match(/<(?:linearGradient|radialGradient)\b/gi) ?? []).length;
		const isoGlow = /\sdata-vpk-iso[\s>=]/.test(root) && gradientCount > 0 && gradientIds.length === gradientCount && gradientIds.every(id => /^vpk-iso-[\w-]+-glow-/.test(id));
		if (/<(?:filter|feDropShadow)\b|filter\s*=|drop-shadow\(/i.test(svg) || (!isoGlow && /<(?:linearGradient|radialGradient)\b/i.test(svg))) {
			issues.push(`line ${baseLine}: SVG must not use gradients, filters, or drop shadows`);
		}
		if (/var\(--(?:accent|link)[\w-]*\)/i.test(svg)) {
			issues.push(`line ${baseLine}: SVG must not use accent or link tokens`);
		}
		issues.push(...collectSvgColorIssues(svg, baseLine));
		issues.push(...collectSmilPaintIssues(svg, baseLine));
		issues.push(...collectSvgFontIssues(svg, baseLine));
		issues.push(...collectSvgStrokeWidthIssues(svg, baseLine));
		if (issues.length >= 12) return [`SVG grammar violations (${issues.slice(0, 12).join("; ")})`];
	}
	return issues.length > 0 ? [`SVG grammar violations (${issues.slice(0, 12).join("; ")})`] : [];
}

export function collectSelfReferentialCustomPropertyIssues(source) {
	const issues = [];
	const lines = source.split("\n");
	for (let index = 0; index < lines.length; index++) {
		const match = lines[index].match(/^\s*(--[\w-]+)\s*:\s*var\(\1\);\s*$/);
		if (!match) continue;
		issues.push(`line ${index + 1}: ${match[1]}`);
		if (issues.length >= 12) break;
	}

	if (issues.length > 0) {
		return [`contains self-referential custom properties that invalidate theme tokens (${issues.join("; ")})`];
	}
	return [];
}

function cssLengthToPx(value) {
	const normalized = value.trim().toLowerCase();
	if (normalized === "thin") return 1;
	if (normalized === "medium") return 3;
	if (normalized === "thick") return 5;
	const match = normalized.match(/^(-?\d*\.?\d+)(px|pt|rem|em|mm|cm|in)?$/);
	if (!match) return null;
	const numeric = Number(match[1]);
	if (!Number.isFinite(numeric)) return null;
	const unit = match[2] || "px";
	const multipliers = {
		px: 1,
		pt: 96 / 72,
		rem: 16,
		em: 16,
		mm: 96 / 25.4,
		cm: 96 / 2.54,
		in: 96,
	};
	return numeric * multipliers[unit];
}

function firstBorderWidthPx(value) {
	for (const part of value.trim().split(/\s+/)) {
		const px = cssLengthToPx(part);
		if (px !== null) return px;
	}
	return null;
}

function borderWidthSides(value) {
	const parts = value.trim().split(/\s+/).map(cssLengthToPx);
	if (parts.some(part => part === null)) return [];
	if (parts.length === 1) return [["left", parts[0]], ["right", parts[0]]];
	if (parts.length === 2) return [["left", parts[1]], ["right", parts[1]]];
	if (parts.length === 3) return [["left", parts[1]], ["right", parts[1]]];
	return [["left", parts[3]], ["right", parts[1]]];
}

function collectBorderStripeDeclarations(css, baseLine, label) {
	const issues = [];
	const pattern = /\b(border-(left|right)(?:-width)?|border-width)\s*:\s*([^;{}]+);/gi;
	let match;
	while ((match = pattern.exec(css)) !== null) {
		const property = match[1].toLowerCase();
		const line = baseLine + findLineNumber(css, match.index) - 1;
		const sides = property === "border-width"
			? borderWidthSides(match[3])
			: [[match[2].toLowerCase(), firstBorderWidthPx(match[3])]];
		for (const [side, width] of sides) {
			if (width === null || width <= 1.6) continue;
			issues.push(`${label} line ${line}: ${property} sets ${side} border to ${Number(width.toFixed(2))}px`);
			if (issues.length >= 12) return issues;
		}
	}
	return issues;
}

export function collectBorderStripeIssues(source) {
	const issues = [];
	const styleBlockPattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
	let match;
	while ((match = styleBlockPattern.exec(source)) !== null) {
		issues.push(...collectBorderStripeDeclarations(match[1], findLineNumber(source, match.index), "style block"));
		if (issues.length >= 12) break;
	}

	if (issues.length < 12) {
		const styleAttrPattern = /\bstyle=["']([^"']+)["']/gi;
		while ((match = styleAttrPattern.exec(source)) !== null) {
			issues.push(...collectBorderStripeDeclarations(match[1], findLineNumber(source, match.index), "style attribute"));
			if (issues.length >= 12) break;
		}
	}

	if (issues.length > 0) {
		return [`contains decorative side-border stripes over 1.6px (${issues.slice(0, 12).join("; ")})`];
	}
	return [];
}

export function collectPresentationIssues(source) {
	if (!isDeck(source)) return [];
	const issues = [];
	if (!/<script\b[^>]*\bdata-vpk-presentation-runtime\b/i.test(source)) {
		issues.push("deck is missing the shared presentation runtime script");
	}
	if (!/\.speaker-notes\s*\{[\s\S]*?display:\s*none\s*!important/i.test(source)) {
		issues.push("deck does not hide .speaker-notes by default");
	}
	if (!/@media\s+print\s*\{[\s\S]*?(?:animation|transition|transform):\s*none\s*!important/i.test(source)) {
		issues.push("deck is missing the print motion neutralizer");
	}
	return issues;
}

// ws1 review markup (ws1 §4.16; integration K6 collector 4). Static markup only: comments are
// dropped and <template>, <script> and <style> contents are blanked (their tags stay, so
// script attributes still count). Attribute names match exactly (data-vpk-review never
// matches data-vpk-review-runtime). Inert without review markup.
const REVIEW_MARKER_IDS = ["review", "review-data", "revisions", "review-content"];

function reviewStaticMarkup(source) {
	return source
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<template\b[\s\S]*?<\/template\s*>/gi, "")
		.replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, "$1$3");
}

function reviewIslands(source, attribute) {
	const islands = [];
	const pattern = /<script\b((?:[^"'>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi;
	const named = new RegExp(`(?:^|\\s)${attribute}(?=[\\s>=/]|$)`, "i");
	let match;
	while ((match = pattern.exec(source)) !== null) {
		if (/\btype\s*=\s*["']?application\/json/i.test(match[1]) && named.test(match[1])) islands.push(match[2]);
	}
	return islands;
}

function reviewMetaContent(markup, name) {
	for (const tag of markup.match(/<meta\b[^>]*>/gi) ?? []) {
		if (!new RegExp(`\\bname\\s*=\\s*["']?${name}["'\\s>]`, "i").test(tag)) continue;
		const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
		return content ? (content[1] ?? content[2] ?? content[3] ?? "") : "";
	}
	return null;
}

// Review blocks are indexed and stamped only inside <main>. Returns the visible text of the
// block elements that sit in <body> outside <main> (headings, paragraphs, list items, cells).
const OUTSIDE_MAIN_BLOCKS = /<(h[1-6]|p|li|td|th|dt|dd|blockquote|figcaption)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
const REVIEW_IGNORED_ATTRIBUTE = /data-vpk-review-ignore|data-vpk-generated|data-vpk-review-ui|speaker-notes/;

function textOutsideMain(markup) {
	const open = markup.search(/<main\b/i);
	const close = markup.toLowerCase().lastIndexOf("</main");
	const body = markup.search(/<body\b/i);
	if (open < 0 || close < open || body < 0) return [];
	const outside = (markup.slice(body, open) + markup.slice(close))
		.replace(/<(svg|nav|noscript|script|style|template|select|button)\b[\s\S]*?<\/\1\s*>/gi, "");
	const found = [];
	for (const [, , attrs, inner] of outside.matchAll(OUTSIDE_MAIN_BLOCKS)) {
		if (REVIEW_IGNORED_ATTRIBUTE.test(attrs)) continue;
		const text = inner.replace(/<[^>]*>/g, "").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
		if (text) found.push(text);
	}
	return found;
}

export function collectReviewIssues(source) {
	const failures = [];
	const warnings = [];
	if (!/data-vpk-|vpk-doc-|<!-- vpk-review/.test(source)) return { failures, warnings };
	const markup = reviewStaticMarkup(source);
	const hasRuntime = /<script\b[^>]*\bdata-vpk-review-runtime(?=[\s>=/])/i.test(markup);
	if (hasRuntime || reviewMetaContent(markup, "vpk-doc-id") !== null || /\sdata-vpk-id\s*=/i.test(markup)) {
		const outside = textOutsideMain(markup);
		if (outside.length) {
			const sample = outside.slice(0, 3).map(text => `"${text.length > 40 ? `${text.slice(0, 37)}...` : text}"`).join(", ");
			warnings.push(`${outside.length} text block${outside.length === 1 ? "" : "s"} outside <main> cannot take review comments (the review loop indexes and stamps only <main>): ${sample}. Move them inside <main>.`);
		}
	}
	if (/<fieldset\b[^>]*\bdata-vpk-decision\s*=/i.test(markup) && !hasRuntime) {
		warnings.push("decision blocks are inert without the review runtime (answers are not captured); run build.mjs --inject-review");
	}
	const docId = reviewMetaContent(markup, "vpk-doc-id");
	if (hasRuntime && !/^[a-z0-9]{8,32}$/.test(docId ?? "")) failures.push("review runtime present without a valid vpk-doc-id meta");
	const counts = new Map();
	for (const match of markup.matchAll(/<[a-zA-Z][^\s/>]*\b[^>]*?\sdata-vpk-id\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
		const id = match[1] ?? match[2];
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	const duplicates = [...counts].filter(([, count]) => count > 1).map(([id]) => id);
	if (duplicates.length) failures.push(`duplicate data-vpk-id values: ${duplicates.slice(0, 12).join(", ")}${duplicates.length > 12 ? ` and ${duplicates.length - 12} more` : ""}`);
	let registry = null;
	for (const attribute of ["data-vpk-review", "data-vpk-revisions"]) {
		for (const text of reviewIslands(source, attribute)) {
			if (text.includes("<")) {
				failures.push(`${attribute} island contains a raw "<" (write it with serializeJsonIsland)`);
				continue;
			}
			try {
				const value = JSON.parse(text);
				if (attribute === "data-vpk-revisions") registry = value;
			} catch (error) {
				failures.push(`${attribute} island is not valid JSON (${error.message})`);
			}
		}
	}
	const entries = registry && Array.isArray(registry.entries) ? registry.entries : [];
	if (entries.length) {
		const last = entries[entries.length - 1]?.id;
		const revision = reviewMetaContent(markup, "vpk-doc-revision");
		if (revision !== last) failures.push(`vpk-doc-revision meta (${revision ?? "missing"}) does not match the last revision entry (${last})`);
	}
	for (const id of REVIEW_MARKER_IDS) {
		const start = source.split(`<!-- vpk-${id}:start -->`).length - 1;
		const end = source.split(`<!-- vpk-${id}:end -->`).length - 1;
		if (start > 1 || end > 1) failures.push(`duplicated vpk-${id} markers`);
		else if (start !== end || (start === 1 && source.indexOf(`<!-- vpk-${id}:end -->`) < source.indexOf(`<!-- vpk-${id}:start -->`))) failures.push(`unbalanced vpk-${id} markers`);
	}
	return { failures, warnings };
}

// Templates stay review-free (ws1 §4.16 template guard; build.mjs --check-templates).
export function collectTemplateReviewIssues(source) {
	if (!/data-vpk-|vpk-doc-|<!-- vpk-review/.test(source)) return [];
	const markup = reviewStaticMarkup(source);
	const issues = [];
	if (/\sdata-vpk-id\s*=/i.test(markup)) issues.push("template carries data-vpk-id (stamp copies, never templates)");
	if (/\sdata-vpk-revision\s*=/i.test(markup)) issues.push("template carries data-vpk-revision marks");
	if (reviewMetaContent(markup, "vpk-doc-id") !== null || reviewMetaContent(markup, "vpk-doc-revision") !== null) issues.push("template carries a vpk-doc-id or vpk-doc-revision meta");
	if (reviewIslands(source, "data-vpk-review").length || reviewIslands(source, "data-vpk-revisions").length) issues.push("template carries a review or revisions island");
	if (/<script\b[^>]*\bdata-vpk-review-runtime(?=[\s>=/])/i.test(markup)) issues.push("template carries the review runtime");
	if (/<style\b[^>]*\bdata-vpk-review-content(?=[\s>=/])/i.test(markup) || source.includes("<!-- vpk-review-content:start -->")) issues.push("template carries the review-content block");
	return issues;
}

function hasAttribute(tag, attribute) {
	return new RegExp(`\\s${attribute}(?:\\s*=|\\s|>)`, "i").test(tag);
}

export function validateHtmlString(html, label = "document") {
	const failures = [];

	// Landing/product-site mode (opt-in, parallels data-vpk-upstream-demo): a
	// screen-first page may legitimately load remote assets (analytics, OG images)
	// and link companion files (sitemap, canonical). This loosens ONLY the
	// remote-asset + external-stylesheet rules; every other offline invariant
	// (embedded fonts, dark block, a11y, main landmark, no unresolved {{...}})
	// still applies.
	const isLanding = /<html\b[^>]*\bdata-vpk-landing=["']true["']/i.test(html);

	if (/{{[^}]+}}/.test(html) && !/data-vpk-literal-double-braces="true"/.test(html)) {
		failures.push("contains unresolved {{...}} placeholder tokens");
	}

	const remotePatterns = [
		/<script\b[^>]*\bsrc=["']https?:\/\//gi,
		/<link\b[^>]*\bhref=["']https?:\/\//gi,
		/<(?:img|source|iframe|audio|video|object|embed)\b[^>]*(?:src|data|poster)=["']https?:\/\//gi,
		/url\(\s*["']?https?:\/\//gi,
		/@import\s+(?:url\()?["']?https?:\/\//gi,
	];
	if (!isLanding) {
		for (const pattern of remotePatterns) {
			const matches = collectMatches(pattern, html);
			if (matches.length > 0) {
				failures.push(`contains remote runtime asset reference: ${matches[0]}`);
			}
		}
	}

	if (!/@font-face[\s\S]+data:font\/(?:woff2|otf|ttf);base64,/.test(html)) {
		failures.push("does not embed local fonts as data URIs");
	}
	failures.push(...collectFontFaceIssues(html));

	if (!isLanding && /<link\b[^>]*rel=["'][^"']*stylesheet/i.test(html)) {
		failures.push("contains an external stylesheet link instead of inline CSS");
	}

	if (/<script\b[^>]*\bsrc=/i.test(html)) {
		failures.push("contains a non-inline script");
	}

	if (!/<style>[\s\S]*<\/style>/i.test(html)) {
		failures.push("does not contain inline CSS");
	}

	failures.push(...collectColorTokenIssues(html, label));
	failures.push(...collectSelfReferentialCustomPropertyIssues(html));
	failures.push(...collectBorderStripeIssues(html));
	failures.push(...collectFaviconIssues(html));
	failures.push(...collectPresentationIssues(html));
	failures.push(...collectSmilMotionIssues(html));
	failures.push(...collectSvgGrammarIssues(html));
	const reviewIssues = collectReviewIssues(html);
	failures.push(...reviewIssues.failures);
	// Figure engines (ws4b, K6 row 5): engine record E1–E3 and anatomy hero H1–H8; inert without their markup.
	const figureIssues = collectFigureEngineIssues(html);
	failures.push(...figureIssues.failures);

	if (!/\[data-theme="dark"\]/.test(html) || !/color-scheme:\s*light dark/.test(html)) {
		failures.push("does not contain the dark-mode token block");
	}

	if (/data-vpk-toggle-allowed="true"/.test(html) && !/data-vpk-theme-toggle/.test(html)) {
		failures.push("allows theme toggle but does not render the toggle control");
	}

	const metadataComments = collectMatches(/<!--[\s\S]*?-->/g, html);
	for (const comment of metadataComments) {
		if (/\/Users\/|[A-Za-z]:\\/.test(comment)) {
			failures.push("metadata comment contains an absolute source path");
			break;
		}
	}

	const imageTags = collectMatches(/<img\b[^>]*>/gi, html);
	for (const tag of imageTags) {
		if (!hasAttribute(tag, "alt")) {
			failures.push(`image tag lacks alt text: ${tag}`);
			break;
		}
	}

	const svgTags = collectMatches(/<svg\b[^>]*>/gi, html);
	for (const tag of svgTags) {
		if (!hasAttribute(tag, "aria-label") && !hasAttribute(tag, "aria-hidden") && !hasAttribute(tag, "aria-labelledby")) {
			failures.push(`svg lacks accessible name or decorative marker: ${tag}`);
			break;
		}
	}

	const controlTags = collectMatches(/<(?:button|textarea|input)\b[^>]*>/gi, html);
	for (const tag of controlTags) {
		if (/<input\b/i.test(tag) && /type=["']hidden["']/i.test(tag)) continue;
		if (/<button\b/i.test(tag)) {
			const tagEnd = html.indexOf("</button>", html.indexOf(tag));
			const text = tagEnd >= 0 ? html.slice(html.indexOf(tag) + tag.length, tagEnd).trim() : "";
			if (!text && !hasAttribute(tag, "aria-label") && !hasAttribute(tag, "aria-labelledby")) {
				failures.push(`button lacks accessible name: ${tag}`);
				break;
			}
		}
	}

	if (!/<main\b/i.test(html)) {
		failures.push("does not contain a main landmark");
	}

	// Advisory only: warnings never change `ok` or the exit code.
	const warnings = [...reviewIssues.warnings, ...figureIssues.warnings];

	return {
		ok: failures.length === 0,
		label,
		failures,
		warnings,
	};
}

export function validateHtmlFile(filePath) {
	const html = fs.readFileSync(filePath, "utf8");
	return validateHtmlString(html, filePath);
}

export function auditColorTokensFile(filePath) {
	const html = fs.readFileSync(filePath, "utf8");
	return {
		ok: collectColorTokenIssues(html, filePath).length === 0,
		label: filePath,
		failures: collectColorTokenIssues(html, filePath),
	};
}

async function main() {
	const files = process.argv.slice(2);
	if (files.length === 0) {
		console.error("Usage: check-html.mjs <file.html> [more.html]");
		process.exitCode = 1;
		return;
	}

	const results = files.map(file => validateHtmlFile(path.resolve(process.cwd(), file)));
	for (const result of results) {
		if (result.ok) {
			console.log(`ok ${result.label}`);
		} else {
			console.error(`not ok ${result.label}`);
			for (const failure of result.failures) {
				console.error(`- ${failure}`);
			}
		}
		for (const warning of result.warnings) console.warn(`warn ${warning}`);
	}

	if (results.some(result => !result.ok)) {
		process.exitCode = 1;
	}
}

if (process.argv[1] === __filename) {
	await main();
}

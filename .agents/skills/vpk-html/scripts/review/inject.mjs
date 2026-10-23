/*
 * review/inject: serializes the in-page review runtime and builds, inserts,
 * refreshes and removes its blocks (ws1 4.2, 4.6). Node only.
 *
 * The runtime is the source text of every export of the serialized modules
 * (review/{text,schema,markup,anchor,merge,markdown}.mjs and review/runtime/
 * {dom,boot,highlights,panel,composer,decisions,transport}.mjs) plus ws6
 * serializeJsonIsland, parseJsonIsland and findJsonIslands and scanSecrets,
 * minified by esbuild into one strict IIFE (`format: "iife"`, tree-shaken, so
 * functions nothing reaches are dropped). The config (version, the shadow style
 * attribute name, icons, the data-URL budget) never passes through esbuild: a
 * free identifier placeholder is replaced after minification with
 * serializeJsonIsland(config), so every less-than sign in it is a backslash-u
 * escape. The shadow-root CSS is not in the config (see reviewRuntimeConfig).
 *
 * Blocks (markers from review/markup.mjs reviewMarkers, equal to ws0 markerPair):
 *   review          <style data-vpk-review-style> (document CSS)
 *                   + <style data-vpk-review-shadow media="not all"> (shadow-root CSS, never
 *                     applied to the page; B2 decision 8)
 *                   + <script data-vpk-review-runtime>                              (body end)
 *   review-content  <style data-vpk-review-content>, only with decision blocks        (head end)
 * The pipeline step (runtime/review.mjs) is replace-only: refreshReviewRuntime
 * rewrites blocks in place and never inserts them. esbuild loads lazily (R28).
 */

import { createRequire } from "node:module";
import { findJsonIslands, parseJsonIsland, serializeJsonIsland } from "../json-island.mjs";
import { inlineIcon } from "../icons.mjs";
import { DATA_URL_SAFE_HTML_BYTES } from "../media/size-budget.mjs";
import { scanSecrets } from "../secret-scan.mjs";
import * as anchorDomModule from "./anchor-dom.mjs";
import * as anchorModule from "./anchor.mjs";
import * as layoutAuditModule from "./layout-audit.mjs";
import * as markdownModule from "./markdown.mjs";
import * as markupModule from "./markup.mjs";
import * as mergeModule from "./merge.mjs";
import * as bootModule from "./runtime/boot.mjs";
import * as composerModule from "./runtime/composer.mjs";
import * as decisionsModule from "./runtime/decisions.mjs";
import * as domModule from "./runtime/dom.mjs";
import * as highlightsModule from "./runtime/highlights.mjs";
import * as layoutModule from "./runtime/layout.mjs";
import * as ownerModule from "./runtime/owner.mjs";
import * as panelModule from "./runtime/panel.mjs";
import { reviewContentCss, reviewDocumentCss, reviewShadowCss } from "./runtime/styles.mjs";
import * as threadsModule from "./runtime/threads.mjs";
import * as transportModule from "./runtime/transport.mjs";
import * as schemaModule from "./schema.mjs";
import * as textModule from "./text.mjs";

const require = createRequire(import.meta.url);

/** Serialized modules in emission order: [name, namespace]. */
export const SERIALIZED_MODULES = Object.freeze([
	["text", textModule],
	["schema", schemaModule],
	["markup", markupModule],
	["anchor", anchorModule],
	["anchor-dom", anchorDomModule],
	["layout-audit", layoutAuditModule],
	["merge", mergeModule],
	["markdown", markdownModule],
	["runtime/dom", domModule],
	["runtime/boot", bootModule],
	["runtime/highlights", highlightsModule],
	["runtime/panel", panelModule],
	["runtime/layout", layoutModule],
	["runtime/owner", ownerModule],
	["runtime/threads", threadsModule],
	["runtime/composer", composerModule],
	["runtime/decisions", decisionsModule],
	["runtime/transport", transportModule],
]);

/** Text the emitted runtime must never contain (ws1 4.6 rule 1). */
export const REVIEW_RUNTIME_FORBIDDEN = /<!--|-->|<\/?(?:script|style|body|html|head|main|template|svg|button|textarea|input|select|img|source|iframe|audio|video|object|embed|link|meta|linearGradient|radialGradient|filter)\b/i;

/** Validator-sensitive text the runtime must never contain (ws1 4.6 rule 2). */
export const REVIEW_RUNTIME_SENSITIVE = /#[0-9A-Fa-f]{3,8}\b|\b(?:rgba?|hsla?)\(|{{[^}]+}}|(?:^|[^-])\bease-in\b(?!-)/;

/**
 * The review block budget (T-INJ5). ws1 4.6 and integration K2 set 90 KB (92,160 B) for M1; B2
 * decision 2 raised the M1 budget to 131,072 B after the trim (tree-shaking), on the EU26 evidence
 * that the ws1 9 item 12 performance budgets still pass (P2-ws1-M1.md D1). With the M2 code (Layout
 * tab, Owner mode, Re-attach, storage meter) the spec's +10,240 B allowance applies on top:
 * 141,312 B (P3 decision 21, a deviation). Measuring rule (K2, B2 decision 20): the runtime is
 * built with esbuild `minify: true, format: "iife", treeShaking: true` (not the spec's
 * whitespace-only setting), and the budget counts the whole review block as injected (document
 * style + shadow style + script).
 */
export const REVIEW_BLOCK_SPEC_BYTES = 141312;

const CONFIG_PLACEHOLDER = "__VPK_REVIEW_CONFIG__";
const LEGAL = "/*! vpk-review runtime v1 | cssPathFor ported from lavish-axi revisionSelectorFor (MIT, (c) 2026 Kun Chen) | review wording ideas from html-plan (MIT) */";

// Function sources in order; throws on a non-function or a repeated name.
export function serializeFunctions(fns) {
	const names = new Set();
	const out = [];
	for (const fn of fns) {
		if (typeof fn !== "function") throw new TypeError(`serializeFunctions: not a function: ${String(fn)}`);
		if (!fn.name) throw new TypeError("serializeFunctions: anonymous function");
		if (names.has(fn.name)) throw new Error(`serializeFunctions: duplicate function name ${fn.name}`);
		names.add(fn.name);
		const source = fn.toString();
		if (!/^(?:async\s+)?function\b/.test(source)) throw new TypeError(`serializeFunctions: ${fn.name} is not a function declaration`);
		out.push(source);
	}
	return out.join("\n");
}

export function serializedFunctionList() {
	const fns = [];
	for (const [, namespace] of SERIALIZED_MODULES) {
		for (const [name, value] of Object.entries(namespace)) {
			if (typeof value !== "function") throw new TypeError(`serialized module export ${name} is not a function`);
			fns.push(value);
		}
	}
	fns.push(serializeJsonIsland, parseJsonIsland, findJsonIslands, scanSecrets);
	return fns;
}

// The shadow-root CSS ships as raw (minified) text in a never-applied
// <style data-vpk-review-shadow media="not all"> inside the review block, not
// in the JSON config: escaping every parenthesis cost about 3 KB. The runtime
// copies it into its shadow root; config.shadowStyle names that attribute.
export function reviewRuntimeConfig() {
	return {
		version: 1,
		shadowStyle: "data-vpk-review-shadow",
		icons: {
			comment: inlineIcon("comment"),
			copy: inlineIcon("copy"),
			send: inlineIcon("send"),
			download: inlineIcon("download"),
			close: inlineIcon("cross"),
			check: inlineIcon("check-mark"),
			reply: inlineIcon("reply-left"),
			chevronUp: inlineIcon("chevron-up"),
			chevronDown: inlineIcon("chevron-down"),
		},
		dataUrlSafeBytes: DATA_URL_SAFE_HTML_BYTES,
	};
}

let cachedScript = null;

// The runtime script text (without the script tags); memoized and deterministic.
export function buildReviewRuntimeScript() {
	if (cachedScript) return cachedScript;
	const esbuild = require("esbuild");
	const body = serializeFunctions(serializedFunctionList());
	// Top-level declarations so `format: "iife"` can tree-shake them; esbuild adds the
	// wrapper, and the attribution comment goes first (ahead of the directive).
	const code = `"use strict";\n${body}\nif (!window.__VPK_REVIEW__ && !/^#presenter-/.test(location.hash)) bootVpkReview(${CONFIG_PLACEHOLDER});\n`;
	const minified = `${LEGAL}\n${esbuild.transformSync(code, { loader: "js", format: "iife", treeShaking: true, minify: true, charset: "ascii", target: "es2020" }).code.trim()}`;
	const parts = minified.split(CONFIG_PLACEHOLDER);
	if (parts.length !== 2) throw new Error(`review runtime: expected one config placeholder, found ${parts.length - 1}`);
	const script = parts[0] + serializeJsonIsland(reviewRuntimeConfig()) + parts[1];
	const forbidden = REVIEW_RUNTIME_FORBIDDEN.exec(script);
	if (forbidden) throw new Error(`review runtime contains HTML-structural text: ${JSON.stringify(script.slice(Math.max(0, forbidden.index - 40), forbidden.index + 40))}`);
	const sensitive = REVIEW_RUNTIME_SENSITIVE.exec(script);
	if (sensitive) throw new Error(`review runtime contains validator-sensitive text: ${JSON.stringify(script.slice(Math.max(0, sensitive.index - 40), sensitive.index + 40))}`);
	cachedScript = script;
	return script;
}

let cachedCss = null;

// esbuild-minified CSS, checked against the same validator-sensitive text as the script.
export function minifiedReviewCss() {
	if (cachedCss) return cachedCss;
	const esbuild = require("esbuild");
	const minify = css => {
		const out = esbuild.transformSync(css, { loader: "css", minify: true, charset: "ascii" }).code.trim();
		const sensitive = REVIEW_RUNTIME_SENSITIVE.exec(out) || REVIEW_RUNTIME_FORBIDDEN.exec(out);
		if (sensitive) throw new Error(`review CSS contains validator-sensitive text: ${JSON.stringify(out.slice(Math.max(0, sensitive.index - 40), sensitive.index + 40))}`);
		return out;
	};
	cachedCss = { document: minify(reviewDocumentCss()), shadow: minify(reviewShadowCss()), content: reviewContentCss() };
	return cachedCss;
}

// Inner texts of the two blocks the runtime owns (markers excluded).
export function buildReviewBlocks() {
	const css = minifiedReviewCss();
	return {
		review: `<style data-vpk-review-style>\n${css.document}\n</style>\n<style data-vpk-review-shadow media="not all">\n${css.shadow}\n</style>\n<script data-vpk-review-runtime data-vpk-review-version="1">\n${buildReviewRuntimeScript()}\n</script>`,
		reviewContent: `<style data-vpk-review-content>\n${css.content}\n</style>`,
	};
}

export function hasReviewRuntime(html) {
	return /<script\b[^>]*\bdata-vpk-review-runtime(?=[\s>=/])/i.test(String(html));
}

// Decision blocks in static markup (outside template and script contents).
export function hasDecisionBlocks(html) {
	const statics = String(html).replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, "");
	return /<fieldset\b[^>]*\bdata-vpk-decision\s*=/i.test(statics);
}

// Places blocks by the insertion rule (before the vpkh-enhance block, else the
// last body end tag; order revisions, review-data, review). blocks: { id: inner | null }.
export function insertReviewBlocks(html, blocks) {
	let out = String(html);
	for (const id of ["review-content", "revisions", "review-data", "review"]) {
		if (Object.prototype.hasOwnProperty.call(blocks || {}, id)) out = markupModule.setMarkedBlockText(out, id, blocks[id]);
	}
	return out;
}

// Adds (or refreshes) the runtime, and the review-content block exactly when
// the document has decision blocks. Idempotent.
export function injectReviewRuntime(html) {
	const blocks = buildReviewBlocks();
	return insertReviewBlocks(html, { "review-content": hasDecisionBlocks(html) ? blocks.reviewContent : null, review: blocks.review });
}

// Replace-only refresh for the pipeline step: rewrites `review` and
// `review-content` in place when their markers exist; never inserts.
export function refreshReviewRuntime(html) {
	const source = String(html);
	const markers = markupModule.reviewMarkers();
	const hasReview = source.includes(markers.review.start) && source.includes(markers.review.end);
	const hasContent = source.includes(markers.reviewContent.start) && source.includes(markers.reviewContent.end);
	if (!hasReview && !hasContent) return source;
	const blocks = buildReviewBlocks();
	let out = source;
	if (hasReview) out = markupModule.setMarkedBlockText(out, "review", blocks.review);
	if (hasContent) out = markupModule.setMarkedBlockText(out, "review-content", blocks.reviewContent);
	return out;
}

// --strip-review: removes the runtime and the embedded review (keeps ids,
// metas, the registry and review-content). With all, also the registry and
// review-content blocks (ids and metas are removed by the CLI).
export function removeReviewRuntime(html, options = {}) {
	const ids = options.all ? ["review", "review-data", "revisions", "review-content"] : ["review", "review-data"];
	let out = String(html);
	for (const id of ids) out = markupModule.setMarkedBlockText(out, id, null);
	return out;
}

// UTF-8 bytes of the injected review block (markers, style and script).
export function runtimeBytes() {
	const markers = markupModule.reviewMarkers();
	const block = `${markers.review.start}\n${buildReviewBlocks().review}\n${markers.review.end}`;
	return Buffer.byteLength(block, "utf8");
}

// The unminified serialized source size (reported, not asserted).
export function runtimeSourceBytes() {
	return Buffer.byteLength(serializeFunctions(serializedFunctionList()), "utf8");
}

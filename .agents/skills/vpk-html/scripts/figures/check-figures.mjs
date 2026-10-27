#!/usr/bin/env node
/*
 * figures/check-figures — figure-engine checks (ws4b spec section 4.9 and 6.6; integration K6, K11, R4).
 *
 *   node .agents/skills/vpk-html/scripts/figures/check-figures.mjs <file.html> [--strict] [--json]
 *   node .agents/skills/vpk-html/scripts/build.mjs --check-figures <file.html> [--strict] [--json]
 *
 * Hard checks (check-html pushes them through collectFigureEngineIssues):
 *   E1–E3  the <meta name="vpk-figure-engine"> record against the data-vpk-engine roots present
 *   H1–H8  anatomy hero structure: blocks, ids, grayscale grammar, print-safe rest, ws1 block, markers,
 *          stage roles and ARIA, live scripts that never own a loop
 * Advisory checks A1–A6 (fail only under --strict, and only A4 below the part bar or A5 above heroFailBytes):
 *   heroes per document, camera parity across engines, focal, parts per tier, budgets, flow/pulse motion.
 * Every rule is inert without data-vpk-engine, the meta, or anatomy markers, so existing documents and the
 * backend report generator are untouched. This module imports nothing from check-html and reads no file at
 * import time (R28): the thresholds are read lazily.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseCameraAttr, sameCamera } from "./camera.mjs";

const __filename = fileURLToPath(import.meta.url);

export const FIGURE_ENGINES = Object.freeze(["none", "iso-kit", "anatomy-hero", "both", "hairline", "anatomy-gl"]);
export const ROOT_ENGINES = Object.freeze(["iso-kit", "anatomy-hero", "hairline", "anatomy-gl"]);
export const FIGURE_ID = /^[a-z][a-z0-9-]{0,39}$/;
export const DEFAULT_FIGURE_THRESHOLDS = Object.freeze({
	maxHeroes: Infinity,
	heroWarnBytes: Infinity,
	heroFailBytes: Infinity,
	liveWarnBytes: Infinity,
	figuresWarnBytes: Infinity,
	parts: Object.freeze({ figure: Object.freeze([40, 80]), hero: Object.freeze([80, 150]) }),
	// The hairline engine bundles vendored figures whole, so its blocks are measured on their own (§ 10).
	hairline: Object.freeze({ runtimeWarnBytes: Infinity, pageWarnBytes: Infinity }),
});
const THRESHOLDS_URL = new URL("../../references/checks-thresholds.json", import.meta.url);
const STALE_RUNTIME = "run build.mjs --inject-runtime (or --build-hero) on this file";

const TAG = "(?:[^>\"']|\"[^\"]*\"|'[^']*')*";
const bytes = text => Buffer.byteLength(text ?? "", "utf8");
const kb = n => `${(n / 1024).toFixed(1)} KB`;
const count = (text, pattern) => (text.match(pattern) ?? []).length;

// Script and style bodies blanked (same length), so selectors and runtime strings never read as markup.
export function blankCode(html) {
	return html.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (_, open, __, body, close) => `${open}${" ".repeat(body.length)}${close}`);
}

function attr(tag, name) {
	const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
	return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

const hasAttr = (tag, name) => new RegExp(`\\s${name}(?=[\\s=>/])`, "i").test(tag);

// Every element start tag carrying data-vpk-engine, outside script and style text.
export function engineRoots(html) {
	const code = blankCode(html);
	const pattern = new RegExp(`<([a-z][\\w-]*)\\b${TAG}?\\sdata-vpk-engine\\s*=${TAG}>`, "gi");
	return [...code.matchAll(pattern)].map(match => ({ tag: match[0], name: match[1].toLowerCase(), index: match.index, engine: attr(match[0], "data-vpk-engine"), id: attr(match[0], "data-vpk-figure") }));
}

export function figureEngineMetas(html) {
	const code = blankCode(html);
	return [...code.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]).filter(tag => attr(tag, "name") === "vpk-figure-engine").map(tag => attr(tag, "content"));
}

// The outer HTML of the element whose start tag is at `index` (balanced on its own tag name).
function elementAt(html, code, index, name) {
	const pattern = new RegExp(`<(/?)${name}\\b${TAG}>`, "gi");
	pattern.lastIndex = index;
	let depth = 0;
	for (let match = pattern.exec(code); match; match = pattern.exec(code)) {
		depth += match[1] ? -1 : 1;
		if (depth === 0) return html.slice(index, match.index + match[0].length);
	}
	return html.slice(index);
}

const START_MARKER = /^<!-- vpk-anatomy-hero:start\b([^>]*?)-->$/;
const END_MARKER = /^<!-- vpk-anatomy-hero:end\b([^>]*?)-->$/;
const snippet = text => (text.length > 72 ? `${text.slice(0, 66)} … -->` : text);

// H6 marker scan (build-hero reads regions through it too): every <!-- vpk-anatomy-hero… --> comment outside
// script and style text, paired in document order. A start without its end, an end without its start, a start
// inside an open region, a misspelled marker, or a pair without one shared id is an issue, so a broken region
// never reads as "no hero". → { pairs: [{ id, src, endId, text, start, end }], issues: [{ id, message }] }
export function anatomyMarkers(html) {
	const pairs = [];
	const issues = [];
	const issue = (id, message) => issues.push({ id: id ?? "?", message: `H6 ${message}` });
	let open = null;
	for (const match of blankCode(html).matchAll(/<!--[\s\S]*?-->/g)) {
		const text = match[0];
		if (!/^<!--\s*vpk-anatomy-hero/.test(text)) continue;
		const start = text.match(START_MARKER);
		const end = start ? null : text.match(END_MARKER);
		const id = attr(` ${(start ?? end)?.[1] ?? text.slice(4, -3)}`, "id");
		if (!start && !end) issue(id, `unknown marker ${snippet(text)}: write <!-- vpk-anatomy-hero:start id="…" src="…" --> or <!-- vpk-anatomy-hero:end id="…" -->`);
		else if (start && open) issue(id, `start marker inside the unclosed region ${open.id ?? "?"}: regions do not nest`);
		else if (start) open = { id, src: attr(` ${start[1]}`, "src"), start: match.index };
		else if (!open) issue(id, "end marker without a start marker");
		else {
			if (!open.id || open.id !== id) issue(open.id, `start and end markers name different ids (${open.id} / ${id})`);
			const endIndex = match.index + text.length;
			pairs.push({ id: open.id, src: open.src, endId: id, text: html.slice(open.start, endIndex), start: open.start, end: endIndex });
			open = null;
		}
	}
	if (open) issue(open.id, `start marker without a matching <!-- vpk-anatomy-hero:end id="${open.id ?? "…"}" -->`);
	return { pairs, issues };
}

// Anatomy regions by id: marker text, the root element, the live script and the island.
export function anatomyRegions(html) {
	const code = blankCode(html);
	const markers = anatomyMarkers(html).pairs;
	const roots = engineRoots(html).filter(root => root.engine === "anatomy-hero").map(root => {
		const element = elementAt(html, code, root.index, root.name);
		const region = markers.find(marker => root.index > marker.start && root.index < marker.end) ?? null;
		const scope = region ? region.text : element;
		const scripts = [...scope.matchAll(/<script\b[^>]*\sdata-vpk-anatomy-live\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => ({ id: match[1], text: match[0], body: match[2] }));
		const islands = [...element.matchAll(/<script\b[^>]*\sdata-vpk-anatomy-data\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => ({ text: match[0], body: match[1] }));
		return { ...root, element, region, scripts, islands };
	});
	return { markers, roots };
}

/* ============ E1–E3: the document-level engine record ============ */

function collectEngineRecordIssues(html) {
	const failures = [];
	const warnings = [];
	const roots = engineRoots(html);
	const metas = figureEngineMetas(html);
	if (!roots.length && !metas.length) return { failures, warnings };
	const kinds = new Set(roots.map(root => root.engine));
	for (const root of roots) {
		if (!ROOT_ENGINES.includes(root.engine)) failures.push(`figure engine E2: unknown data-vpk-engine="${root.engine}" (use ${ROOT_ENGINES.join(" or ")})`);
	}
	if (metas.length > 1) failures.push(`figure engine E2: ${metas.length} <meta name="vpk-figure-engine"> tags; keep one`);
	const meta = metas[0];
	if (meta === undefined) {
		failures.push(`figure engine E1: ${roots.length} figure-engine root${roots.length === 1 ? "" : "s"} but no <meta name="vpk-figure-engine" content="${kinds.size > 1 && !kinds.has("hairline") ? "both" : [...kinds][0]}"> in <head>`);
		return { failures, warnings };
	}
	if (!FIGURE_ENGINES.includes(meta)) {
		failures.push(`figure engine E2: <meta name="vpk-figure-engine" content="${meta}"> is not one of ${FIGURE_ENGINES.join(", ")}`);
		return { failures, warnings };
	}
	for (const kind of kinds) {
		if (!ROOT_ENGINES.includes(kind)) continue;
		// "both" is iso-kit plus anatomy-hero; a hairline root needs meta "hairline" (figure-engines.md § 10).
		const covered = meta === kind || (meta === "both" && kind !== "hairline" && kind !== "anatomy-gl");
		if (!covered) failures.push(`figure engine E2: meta "${meta}" does not cover the ${kind} root${roots.filter(root => root.engine === kind).length === 1 ? "" : "s"}`);
	}
	const known = [...kinds].filter(kind => kind === "iso-kit" || kind === "anatomy-hero");
	if (meta === "both" && known.length < 2) warnings.push(`figure engine E3: meta "both" but the document has ${known.length ? `only ${known[0]} roots` : "no iso-kit and anatomy-hero roots"}`);
	if ((meta === "iso-kit" || meta === "anatomy-hero" || meta === "hairline" || meta === "anatomy-gl") && !kinds.has(meta)) warnings.push(`figure engine E3: meta "${meta}" but no ${meta} root`);
	return { failures, warnings };
}

/* ============ H1–H8: anatomy hero structure ============ */

// A red, green or blue `data-tone`/`data-mark`, written with double, single or no quotes (HTML accepts all three).
// The hero builder's markup sanitizer reads the same two patterns, so build and check-html agree.
export const RED_GREEN_BLUE = /data-(?:tone|mark)\s*=\s*(?:"(?:red|green|blue)"|'(?:red|green|blue)'|(?:red|green|blue)(?=[\s/>]|$))/i;
export const styleAttributeValues = markup => [...markup.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)].map(match => match[1] ?? match[2] ?? match[3]);
export const STYLE_FILTER = /\bfilter\s*:/i;
// Print forces `opacity: 1` and `transform: none` (styles.css), so neither may shape the rest pose from a style
// attribute either; `fill-opacity`, `stroke-opacity`, `transform-origin` and custom properties are fine.
export const STYLE_PRINT_RESET = /(?<![\w-])(?:opacity|transform)\s*:/i;

function markupIssues(markup) {
	const issues = [];
	if (/iso-halo/.test(markup)) issues.push("H3 halo (iso-halo)");
	if (RED_GREEN_BLUE.test(markup)) issues.push("H3 red, green or blue tone");
	for (const [pattern, label] of [[/<canvas\b/i, "<canvas>"], [/<linearGradient\b/i, "<linearGradient>"], [/<radialGradient\b/i, "<radialGradient>"], [/<filter\b/i, "<filter>"]]) {
		if (pattern.test(markup)) issues.push(`H3 ${label}`);
	}
	if (/\sfilter\s*=/i.test(markup)) issues.push("H3 filter= attribute");
	if (styleAttributeValues(markup).some(value => STYLE_FILTER.test(value))) issues.push("H3 filter: inside a style attribute");
	for (const match of markup.matchAll(/\stransform\s*=/gi)) {
		const tag = markup.slice(markup.lastIndexOf("<", match.index), markup.indexOf(">", match.index));
		if (!/^<text\b/i.test(tag) || attr(tag, "class") !== "iso-face-text") {
			issues.push("H4 transform= at rest outside .iso-face-text (print resets transforms)");
			break;
		}
	}
	if (/\sopacity\s*=/i.test(markup)) issues.push("H4 opacity= attribute (print resets opacity)");
	if (styleAttributeValues(markup).some(value => STYLE_PRINT_RESET.test(value))) issues.push("H4 opacity: or transform: inside a style attribute (print resets both)");
	return issues;
}

function stageIssues(element) {
	const stages = [...element.matchAll(new RegExp(`<[a-z][\\w-]*\\b${TAG}?\\sclass\\s*=\\s*["'][^"']*\\biso-stage\\b[^"']*["']${TAG}>`, "gi"))].map(match => match[0]);
	if (stages.length !== 1) return [`H7 ${stages.length} .iso-stage elements (exactly one)`];
	const tag = stages[0];
	const issues = [];
	const role = attr(tag, "role");
	if (!["slider", "group", "img"].includes(role)) issues.push(`H7 stage role "${role}" (slider, group or img)`);
	if (!(attr(tag, "aria-label") ?? "").trim()) issues.push("H7 stage without an aria-label");
	const focusable = attr(tag, "tabindex") === "0";
	if ((role === "slider" || role === "group") !== focusable) issues.push(`H7 tabindex="0" ${focusable ? "on a non-interactive" : "missing on an interactive"} stage`);
	if (role === "slider") {
		for (const name of ["aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext"]) if (attr(tag, name) === null) issues.push(`H7 slider without ${name}`);
	}
	return issues;
}

export function collectAnatomyHeroIssues(html) {
	if (!/anatomy-hero|data-vpk-anatomy|vpk-anatomy-/.test(html)) return [];
	const failures = [];
	const { markers, roots } = anatomyRegions(html);
	const code = blankCode(html);
	const headEnd = code.search(/<\/head\s*>/i);
	const cssTags = [...code.matchAll(/<style\b[^>]*\sdata-vpk-anatomy-css\b[^>]*>/gi)];
	const runtimeTags = count(code, /<script\b[^>]*\sdata-vpk-anatomy-runtime\b[^>]*>/gi);
	if (roots.length) {
		if (cssTags.length !== 1 || headEnd < 0 || cssTags[0].index > headEnd) failures.push(`anatomy hero H1: expected one <style data-vpk-anatomy-css> inside <head>, found ${cssTags.length}${cssTags.length === 1 ? " outside <head>" : ""}; ${STALE_RUNTIME}`);
		if (runtimeTags !== 1) failures.push(`anatomy hero H1: expected one <script data-vpk-anatomy-runtime>, found ${runtimeTags}; ${STALE_RUNTIME}`);
	} else if (cssTags.length || runtimeTags) {
		failures.push(`anatomy hero H1: stale anatomy runtime without a hero; ${STALE_RUNTIME}`);
	}

	const allIds = engineRoots(html).map(root => root.id);
	const liveIds = [...code.matchAll(/<script\b[^>]*\sdata-vpk-anatomy-live\s*=\s*["']([^"']*)["']/gi)].map(match => match[1]);
	for (const id of new Set(liveIds)) {
		if (!roots.some(root => root.id === id)) failures.push(`anatomy hero ${id}: H5 live script without a matching root`);
		if (liveIds.filter(other => other === id).length > 1) failures.push(`anatomy hero ${id}: H5 more than one live script`);
	}
	for (const root of roots) {
		const id = root.id ?? "?";
		const say = message => failures.push(`anatomy hero ${id}: ${message}`);
		if (!FIGURE_ID.test(root.id ?? "")) say(`H2 data-vpk-figure must match ${FIGURE_ID}`);
		if (allIds.filter(other => other === root.id).length > 1) say("H2 data-vpk-figure is not unique across figure engines");
		if (root.islands.length !== 1) say(`H2 ${root.islands.length} data-vpk-anatomy-data islands (exactly one)`);
		else {
			try {
				const value = JSON.parse(root.islands[0].body);
				if (!value || typeof value.P !== "object" || value.P === null || Array.isArray(value.P)) say("H2 the data island has no object P");
			} catch {
				say("H2 the data island is not valid JSON");
			}
		}
		const markup = root.region ? blankCode(root.region.text) : blankCode(root.element);
		for (const issue of markupIssues(markup)) say(issue);
		if (!hasAttr(root.tag, "data-vpk-block")) say("H5 root without data-vpk-block (one atomic ws1 block)");
		if (!hasAttr(root.tag, "data-vpkh-no-lightbox")) say("H5 root without data-vpkh-no-lightbox");
		const figure = root.element.match(/<figure\b[^>]*\bclass\s*=\s*["'][^"']*\biso-figure\b[^>]*>/i)?.[0];
		if (!figure || !hasAttr(figure, "data-vpk-review-ignore")) say("H5 inner <figure class=\"iso-figure\"> without data-vpk-review-ignore");
		if (!root.region) say("H6 anatomy figure without markers: rebuild with build.mjs --build-hero");
		else {
			if (root.region.id !== root.id) say(`H6 markers name ${root.region.id}/${root.region.endId}, not ${id}`);
			if (root.region.src !== null && (/^\//.test(root.region.src) || /^[a-z][a-z0-9+.-]*:/i.test(root.region.src))) say(`H6 src "${root.region.src}" must be relative to the artifact folder`);
		}
		for (const issue of stageIssues(root.element)) say(issue);
		for (const script of root.scripts) {
			for (const [pattern, label] of [[/requestAnimationFrame/, "requestAnimationFrame"], [/IntersectionObserver/, "IntersectionObserver"], [/setInterval/, "setInterval"], [/document\.addEventListener/, "document.addEventListener"]]) {
				if (pattern.test(script.body)) say(`H8 live script uses ${label}; motion goes through ctx and the shared loop`);
			}
		}
	}
	for (const marker of markers) {
		if (!roots.some(root => root.region === marker)) failures.push(`anatomy hero ${marker.id ?? "?"}: H6 markers without a hero root`);
	}
	for (const marker of anatomyMarkers(html).issues) failures.push(`anatomy hero ${marker.id}: ${marker.message}`);
	return failures;
}

// L1–L2: hairline engine structure (figure-engines.md § 10). A hairline root needs the one stylesheet in <head>
// and the one runtime block; blocks without a root are stale.
const HAIRLINE_RUNTIME = /<script\b[^>]*\sdata-vpk-hairline-runtime\b[^>]*>/gi;
export function collectHairlineIssues(html) {
	if (!/hairline/.test(html)) return [];
	const failures = [];
	const code = blankCode(html);
	const roots = engineRoots(html).filter(root => root.engine === "hairline");
	const headEnd = code.search(/<\/head\s*>/i);
	const cssTags = [...code.matchAll(/<style\b[^>]*\sdata-vpk-hairline-css\b[^>]*>/gi)];
	const runtimes = count(code, HAIRLINE_RUNTIME);
	if (roots.length) {
		if (cssTags.length !== 1 || headEnd < 0 || cssTags[0].index > headEnd) failures.push(`hairline L1: expected one <style data-vpk-hairline-css> inside <head>, found ${cssTags.length}`);
		if (runtimes !== 1) failures.push(`hairline L1: expected one <script data-vpk-hairline-runtime>, found ${runtimes}`);
	} else if (cssTags.length || runtimes) failures.push("hairline L1: stale hairline stylesheet or runtime without a hairline root");
	for (const root of roots) {
		const element = elementAt(html, code, root.index, root.name);
		const host = element.match(new RegExp(`<div\\b${TAG}?\\sdata-vpk-hairline\\s*=${TAG}>`, "i"))?.[0];
		if (!host) failures.push(`hairline ${root.id ?? "?"}: L2 plate without a data-vpk-hairline host`);
		else if (!(attr(host, "aria-label") ?? "").trim()) failures.push(`hairline ${root.id ?? "?"}: L2 host without an aria-label`);
		if (!/\sdata-vpk-hairline-read\b/.test(element)) failures.push(`hairline ${root.id ?? "?"}: L2 plate without a data-vpk-hairline-read readout`);
		if (!hasAttr(root.tag, "data-vpkh-no-lightbox")) failures.push(`hairline ${root.id ?? "?"}: L2 root without data-vpkh-no-lightbox`);
	}
	return failures;
}

// The check-html collector (K6 row 5): engine record plus anatomy and hairline structure.
export function collectFigureEngineIssues(html) {
	if (!/data-vpk-engine|vpk-figure-engine|anatomy-hero|data-vpk-anatomy|vpk-anatomy-|data-vpk-hairline/.test(html)) return { failures: [], warnings: [] };
	const record = collectEngineRecordIssues(html);
	return { failures: [...record.failures, ...collectAnatomyHeroIssues(html), ...collectHairlineIssues(html)], warnings: record.warnings };
}

/* ============ A1–A6: advisories and budgets ============ */

let cachedThresholds = null;

export function loadFigureThresholds() {
	if (cachedThresholds) return cachedThresholds;
	let figures = {};
	try {
		figures = JSON.parse(fs.readFileSync(THRESHOLDS_URL, "utf8")).figures ?? {};
	} catch {
		figures = {};
	}
	// A threshold set to null in the JSON is switched off (Infinity), so its check never fires.
	const off = block => Object.fromEntries(Object.entries(block).map(([key, value]) => [key, value === null ? Infinity : value]));
	cachedThresholds = { ...DEFAULT_FIGURE_THRESHOLDS, ...off(figures), parts: { ...DEFAULT_FIGURE_THRESHOLDS.parts, ...(figures.parts ?? {}) }, hairline: { ...DEFAULT_FIGURE_THRESHOLDS.hairline, ...off(figures.hairline ?? {}) } };
	return cachedThresholds;
}

function isoFigureUnits(html) {
	const code = blankCode(html);
	const regions = [...html.matchAll(/<!-- vpk-figure:begin\b([^>]*?)-->[\s\S]*?<!-- vpk-figure:end\b[^>]*-->/g)].map(match => ({ id: attr(` ${match[1]}`, "id"), start: match.index, text: match[0] }));
	return engineRoots(html).filter(root => root.engine === "iso-kit").map(root => {
		const region = regions.find(candidate => root.index > candidate.start && root.index < candidate.start + candidate.text.length);
		return { id: root.id, bytes: bytes(region ? region.text : elementAt(html, code, root.index, root.name)) };
	});
}

export function measureFigureBudget(html) {
	const { roots } = anatomyRegions(html);
	const heroes = roots.map(root => ({
		id: root.id,
		tier: attr(root.tag, "data-vpk-anatomy-tier") ?? "figure",
		region: bytes(root.region ? root.region.text : root.element),
		script: root.scripts.reduce((sum, script) => sum + bytes(script.text), 0),
		data: root.islands.reduce((sum, island) => sum + bytes(island.text), 0),
		parts: Number(attr(root.tag, "data-vpk-anatomy-parts") ?? 0),
	}));
	const isoFigures = isoFigureUnits(html);
	const figuresTotal = heroes.reduce((sum, hero) => sum + hero.region, 0) + isoFigures.reduce((sum, figure) => sum + figure.bytes, 0);
	return { heroes, isoFigures, figuresTotal, documentBytes: bytes(html) };
}

// [{ id, strict, message }]: strict advisories fail under --strict.
export function collectFigureAdvisories(html, thresholds = loadFigureThresholds()) {
	const advisories = [];
	const add = (id, message, strict = false) => advisories.push({ id, strict, message });
	const { roots } = anatomyRegions(html);
	if (!roots.length && !engineRoots(html).length) return advisories;
	const budget = measureFigureBudget(html);
	if (roots.length > thresholds.maxHeroes) add("A1", `${roots.length} anatomy heroes; a document carries at most ${thresholds.maxHeroes}`);
	const isoRoots = engineRoots(html).filter(root => root.engine === "iso-kit");
	for (const root of roots) {
		const id = root.id ?? "?";
		const heroCamera = parseCameraAttr(attr(root.tag, "data-vpk-camera") ?? "");
		if (isoRoots.length) {
			for (const iso of isoRoots) {
				const isoCamera = parseCameraAttr(attr(iso.tag, "data-vpk-camera") ?? "");
				if (!sameCamera(heroCamera, isoCamera)) add("A2", `camera parity: iso figure ${iso.id ?? "?"} (${attr(iso.tag, "data-vpk-camera") ?? "no data-vpk-camera"}) differs from hero ${id} (${attr(root.tag, "data-vpk-camera") ?? "no data-vpk-camera"})`);
			}
		}
		const markup = blankCode(root.region ? root.region.text : root.element);
		if (!/data-tone\s*=\s*["']lit["']|\sdata-lit(?=[\s=>/])/.test(markup)) add("A3", `hero ${id} has no lit accent (data-tone="lit" or data-lit)`);
		const focal = new Set([...markup.matchAll(/\sdata-focal\s*=\s*["']([^"']+)["']/g)].map(match => match[1]));
		if (focal.size !== 1) add("A3", `hero ${id} has ${focal.size} distinct data-focal names (exactly one)`);
		const hero = budget.heroes.find(item => item.id === root.id);
		const [low] = thresholds.parts[hero.tier] ?? thresholds.parts.figure;
		if (hero.parts < low) add("A4", `hero ${id}: ${hero.parts} parts is below the ${low}-part bar for the ${hero.tier} tier`, true);
		if (hero.region > thresholds.heroFailBytes) add("A5", `hero ${id}: region ${kb(hero.region)} exceeds the ${kb(thresholds.heroFailBytes)} fail threshold`, true);
		else if (hero.region > thresholds.heroWarnBytes) add("A5", `hero ${id}: region ${kb(hero.region)} exceeds ${kb(thresholds.heroWarnBytes)}`);
		if (hero.script + hero.data > thresholds.liveWarnBytes) add("A5", `hero ${id}: script and island ${kb(hero.script + hero.data)} exceed ${kb(thresholds.liveWarnBytes)}`);
		if (/\sdata-(?:flow|pulse)(?=[\s=>/])/.test(markup)) add("A6", `hero ${id} uses data-flow or data-pulse: the advisory motion-budget gate will warn on its 1,600 ms animations`);
	}
	if (budget.figuresTotal > thresholds.figuresWarnBytes) add("A5", `all figure regions ${kb(budget.figuresTotal)} exceed ${kb(thresholds.figuresWarnBytes)}`);
	if (engineRoots(html).some(root => root.engine === "hairline")) {
		const runtime = html.match(/<!-- vpk-hairline:start -->[\s\S]*?<!-- vpk-hairline:end -->/)?.[0] ?? "";
		if (bytes(runtime) > thresholds.hairline.runtimeWarnBytes) add("A7", `hairline runtime block ${kb(bytes(runtime))} exceeds ${kb(thresholds.hairline.runtimeWarnBytes)}`);
		if (budget.documentBytes > thresholds.hairline.pageWarnBytes) add("A7", `hairline page ${kb(budget.documentBytes)} exceeds ${kb(thresholds.hairline.pageWarnBytes)}`);
	}
	return advisories;
}

/* ============ CLI ============ */

export async function checkFiguresFile(filePath, { strict = false } = {}) {
	const html = fs.readFileSync(filePath, "utf8");
	const { failures, warnings } = collectFigureEngineIssues(html);
	const advisories = collectFigureAdvisories(html);
	const budget = measureFigureBudget(html);
	const weight = [];
	const strictFailures = strict ? advisories.filter(advisory => advisory.strict) : [];
	return { ok: failures.length === 0 && strictFailures.length === 0, file: filePath, failures, warnings, advisories, budget, weight };
}

export function formatFigureReport(result, { strict = false } = {}) {
	const lines = [`check-figures ${path.relative(process.cwd(), result.file)}`];
	lines.push(result.failures.length ? `✗ structure: ${result.failures.length} failure${result.failures.length === 1 ? "" : "s"}` : "✓ structure (E1–E3, H1–H8): clean");
	for (const failure of result.failures) lines.push(`  - ${failure}`);
	for (const warning of result.warnings) lines.push(`  warn ${warning}`);
	for (const hero of result.budget.heroes) lines.push(`hero ${hero.id} · ${hero.tier} · ${hero.parts} parts · region ${kb(hero.region)} · script ${kb(hero.script)} · island ${kb(hero.data)}`);
	for (const figure of result.budget.isoFigures) lines.push(`iso figure ${figure.id} · ${kb(figure.bytes)}`);
	lines.push(`figures ${kb(result.budget.figuresTotal)} of a ${kb(result.budget.documentBytes)} document`);
	for (const warning of result.weight) lines.push(`  ⚠ ${warning}`);
	if (!result.advisories.length) lines.push("✓ advisories (A1–A6): clean");
	for (const advisory of result.advisories) lines.push(`${strict && advisory.strict ? "✗" : "⚠"} ${advisory.id} ${advisory.message}`);
	return lines.join("\n");
}

export async function runCheckFigures({ file, strict = false, json = false } = {}) {
	if (!file) {
		console.error("Usage: check-figures.mjs <file.html> [--strict] [--json]");
		return 2;
	}
	const abs = path.resolve(file);
	if (!fs.existsSync(abs)) {
		console.error(`File not found: ${abs}`);
		return 2;
	}
	const result = await checkFiguresFile(abs, { strict });
	if (json) console.log(JSON.stringify(result, null, 2));
	else console.log(formatFigureReport(result, { strict }));
	return result.ok ? 0 : 1;
}

async function main(argv) {
	const args = { file: null, strict: false, json: false };
	for (const arg of argv) {
		if (arg === "--strict") args.strict = true;
		else if (arg === "--json") args.json = true;
		else if (!arg.startsWith("--") && !args.file) args.file = arg;
		else {
			console.error(`Unknown argument: ${arg}`);
			return 2;
		}
	}
	return runCheckFigures(args);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	process.exitCode = await main(process.argv.slice(2));
}

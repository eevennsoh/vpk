#!/usr/bin/env node
/*
 * runtime/smil-starter — the SMIL motion contract (references/svg-style.md § SMIL motion):
 * the scanner (skips external-asset SVGs, <script>, <style>, <template>, comments), the
 * autoplay normaliser, the one canonical `vpk-smil-starter` block with window.vpkSmil,
 * collectSmilMotionIssues() (re-exported by check-html.mjs), verifySmilMotion() for --verify,
 * and the sweep: node .agents/skills/vpk-html/scripts/runtime/smil-starter.mjs --sweep [--strict] [file…]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineMarkedRuntime } from "./define.mjs";

export const SMIL_TAG = /<(animate|animateTransform|animateMotion|set)(?=[\s/>])([^>]*?)(\/?)>/g;

// One left-to-right scan, so a comment that mentions <script> cannot open a script range.
const MASKED = /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<template\b[\s\S]*?<\/template>|<svg\b(?=[^>]*\bdata-vpk-external-asset\b)[\s\S]*?<\/svg>/gi;
const OFFSET = /^\s*-?\d*\.?\d+(ms|s)?\s*$/;
const OFFSET_VALUE = /^-?\d*\.?\d+(ms|s)?$/;
const SYNCBASE = /^\s*[A-Za-z_][\w.-]*\.(begin|end)(\s*[+-]\s*\d*\.?\d+(ms|s)?)?\s*$/;
const TRANSFORM_FUNCTION = /^(translate|scale|rotate|skewX|skewY)\(([^()]*)\)$/;
const STARTER_SCRIPT = /<script\b[^>]*\bdata-vpk-smil-starter\b[^>]*>([\s\S]*?)<\/script>/gi;
const MAX_ISSUES = 12;

export function smilMaskedRanges(html) {
	return [...html.matchAll(MASKED)].map(match => [match.index, match.index + match[0].length]);
}

// → [{ index, tag, name, attrs, selfClosing }] for every SMIL element outside masked ranges.
export function listSmilElements(html) {
	const ranges = smilMaskedRanges(html);
	const elements = [];
	let cursor = 0;
	for (const match of html.matchAll(SMIL_TAG)) {
		while (cursor < ranges.length && ranges[cursor][1] <= match.index) cursor += 1;
		if (cursor < ranges.length && ranges[cursor][0] <= match.index) continue;
		elements.push({ index: match.index, tag: match[0], name: match[1], attrs: match[2], selfClosing: match[3] === "/" });
	}
	return elements;
}

const attributePattern = name => new RegExp(`(\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
const withoutAttribute = (attrs, name) => attrs.replace(attributePattern(name), "");

// The value of one attribute in a tag's attribute text, or null when absent.
export function readSmilAttribute(attrs, name) {
	const match = attributePattern(name).exec(attrs);
	return match ? (match[2] ?? match[3]) : null;
}

// begin="indefinite", or a ;-list made only of syncbase values (id.begin|id.end ± offset).
export function isGatedBegin(attrs) {
	const begin = readSmilAttribute(attrs, "begin");
	if (begin === null) return false;
	if (begin.trim() === "indefinite") return true;
	return begin.split(";").every(part => SYNCBASE.test(part));
}

function syncbaseIds(begin) {
	return begin.split(";").map(part => part.trim().replace(/\.(?:begin|end)(?:\s*[+-][\s\S]*)?$/, ""));
}

function animateTransformAttrs(attrs) {
	if (readSmilAttribute(attrs, "type") !== null || readSmilAttribute(attrs, "by") !== null) return null;
	const values = readSmilAttribute(attrs, "values");
	const from = readSmilAttribute(attrs, "from");
	const to = readSmilAttribute(attrs, "to");
	const items = values !== null ? values.split(";").map(item => item.trim()).filter(Boolean) : (from !== null && to !== null ? [from.trim(), to.trim()] : []);
	if (items.length === 0) return null;
	const parsed = items.map(item => TRANSFORM_FUNCTION.exec(item));
	if (parsed.some(match => !match) || new Set(parsed.map(match => match[1])).size !== 1) return null;
	const type = parsed[0][1];
	const args = parsed.map(match => match[2].replace(/,/g, " ").trim().replace(/\s+/g, " ")).join("; ");
	let out = withoutAttribute(withoutAttribute(withoutAttribute(attrs, "values"), "from"), "to");
	out = out.replace(attributePattern("attributeName"), (token, space) => `${space}attributeName="transform" type="${type}" values="${args}"`);
	return out;
}

function gateBegin(attrs) {
	const begin = readSmilAttribute(attrs, "begin");
	const hasOffset = readSmilAttribute(attrs, "data-vpk-begin") !== null;
	if (begin === null) {
		const added = hasOffset ? ` begin="indefinite"` : ` begin="indefinite" data-vpk-begin="0s"`;
		return attrs.replace(/\s*$/, trailing => `${added}${trailing}`);
	}
	if (!OFFSET.test(begin)) return attrs;
	return attrs.replace(attributePattern("begin"), (token, space) => `${space}begin="indefinite"${hasOffset ? "" : ` data-vpk-begin="${begin.trim()}"`}`);
}

// Pure and idempotent; rewrites only unmasked SMIL tags.
export function normalizeSmilBegin(html) {
	const elements = listSmilElements(html);
	if (elements.length === 0) return html;
	let out = "";
	let cursor = 0;
	for (const element of elements) {
		if (element.index < cursor) continue;
		let { name, attrs } = element;
		let end = element.index + element.tag.length;
		let closing = "";
		if (name === "animate" && readSmilAttribute(attrs, "attributeName")?.trim() === "transform") {
			const converted = animateTransformAttrs(attrs);
			const closeMatch = element.selfClosing ? null : /^\s*<\/animate>/.exec(html.slice(end));
			if (converted !== null && (element.selfClosing || closeMatch)) {
				name = "animateTransform";
				attrs = converted;
				if (closeMatch) {
					closing = `${closeMatch[0].slice(0, -"</animate>".length)}</animateTransform>`;
					end += closeMatch[0].length;
				}
			}
		}
		attrs = gateBegin(attrs);
		out += `${html.slice(cursor, element.index)}<${name}${attrs}${element.selfClosing ? "/" : ""}>${closing}`;
		cursor = end;
	}
	return out + html.slice(cursor);
}

// The canonical starter source (ws0 spec §5.4). One per page; the first starter wins.
export function buildSmilStarterScript() {
	return String.raw`(() => {
	if (window.vpkSmil) return;
	const SELECTOR = 'animate[begin="indefinite"], animateTransform[begin="indefinite"], animateMotion[begin="indefinite"], set[begin="indefinite"]';
	const EXTERNAL = "svg[data-vpk-external-asset]";
	const media = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
	const calm = () => !media || media.matches;
	const state = new WeakMap();
	const seconds = value => {
		const match = /^(-?\d*\.?\d+)(ms|s)?$/.exec(String(value ?? "").trim());
		return match ? Number(match[1]) / (match[2] === "ms" ? 1000 : 1) : null;
	};
	const stagger = svg => {
		const raw = svg.getAttribute("data-vpk-smil-stagger");
		const ms = raw === null || raw.trim() === "" ? NaN : Number(raw);
		return (Number.isFinite(ms) && ms >= 0 ? ms : 70) / 1000;
	};
	const animations = svg => [...svg.querySelectorAll(SELECTOR)].filter(animation => !animation.closest(EXTERNAL));
	const offset = (svg, animation, index) => seconds(animation.getAttribute("data-vpk-begin")) ?? index * stagger(svg);
	const figures = [...document.querySelectorAll("svg")].filter(svg => !svg.parentElement?.closest("svg") && !svg.matches(EXTERNAL) && animations(svg).length > 0);
	const schedule = svg => animations(svg).forEach((animation, index) => {
		try { animation.beginElementAt(offset(svg, animation, index)); } catch { /* not an SVGAnimationElement */ }
	});
	const duration = svg => Math.max(0, ...animations(svg).map((animation, index) => offset(svg, animation, index) + (seconds(animation.getAttribute("dur")) ?? 0) * (Number(animation.getAttribute("repeatCount")) || 1)));
	const begin = svg => {
		if (!state.has(svg)) {
			state.set(svg, { t0: svg.getCurrentTime(), mode: "playing" });
			schedule(svg);
		}
		return state.get(svg);
	};
	const arm = svg => {
		svg.pauseAnimations();
		svg.setCurrentTime(0);
		state.set(svg, { t0: 0, mode: "armed" });
		schedule(svg);
	};
	const start = svg => {
		if (calm()) return;
		const entry = state.get(svg);
		if (!entry) begin(svg);
		else if (entry.mode === "armed") { entry.mode = "playing"; svg.unpauseAnimations(); }
	};
	const land = svg => {
		const entry = state.get(svg);
		if (!entry) return;
		svg.setCurrentTime(1e6);
		svg.unpauseAnimations();
		entry.mode = "landed";
	};
	const hold = (t, svg) => {
		const entry = begin(svg);
		svg.pauseAnimations();
		svg.setCurrentTime(entry.t0 + Math.max(0, Number(t) || 0));
		entry.mode = "held";
	};
	const each = (fn, svg) => (svg ? [svg] : figures).forEach(fn);
	window.vpkSmil = {
		version: 1,
		figures: () => figures.slice(),
		start: svg => each(start, svg),
		land: svg => each(land, svg),
		hold: (t, svg) => each(target => hold(t, target), svg),
		duration: svg => Math.max(0, ...(svg ? [svg] : figures).map(duration)),
	};
	window.addEventListener("beforeprint", () => each(land));
	if (media) {
		const onChange = () => { if (media.matches) each(land); };
		if (media.addEventListener) media.addEventListener("change", onChange);
		else if (media.addListener) media.addListener(onChange);
	}
	if (calm()) return;
	figures.filter(svg => svg.hasAttribute("data-vpk-smil-arm")).forEach(arm);
	if (!("IntersectionObserver" in window)) { each(start); return; }
	const observer = new IntersectionObserver(entries => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			observer.unobserve(entry.target);
			start(entry.target);
		}
	}, { rootMargin: "0px 0px -15% 0px" });
	figures.forEach(svg => observer.observe(svg));
})();`;
}

export const SMIL_STARTER_START = "<!-- vpk-smil-starter:start -->";
export const SMIL_STARTER_END = "<!-- vpk-smil-starter:end -->";

export function buildSmilStarterBlock() {
	return [SMIL_STARTER_START, "<script data-vpk-smil-starter>", buildSmilStarterScript(), "</script>", SMIL_STARTER_END].join("\n");
}

export const smilStarterStep = defineMarkedRuntime({
	id: "smil-starter",
	kinds: ["template", "demo", "index", "diagram", "illustration", "landing", "artifact"],
	normalize: normalizeSmilBegin,
	appliesTo: html => listSmilElements(html).some(element => isGatedBegin(element.attrs)),
	legacy: /\n?<script\b[^>]*\bdata-vpk-smil-starter\b[^>]*>[\s\S]*?<\/script>/gi,
	build: buildSmilStarterBlock,
	budgetBytes: 4096,
});

const shortTag = tag => (tag.length > 120 ? `${tag.slice(0, 119)}…` : tag);
const isStaggerValue = raw => raw.trim() !== "" && Number.isFinite(Number(raw)) && Number(raw) >= 0;

// Timing and gating rules 1–7 (svg-style.md § SMIL motion). At most 12 messages.
export function collectSmilMotionIssues(source) {
	const elements = listSmilElements(source);
	const issues = [];
	const push = message => { if (issues.length < MAX_ISSUES) issues.push(message); };
	const ids = new Set(elements.map(element => readSmilAttribute(element.attrs, "id")).filter(Boolean));
	let gated = false;
	for (const element of elements) {
		const tag = shortTag(element.tag);
		const begin = readSmilAttribute(element.attrs, "begin");
		if (isGatedBegin(element.attrs)) {
			gated = true;
			if (begin.trim() !== "indefinite") {
				for (const id of syncbaseIds(begin)) {
					if (!ids.has(id)) push(`SMIL begin="${begin}" references unknown animation id "${id}": ${tag}`);
				}
			}
		} else {
			push(`SMIL ${element.name} begin="${begin ?? "(absent → 0s)"}" is not gated; SMIL animations must use begin="indefinite" (keep the offset in data-vpk-begin) or chain from one by syncbase: ${tag}`);
		}
		if (element.name === "animate" && readSmilAttribute(element.attrs, "attributeName")?.trim() === "transform") {
			push(`<animate attributeName="transform"> is ignored by Chromium; use <animateTransform type="translate|scale|rotate|skewX|skewY">: ${tag}`);
		}
		for (const attribute of ["repeatCount", "repeatDur"]) {
			if (readSmilAttribute(element.attrs, attribute)?.trim() === "indefinite") {
				push(`SMIL loops forever (${attribute}="indefinite"); WCAG 2.2.2 needs a pause control, so use a finite repeat: ${tag}`);
			}
		}
		const offset = readSmilAttribute(element.attrs, "data-vpk-begin");
		if (offset !== null && !OFFSET_VALUE.test(offset)) push(`data-vpk-begin="${offset}" must be an offset such as 80ms or 0.2s: ${tag}`);
	}
	if (gated) {
		const starters = [...source.matchAll(STARTER_SCRIPT)];
		if (starters.length === 0) push("SMIL animations require a data-vpk-smil-starter script (run build.mjs --inject-runtime <file>)");
		else if (starters.some(match => !match[1].includes("prefers-reduced-motion"))) push("data-vpk-smil-starter must return early under prefers-reduced-motion: reduce");
	}
	const ranges = smilMaskedRanges(source);
	for (const match of source.matchAll(/<svg\b[^>]*>/gi)) {
		if (ranges.some(([start, end]) => match.index >= start && match.index < end)) continue;
		const stagger = readSmilAttribute(match[0].slice(4, -1), "data-vpk-smil-stagger");
		if (stagger !== null && !isStaggerValue(stagger)) push(`data-vpk-smil-stagger="${stagger}" must be a non-negative number of milliseconds`);
	}
	return issues;
}

async function scrollThrough(page) {
	await page.evaluate(async () => {
		const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
		for (let y = 0; y <= document.documentElement.scrollHeight; y += 600) {
			window.scrollTo(0, y);
			await pause(60);
		}
	});
}

function countBegins() {
	window.__vpkSmilBeginCount = 0;
	window.addEventListener("beginEvent", () => { window.__vpkSmilBeginCount += 1; }, true);
}

async function openCounted(browser, contexts, { url, viewport, reducedMotion }) {
	const context = await browser.newContext({ viewport, reducedMotion });
	contexts.push(context);
	await context.addInitScript(countBegins);
	const page = await context.newPage();
	await page.goto(url, { waitUntil: "load", timeout: 20_000 });
	await scrollThrough(page);
	return page;
}

// --verify behaviour check: nothing begins under reduce; everything begins without it.
export async function verifySmilMotion({ browser, url, html, viewport = { width: 1280, height: 800 }, settleMs = 800, marginMs = 1500 }) {
	const total = listSmilElements(html).length;
	const issues = [];
	const warnings = [];
	if (total === 0) return { total, issues, warnings };
	const contexts = [];
	try {
		const reduce = await openCounted(browser, contexts, { url, viewport, reducedMotion: "reduce" });
		await reduce.waitForTimeout(settleMs);
		const began = await reduce.evaluate(() => window.__vpkSmilBeginCount);
		if (began > 0) issues.push(`SMIL animations ran under prefers-reduced-motion: reduce (${began} began)`);

		const motion = await openCounted(browser, contexts, { url, viewport, reducedMotion: "no-preference" });
		const duration = await motion.evaluate(() => window.vpkSmil?.duration() ?? 4);
		try {
			await motion.waitForFunction(expected => window.__vpkSmilBeginCount >= expected, total, { timeout: Math.ceil(duration * 1000) + marginMs });
		} catch {
			const started = await motion.evaluate(() => window.__vpkSmilBeginCount);
			warnings.push(`${total - started} of ${total} SMIL animations never started (hidden figure or missing data-vpk-smil-starter)`);
		}
	} finally {
		await Promise.all(contexts.map(context => context.close()));
	}
	return { total, issues, warnings };
}

async function sweep(argv) {
	const strict = argv.includes("--strict");
	const named = argv.filter(arg => !arg.startsWith("--"));
	const { listLibraryFiles } = await import("./pipeline.mjs");
	const candidates = named.length > 0 ? named.map(file => path.resolve(file)) : listLibraryFiles();
	const targets = candidates
		.map(file => ({ file, html: fs.readFileSync(file, "utf8") }))
		.filter(({ html }) => listSmilElements(html).length > 0);
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	const tally = { reduced: 0, started: 0, issues: 0, warnings: 0 };
	try {
		const queue = [...targets];
		const worker = async () => {
			for (let target = queue.shift(); target; target = queue.shift()) {
				const rel = path.relative(process.cwd(), target.file);
				const result = await verifySmilMotion({ browser, url: pathToFileURL(target.file).href, html: target.html });
				tally.reduced += result.issues.length > 0 ? 1 : 0;
				tally.started += result.warnings.length === 0 ? 1 : 0;
				tally.issues += result.issues.length;
				tally.warnings += result.warnings.length;
				for (const issue of result.issues) console.log(`✗ ${rel}: ${issue}`);
				for (const warning of result.warnings) console.log(`⚠ ${rel}: ${warning}`);
			}
		};
		await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker)); // 4 pages share one browser
	} finally {
		await browser.close();
	}
	const { reduced, started } = tally;
	const ok = tally.issues === 0 && (!strict || tally.warnings === 0);
	console.log(`${ok ? "✓" : "✗"} smil sweep: ${targets.length} files; ${reduced} began under reduced motion; ${started} fully started`);
	return ok ? 0 : 1;
}

async function main() {
	const argv = process.argv.slice(2);
	if (!argv.includes("--sweep") || argv.some(arg => arg.startsWith("--") && arg !== "--sweep" && arg !== "--strict")) {
		console.error("Usage: node .agents/skills/vpk-html/scripts/runtime/smil-starter.mjs --sweep [--strict] [file…]");
		process.exitCode = 1;
		return;
	}
	process.exitCode = await sweep(argv);
}

function isMainModule() {
	try {
		return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
	} catch {
		return false;
	}
}

// Not awaited: pipeline.mjs imports this module via the registry (a top-level await would deadlock).
if (isMainModule()) {
	main().catch(error => { console.error(error); process.exitCode = 1; });
}

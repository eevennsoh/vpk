import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { validateHtmlString } from "../check-html.mjs";
import { ENHANCEMENT_BLOCK } from "../inject-enhancements.mjs";
import { insertBeforeBodyEnd } from "../runtime/blocks.mjs";
import { isoRuntimeStep } from "../runtime/iso.mjs";
import { runRuntimePipeline } from "../runtime/pipeline.mjs";
import { smilStarterStep } from "../runtime/smil-starter.mjs";
import { ROOT } from "../shared.mjs";
import { ACCENT } from "./accent.mjs";
import { renderRegion } from "./emit.mjs";
import { hasIsoFigures, ISO_BUDGET_BYTES, isoKitSource, isoRuntimeBlock, isoRuntimeScript, isoRuntimeSource, isoStyleTag } from "./inline.mjs";
import { ISO_CSS } from "./runtime-css.mjs";
import { buildScene } from "./scene.mjs";

const SOURCES = ["../runtime/frame-loop.mjs", "./core.mjs", "./runtime.mjs", "./manual-runtime.mjs"].map(rel => fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const EXEMPLAR = JSON.parse(fs.readFileSync(new URL("./briefs/exploded-stack.json", import.meta.url), "utf8"));
const BLOCK = isoRuntimeBlock();
const SCRIPT = /<script data-vpk-iso-runtime>([\s\S]*?)<\/script>/.exec(BLOCK)[1];
const count = (text, needle) => text.split(needle).length - 1;
const MINIMAL = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>x</title><style>body{}</style></head><body><main>__FIG__</main></body></html>`;

test("the three inlined sources have no import statements", () => {
	for (const source of SOURCES) assert.doesNotMatch(source, /^\s*import\b/m);
});

test("the block has its markers, two tags, no <svg and none of the forbidden substrings", () => {
	assert.ok(BLOCK.startsWith("<!-- vpk-iso:start -->\n<style data-vpk-iso-css>"));
	assert.ok(BLOCK.endsWith("</script>\n<!-- vpk-iso:end -->"));
	assert.equal(count(BLOCK, "<style"), 1);
	assert.equal(count(BLOCK, "<script"), 1);
	// The only colour literals are the accent pair's token declarations (ADS orange, iso/accent.mjs), which check-html reads as
	// token values; every rule after them paints through var().
	const decls = [...BLOCK.matchAll(/^\t(--ill-accent(?:-ink)?): (#[0-9a-f]{6});$/gm)].map(match => `${match[1]} ${match[2]}`);
	assert.deepEqual(decls, ["light", "dark"].flatMap(theme => [`--ill-accent ${ACCENT[theme].accent}`, `--ill-accent-ink ${ACCENT[theme].ink}`]));
	const unlit = BLOCK.replace(/^\t(?:--ill-accent(?:-ink)?|--ill-ray-[rgb]): #[0-9a-f]{6};$/gm, "");
	for (const bad of [/#[0-9a-f]{3,8}\b/i]) assert.doesNotMatch(unlit, bad, String(bad));
	for (const bad of [/<svg/, /\brgba?\(|\bhsla?\(/i, /<animate|<set /, /\{\{/, /\bease-in\b/, /\.repeat\(/, /"#" \+/, /https?:/]) assert.doesNotMatch(BLOCK, bad, String(bad));
	assert.match(BLOCK, /hairline \(MIT, Copyright \(c\) 2026 Lucas Marques, github\.com\/lucasmarkes\/hairline\)/, "attribution survives minification");
	assert.ok(BLOCK.includes(isoStyleTag()), "the CSS is not minified");
});

// One style, one block: every iso document inlines the same text, measured against one budget.
test("block size: one block within ISO_BUDGET_BYTES, built by the registry step", () => {
	const bytes = Buffer.byteLength(BLOCK);
	assert.ok(bytes <= ISO_BUDGET_BYTES, `${bytes} B > ${ISO_BUDGET_BYTES} B`);
	assert.equal(isoRuntimeStep.build(), BLOCK, "the registry step builds exactly this block");
	assert.equal(isoRuntimeStep.budgetBytes, ISO_BUDGET_BYTES);
	assert.equal(isoRuntimeStep.manual, undefined, "no second variant");
});

test("the block carries the style's CSS and runtime: frame, tags, marks, pale tone and the select blink", () => {
	for (const piece of ["vpk-iso-plate--manual", "vpk-iso-frame", "data-vpk-iso-blink", "vpk-iso-tag-scale", "vpk-iso-mark-scale", "iso-tone=\"pale\"", "blink"]) assert.ok(BLOCK.includes(piece), piece);
	assert.ok(BLOCK.includes(isoStyleTag()));
	assert.ok(isoStyleTag().includes(ISO_CSS));
});

test("the pipeline inlines the one block for any iso figure and is a fixed point", () => {
	const filePath = path.join(ROOT, "assets/demos/demo-test-iso.html");
	const steps = [isoRuntimeStep];
	const page = MINIMAL.replace("__FIG__", renderRegion(buildScene(EXEMPLAR)));
	const out = runRuntimePipeline(page, { filePath, kind: "artifact", steps }).html;
	assert.equal(count(out, BLOCK), 1);
	assert.equal(runRuntimePipeline(out, { filePath, kind: "artifact", steps }).html, out, "fixed point");
});

test("only the kit scope is renamed: the frame loop keeps its names (the spec's rAF probe reads `gen && run()`)", () => {
	for (const kept of ["function createFrameLoop(", "function getFrameLoop(", "gen&&run()", "window.vpkIso??=kit.createIsoRuntime(window,getFrameLoop(window),kit)"]) assert.ok(SCRIPT.includes(kept), kept);
	assert.equal(count(SCRIPT, "function createIsoRuntime("), 0, "kit locals are renamed");
	assert.match(SCRIPT, /return\{createIsoRuntime:[\w$]+,hull:[\w$]+,padHull:[\w$]+,parsePolyPath:[\w$]+,parseVec:[\w$]+,topmostHit:[\w$]+,blink:[\w$]+,tagLines:[\w$]+,mountStates:[\w$]+\}/);
	assert.ok(SCRIPT.includes('querySelectorAll(".slide")') && SCRIPT.includes("maxHeight"), "the deck fit ships in the block");
});

function fakeWindow() {
	const listeners = [];
	const win = {
		matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
		requestAnimationFrame: () => 1,
		cancelAnimationFrame() {},
		IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
		ResizeObserver: class { observe() {} },
		performance: { now: () => 0 },
		setTimeout: () => 0,
		console: { warn() {} },
		addEventListener: (...args) => listeners.push(args),
		removeEventListener() {},
		document: {
			readyState: "complete",
			querySelectorAll: () => [],
			querySelector: () => null,
			addEventListener() {},
		},
	};
	win.window = win;
	return win;
}

test("node:vm: the minified block runs, exposes vpkIso and one vpkFrameLoop, and re-running keeps the loop", () => {
	const context = vm.createContext(fakeWindow());
	vm.runInContext(SCRIPT, context);
	assert.equal(context.vpkIso.version, 1);
	assert.equal(typeof context.vpkFrameLoop.register, "function");
	assert.equal(context.vpkFrameLoop.version, 1);
	const loop = context.vpkFrameLoop;
	const iso = context.vpkIso;
	vm.runInContext(SCRIPT, context);
	assert.equal(context.vpkFrameLoop, loop, "the ??= single instance survives a second block");
	assert.equal(context.vpkIso, iso);
	assert.equal(typeof context.__vpkIsoRehearsal.hold, "function");
});

test("node:vm: the unminified concatenation has no ReferenceError or duplicate top-level names", () => {
	const context = vm.createContext(fakeWindow());
	assert.doesNotThrow(() => vm.runInContext(isoRuntimeSource(isoKitSource()), context));
	assert.equal(context.vpkIso.version, 1);
});

test("hasIsoFigures keys on <svg … data-vpk-iso-id> and never on the block itself", () => {
	assert.equal(hasIsoFigures(MINIMAL.replace("__FIG__", "") + BLOCK), false);
	assert.equal(hasIsoFigures('<svg data-vpk-illustration data-vpk-iso-id="x">'), true);
	assert.equal(hasIsoFigures(isoRuntimeScript()), false);
});

test("pipeline: one block and one starter for a page with an iso figure, a fixed point on run 2, removal when the figure goes", () => {
	const page = MINIMAL.replace("__FIG__", renderRegion(buildScene(EXEMPLAR)));
	const filePath = path.join(ROOT, "assets/demos/demo-test-iso.html");
	const steps = [smilStarterStep, isoRuntimeStep];
	const once = runRuntimePipeline(page, { filePath, kind: "artifact", steps }).html;
	assert.equal(count(once, "<!-- vpk-iso:start -->"), 1);
	assert.equal(count(once, "<!-- vpk-smil-starter:start -->"), 1);
	const twice = runRuntimePipeline(once, { filePath, kind: "artifact", steps }).html;
	assert.equal(twice, once, "fixed point");
	const removed = runRuntimePipeline(twice.replace(/<!-- vpk-figure:begin[\s\S]*<!-- vpk-figure:end id="exploded-stack" -->/, ""), { filePath, kind: "artifact", steps }).html;
	assert.equal(count(removed, "vpk-iso:start"), 0, "block removed with the last iso figure");
	assert.equal(count(removed, "vpk-smil-starter"), 0, "starter removed with the last gated SMIL");
});

test("check-html accepts the block in a minimal page (as ws0 T-P5 does)", () => {
	const html = insertBeforeBodyEnd(MINIMAL.replace("__FIG__", "<p>x</p>"), BLOCK);
	const failures = validateHtmlString(html).failures.filter(failure => !/font|dark-mode/.test(failure));
	assert.deepEqual(failures, []);
});

test("ENHANCEMENT_BLOCK carries the R6 opt-out (not S5b's attributeFilter)", () => {
	assert.ok(ENHANCEMENT_BLOCK.includes('const optOutSelector = "[data-vpkh-no-lightbox]"'));
	// B3 decision 26b: the observer skips every record (attributes and childList) inside an opt-out root.
	assert.ok(ENHANCEMENT_BLOCK.includes("(record.target.nodeType === 1 ? record.target : record.target.parentElement)?.closest(optOutSelector)"));
	assert.doesNotMatch(ENHANCEMENT_BLOCK, /attributeFilter/);
});

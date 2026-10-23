#!/usr/bin/env node

// SMIL motion contract: normaliser, static rules, canonical starter, starter behaviour (ws0 T-S*).

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const SCRIPTS = path.resolve(__dirname, "..");
const load = name => import(pathToFileURL(path.join(SCRIPTS, name)).href);

// sha256 of the ws0 spec §5.4 starter source (3,489 B). Change it only with the spec (frozen, R29).
const CANONICAL_SOURCE_SHA256 = "047aae7dab13a448d81fded1b47f8a9de033bf1d1a22cf6ae2a2249990fc217b";
const FONT = `@font-face { font-family: "Geist"; src: url(data:font/woff2;base64,AA==); }`;
const page = (body, extra = "") => `<!doctype html><html><head><style>${FONT} :root { color-scheme: light dark; } [data-theme="dark"] { color-scheme: light dark; }</style></head><body><main>${body}</main>${extra}</body></html>`;
const svg = inner => `<svg aria-label="demo"><rect width="10" height="10">${inner}</rect></svg>`;

test("T-S1 normalizeSmilBegin gates offsets, converts animate-on-transform, and skips masked SMIL", async () => {
	const { normalizeSmilBegin } = await load("runtime/smil-starter.mjs");
	const cases = [
		['<animate attributeName="width" to="10" begin="80ms" dur="1s"/>', '<animate attributeName="width" to="10" begin="indefinite" data-vpk-begin="80ms" dur="1s"/>'],
		['<animate attributeName="width" to="10" dur="1s"/>', '<animate attributeName="width" to="10" dur="1s" begin="indefinite" data-vpk-begin="0s"/>'],
		['<set attributeName="opacity" to="1">', '<set attributeName="opacity" to="1" begin="indefinite" data-vpk-begin="0s">'],
		['<animate id="a2" attributeName="x" to="1" begin="a1.end+0.1s" dur="1s"/>', null],
		['<animate attributeName="x" to="1" begin="click" dur="1s"/>', null],
		['<animate attributeName="x" to="1" begin="indefinite" dur="1s"/>', null],
		['<animate attributeName="transform" values="translate(-58 -24); translate(0 0)" begin="0ms" dur="620ms" fill="freeze"/>', '<animateTransform attributeName="transform" type="translate" values="-58 -24; 0 0" begin="indefinite" data-vpk-begin="0ms" dur="620ms" fill="freeze"/>'],
		['<animate attributeName="transform" values="scale(0.9); scale(1)" begin="1.12s" dur="420ms"/>', '<animateTransform attributeName="transform" type="scale" values="0.9; 1" begin="indefinite" data-vpk-begin="1.12s" dur="420ms"/>'],
		['<animate attributeName="transform" from="translate(0,4)" to="translate(0,0)" begin="indefinite" dur="1s"/>', '<animateTransform attributeName="transform" type="translate" values="0 4; 0 0" begin="indefinite" dur="1s"/>'],
		['<animate attributeName="transform" values="translate(1 1); scale(2)" begin="indefinite" dur="1s"/>', null],
		['<animate attributeName="width" to="10" begin="0s" dur="1s"></animate>', '<animate attributeName="width" to="10" begin="indefinite" data-vpk-begin="0s" dur="1s"></animate>'],
	];
	for (const [input, expected] of cases) {
		const html = page(svg(input));
		const out = normalizeSmilBegin(html);
		assert.equal(out, expected === null ? html : page(svg(expected)), input);
		assert.equal(normalizeSmilBegin(out), out, `idempotent: ${input}`);
	}
	const masked = [
		`<svg data-vpk-external-asset aria-label="x"><animate attributeName="x" begin="0s" dur="1s"/></svg>`,
		`<script>const s = '<animate attributeName="x" begin="0s"/>';</script>`,
		`<style>/* <set attributeName="x" to="1"> */</style>`,
		`<template><animate attributeName="x" begin="0s"/></template>`,
		`<!-- <animate attributeName="x" begin="0s"/> -->`,
	];
	for (const fragment of masked) assert.equal(normalizeSmilBegin(page(fragment)), page(fragment), fragment);
});

test("T-S2 the static rules fail ungated, unknown, transform, looping, starterless and malformed SMIL", async () => {
	const { collectSmilMotionIssues, buildSmilStarterBlock } = await load("runtime/smil-starter.mjs");
	const { validateHtmlString } = await load("check-html.mjs");
	const starter = `\n${buildSmilStarterBlock()}\n`;
	const failing = [
		[svg('<animate attributeName="width" to="10" begin="0s" dur="1s"/>'), /is not gated/],
		[svg('<set attributeName="opacity" to="1">'), /begin="\(absent → 0s\)" is not gated/],
		[svg('<animate attributeName="width" to="10" begin="click" dur="1s"/>'), /is not gated/],
		[svg('<animate attributeName="width" to="10" begin="nope.end" dur="1s"/>'), /unknown animation id "nope"/],
		[svg('<animate attributeName="transform" values="scale(1); scale(2)" begin="indefinite" dur="1s"/>'), /ignored by Chromium/],
		[svg('<animate attributeName="width" to="10" begin="indefinite" dur="1s" repeatCount="indefinite"/>'), /loops forever/],
		[svg('<animate attributeName="width" to="10" begin="indefinite" dur="1s" data-vpk-begin="soon"/>'), /data-vpk-begin="soon" must be an offset/],
		[`<svg aria-label="demo" data-vpk-smil-stagger="-5"><rect width="1"><animate attributeName="width" to="1" begin="indefinite" dur="1s"/></rect></svg>`, /data-vpk-smil-stagger="-5" must be a non-negative number/],
	];
	for (const [body, pattern] of failing) assert.match(collectSmilMotionIssues(page(body, starter)).join("\n"), pattern, body);
	assert.match(collectSmilMotionIssues(page(svg('<animate attributeName="width" to="10" begin="indefinite" dur="1s"/>'))).join("\n"), /require a data-vpk-smil-starter script/);
	assert.match(collectSmilMotionIssues(page(svg('<animate attributeName="width" to="10" begin="indefinite" dur="1s"/>'), "<script data-vpk-smil-starter>window.go();</script>")).join("\n"), /must return early under prefers-reduced-motion/);
	for (const paint of ['<set attributeName="fill" to="red" begin="indefinite"/>', '<animate attributeName="fill" values="var(--ill-tone1);#000000" begin="indefinite" dur="1s"/>']) {
		assert.match(validateHtmlString(page(svg(paint), starter)).failures.join("\n"), /grayscale figure tokens/, paint);
	}
	assert.ok(collectSmilMotionIssues(page(Array.from({ length: 20 }, () => svg('<animate attributeName="x" begin="0s"/>')).join(""))).length <= 12, "at most 12 messages");
});

test("T-S3 gated, chained, armed, external and grayscale-paint SMIL passes", async () => {
	const { buildSmilStarterBlock } = await load("runtime/smil-starter.mjs");
	const { validateHtmlString } = await load("check-html.mjs");
	const starter = `\n${buildSmilStarterBlock()}\n`;
	const passing = [
		svg('<animate attributeName="width" to="10" begin="indefinite" data-vpk-begin="80ms" dur="1s"/>'),
		svg('<animate id="a1" attributeName="width" to="10" begin="indefinite" dur="1s"/><animate attributeName="height" to="10" begin="a1.end+0.2s" dur="1s"/>'),
		`<svg aria-label="demo" data-vpk-smil-stagger="0" data-vpk-smil-arm><rect width="1"><animateTransform attributeName="transform" type="translate" values="0 4; 0 0" keyTimes="0; 1" begin="indefinite" data-vpk-begin="0s" dur="1s"/></rect></svg>`,
		`<svg data-vpk-external-asset aria-label="x"><animate attributeName="x" begin="0s" dur="1s" repeatCount="indefinite"/></svg>`,
		svg('<animate attributeName="fill" values="var(--ill-tone1);var(--ill-tone2)" begin="indefinite" dur="1s" fill="freeze"/>'),
	];
	for (const body of passing) assert.deepEqual(validateHtmlString(page(body, starter)).failures, [], body);
});

test("T-S4 the original build.test.js SMIL vectors keep matching", async () => {
	const { validateHtmlString } = await load("check-html.mjs");
	const base = page('<svg aria-label="demo"><animateTransform attributeName="transform" type="translate" begin="indefinite"/></svg>');
	assert.match(validateHtmlString(base).failures.join("\n"), /data-vpk-smil-starter/);
	assert.match(validateHtmlString(base.replace('begin="indefinite"', 'begin="0s"')).failures.join("\n"), /begin="indefinite"/);
});

test("T-S5 the canonical starter block is the spec source, within budget, and token-clean", async () => {
	const { buildSmilStarterBlock, buildSmilStarterScript } = await load("runtime/smil-starter.mjs");
	const { collectColorTokenIssues } = await load("check-html.mjs");
	const source = buildSmilStarterScript();
	assert.equal(crypto.createHash("sha256").update(source).digest("hex"), CANONICAL_SOURCE_SHA256, "starter source equals the §5.4 canonical source");
	for (const needle of ["prefers-reduced-motion", "beginElementAt", "pauseAnimations", "setCurrentTime", "IntersectionObserver", "beforeprint", "window.vpkSmil"]) assert.ok(source.includes(needle), needle);
	assert.doesNotMatch(source, /setAttribute|dataset\./, "the starter makes no DOM writes");
	assert.deepEqual(collectColorTokenIssues(source), []);
	const block = buildSmilStarterBlock();
	assert.ok(Buffer.byteLength(block) <= 4096, `${Buffer.byteLength(block)} B`);
	assert.equal(block, `<!-- vpk-smil-starter:start -->\n<script data-vpk-smil-starter>\n${source}\n</script>\n<!-- vpk-smil-starter:end -->`);
});

function fakeAnimation(attrs) {
	return {
		calls: [],
		getAttribute(name) { return Object.hasOwn(attrs, name) ? attrs[name] : null; },
		closest() { return null; },
		beginElementAt(offset) { this.calls.push(offset); this.log?.push(["begin", offset]); },
	};
}

function fakeSvg({ attrs = {}, animations, log = [] }) {
	const svgNode = {
		log,
		time: 3,
		getAttribute(name) { return Object.hasOwn(attrs, name) ? attrs[name] : null; },
		hasAttribute(name) { return Object.hasOwn(attrs, name); },
		matches() { return false; },
		parentElement: { closest: () => null },
		querySelectorAll() { return animations; },
		getCurrentTime() { return this.time; },
		pauseAnimations() { log.push(["pause"]); },
		unpauseAnimations() { log.push(["unpause"]); },
		setCurrentTime(t) { log.push(["seek", t]); },
	};
	for (const animation of animations) animation.log = log;
	return svgNode;
}

function runStarter(source, { svgs, reduce = false }) {
	const listeners = {};
	const media = { matches: reduce, addEventListener(type, fn) { this.onChange = fn; } };
	const observers = [];
	class FakeIntersectionObserver {
		constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; observers.push(this); }
		observe(target) { this.targets.push(target); }
		unobserve(target) { this.targets = this.targets.filter(item => item !== target); }
	}
	const window = { matchMedia: () => media, addEventListener: (type, fn) => { listeners[type] = fn; }, IntersectionObserver: FakeIntersectionObserver };
	const document = { querySelectorAll: () => svgs };
	const run = () => new Function("window", "document", "IntersectionObserver", source)(window, document, FakeIntersectionObserver);
	run();
	const intersect = targets => observers[0].callback(targets.map(target => ({ isIntersecting: true, target })));
	return { window, media, observers, listeners, intersect, run };
}

test("T-S6 the starter schedules offsets, arms, respects reduced motion and lands on change", async () => {
	const { buildSmilStarterScript } = await load("runtime/smil-starter.mjs");
	const source = buildSmilStarterScript();
	const near = (actual, expected) => assert.deepEqual(actual.map(value => Math.round(value * 1000) / 1000), expected);
	const three = () => [fakeAnimation({ begin: "indefinite" }), fakeAnimation({ begin: "indefinite" }), fakeAnimation({ begin: "indefinite" })];

	for (const [stagger, expected] of [[undefined, [0, 0.07, 0.14]], ["90", [0, 0.09, 0.18]], ["0", [0, 0, 0]]]) {
		const animations = three();
		const figure = fakeSvg({ attrs: stagger === undefined ? {} : { "data-vpk-smil-stagger": stagger }, animations });
		const harness = runStarter(source, { svgs: [figure] });
		assert.deepEqual(animations.flatMap(a => a.calls), [], "nothing begins before the figure enters the viewport");
		assert.equal(harness.observers[0].options.rootMargin, "0px 0px -15% 0px");
		harness.intersect([figure]);
		near(animations.flatMap(a => a.calls), expected);
	}

	const offsetAnimation = fakeAnimation({ begin: "indefinite", "data-vpk-begin": "80ms" });
	const offsetFigure = fakeSvg({ animations: [offsetAnimation] });
	runStarter(source, { svgs: [offsetFigure] }).intersect([offsetFigure]);
	near(offsetAnimation.calls, [0.08]);

	const log = [];
	const armedFigure = fakeSvg({ attrs: { "data-vpk-smil-arm": "", "data-vpk-smil-stagger": "0" }, animations: [fakeAnimation({ begin: "indefinite" }), fakeAnimation({ begin: "indefinite" })], log });
	const armed = runStarter(source, { svgs: [armedFigure] });
	assert.deepEqual(log, [["pause"], ["seek", 0], ["begin", 0], ["begin", 0]], "armed: pause → seek 0 → begin, before any intersection");
	armed.intersect([armedFigure]);
	assert.deepEqual(log.at(-1), ["unpause"], "armed figures unpause on entry");

	const calmAnimations = three();
	const calmFigure = fakeSvg({ animations: calmAnimations });
	const calm = runStarter(source, { svgs: [calmFigure], reduce: true });
	assert.equal(calm.window.vpkSmil.version, 1);
	assert.equal(calm.observers.length, 0, "nothing is observed under reduced motion");
	calm.window.vpkSmil.start();
	assert.deepEqual(calmAnimations.flatMap(a => a.calls), [], "start() is a no-op under reduced motion");

	const changeLog = [];
	const startedFigure = fakeSvg({ animations: three(), log: changeLog });
	const live = runStarter(source, { svgs: [startedFigure] });
	live.intersect([startedFigure]);
	live.media.matches = true;
	live.media.onChange();
	assert.deepEqual(changeLog.slice(-2), [["seek", 1e6], ["unpause"]], "a change to reduce lands started figures");

	const api = live.window.vpkSmil;
	live.run();
	assert.equal(live.window.vpkSmil, api, "a second starter does not replace window.vpkSmil");
	assert.equal(api.duration(startedFigure) >= 0.14, true);
	live.listeners.beforeprint();
	assert.deepEqual(changeLog.slice(-2), [["seek", 1e6], ["unpause"]], "beforeprint lands figures");
});

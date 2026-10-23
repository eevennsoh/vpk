// Mixed-engine proof (ws4a-labs.md §4.12, integration R1): one HTML holds a lab, an iso-kit figure and an anatomy hero.
// The document is built with the real builders (iso/build-figure.mjs --inject, anatomy/build-hero.mjs --audit,
// lab/kit.mjs --inject) from the motion-case-study template, with the figure engine meta set to "both".
// The build and its static assertions run without a browser; the runtime assertions are opt-in:
//   VPK_HTML_BROWSER=1 node --test .agents/skills/vpk-html/scripts/lab/mixed.browser.test.mjs   (unsandboxed)
// Everything is written under the temp dir. Skips with a message when WS3's or ws4b's builders are absent.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateHtmlString } from "../check-html.mjs";
import { applyCaseStudy, renderCaseStudy } from "./render-case-study.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(here, "..");
const SKILL = path.join(SCRIPTS, "..");
const ISO_BUILDER = path.join(SCRIPTS, "iso", "build-figure.mjs");
const HERO_BUILDER = path.join(SCRIPTS, "anatomy", "build-hero.mjs");
const DIAL_HERO = path.join(SCRIPTS, "anatomy", "examples", "dial-indicator.hero.mjs");
const ISO_BRIEF = path.join(SCRIPTS, "figures", "briefs", "round-trip.json");
const SLOT = "<!-- figure slot: place vpk-figure markers here when the contract picks iso-kit, anatomy-hero or both (references/figure-engines.md) -->";
const missing = [ISO_BUILDER, HERO_BUILDER, DIAL_HERO, ISO_BRIEF].filter(file => !fs.existsSync(file));
const skipBuild = missing.length ? `the figure builders are absent: ${missing.map(file => path.relative(SKILL, file)).join(", ")}` : false;
const skipBrowser = skipBuild || (process.env.VPK_HTML_BROWSER !== "1" ? "set VPK_HTML_BROWSER=1 (unsandboxed) to run" : false);

const SEL = {
	labCanvas: '[data-vpk-lab="easing"] [data-vpk-lab-canvas]',
	labPlay: '[data-vpk-lab="easing"] [data-vpk-lab-play]',
	heroStage: '[data-vpk-figure="dial"] .iso-stage',
	isoStage: '[data-vpk-engine="iso-kit"] [data-vpk-iso-stage]',
};
// Counts rAF calls and outstanding callbacks by origin (the frame loop reaches window.requestAnimationFrame lazily).
// Two one-shot callers are not loops and are counted apart: the enhancer's mutation-driven scroll-fade refresh
// (scheduleScrollUpdate) and the lab's resize/theme redraw (requestDraw, only when its loop is not running). Everything
// else, the shared vpkFrameLoop chain included, counts as "loop".
const RAF_PROBE = () => {
	const raf = window.requestAnimationFrame.bind(window);
	const caf = window.cancelAnimationFrame.bind(window);
	const pending = new Map();
	const kindOf = stack => (/scheduleScrollUpdate/.test(stack) ? "enhancer" : /requestDraw/.test(stack) ? "labRedraw" : "loop");
	window.__vpkRaf = { calls: 0, byKind: { loop: 0, enhancer: 0, labRedraw: 0 }, outstanding: kind => [...pending.values()].filter(value => !kind || value === kind).length };
	window.requestAnimationFrame = fn => {
		const kind = kindOf(new Error().stack);
		window.__vpkRaf.calls += 1;
		window.__vpkRaf.byKind[kind] += 1;
		const id = raf(time => {
			pending.delete(id);
			fn(time);
		});
		pending.set(id, kind);
		return id;
	};
	window.cancelAnimationFrame = id => {
		pending.delete(id);
		caf(id);
	};
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

let dir;
let file;
let html;
const cli = (script, args) => execFileSync(process.execPath, [script, ...args], { encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "pipe"] });

before(() => {
	if (skipBuild) return;
	dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-mixed-")));
	fs.mkdirSync(path.join(dir, "_figures"));
	fs.copyFileSync(DIAL_HERO, path.join(dir, "_figures", "dial-indicator.hero.mjs"));
	fs.copyFileSync(ISO_BRIEF, path.join(dir, "_figures", "round-trip.json"));
	const ir = JSON.parse(fs.readFileSync(path.join(SKILL, "assets", "lab", "fixtures", "demo.content.json"), "utf8"));
	let source = applyCaseStudy(fs.readFileSync(path.join(SKILL, "assets", "templates", "motion-case-study.html"), "utf8"), renderCaseStudy(ir));
	assert.ok(source.includes(SLOT), "the template carries the figure slot comment");
	const regions = [
		SLOT,
		'<!-- vpk-figure:begin engine="iso-kit" id="round-trip" src="_figures/round-trip.json" -->',
		'<!-- vpk-figure:end id="round-trip" -->',
		'<!-- vpk-anatomy-hero:start id="dial" src="_figures/dial-indicator.hero.mjs" -->',
		'<!-- vpk-anatomy-hero:end id="dial" -->',
	].join("\n\t\t");
	source = source.replace(SLOT, () => regions).replace("</head>", () => '<meta name="vpk-figure-engine" content="both">\n</head>');
	file = path.join(dir, "mixed.html");
	fs.writeFileSync(file, source);
	// Hero first: build-hero appends its runtime after the enhancer block, and the next pipeline run (the iso --inject) moves the
	// enhancer last, so this order leaves every builder's --check green. The reverse order needs one more pipeline run
	// (build.mjs --inject-runtime) before the iso --check passes.
	cli(HERO_BUILDER, [file, "--audit"]);
	cli(ISO_BUILDER, ["--inject", file]);
	cli(path.join(here, "kit.mjs"), ["--inject", file]);
	html = fs.readFileSync(file, "utf8");
});
after(() => {
	if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

test("the mixed document: real builders, ok under check-html (H1 to H7 included), engine meta both, no separate loop block", { skip: skipBuild }, () => {
	const result = validateHtmlString(html, "mixed.html");
	assert.deepEqual(result.failures, []);
	assert.match(html, /<meta name="vpk-figure-engine" content="both">/);
	assert.equal((html.match(/data-vpk-engine="iso-kit"/g) ?? []).length >= 1, true, "an iso-kit root");
	assert.equal((html.match(/data-vpk-engine="anatomy-hero"/g) ?? []).length >= 1, true, "an anatomy hero root");
	assert.match(html, /data-vpk-lab="easing"/, "the lab");
	// R1: there is no vpk-figure-loop block; each runtime inlines the one frame-loop module and shares window.vpkFrameLoop.
	assert.doesNotMatch(html, /data-vpk-figure-loop/);
	assert.equal(html.split("<!-- vpk-lab:start -->").length - 1, 1, "one lab block");
	assert.equal(html.split("<!-- vpk-iso:start -->").length - 1, 1, "one iso block");
	assert.equal(html.split("<!-- vpk-anatomy-runtime:start -->").length - 1, 1, "one anatomy runtime block");
	// The builders are idempotent on their own output, and the lab block is current.
	assert.match(cli(path.join(here, "kit.mjs"), ["--check", file]), /lab block current/);
	cli(ISO_BUILDER, ["--inject", file, "--check"]);
	cli(HERO_BUILDER, [file, "--check"]);
	// The lightbox opt-out is on every interactive root (R6).
	const tags = html.match(/<[a-z][\w-]*\b[^>]*>/gi) ?? [];
	for (const [name, attribute] of [["lab", /\sdata-vpk-lab="easing"/], ["film", /\sdata-vpk-film(?=[\s>])/], ["iso figure", /\sdata-vpk-engine="iso-kit"/], ["anatomy hero", /\sdata-vpk-engine="anatomy-hero"/]]) {
		const tag = tags.find(candidate => attribute.test(candidate));
		assert.ok(tag, `${name} root`);
		assert.match(tag, /\sdata-vpkh-no-lightbox(?=[\s>=])/, `${name} root opts out of the lightbox`);
	}
});

test("one vpkFrameLoop shared by the lab, the iso figure and the hero: at most one outstanding rAF, sleeping off-screen, no lightbox", { skip: skipBrowser }, async () => {
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		// Tall enough that the lab canvas, the iso stage and the hero stage are in view together (the demo spans about 2,700 px from the lab to the hero).
		const context = await browser.newContext({ viewport: { width: 1280, height: 3200 }, colorScheme: "light", reducedMotion: "no-preference" });
		await context.addInitScript(RAF_PROBE);
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
		page.on("console", message => {
			if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
		});
		await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
		await page.evaluate(() => window.vpkLab.ready);
		const inView = selector => page.evaluate(sel => {
			const box = document.querySelector(sel).getBoundingClientRect();
			return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
		}, selector);

		// One loop object: the lab's `loop` is the iso and hero runtimes' window.vpkFrameLoop.
		const loop = await page.evaluate(() => ({ shared: window.vpkLab.loop === window.vpkFrameLoop, register: typeof window.vpkFrameLoop?.register }));
		assert.deepEqual(loop, { shared: true, register: "function" });

		// The lab plays, the hero tours and the pointer sweeps the iso stage: all three boards awake at once.
		await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: "start", behavior: "instant" }), SEL.labCanvas);
		await wait(1500); // the hero's idle tour has begun
		for (const [name, selector] of Object.entries(SEL)) if (name !== "labPlay") assert.equal(await inView(selector), true, `${name} is in view in the tall viewport`);
		const stage = await page.locator(SEL.isoStage).boundingBox();
		await page.mouse.move(stage.x + stage.width * 0.3, stage.y + stage.height * 0.55, { steps: 3 });
		await page.evaluate(sel => document.querySelector(sel).click(), SEL.labPlay);
		assert.equal(await page.getAttribute(SEL.labPlay, "aria-pressed"), "true", "the lab is playing");
		const seen = { loop: 0, total: 0, boards: 0, visible: 0, awake: 0 };
		const callsBefore = await page.evaluate(() => ({ ...window.__vpkRaf.byKind }));
		for (let index = 0; index < 60; index += 1) {
			if (index % 6 === 0) await page.mouse.move(stage.x + stage.width * [0.3, 0.5, 0.7][(index / 6) % 3], stage.y + stage.height * 0.55, { steps: 3 });
			const sample = await page.evaluate(() => ({ loop: window.__vpkRaf.outstanding("loop"), total: window.__vpkRaf.outstanding(), stats: window.vpkFrameLoop.stats() }));
			for (const key of ["loop", "total"]) seen[key] = Math.max(seen[key], sample[key]);
			for (const key of ["boards", "visible", "awake"]) seen[key] = Math.max(seen[key], sample.stats[key]);
			await wait(30);
		}
		const callsAfter = await page.evaluate(() => ({ ...window.__vpkRaf.byKind }));
		const calls = Object.fromEntries(Object.keys(callsAfter).map(kind => [kind, callsAfter[kind] - callsBefore[kind]]));
		assert.ok(seen.boards >= 3, `vpkFrameLoop.stats().boards ≥ 3 (lab, iso figure, hero): ${JSON.stringify(seen)}`);
		assert.ok(seen.visible >= 3, `all three boards visible at once: ${JSON.stringify(seen)}`);
		assert.ok(seen.awake >= 3, `all three boards awake at once (the lab playing, the hero touring, the iso stage hovered): ${JSON.stringify(seen)}`);
		assert.ok(calls.loop > 10, `the shared loop ran (${JSON.stringify(calls)})`);
		// One frame-loop chain for all three engines: at most one outstanding loop callback. The one-shot housekeeping callbacks are counted apart.
		assert.ok(seen.loop <= 1, `at most 1 outstanding frame-loop rAF with all three moving, saw ${seen.loop}`);
		assert.ok(seen.total <= 3, `the loop's one plus at most the two coalesced one-shots, saw ${seen.total}`);
		console.log(`# mixed: ${seen.boards} boards on one vpkFrameLoop, ${seen.visible} visible, ${seen.awake} awake at once; outstanding rAF at most ${seen.loop} loop, ${seen.total} in all; rAF calls in 1.8 s: ${JSON.stringify(calls)}`);

		// Clicks on the lab canvas, the hero stage and the iso stage open no lightbox, and no zoomable lives inside an opt-out root.
		for (const selector of [SEL.labCanvas, SEL.heroStage, SEL.isoStage]) {
			await page.locator(selector).scrollIntoViewIfNeeded();
			await page.locator(selector).click({ position: { x: 20, y: 20 } });
			await wait(150);
			assert.equal(await page.evaluate(() => document.querySelectorAll(".vpkh-lightbox").length), 0, `no .vpkh-lightbox after clicking ${selector}`);
		}
		assert.equal(await page.evaluate(() => document.querySelectorAll("[data-vpkh-no-lightbox] .vpkh-zoomable, [data-vpkh-no-lightbox].vpkh-zoomable").length), 0, "no .vpkh-zoomable inside an opt-out root");
		assert.equal(await page.evaluate(() => document.body.classList.contains("vpkh-lightbox-open")), false);

		// Everything off-screen: nothing runs. The lab is finished or paused, the pointer is away, and the page is scrolled to the top.
		await page.evaluate(() => {
			const play = document.querySelector('[data-vpk-lab="easing"] [data-vpk-lab-play]');
			if (play.getAttribute("aria-pressed") === "true") play.click();
			window.scrollTo({ top: 0, behavior: "instant" });
		});
		await page.mouse.move(1, 1);
		await wait(1200);
		for (const selector of [SEL.labCanvas, SEL.heroStage, SEL.isoStage]) assert.equal(await inView(selector), false, `${selector} is off-screen at the top of the page`);
		const before = await page.evaluate(() => window.__vpkRaf.calls);
		await wait(1500);
		const idle = (await page.evaluate(() => window.__vpkRaf.calls)) - before;
		assert.equal(idle, 0, `0 rAF callbacks while all three are off-screen, saw ${idle}`);
		assert.deepEqual(errors, [], "no console or page errors");
	} finally {
		await browser.close();
	}
});

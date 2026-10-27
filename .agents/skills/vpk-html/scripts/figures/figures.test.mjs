// ws4b figure-engine suite (spec ws4b section 7.2 F1–F8; integration K4, K11–K13, R4, R5). Run:
//   OPENSSL_CONF=/dev/null node --test .agents/skills/vpk-html/scripts/figures/figures.test.mjs
// F1/F1b compare against ws3's iso modules when they exist; F8 and F8b (Tier B) check demo-figure-engines.html.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(HERE, "..");
const SKILL = path.resolve(SCRIPTS, "..");
const DEMO = path.join(SKILL, "assets", "demos", "demo-anatomy-hero.html");
const ENGINES_DEMO = path.join(SKILL, "assets", "demos", "demo-figure-engines.html");
const CHECK_FIGURES = path.join(HERE, "check-figures.mjs");
const FIXTURE_MODULE = path.join(SCRIPTS, "anatomy", "fixtures", "carriage.hero.mjs");
const DIAL_MODULE = path.join(SCRIPTS, "anatomy", "examples", "dial-indicator.hero.mjs");
const load = rel => import(pathToFileURL(path.join(SCRIPTS, rel)).href);
const count = (text, needle) => text.split(needle).length - 1;
const MINIMAL_HEAD = `<style>@font-face { font-family: "Geist"; src: url(data:font/woff2;base64,AA==); } :root { color-scheme: light dark; } [data-theme="dark"] { color-scheme: light dark; }</style>`;
const META = '<meta name="vpk-figure-engine" content="anatomy-hero">';
const page = (body, head = META) => `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}${MINIMAL_HEAD}</head><body><main><h1>Fixture</h1><p>Visible copy.</p>\n${body}\n</main></body></html>`;

const memo = new Map();
const once = (key, make) => (memo.has(key) ? memo.get(key) : memo.set(key, make()).get(key));

async function heroPage(overrides = {}) {
	const [{ buildHero }, { refreshAnatomyRuntime }, base] = await Promise.all([load("anatomy/hero.mjs"), load("anatomy/runtime.mjs"), import(pathToFileURL(FIXTURE_MODULE).href)]);
	const built = await buildHero({ ...base, ...overrides }, { src: "_figures/carriage.hero.mjs" });
	return refreshAnatomyRuntime(page(built.fragment));
}

const validPage = () => once("valid", () => heroPage());
const dialBuild = () => once("dial", async () => (await load("anatomy/hero.mjs")).buildHero(await import(pathToFileURL(DIAL_MODULE).href), { audit: true }));

test("F1 camera: heroes fit with the shared 45/30 camera, the same preset as the iso kit", async t => {
	const { createKit } = await load("anatomy/hero.mjs");
	const { FIGURE_CAMERA } = await load("figures/camera.mjs");
	const P = createKit().camera.fit([[-10, -10, 0], [10, 10, 10]], 400, 300, { pad: 20 });
	assert.deepEqual([P.azimuth, P.elevation], [45, 30]);
	const built = await dialBuild();
	assert.equal(built.camera, "45 30");
	const scene = path.join(SCRIPTS, "iso", "scene.mjs");
	if (!fs.existsSync(scene)) return t.skip("ws3 iso/scene.mjs is not present yet");
	const { CAMERA_PRESETS } = await import(pathToFileURL(scene).href);
	assert.deepEqual({ ...CAMERA_PRESETS.dimetric }, { ...FIGURE_CAMERA }, "K12: ws3 dimetric deep-equals FIGURE_CAMERA");
});

test("F1b face tones: anatomy and the iso kit resolve top, near and far identically in both themes (K13)", async t => {
	const palette = path.join(SCRIPTS, "iso", "palette.mjs");
	if (!fs.existsSync(palette)) return t.skip("ws3 iso/palette.mjs is not present yet");
	const { ISO_PRESET, DARK_TONE_OVERRIDES } = await import(pathToFileURL(palette).href);
	const { FIGURE_FACE_ROLES, ANATOMY_TOKEN_MAP, ANATOMY_DARK_TOKEN_MAP } = await load("anatomy/tokens.mjs");
	const tones = ISO_PRESET.tones;
	const iso = {
		light: { top: tones.top, sideNear: tones.light, sideFar: tones.dark },
		dark: { top: DARK_TONE_OVERRIDES.top ?? tones.top, sideNear: DARK_TONE_OVERRIDES.light ?? tones.light, sideFar: DARK_TONE_OVERRIDES.dark ?? tones.dark },
	};
	for (const theme of ["light", "dark"]) {
		const { top, sideNear, sideFar } = FIGURE_FACE_ROLES[theme];
		assert.deepEqual({ top, sideNear, sideFar }, iso[theme], `${theme} roles`);
		const map = theme === "dark" ? { ...ANATOMY_TOKEN_MAP, ...ANATOMY_DARK_TOKEN_MAP } : ANATOMY_TOKEN_MAP;
		assert.deepEqual([map.top, map["shade-3"], map["shade-2"]], [iso[theme].top, iso[theme].sideNear, iso[theme].sideFar], `${theme} anatomy properties`);
	}
});

function fakeRoot(id, control) {
	const stage = {
		attrs: {},
		listeners: {},
		getAttribute(name) { return this.attrs[name] ?? null; },
		setAttribute(name, value) { this.attrs[name] = String(value); },
		addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); },
		querySelector: selector => (selector === "svg" ? { querySelector: () => null, querySelectorAll: () => [] } : null),
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
	};
	const island = { textContent: JSON.stringify({ P: { origin: [0, 0], scale: 1, azimuth: 45, elevation: 30 }, control, data: {} }) };
	const readout = { textContent: "" };
	return {
		stage,
		readout,
		getAttribute: name => (name === "data-vpk-figure" ? id : null),
		querySelector: selector => (selector.includes("data-vpk-anatomy-data") ? island : selector === ".iso-stage" ? stage : selector === "[data-readout]" ? readout : null),
		appendChild: node => node,
	};
}

function sandbox(roots, extra = {}) {
	const win = {
		document: { readyState: "complete", querySelectorAll: selector => (selector.includes("anatomy-hero") ? roots : []), addEventListener() {}, createElement: () => ({ setAttribute() {}, style: {} }) },
		console: { warn() {}, error() {}, log() {} },
		performance: { now: () => 1000 },
		setTimeout: () => 0,
		clearTimeout() {},
		requestAnimationFrame: () => 1,
		cancelAnimationFrame() {},
		matchMedia: () => ({ matches: false, addEventListener() {} }),
		addEventListener() {},
		removeEventListener() {},
		...extra,
	};
	win.self = win;
	return vm.createContext(win);
}

test("F2 shared loop: three heroes register three boards through vpkFrameLoop, wake once each, and pass calm", async () => {
	const { anatomyRuntimeScript, frameLoopSource } = await load("anatomy/runtime.mjs");
	const body = anatomyRuntimeScript().replace(/^<script[^>]*>\n?/, "").replace(/<\/script>$/, "");
	const boards = [];
	const loop = {
		register(stage, tick, options) {
			const board = { stage, tick, options, wakes: 0 };
			boards.push(board);
			return { wake: () => (board.wakes += 1), unregister() {} };
		},
		reducedMotion: () => true,
		onReducedMotionChange: () => () => {},
	};
	const slider = { role: "slider", min: 0, max: 10, step: 1, bigStep: 5, rest: 5, pointer: { axis: "x", from: 0.1, to: 0.9 }, tour: null };
	const roots = [fakeRoot("one", slider), fakeRoot("two", { role: "img" }), fakeRoot("three", { role: "img" })];
	const calms = [];
	const context = sandbox(roots, { vpkFrameLoop: loop });
	context.vpkAnatomyQueue = ["one", "two", "three"].map(id => ({
		id,
		model: x => ({ x }),
		present: state => ({ readout: `r${state.x}`, valueText: `v${state.x}` }),
		live: () => ({ tick: (dt, now, calm) => (calms.push(calm), false) }),
	}));
	vm.runInContext(body, context);
	assert.equal(boards.length, 3);
	assert.deepEqual(boards.map(board => board.wakes), [1, 1, 1]);
	assert.deepEqual(boards.map(board => board.stage), roots.map(root => root.stage));
	for (const board of boards) board.tick(0.016, 1000, true);
	for (const board of boards) board.tick(0.016, 1016, false);
	assert.deepEqual(calms, [true, true, true, false, false, false], "each tick passes the loop's calm through");
	assert.equal(typeof boards[0].options.rest, "function", "print rest goes through the loop's beforeprint (K4)");
	vm.runInContext("self.vpkFrameLoop ??= { other: true }; self.seen = self.vpkFrameLoop;", context);
	assert.equal(context.seen, loop, "an iso-runtime stand-in doing ??= reuses the same loop object");
	assert.equal(context.vpkAnatomy.inspect("one").target, 5);

	const real = sandbox([], { IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} } });
	vm.runInContext(body, real);
	const created = real.vpkFrameLoop;
	assert.equal(created.version, 1);
	vm.runInContext(`(() => { ${frameLoopSource()}\n self.second = getFrameLoop(self); })();`, real);
	assert.equal(real.second, created, "a second runtime inlining frame-loop.mjs gets the same vpkFrameLoop");
});

test("F2b reduced motion: the runtime's own MediaQueryList resumes the tour when the loop's listeners never fire", async () => {
	// Chromium drops the frame loop's change event while a board ticks (the loop reads .matches every frame), so
	// the loop stub here never calls its listeners; only the mount runtime's own, never-read list reports the change.
	const { anatomyRuntimeScript } = await load("anatomy/runtime.mjs");
	const body = anatomyRuntimeScript().replace(/^<script[^>]*>\n?/, "").replace(/<\/script>$/, "");
	const state = { reduce: false };
	const boards = [];
	const timers = [];
	const lists = [];
	const loop = {
		register: (stage, tick) => (boards.push(tick), { wake() {}, unregister() {} }),
		reducedMotion: () => state.reduce,
		onReducedMotionChange: () => () => {},
	};
	const tour = { stops: [2, 8], dwell: 1, delay: 1, resume: 3.5 };
	const slider = { role: "slider", min: 0, max: 10, step: 1, bigStep: 5, rest: 5, pointer: null, tour };
	const context = sandbox([fakeRoot("one", slider)], {
		vpkFrameLoop: loop,
		setTimeout: (fn, ms) => timers.push(ms),
		matchMedia: query => ({ matches: false, addEventListener: (type, fn) => lists.push({ query, type, fn }) }),
	});
	vm.runInContext(body, context);
	assert.deepEqual(lists.map(({ query, type }) => [query, type]), [["(prefers-reduced-motion: reduce)", "change"]], "one change listener on a list of its own");
	assert.deepEqual(timers, [tour.delay * 1000 + 20], "the first tour is scheduled after the delay");
	const [tick] = boards;
	tick(0.016, 2100, false);
	assert.equal(context.vpkAnatomy.inspect("one").touring, true, "touring after the delay");
	state.reduce = true;
	assert.equal(tick(0.016, 2116, true), false, "a calm frame stops the tour and lets the board sleep");
	assert.equal(context.vpkAnatomy.inspect("one").touring, false);
	lists[0].fn({ matches: true });
	assert.equal(timers.length, 1, "switching to reduce schedules nothing");
	state.reduce = false;
	lists[0].fn({ matches: false });
	assert.deepEqual(timers.slice(1), [tour.resume * 1000 + 20], "clearing reduce schedules the resume");
	tick(0.016, 1000 + tour.resume * 1000 + 16, false);
	assert.equal(context.vpkAnatomy.inspect("one").touring, true, "the tour is back");
});

test("F2c tour defaults: a hero whose tour names only its stops starts, cycles and resumes at 1.4/2.2/3.6 s in the runtime", async () => {
	const [{ anatomyRuntimeScript }, { buildHero }, base] = await Promise.all([load("anatomy/runtime.mjs"), load("anatomy/hero.mjs"), import(pathToFileURL(FIXTURE_MODULE).href)]);
	const body = anatomyRuntimeScript().replace(/^<script[^>]*>\n?/, "").replace(/<\/script>$/, "");
	const stops = [27, 13];
	const built = await buildHero({ ...base, hero: { ...base.hero, stage: { ...base.hero.stage, tour: { stops } } } });
	const { control } = JSON.parse(built.fragment.match(/<script type="application\/json" data-vpk-anatomy-data>([\s\S]*?)<\/script>/)[1]);
	// One clock for performance.now() and the board's `now`, advanced by tick().
	const run = slider => {
		const clock = { now: 1000 };
		const boards = [];
		const timers = [];
		const loop = { register: (stage, tick) => (boards.push(tick), { wake() {}, unregister() {} }), reducedMotion: () => false, onReducedMotionChange: () => () => {} };
		const root = fakeRoot("carriage", slider);
		const context = sandbox([root], { vpkFrameLoop: loop, performance: { now: () => clock.now }, setTimeout: (fn, ms) => timers.push(ms) });
		vm.runInContext(body, context);
		const fire = (name, event = {}) => root.stage.listeners[name].forEach(fn => fn({ type: name, composedPath: () => [], ...event }));
		const tick = ms => boards[0](ms / 1000, (clock.now += ms), false);
		return { clock, tick, timers, stage: root.stage, fire, inspect: () => context.vpkAnatomy.inspect("carriage") };
	};

	// What the island carried before r3.1 (the module's tour as written) schedules the first tour at NaN ms.
	assert.deepEqual(run({ ...control, tour: { stops } }).timers.map(String), ["NaN"], "the raw tour never starts");

	const hero = run(control);
	assert.deepEqual(hero.timers, [1420], "the first tour is scheduled after the 1.4 s delay");
	hero.tick(1390);
	assert.equal(hero.inspect().touring, false, "not before the delay");
	hero.tick(10);
	assert.equal(hero.inspect().touring, true, "touring once the delay has passed");
	const seen = [];
	for (let frame = 0; frame < 300; frame++) {
		hero.tick(16);
		seen.push([hero.inspect().target, hero.stage.getAttribute("aria-valuenow")]);
	}
	assert.ok(seen.every(([target, valueNow]) => stops.includes(target) && String(target) === valueNow), "every frame holds a stop, and aria-valuenow is that stop (never NaN)");
	const switched = seen.findIndex(([target]) => target === 13);
	assert.ok(Math.abs(switched * 0.016 - 2.2) < 0.05, `the second stop arrives one 2.2 s dwell in (frame ${switched})`);
	assert.equal(seen.at(-1)[0], 27, "and the tour wraps back to the first stop after 4.4 s");

	hero.fire("pointerenter");
	assert.equal(hero.inspect().touring, false, "hover pauses the tour");
	hero.fire("pointerleave");
	assert.deepEqual(hero.timers.slice(1), [3620], "leaving schedules the 3.6 s resume");
	hero.tick(3590);
	assert.equal(hero.inspect().touring, false, "not before the resume");
	hero.tick(10);
	assert.equal(hero.inspect().touring, true, "the tour comes back after the 3.6 s resume");
});

test("E1–E3 engine record: the meta must exist and cover the roots present", async () => {
	const { collectFigureEngineIssues } = await load("figures/check-figures.mjs");
	const valid = await validPage();
	assert.deepEqual(collectFigureEngineIssues(valid), { failures: [], warnings: [] });
	assert.deepEqual(collectFigureEngineIssues(page("<p>No figures.</p>", "")), { failures: [], warnings: [] }, "inert without roots or meta");
	const without = valid.replace(META, "");
	assert.match(collectFigureEngineIssues(without).failures.join("\n"), /E1: 1 figure-engine root but no <meta name="vpk-figure-engine" content="anatomy-hero">/);
	const swap = content => valid.replace(META, `<meta name="vpk-figure-engine" content="${content}">`);
	assert.match(collectFigureEngineIssues(swap("iso")).failures.join("\n"), /E2: .*content="iso"> is not one of none, iso-kit, anatomy-hero, both/);
	assert.match(collectFigureEngineIssues(swap("iso-kit")).failures.join("\n"), /E2: meta "iso-kit" does not cover the anatomy-hero root/);
	assert.match(collectFigureEngineIssues(swap("none")).failures.join("\n"), /E2: meta "none" does not cover the anatomy-hero root/);
	const both = collectFigureEngineIssues(swap("both"));
	assert.deepEqual(both.failures, []);
	assert.match(both.warnings.join("\n"), /E3: meta "both" but the document has only anatomy-hero roots/);
	assert.match(collectFigureEngineIssues(page("<p>x</p>", '<meta name="vpk-figure-engine" content="iso-kit">')).warnings.join("\n"), /E3: meta "iso-kit" but no iso-kit root/);
	assert.match(collectFigureEngineIssues(valid.replace("<h1>", '<figure data-vpk-engine="isokit" data-vpk-figure="x"></figure><h1>')).failures.join("\n"), /E2: unknown data-vpk-engine="isokit"/);
	assert.match(collectFigureEngineIssues(valid.replace(META, META + META)).failures.join("\n"), /E2: 2 <meta name="vpk-figure-engine"> tags/);
});

test("F3 collectAnatomyHeroIssues: H1–H8 fixtures", async () => {
	const { collectAnatomyHeroIssues } = await load("figures/check-figures.mjs");
	const { anatomyRuntimeBlock } = await load("anatomy/runtime.mjs");
	const valid = await validPage();
	const template = fs.readFileSync(path.join(SKILL, "assets", "templates", "one-pager.html"), "utf8");
	assert.deepEqual(collectAnatomyHeroIssues(template), [], "plain template");
	assert.deepEqual(collectAnatomyHeroIssues(valid), [], "valid slider hero");
	const fixture = await import(pathToFileURL(FIXTURE_MODULE).href);
	const staticHero = await heroPage({ hero: { ...fixture.hero, stage: { role: "img", label: "A carriage on two rails." } }, live: undefined });
	assert.deepEqual(collectAnatomyHeroIssues(staticHero), [], "static role=img hero without tabindex or script");
	assert.equal(count(staticHero, "data-vpk-anatomy-live"), 0);
	assert.doesNotMatch(staticHero.match(/<div class="iso-stage"[^>]*>/)[0], /tabindex/);
	const expect = (html, pattern, label) => assert.match(collectAnatomyHeroIssues(html).join("\n"), pattern, label);
	const root = /<div data-vpk-engine="anatomy-hero"[^>]*>/;
	expect(valid.replace(anatomyRuntimeBlock(), `${anatomyRuntimeBlock()}\n<script data-vpk-anatomy-runtime>/* second */</script>`), /H1: expected one <script data-vpk-anatomy-runtime>, found 2/, "two runtimes");
	expect(valid.replace(/<!-- vpk-anatomy-hero:start[\s\S]*?<!-- vpk-anatomy-hero:end[^>]*-->/, ""), /H1: stale anatomy runtime without a hero/, "stale runtime");
	expect(valid.replace('data-vpk-figure="carriage"', 'data-vpk-figure="Carriage_1"'), /H2 data-vpk-figure must match/, "bad id");
	expect(valid.replace("<h1>", '<figure class="vpk-iso-plate" data-vpk-engine="iso-kit" data-vpk-figure="carriage"></figure><h1>'), /H2 data-vpk-figure is not unique across figure engines/, "collides with an iso-kit id");
	expect(valid.replace('class="iso-line iso-edge" data-tone="hi"', 'class="iso-line iso-edge" data-tone="red"'), /H3 red, green or blue tone/, "red tone");
	// HTML accepts single-quoted and unquoted attribute values, so H3 reads all three forms (whole values only).
	expect(valid.replace('class="iso-line iso-edge" data-tone="hi"', "class=\"iso-line iso-edge\" data-tone='green'"), /H3 red, green or blue tone/, "single-quoted tone");
	expect(valid.replace('class="iso-line iso-edge" data-tone="hi"', 'class="iso-line iso-edge" data-tone=blue'), /H3 red, green or blue tone/, "unquoted tone");
	assert.deepEqual(collectAnatomyHeroIssues(valid.replace('class="iso-line iso-edge" data-tone="hi"', 'class="iso-line iso-edge" data-tone=redwood')), [], "a tone that only starts with red");
	expect(valid.replace('<path class="iso-fill"', '<path style="filter:blur(4px)" class="iso-fill"'), /H3 filter: inside a style attribute/, "style filter");
	expect(valid.replace('<path class="iso-fill"', '<path style=filter:blur(4px) class="iso-fill"'), /H3 filter: inside a style attribute/, "unquoted style filter");
	assert.deepEqual(collectAnatomyHeroIssues(valid.replace(/<span class="iso-caption">[^<]*/, '<span class="iso-caption">Bloom filter: false positives')), [], "caption text mentioning a filter");
	expect(valid.replace('<g data-piece="carriage">', '<g data-piece="carriage" transform="translate(2 1)">'), /H4 transform= at rest/, "transform on a part");
	expect(valid.replace('<g data-focal="probe">', '<g data-focal="probe" opacity="0.5">'), /H4 opacity= attribute/, "opacity attribute");
	expect(valid.replace('<path class="iso-fill"', '<path style="opacity:.4" class="iso-fill"'), /H4 opacity: or transform: inside a style attribute/, "style opacity");
	expect(valid.replace('<g data-piece="carriage">', "<g data-piece='carriage' style='transform:translate(1px,1px)'>"), /H4 opacity: or transform: inside a style attribute/, "style transform");
	assert.deepEqual(collectAnatomyHeroIssues(valid.replace('<path class="iso-fill"', '<path style="fill-opacity:.5;transform-origin:center" class="iso-fill"')), [], "style declarations print keeps");
	expect(valid.replace("</main>", '<script data-vpk-anatomy-live="ghost">(self.vpkAnatomyQueue ??= []).push({ id: "ghost" });</script></main>'), /anatomy hero ghost: H5 live script without a matching root/, "orphan script");
	expect(valid.replace(root, tag => tag.replace(" data-vpkh-no-lightbox", "")), /H5 root without data-vpkh-no-lightbox/, "lightbox opt-out missing");
	expect(valid.replace(root, tag => tag.replace(" data-vpk-block", "")), /H5 root without data-vpk-block/, "ws1 block missing");
	expect(valid.replace("<figure class=\"iso-figure\" data-vpk-review-ignore>", "<figure class=\"iso-figure\">"), /H5 inner <figure class="iso-figure"> without data-vpk-review-ignore/);
	expect(valid.replace(/<!-- vpk-anatomy-hero:(?:start|end)[^>]*-->/g, ""), /H6 anatomy figure without markers: rebuild with build.mjs --build-hero/, "no markers");
	// Every marker outside script and style text that is not part of a complete same-id pair is H6, built root or not
	// (round 5: these pages passed check-html, --check-figures and build-hero as "no hero").
	const START = '<!-- vpk-anatomy-hero:start id="carriage" src="_figures/carriage.hero.mjs" -->';
	const END = '<!-- vpk-anatomy-hero:end id="carriage" -->';
	const issuesOf = body => collectAnatomyHeroIssues(page(body));
	assert.deepEqual(issuesOf(START), ['anatomy hero carriage: H6 start marker without a matching <!-- vpk-anatomy-hero:end id="carriage" -->'], "start without end");
	assert.deepEqual(issuesOf(END), ["anatomy hero carriage: H6 end marker without a start marker"], "end without start");
	assert.deepEqual(issuesOf(`${START}<!-- vpk-anatomy-hero:stop id="carriage" -->`), [
		'anatomy hero carriage: H6 unknown marker <!-- vpk-anatomy-hero:stop id="carriage" -->: write <!-- vpk-anatomy-hero:start id="…" src="…" --> or <!-- vpk-anatomy-hero:end id="…" -->',
		'anatomy hero carriage: H6 start marker without a matching <!-- vpk-anatomy-hero:end id="carriage" -->',
	], "misspelled end");
	expect(page(`<!--vpk-anatomy-hero:start id="carriage" src="_figures/carriage.hero.mjs"-->${END}`), /H6 unknown marker <!--vpk-anatomy-hero:start[\s\S]*H6 end marker without a start marker/, "unspaced start");
	expect(page(`${START}${START.replace(/carriage/g, "other")}${END}`), /anatomy hero other: H6 start marker inside the unclosed region carriage: regions do not nest/, "nested start");
	expect(page(`${START}${END.replace("carriage", "other")}`), /H6 start and end markers name different ids \(carriage \/ other\)/, "different ids");
	assert.deepEqual(issuesOf(`<script type="text/plain">${START}</script><style>/* ${END} */</style>`), [], "markers inside script or style text are not markers");
	expect(valid.replace(/<!-- vpk-anatomy-hero:end[^>]*-->/, ""), /H6 anatomy figure without markers[\s\S]*H6 start marker without a matching/, "a built region that lost its end marker");
	expect(valid.replace(/<!-- vpk-anatomy-hero:start[^>]*-->/, ""), /H6 anatomy figure without markers[\s\S]*H6 end marker without a start marker/, "a built region that lost its start marker");
	const { validateHtmlString } = await load("check-html.mjs");
	assert.match(validateHtmlString(page(START)).failures.join("\n"), /H6 start marker without a matching/, "check-html reports it");
	expect(valid.replace('src="_figures/carriage.hero.mjs"', 'src="/Users/x/a.hero.mjs"'), /H6 src "\/Users\/x\/a.hero.mjs" must be relative/, "absolute src");
	expect(valid.replace('src="_figures/carriage.hero.mjs"', 'src="https://example.com/a.hero.mjs"'), /H6 src .* must be relative/, "URL src");
	expect(staticHero.replace('<div class="iso-stage" role="img"', '<div class="iso-stage" tabindex="0" role="img"'), /H7 tabindex="0" on a non-interactive stage/, "img with tabindex");
	expect(valid.replace(/ aria-valuenow="[^"]*"/, ""), /H7 slider without aria-valuenow/, "slider without aria-valuenow");
	expect(valid.replace(/ aria-label="Carriage\. [^"]*"/, ' aria-label=" "'), /H7 stage without an aria-label/);
	expect(valid.replace("const pieces = ", "requestAnimationFrame(() => {}); const pieces = "), /H8 live script uses requestAnimationFrame/, "a script owning a loop");
});

test("F3b check-runtime on a page without a hero root fails B0 heroes with the H6 issue, before any browser starts", async () => {
	const { checkFigureRuntime } = await load("figures/check-runtime.mjs");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-figures-nohero-"));
	const file = path.join(dir, "page.html");
	fs.writeFileSync(file, page('<!-- vpk-anatomy-hero:start id="carriage" src="_figures/carriage.hero.mjs" -->'));
	const result = await checkFigureRuntime(file);
	assert.equal(result.ok, false);
	assert.deepEqual(result.checks.map(check => `${check.id} ${check.ok}`), ["B0 heroes false"]);
	assert.match(result.checks[0].detail, /^no data-vpk-engine="anatomy-hero" root in the page; carriage: H6 start marker without a matching/);
	fs.rmSync(dir, { recursive: true, force: true });
});

test("F4 budget and advisories: measured bytes, A4 below the bar and A5 over the fail threshold fail under --strict", async () => {
	const { measureFigureBudget, collectFigureAdvisories, DEFAULT_FIGURE_THRESHOLDS } = await load("figures/check-figures.mjs");
	const valid = await validPage();
	const budget = measureFigureBudget(valid);
	assert.equal(budget.heroes.length, 1);
	const [hero] = budget.heroes;
	assert.ok(hero.region > 0 && hero.script > 0 && hero.data > 0 && hero.parts === 12, JSON.stringify(hero));
	assert.equal(budget.figuresTotal, hero.region);
	assert.equal(budget.documentBytes, Buffer.byteLength(valid));
	const advisories = collectFigureAdvisories(valid, DEFAULT_FIGURE_THRESHOLDS);
	assert.deepEqual(advisories.map(advisory => [advisory.id, advisory.strict]), [["A4", true]], "the 12-part fixture is below the Figure bar");
	assert.match(advisories[0].message, /12 parts is below the 40-part bar for the figure tier/);
	const big = valid.replace("<!-- vpk-anatomy-hero:end", `<!-- ${"x".repeat(500000)} -->\n<!-- vpk-anatomy-hero:end`).replace('data-vpk-anatomy-parts="12"', 'data-vpk-anatomy-parts="45"');
	// No hero size limit: an oversized hero raises nothing.
	assert.deepEqual(collectFigureAdvisories(big, DEFAULT_FIGURE_THRESHOLDS).map(advisory => advisory.id), []);
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-figures-"));
	const run = (html, ...args) => {
		const file = path.join(dir, "page.html");
		fs.writeFileSync(file, html);
		return spawnSync(process.execPath, [CHECK_FIGURES, file, ...args], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	};
	assert.equal(run(big).status, 0, "advisory without --strict");
	const strictBig = run(big, "--strict");
	assert.equal(strictBig.status, 0, "size never fails, even under --strict");
	assert.doesNotMatch(strictBig.stdout, /A5/);
	const thirty = valid.replace('data-vpk-anatomy-parts="12"', 'data-vpk-anatomy-parts="30"');
	const strictThirty = run(thirty, "--strict");
	assert.equal(strictThirty.status, 1);
	assert.match(strictThirty.stdout, /✗ A4 hero carriage: 30 parts is below the 40-part bar/);
	const json = JSON.parse(run(valid, "--json").stdout);
	assert.equal(json.ok, true);
	assert.equal(json.budget.heroes[0].id, "carriage");
	assert.equal(run(valid.replace(/ aria-valuenow="[^"]*"/, "")).status, 1, "H failures always exit 1");
	assert.equal(spawnSync(process.execPath, [CHECK_FIGURES], { encoding: "utf8" }).status, 2, "usage");
	const focal = collectFigureAdvisories(valid.replace(' data-focal="probe"', ""), DEFAULT_FIGURE_THRESHOLDS);
	assert.ok(focal.some(advisory => advisory.id === "A3" && /0 distinct data-focal/.test(advisory.message)));
	const flow = collectFigureAdvisories(valid.replace('class="iso-line iso-edge"', 'class="iso-line iso-edge" data-flow'), DEFAULT_FIGURE_THRESHOLDS);
	assert.ok(flow.some(advisory => advisory.id === "A6"));
	const two = valid.replace("<h1>", `${valid.match(/<!-- vpk-anatomy-hero:start[\s\S]*?<!-- vpk-anatomy-hero:end[^>]*-->/)[0].replace(/carriage/g, "second")}<h1>`);
	// The one-hero cap is off (maxHeroes Infinity): a document may carry several anatomy heroes.
	assert.ok(!collectFigureAdvisories(two, DEFAULT_FIGURE_THRESHOLDS).some(advisory => advisory.id === "A1"));
	assert.ok(collectFigureAdvisories(two, { ...DEFAULT_FIGURE_THRESHOLDS, maxHeroes: 1 }).some(advisory => advisory.id === "A1"), "a configured cap still reports");
	const mixed = valid.replace("<h1>", '<figure class="vpk-iso-plate" data-vpk-engine="iso-kit" data-vpk-figure="flow" data-vpk-camera="45 35.26"></figure><h1>');
	assert.ok(collectFigureAdvisories(mixed, DEFAULT_FIGURE_THRESHOLDS).some(advisory => advisory.id === "A2" && /iso figure flow \(45 35\.26\) differs from hero carriage \(45 30\)/.test(advisory.message)));
	const aligned = mixed.replace('data-vpk-camera="45 35.26"', 'data-vpk-camera="45 30"');
	assert.equal(collectFigureAdvisories(aligned, DEFAULT_FIGURE_THRESHOLDS).some(advisory => advisory.id === "A2"), false);
});

test("F5 Tier A demo: the committed page is the builder's output, valid, and the dial audits clean with 40+ parts", async () => {
	const built = await dialBuild();
	console.log(`dial audit ${built.audit.ms} ms · ${built.parts} parts · region ${built.sizes.region} B`);
	assert.equal(built.audit.failures, 0, built.audit.report);
	assert.ok(built.parts >= 40, `${built.parts} parts`);
	assert.ok(built.audit.ms < 30000, "the dial audit stays in CI below 30 s");
	const { renderEngineDemo } = await load("figures/build-engine-demo.mjs");
	const { html } = await renderEngineDemo("anatomy");
	assert.ok(fs.existsSync(DEMO), "run node .agents/skills/vpk-html/scripts/figures/build-engine-demo.mjs --page anatomy (unsandboxed)");
	assert.equal(fs.readFileSync(DEMO, "utf8"), html, "demo-anatomy-hero.html is stale: rebuild it with build-engine-demo.mjs");
	const { validateHtmlFile } = await load("check-html.mjs");
	const result = validateHtmlFile(DEMO);
	assert.deepEqual(result.failures, []);
	assert.equal(count(html, "<style data-vpk-anatomy-css>"), 1);
	assert.equal(count(html, "<script data-vpk-anatomy-runtime>"), 1);
	assert.equal(count(html, '<meta name="vpk-figure-engine" content="anatomy-hero">'), 1);
	for (const absent of ["data-vpk-figure-loop", "vpkFigures", 'data-tone="red"', 'data-tone="green"', 'data-tone="blue"']) assert.equal(html.includes(absent), false, absent);
	const region = html.match(/<!-- vpk-anatomy-hero:start[\s\S]*?<!-- vpk-anatomy-hero:end[^>]*-->/)[0];
	for (const absent of ["iso-halo", "filter", "<linearGradient", " opacity="]) assert.equal(region.includes(absent), false, `${absent} inside the hero region`);
	assert.match(html, /\.iso-halo\{display:none\}/, "the only halo text is the CSS rule that hides halos");
});

test("F6 check-html wiring: a hero without its runtime fails validateHtmlString with the H1 message", async () => {
	const { validateHtmlString } = await load("check-html.mjs");
	const { refreshAnatomyRuntime } = await load("anatomy/runtime.mjs");
	const valid = await validPage();
	assert.deepEqual(validateHtmlString(valid).failures, []);
	const { buildHero } = await load("anatomy/hero.mjs");
	const bare = page((await buildHero(await import(pathToFileURL(FIXTURE_MODULE).href), { src: "_figures/carriage.hero.mjs" })).fragment);
	const result = validateHtmlString(bare);
	assert.equal(result.ok, false);
	assert.match(result.failures.join("\n"), /anatomy hero H1: expected one <style data-vpk-anatomy-css> inside <head>, found 0/);
	assert.deepEqual(validateHtmlString(refreshAnatomyRuntime(bare)).failures, []);
	const warned = validateHtmlString(valid.replace(META, '<meta name="vpk-figure-engine" content="both">'));
	assert.equal(warned.ok, true, "E3 is a warning");
	assert.match(warned.warnings.join("\n"), /E3/);
});

test("F7 no regressions: every library file is clean under the anatomy checks", async () => {
	const { collectAnatomyHeroIssues, collectFigureEngineIssues, engineRoots } = await load("figures/check-figures.mjs");
	const directories = ["templates", "demos", "diagrams", "illustrations", "landing"].map(name => path.join(SKILL, "assets", name));
	const files = [...directories.flatMap(dir => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith(".html")).map(name => path.join(dir, name)) : [])), path.join(SKILL, "index.html")];
	assert.ok(files.length > 150, `${files.length} library files`);
	for (const file of files) {
		const html = fs.readFileSync(file, "utf8");
		assert.deepEqual(collectAnatomyHeroIssues(html), [], path.relative(SKILL, file));
		if (!engineRoots(html).length) assert.deepEqual(collectFigureEngineIssues(html).failures, [], `${path.relative(SKILL, file)}: inert without engine roots`);
	}
});

// The text of one "How they share the page" row, by its label.
const factRows = html => {
	const table = html.match(/<table class="hero-facts">\s*<caption>Measured from the builders' output and this page<\/caption>([\s\S]*?)<\/table>/)?.[1] ?? "";
	return new Map([...table.matchAll(/<tr><th scope="row">([^<]*)<\/th><td>([^<]*)<\/td><\/tr>/g)].map(match => [match[1], match[2].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")]));
};
const ENGINES_BRIEF = path.join(SCRIPTS, "figures", "briefs", "round-trip.json");
const kbText = bytes => `${(bytes / 1024).toFixed(1)} KB`;

test("F8 Tier B demo: the committed page is the builder's output, both engines share one camera, one meta and one loop", async () => {
	const { renderEngineDemo } = await load("figures/build-engine-demo.mjs");
	const { html } = await renderEngineDemo("engines");
	assert.ok(fs.existsSync(ENGINES_DEMO), "run node .agents/skills/vpk-html/scripts/figures/build-engine-demo.mjs --page engines (unsandboxed)");
	assert.equal(fs.readFileSync(ENGINES_DEMO, "utf8"), html, "demo-figure-engines.html is stale: rebuild it with build-engine-demo.mjs");
	const { validateHtmlFile } = await load("check-html.mjs");
	const result = validateHtmlFile(ENGINES_DEMO);
	assert.deepEqual(result.failures, []);
	assert.deepEqual(result.warnings, []);
	const { collectFigureAdvisories, collectFigureEngineIssues, engineRoots } = await load("figures/check-figures.mjs");
	const { FIGURE_CAMERA, parseCameraAttr, sameCamera } = await load("figures/camera.mjs");
	const roots = engineRoots(html);
	assert.deepEqual(roots.map(root => root.engine).sort(), ["anatomy-hero", "iso-kit"], "one root of each engine");
	assert.deepEqual(collectFigureEngineIssues(html), { failures: [], warnings: [] }, "E1-E3 and H1-H8 are clean");
	assert.equal(collectFigureAdvisories(html).some(advisory => advisory.id === "A2"), false, "A2: one camera");
	assert.equal(count(html, '<meta name="vpk-figure-engine" content="both">'), 1, "R4: the meta is both, once");
	// R3 and R6 on both roots: engine id, figure id, one shared camera, one atomic review block, no lightbox.
	for (const [engine, figure] of [["iso-kit", "round-trip"], ["anatomy-hero", "dial"]]) {
		const tag = html.match(new RegExp(`<[a-z]+\\b[^>]*\\sdata-vpk-engine="${engine}"[^>]*>`))[0];
		assert.match(tag, new RegExp(`data-vpk-figure="${figure}"`), engine);
		assert.ok(sameCamera(parseCameraAttr(tag.match(/data-vpk-camera="([^"]*)"/)?.[1]), FIGURE_CAMERA), `${engine}: data-vpk-camera is ${JSON.stringify(FIGURE_CAMERA)}`);
		assert.match(tag, /\sdata-vpk-block(?=[\s>])/, `${engine}: one atomic review block`);
		assert.match(tag, /\sdata-vpkh-no-lightbox(?=[\s>])/, `${engine}: lightbox opt-out`);
	}
	// One runtime and one style block per engine, in the pipeline's blocks; no second loop.
	for (const marker of ["<script data-vpk-iso-runtime>", "<style data-vpk-iso-css>", "<script data-vpk-anatomy-runtime>", "<style data-vpk-anatomy-css>"]) assert.equal(count(html, marker), 1, marker);
	for (const absent of ["data-vpk-figure-loop", "vpkFigures", "vpk-figure-loop"]) assert.equal(html.includes(absent), false, absent);
	// WS3's own document audit: 0 errors, including the label/leader rule A7.
	const { auditHtml } = await load("iso/audit.mjs");
	assert.deepEqual(auditHtml(html).findings.filter(finding => finding.severity === "error"), []);
	// K4 with the page's real runtimes: either order, one vpkFrameLoop object, and nothing else leaks.
	const grab = attribute => html.match(new RegExp(`<script ${attribute}>\\n?([\\s\\S]*?)</script>`))[1];
	const scripts = [grab("data-vpk-iso-runtime"), grab("data-vpk-anatomy-runtime")];
	for (const order of [scripts, [...scripts].reverse()]) {
		const context = sandbox([], { IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} } });
		context.window = context;
		vm.runInContext(order[0], context);
		const first = context.vpkFrameLoop;
		assert.equal(first?.version, 1);
		vm.runInContext(order[1], context);
		assert.equal(context.vpkFrameLoop, first, "the second runtime reuses the first one's loop");
		assert.deepEqual(Object.keys(context).filter(key => /^vpk|^__vpk/i.test(key)).sort(), ["__vpkIsoRehearsal", "__vpkRehearsal", "vpkAnatomy", "vpkAnatomyQueue", "vpkFrameLoop", "vpkIso"]);
	}
});

test("F8b Tier B demo: every byte figure in 'How they share the page' equals the builders' measured sizes", async () => {
	const html = fs.readFileSync(ENGINES_DEMO, "utf8");
	const [{ buildHero }, { renderIsoFigure }, { isoRuntimeBlock, ISO_BUDGET_BYTES }, { anatomyCssBlock, anatomyRuntimeBlock }, { FIGURE_FACE_ROLES }] = await Promise.all([
		load("anatomy/hero.mjs"), load("iso/build-figure.mjs"), load("iso/inline.mjs"), load("anatomy/runtime.mjs"), load("anatomy/tokens.mjs"),
	]);
	const dial = await import(pathToFileURL(DIAL_MODULE).href);
	const hero = await buildHero(dial, { src: path.relative(path.dirname(ENGINES_DEMO), DIAL_MODULE).split(path.sep).join("/") });
	const iso = renderIsoFigure(JSON.parse(fs.readFileSync(ENGINES_BRIEF, "utf8")), { indent: "\t" });
	const between = (start, end) => html.slice(html.indexOf(start), html.indexOf(end) + end.length);
	const inPage = {
		iso: Buffer.byteLength(between('<!-- vpk-figure:begin engine="iso-kit"', '<!-- vpk-figure:end id="round-trip" -->')),
		hero: Buffer.byteLength(between("<!-- vpk-anatomy-hero:start", '<!-- vpk-anatomy-hero:end id="dial" -->')),
		isoBlock: Buffer.byteLength(between("<!-- vpk-iso:start -->", "<!-- vpk-iso:end -->")),
		anatomyCss: Buffer.byteLength(between("<!-- vpk-anatomy-css:start -->", "<!-- vpk-anatomy-css:end -->")),
		anatomyRuntime: Buffer.byteLength(between("<!-- vpk-anatomy-runtime:start -->", "<!-- vpk-anatomy-runtime:end -->")),
	};
	// What the page ships is what the builders measured.
	assert.deepEqual(inPage, { iso: iso.sizes.region, hero: hero.sizes.region, isoBlock: Buffer.byteLength(isoRuntimeBlock()), anatomyCss: Buffer.byteLength(anatomyCssBlock()), anatomyRuntime: Buffer.byteLength(anatomyRuntimeBlock()) });
	const total = Buffer.byteLength(html);
	const blocks = inPage.isoBlock + inPage.anatomyCss + inPage.anatomyRuntime;
	const rows = factRows(html);
	assert.equal(rows.get("Iso figure region"), `${kbText(iso.sizes.region)}: SVG ${kbText(iso.sizes.svg)}`);
	assert.equal(rows.get("Iso runtime block"), kbText(inPage.isoBlock));
	assert.equal(rows.get("Hero region"), `${kbText(hero.sizes.region)}: SVG ${kbText(hero.sizes.svg)}, live script ${kbText(hero.sizes.script)}, data island ${kbText(hero.sizes.data)}`);
	assert.equal(rows.get("Anatomy CSS and runtime blocks"), `${kbText(inPage.anatomyCss + inPage.anatomyRuntime)}: CSS ${kbText(inPage.anatomyCss)}, runtime ${kbText(inPage.anatomyRuntime)}`);
	assert.equal(rows.get("Shell, copy and this table"), kbText(total - inPage.iso - inPage.hero - blocks));
	assert.equal(rows.get("Page total"), kbText(total));
	// The prose rows read their values from the same maps the engines paint with.
	const { light, dark } = FIGURE_FACE_ROLES;
	assert.ok(rows.get("Face tones").includes(light.top) && rows.get("Face tones").includes(dark.top) && rows.get("Face tones").includes(light.sideNear) && rows.get("Face tones").includes(light.sideDeep));
	assert.ok(rows.get("Camera").startsWith("45 30 "));
	assert.ok(rows.get("Truth model").includes(dial.present(dial.model(dial.hero.stage.input.rest, dial.data), dial.data).readout));
	// One iso block for every page (one style), held to ISO_BUDGET_BYTES; the anatomy blocks to 40,960 B.
	assert.ok(inPage.isoBlock <= ISO_BUDGET_BYTES && inPage.anatomyCss + inPage.anatomyRuntime <= 40960, "K2 block budgets");
	assert.equal(inPage.isoBlock, Buffer.byteLength(isoRuntimeBlock()), "the page carries the one block");
});

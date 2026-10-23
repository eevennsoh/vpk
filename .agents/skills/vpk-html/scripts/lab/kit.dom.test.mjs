// The kit block evaluated in happy-dom on the template body (ws4a-labs.md §9 kit.dom): idempotent init on a
// serialised copy, generated and mirror markers, Gantt keys, the lab queue, widgets and the legacy lightbox
// fallback. Assertions compare strings, numbers and booleans only.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { liteVariant } from "../media/embed.mjs";
import { buildLabRuntimeSource, collectLabMarkupIssues } from "./kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(here, "..", "..", "assets", "lab");
const BODY = fs.readFileSync(path.join(ASSETS, "motion-case-study.body.html"), "utf8");
const DOC = fs.readFileSync(path.join(ASSETS, "motion-case-study.doc.mjs"), "utf8");
const KIT = buildLabRuntimeSource();
const require = createRequire(import.meta.url);
const { GlobalRegistrator } = require("@happy-dom/global-registrator");
const FILM_DATA = JSON.stringify({
	version: 1, fps: 30, duration: 6,
	segments: [{ id: "clock", label: "clock", kind: "hold", film: [0, 6], clock: { kind: "linear", start: 0, rate: 1 } }],
	chapters: [{ label: "A", film: 0 }, { label: "B", film: 2 }, { label: "C", film: 4 }],
});
const settle = () => new Promise(resolve => setTimeout(resolve, 30));

function bodyMarkup({ enhancer = "" } = {}) {
	return BODY.replace(/^<body[^>]*>\n?/, "")
		.replace(/(<script type="application\/json" data-vpk-film-data>)[\s\S]*?(<\/script>)/, (_, open, close) => `${open}${FILM_DATA}${close}`)
		.replace('<video class="vpk-film-video"', '<video src="data:video/mp4;base64,AAAA" class="vpk-film-video"') + enhancer;
}

function resetGlobals() {
	for (const name of ["vpkLab", "vpkFrameLoop", "vpkLabQueue"]) delete globalThis[name];
}

/** Load markup, queue the sample lab (optionally wrapped), evaluate the kit and wait for init. */
async function boot({ head = "", body = bodyMarkup(), wrapDoc = def => def } = {}) {
	resetGlobals();
	document.head.innerHTML = head;
	document.body.innerHTML = body;
	globalThis.vpkLabQueue = [];
	new Function(DOC)();
	globalThis.vpkLabQueue = globalThis.vpkLabQueue.map(([id, def]) => [id, wrapDoc(def)]);
	new Function(KIT)();
	await settle();
	return globalThis.vpkLab;
}

const counts = () => ({
	chapters: document.querySelectorAll("[data-vpk-film-chapters] button").length,
	ticks: document.querySelectorAll("[data-vpk-film-ticks] > span").length,
	cueT: document.querySelectorAll(".vpk-cue-t > span").length,
	readout: document.querySelectorAll("[data-vpk-readout] > span").length,
	time: document.querySelectorAll("[data-vpk-film-time] > b").length,
	generated: document.querySelectorAll("body [data-vpk-generated]").length,
});

before(() => {
	if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register({ url: "http://localhost/" });
	globalThis.self ??= globalThis;
	globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
after(() => GlobalRegistrator.unregister());

test("the template body carries every mirror marker and static opt-out the kit needs", () => {
	assert.deepEqual(collectLabMarkupIssues(BODY), []);
	for (const selector of ["[data-vpk-beat]", "[data-vpk-film-time]", "[data-vpk-readout]", "[data-vpk-select-detail]", "[data-vpk-out]"]) {
		assert.match(BODY, new RegExp(`${selector.slice(1, -1)}[^>]*data-vpk-review-ignore`), selector);
	}
});

test("init builds chapters, ticks and cue-t spans from the data, all marked data-vpk-generated", async () => {
	const lab = await boot();
	assert.equal(lab.version, "1");
	assert.deepEqual(lab.inspect(), { labs: ["easing"], films: ["film-player"], inited: true });
	assert.equal(await lab.ready, true);
	const c = counts();
	assert.equal(c.chapters, 3, "one button per chapter");
	assert.equal(c.ticks, 3, "one tick per cue");
	assert.equal(c.cueT, 3, "an empty .vpk-cue-t gets one generated span");
	assert.equal(c.time, 1);
	assert.equal(document.querySelector(".vpk-cue-t > span").textContent, "{{Act}} · film 0.00 s · clock t 0.00 s");
	for (const node of document.querySelectorAll("body [data-vpk-generated]")) {
		assert.ok(node.closest("[data-vpk-film], [data-vpk-cues], [data-vpk-lab], [data-vpk-gantt], [data-vpk-layers]"), `${node.tagName} sits in a kit root`);
	}
	for (const node of document.querySelectorAll("[data-vpk-film-chapters] button, [data-vpk-film-ticks] > span, .vpk-cue-t > span")) {
		assert.equal(node.hasAttribute("data-vpk-generated"), true);
	}
});

/** Detached videos the kit creates answer at once: setting src fires loadeddata, setting currentTime fires seeked. */
function fakeProbes() {
	const original = document.createElement;
	const made = [];
	const seeks = [];
	document.createElement = function (name, ...rest) {
		const element = original.call(this, name, ...rest);
		if (String(name).toLowerCase() !== "video") return element;
		made.push(element);
		let time = 0;
		const later = type => setTimeout(() => element.dispatchEvent(new Event(type)), 2);
		Object.defineProperty(element, "src", { configurable: true, get: () => "", set: () => later("loadeddata") });
		Object.defineProperty(element, "currentTime", { configurable: true, get: () => time, set: value => { time = value; seeks.push(value); later("seeked"); } });
		return element;
	};
	return { made, seeks, restore: () => { document.createElement = original; } };
}

test("thumbnails start at idle after init, sooner for vpkLab.ready or beforeprint (a reader's own print and PDF find them drawn)", async () => {
	const probes = fakeProbes();
	const pending = () => document.querySelectorAll("canvas.vpk-cue-thumb.is-pending").length;
	const idle = [];
	globalThis.requestIdleCallback = (callback, options) => idle.push({ callback, options });
	try {
		const lab = await boot();
		assert.equal(pending(), 3, "out of view (the observer never fires here) and not idle yet: every cue canvas waits");
		assert.equal(probes.made.length, 0, "no decoder during init");
		assert.equal(idle.length, 1, "one idle start per film");
		assert.ok(idle[0].options.timeout <= 1000, `the idle start runs within ${idle[0].options.timeout} ms`);
		const started = Date.now();
		assert.equal(await lab.ready, true);
		assert.ok(Date.now() - started < 1500, `ready took ${Date.now() - started} ms`);
		assert.equal(probes.made.length, 1, "one detached video for the whole cue list");
		assert.equal(pending(), 0);
		await boot();
		assert.equal(pending(), 3);
		window.dispatchEvent(new Event("beforeprint"));
		await new Promise(resolve => setTimeout(resolve, 100));
		assert.equal(pending(), 0, "beforeprint drew them without anyone reading ready");
		idle.length = 0;
		await boot();
		assert.equal(pending(), 3);
		const made = probes.made.length;
		idle.splice(0).forEach(entry => entry.callback({ didTimeout: false, timeRemaining: () => 10 }));
		await new Promise(resolve => setTimeout(resolve, 100));
		assert.equal(pending(), 0, "the idle start drew them: nothing read ready, nothing printed, the list never came into view");
		assert.equal(probes.made.length, made + 1, "one detached video");
	} finally {
		delete globalThis.requestIdleCallback;
		probes.restore();
	}
});

test("P4 cycle 2 item 2: each cue thumbnail probes the exact film time its click seeks to", async () => {
	const probes = fakeProbes();
	try {
		const lab = await boot();
		await lab.ready;
		const video = document.querySelector("[data-vpk-film-video]");
		const cues = [...document.querySelectorAll("[data-vpk-cue]")];
		assert.equal(probes.seeks.length, cues.length, "one probe seek per cue");
		cues.forEach((cue, index) => {
			cue.click();
			const landed = video.currentTime;
			assert.ok(landed > Number(cue.getAttribute("data-film")), `${cue.dataset.vpkCue}: the click lands past the cue time (${landed})`);
			assert.equal(probes.seeks[index], landed, `${cue.dataset.vpkCue}: thumbnail time ${probes.seeks[index]} = click time ${landed}`);
		});
	} finally {
		probes.restore();
	}
});

test("re-running init on a serialised copy duplicates nothing", async () => {
	await boot();
	document.querySelector("[data-vpk-cue='cue-2']").click();
	document.querySelector("[data-vpk-flip]").click();
	const first = counts();
	const html = document.documentElement.outerHTML;
	const head = /<head>([\s\S]*)<\/head>/i.exec(html)[1];
	const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)[1];
	assert.ok(body.includes("data-vpk-generated"), "the copy carries the first run's generated nodes");
	await boot({ head, body });
	assert.deepEqual(counts(), first);
	assert.ok(document.querySelectorAll("[data-vpk-color-probe]").length <= 1, "at most one colour probe");
	assert.equal(document.querySelectorAll(".vpk-cue.is-current").length, 1, "one current cue after re-init");
	assert.equal(document.querySelector("[data-vpk-flip]").getAttribute("aria-pressed"), "false", "flip state re-derived");
});

test("the lite copy's note from embed.mjs liteVariant survives init (it sits inside the film root)", async () => {
	const full = `<!doctype html>\n<html lang="en">\n<head></head>\n<body>\n${bodyMarkup()}\n</body>\n</html>\n`;
	const lite = liteVariant(full, { videoSrc: "data:video/mp4;base64,AAAA", poster: null, filmData: JSON.parse(FILM_DATA), provenance: null, slug: "case", width: 640, height: 360 });
	await boot({ body: /<body[^>]*>([\s\S]*)<\/body>/i.exec(lite)[1] });
	const note = document.querySelector(".vpk-film-lite-note");
	assert.ok(note, "the note is still in the DOM after init");
	assert.equal(Boolean(note.closest("[data-vpk-film]")), true);
	assert.match(note.textContent, /^Lite copy: the film is re-encoded at 640 × 360 .* The full copy is case\.html\.$/);
	assert.equal(note.hasAttribute("data-vpk-review-ignore"), true);
});

test("starting the film from the focused big play hands focus to the bar's Play button", async () => {
	await boot();
	const bigPlay = document.querySelector("[data-vpk-film-bigplay]");
	bigPlay.focus();
	assert.equal(document.activeElement === bigPlay, true);
	bigPlay.click();
	assert.equal(bigPlay.hidden, true);
	assert.equal(document.activeElement === document.querySelector("[data-vpk-film-play]"), true, `focus is on ${document.activeElement?.tagName}`);
});

test("a cue click seeks the film: the beat panel copies the cue and it becomes current", async () => {
	const lab = await boot();
	const film = lab.film("film-player");
	document.querySelector("[data-vpk-cue='cue-3']").click();
	assert.ok(Math.abs(film.time - 4.001) < 1e-6, `film time ${film.time}`);
	assert.equal(document.querySelector("[data-vpk-cue='cue-3']").classList.contains("is-current"), true);
	assert.equal(document.querySelector("[data-vpk-beat-title]").textContent, "{{Cue title}}");
	assert.equal(document.querySelector("[data-vpk-beat-body]").textContent, "{{What happens on screen at this cue.}}");
	assert.equal(document.querySelector("[data-vpk-film-time] > b").textContent, "4.00");
	assert.equal(document.querySelector("[data-vpk-gantt-head]").getAttribute("opacity"), "1");
	assert.equal(document.querySelector("[data-vpk-gantt]").getAttribute("aria-valuenow"), "4.00");
});

test("Gantt keys call preventDefault (so docnav skips them) and move the film by 0.1 s / 1 s", async () => {
	const lab = await boot();
	const film = lab.film();
	const gantt = document.querySelector("[data-vpk-gantt]");
	const key = (target, name) => {
		const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
		target.dispatchEvent(event);
		return event.defaultPrevented;
	};
	assert.equal(key(gantt, "ArrowUp"), true);
	assert.ok(Math.abs(film.time - 0.101) < 1e-6, `ArrowUp → ${film.time}`);
	assert.equal(key(gantt, "PageUp"), true);
	assert.ok(Math.abs(film.time - 1.101) < 1e-6, `PageUp → ${film.time} (0.1 s + 1 s + the one 1 ms nudge, no accumulated drift)`);
	assert.equal(key(gantt, "End"), true);
	assert.equal(key(gantt, "Home"), true);
	assert.ok(film.time < 0.01);
	assert.equal(key(gantt, "x"), false, "unhandled keys pass through");
	const root = document.querySelector("[data-vpk-film]");
	assert.equal(key(root, "ArrowUp"), false, "the film leaves ↑/↓ to docnav");
	assert.equal(key(root, "ArrowRight"), true);
	assert.ok(Math.abs(film.time - 0.502) < 0.01, `ArrowRight → ${film.time}`);
	assert.equal(key(root, "3"), true, "digit keys jump to chapters");
	assert.ok(Math.abs(film.time - 4.001) < 1e-6);
});

test("P4 item 17: 50 → presses on the Gantt read 5.00 s, not 5.05 s (the film's +1 ms nudge never feeds back); Home resets; End keeps the clock", async () => {
	const lab = await boot();
	const film = lab.film();
	const gantt = document.querySelector("[data-vpk-gantt]");
	const press = name => gantt.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
	for (let index = 0; index < 50; index += 1) press("ArrowRight");
	assert.equal(gantt.getAttribute("aria-valuenow"), "5.00");
	assert.equal(gantt.getAttribute("aria-valuetext"), "5.00 s");
	assert.ok(Math.abs(film.time - 5.001) < 1e-6, `the film sits 1 ms past the clock (${film.time})`);
	for (let index = 0; index < 10; index += 1) press("ArrowLeft");
	assert.equal(gantt.getAttribute("aria-valuenow"), "4.00", "stepping back stays exact");
	press("Home");
	assert.equal(gantt.getAttribute("aria-valuenow"), "0.00");
	press("ArrowUp");
	assert.equal(gantt.getAttribute("aria-valuenow"), "0.10");
});

test("P4 item 16: every Gantt mark carries its time, and a cue click still reads that cue's clock time", async () => {
	const lab = await boot();
	const marks = [...document.querySelectorAll("[data-vpk-gantt-mark]")].map(node => node.getAttribute("data-vpk-gantt-mark"));
	assert.deepEqual(marks, ["0", "3"], "one data-vpk-gantt-mark per act line, in clock seconds");
	assert.equal(lab.film("film-player").cues.every(cue => Number.isFinite(cue.film)), true);
});

test("Space and k on the focused scrub or Gantt play and pause the film (preventDefault, so the page never scrolls); the scrub's arrows stay native", async () => {
	await boot();
	const video = document.querySelector("[data-vpk-film-video]");
	const calls = [];
	let paused = true;
	Object.defineProperty(video, "paused", { configurable: true, get: () => paused });
	video.play = () => { calls.push("play"); paused = false; return Promise.resolve(); };
	video.pause = () => { calls.push("pause"); paused = true; };
	const key = (target, name) => {
		const event = new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
		target.dispatchEvent(event);
		return event.defaultPrevented;
	};
	const scrub = document.querySelector("[data-vpk-film-scrub]");
	assert.equal(key(scrub, " "), true, "Space on the scrub is handled");
	assert.equal(key(scrub, "k"), true, "k on the scrub is handled");
	assert.equal(key(scrub, "ArrowRight"), false, "→ on the scrub is left to the range input");
	assert.equal(key(scrub, "Home"), false, "Home on the scrub is left to the range input");
	const gantt = document.querySelector("[data-vpk-gantt]");
	assert.equal(key(gantt, " "), true, "Space on the Gantt is handled");
	assert.equal(key(gantt, "k"), true, "k on the Gantt is handled");
	assert.deepEqual(calls, ["play", "pause", "play", "pause"]);
	const select = document.createElement("select");
	document.querySelector("[data-vpk-film]").append(select);
	assert.equal(key(select, " "), false, "other fields inside the film keep their keys");
	assert.deepEqual(calls, ["play", "pause", "play", "pause"]);
});

/** J5 markup: film data that names a poster time, with the video carrying a baked poster (or not). */
function posterBody({ poster }) {
	const data = JSON.stringify({ ...JSON.parse(FILM_DATA), posterTime: 3.3 });
	return bodyMarkup().replace(FILM_DATA, data).replace('<video src="data:video/mp4;base64,AAAA"', `<video src="data:video/mp4;base64,AAAA"${poster ? ' poster="data:image/webp;base64,AAAA"' : ""}`);
}

test("J5: a baked poster of film 3.30 s reads 'film 3.30 s' (readout, scrub, beat, Gantt head) until the first play, which starts at 0", async () => {
	const lab = await boot({ body: posterBody({ poster: true }) });
	const film = lab.film();
	const readout = () => document.querySelector("[data-vpk-film-time] > b").textContent;
	assert.equal(readout(), "3.30", "the readout names the frame the poster shows");
	assert.ok(Math.abs(film.time - 3.3) < 1e-9, `film.time ${film.time}`);
	// r1.1: the authored scrub has max="1" (the range input clamps a value above it). The scrub must already hold the poster
	// time at load, before any metadata event, and still hold it after metadata, with no hand-made render() in between.
	const scrub = document.querySelector("[data-vpk-film-scrub]");
	assert.match(BODY, /data-vpk-film-scrub[^>]*max="1"/, "fixture: the authored max is 1, which would clamp 3.3 to 1");
	assert.equal(scrub.value, "3.300", "the scrub holds the poster time at load, not the authored max");
	assert.equal(scrub.max, "6.000", "the scrub's max is the film duration before metadata, from the film data");
	const metadata = document.querySelector("[data-vpk-film-video]");
	Object.defineProperty(metadata, "duration", { configurable: true, value: 6.0333 });
	metadata.dispatchEvent(new Event("loadedmetadata"));
	assert.equal(scrub.max, "6.033", "metadata replaces the data duration");
	assert.equal(scrub.value, "3.300", "and after loadedmetadata, with no manual render");
	assert.equal(document.querySelector("[data-vpk-cue='cue-2']").classList.contains("is-current"), true, "the cue at 3.30 s is current");
	assert.equal(document.querySelector("[data-vpk-gantt]").getAttribute("aria-valuenow"), "3.30");
	const video = document.querySelector("[data-vpk-film-video]");
	video.play = () => Promise.resolve();
	film.play();
	film.render();
	assert.equal(readout(), "0.00", "play starts at 0, and the readout follows");
	assert.equal(film.time, 0);
	await boot({ body: posterBody({ poster: true }) });
	document.querySelector("[data-vpk-film-step='1']").click();
	assert.equal(document.querySelector("[data-vpk-film-time] > b").textContent, "3.33", "a frame step starts from the shown frame");
});

test("J5: without a baked poster the runtime seeks to the poster time and the readout agrees with that frame", async () => {
	const lab = await boot({ body: posterBody({ poster: false }) });
	const video = document.querySelector("[data-vpk-film-video]");
	assert.equal(document.querySelector("[data-vpk-film-time] > b").textContent, "0.00", "nothing shown yet: film 0");
	video.dispatchEvent(new Event("loadeddata"));
	assert.ok(Math.abs(video.currentTime - 3.3) < 1e-9, "the runtime seeked to the poster time");
	assert.equal(document.querySelector("[data-vpk-film-time] > b").textContent, "3.30");
	assert.ok(Math.abs(lab.film().time - 3.3) < 1e-9);
	document.querySelector("[data-vpk-cue='cue-1']").click();
	assert.equal(document.querySelector("[data-vpk-film-time] > b").textContent, "0.00", "any seek leaves the poster state");
});

test("K26: keys and clicks from inside the WS1 review host's open shadow root never reach the film or the Gantt", async () => {
	const lab = await boot();
	const film = lab.film();
	const video = document.querySelector("[data-vpk-film-video]");
	const calls = [];
	video.play = () => { calls.push("play"); return Promise.resolve(); };
	video.pause = () => calls.push("pause");
	const fire = (target, init, type = "keydown") => {
		const event = type === "keydown" ? new KeyboardEvent(type, { bubbles: true, composed: true, cancelable: true, ...init }) : new MouseEvent(type, { bubbles: true, composed: true, cancelable: true, ...init });
		target.dispatchEvent(event);
		return event.defaultPrevented;
	};
	for (const selector of ["[data-vpk-film]", "[data-vpk-gantt]"]) {
		const container = document.querySelector(selector);
		const host = document.createElement("div");
		host.setAttribute("data-vpk-review-ui", "");
		const field = document.createElement("textarea");
		host.attachShadow({ mode: "open" }).append(field);
		container.append(host);
		for (const key of [" ", "k", "ArrowRight", "End", "3"]) assert.equal(fire(field, { key }), false, `${selector}: ${JSON.stringify(key)} typed in the review UI is left alone`);
		assert.equal(fire(field, { clientX: 400, clientY: 10 }, "click"), false);
		host.remove();
	}
	assert.deepEqual(calls, [], "the film never played or paused");
	assert.ok(film.time < 0.01, `the film never seeked (t ${film.time})`);
	assert.equal(fire(document.querySelector("[data-vpk-gantt]"), { key: "ArrowRight" }), true, "the same key outside the review UI is handled");
	assert.ok(film.time > 0.05, `ArrowRight on the Gantt itself seeks (t ${film.time})`);
});

test("a lab without its root errors, except in the docnav presenter window (which swaps the body for its notes)", async () => {
	const lab = await boot();
	const errors = [];
	const original = console.error;
	console.error = (...args) => errors.push(args.join(" "));
	try {
		assert.equal(lab.lab("absent-one", { draw() {} }), null);
		assert.equal(errors.length, 1);
		assert.match(errors[0], /no \[data-vpk-lab="absent-one"\] element/);
		document.documentElement.setAttribute("data-vpk-presenter", "true");
		document.body.className = "vpk-presenter-window";
		assert.equal(lab.lab("absent-two", { draw() {} }), null);
		assert.equal(errors.length, 1, "quiet in the presenter window");
	} finally {
		console.error = original;
		document.documentElement.removeAttribute("data-vpk-presenter");
		document.body.className = "";
	}
});

test("lab canvases follow their rendered width: api.scale and api.px(n), and data-vpk-canvas-min-height grows the logical height", async () => {
	const observers = [];
	const NativeObserver = globalThis.ResizeObserver;
	globalThis.ResizeObserver = class {
		constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
		observe(target) { this.targets.push(target); }
		disconnect() {}
	};
	try {
		const lab = await boot();
		const api = lab.lab("easing", { draw() {} });
		const canvas = document.querySelector("[data-vpk-lab-canvas]");
		const observer = observers.find(item => item.targets.includes(canvas));
		assert.ok(observer, "the lab observes its canvas");
		assert.deepEqual([api.scale, api.px(12), api.h], [1, 12, 300]);
		observer.callback([{ target: canvas, contentRect: { width: 1110 } }]);
		assert.deepEqual([api.h, api.px(12)], [300, 12], "wide: authored height, text at its own size");
		observer.callback([{ target: canvas, contentRect: { width: 309 } }]);
		assert.equal(api.h, Math.round((200 * 960) / 309), "narrow: the logical height grows so the canvas renders 200 CSS px tall");
		assert.equal(canvas.height, api.h * Math.min(2, globalThis.devicePixelRatio || 1));
		assert.ok(Math.abs(api.px(12) - (12 * 960) / 309) < 1e-9, `api.px(12) = ${api.px(12)}`);
		assert.equal(canvas.getAttribute("data-vpk-canvas-size"), "960 300", "the authored size is kept for re-init");
		observer.callback([{ target: canvas, contentRect: { width: 1110 } }]);
		assert.equal(api.h, 300, "widening restores the authored height");
	} finally {
		globalThis.ResizeObserver = NativeObserver;
	}
});

test("a queued lab defined before init is constructed exactly once", async () => {
	let setups = 0;
	const lab = await boot({ wrapDoc: def => ({ ...def, setup(api) { setups += 1; return def.setup.call(this, api); } }) });
	assert.equal(setups, 1);
	const again = lab.lab("easing", { draw() {} });
	assert.equal(again.id, "easing");
	globalThis.vpkLabQueue.push(["easing", { draw() {} }]);
	assert.equal(setups, 1, "later registrations of the same id reuse the first");
	assert.equal(document.querySelectorAll("[data-vpk-readout] > span").length, 3, "readout cells are created once");
});

test("widgets: filters hide by kind, flips swap faces, the layer select copies its detail", async () => {
	await boot();
	document.querySelector("[data-vpk-filter='build']").click();
	const hidden = [...document.querySelectorAll("[data-kind]")].map(node => node.classList.contains("vpk-is-filtered"));
	assert.deepEqual(hidden, [true, false]);
	assert.deepEqual([...document.querySelectorAll(".day")].map(node => node.classList.contains("vpk-is-filtered")), [true, false]);
	document.querySelector("[data-vpk-filter='all']").click();
	assert.equal(document.querySelectorAll(".vpk-is-filtered").length, 0);
	const flip = document.querySelector("[data-vpk-flip]");
	flip.click();
	assert.equal(flip.getAttribute("aria-pressed"), "true");
	assert.equal(flip.querySelector("[data-face='front']").getAttribute("aria-hidden"), "true");
	assert.equal(flip.querySelector("[data-face='back']").getAttribute("aria-hidden"), "false");
	document.querySelector("[data-vpk-select='layers'][data-index='1']").click();
	assert.equal(document.querySelector("[data-vpk-select-detail] .vpk-select-body").textContent, "{{What this layer does.}}");
	assert.equal(document.querySelector(".vpk-layer-plane[data-index='1']").classList.contains("is-selected"), true);
	assert.equal(document.querySelector(".vpk-layer-plane[data-index='0']").classList.contains("is-selected"), false);
});

test("the legacy lightbox fallback attaches only when an old enhancer is on the page at init", async () => {
	const reached = [];
	const listener = event => reached.push(event.target.tagName);
	document.addEventListener("click", listener);
	const clickCanvas = () => document.querySelector("[data-vpk-lab-canvas]").dispatchEvent(new MouseEvent("click", { bubbles: true }));
	const clickButton = () => document.querySelector("[data-vpk-lab-reset]").dispatchEvent(new MouseEvent("click", { bubbles: true }));
	try {
		await boot({ body: bodyMarkup({ enhancer: "<script data-vpkh-enhance>const skipSelector = '.vpkh-lightbox';</script>" }) });
		clickCanvas();
		clickButton();
		assert.deepEqual(reached, ["BUTTON"], "an old enhancer: visual clicks stop at the kit root, control clicks still bubble");
		reached.length = 0;
		await boot({ body: bodyMarkup({ enhancer: "<script data-vpkh-enhance>const optOutSelector = \"[data-vpkh-no-lightbox]\";</script>" }) });
		clickCanvas();
		assert.deepEqual(reached, ["CANVAS"], "a current enhancer: no propagation-stopping listener");
		reached.length = 0;
		await boot();
		clickCanvas();
		assert.deepEqual(reached, ["CANVAS"], "no enhancer: nothing attached");
	} finally {
		document.removeEventListener("click", listener);
	}
});

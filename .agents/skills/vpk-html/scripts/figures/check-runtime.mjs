#!/usr/bin/env node
/*
 * figures/check-runtime — anatomy hero runtime checks in headless Chromium, plus contact sheets
 * (ws4b spec sections 6.7 and 7.3; integration K4, K5, K13, R33).
 *
 *   node .agents/skills/vpk-html/scripts/figures/check-runtime.mjs <file.html> [--out <dir>] [--json]
 *
 * Per hero, in light and dark: B18 the plate fills the hero and the drawing its room at 390 and 1280 px (first; a
 * collapsed hero skips the rest), B3 sleeps off-screen, B4 reduced motion is still and still answers, B5 the
 * readout and ARIA equal present(model(input)) from the hero module (reduced motion, and under full motion within
 * 3 s of Home and End), B6 no page errors or console errors in the reduced-motion page or either full-motion page
 * (B5 full, the idle tour) and fonts load (recorded last, after the full-motion phases), B7 print
 * rest pose and tour resume, B9a no lightbox, B11 idle tour (pauses on hover, focus and leave timing), B12
 * grayscale fills and strokes (channel spread <= 16), B14 plate corners fit at 320, 390 and 600 px with the
 * longest readout (inside the inset, no overlaps, plate inside the viewport), B15 the tour stops when the
 * reduced-motion media feature turns on mid-tour and returns within resume + 1 s once it is cleared, B16 every
 * HTML text run in the hero at >= 4.5:1 on its background (WCAG 1.4.3), B17 the plate corners inside the viewport
 * and clear of the scroll fades and docnav after Tab reaches the stage and with the plate centred (1280x800,
 * 1280x720, 1440x900, 1920x1080, 390x664), and B2 at most one outstanding rAF while touring. On a page that also
 * carries an iso-kit figure (Tier B): B12 iso (the iso figure is grayscale apart from the one accent of iso/accent.mjs) and B2 mixed (the hero tours while the
 * pointer sweeps each iso stage in turn in a tall viewport: at most one outstanding rAF, both boards on the one
 * vpkFrameLoop, visible and awake together). B10 enhancer idle runs once per theme on every page: a reduced-motion
 * page settled 1.5 s makes 0 rAF calls over 2 s. A page with iso-kit figures and no hero (the default engine) skips the
 * hero phases and runs B6 (page and console errors on the reduced-motion and the full-motion page, fonts loaded),
 * B12 iso (grayscale plus the one accent) and B2 idle (0 rAF calls in 1 s once the figures settle) plus B10. A page with neither root
 * fails "B0 heroes" (with any H6 marker issue); an error a step throws fails "B0 error" for that hero and theme.
 * --out (default output/vpk-html/figures/<basename>/) writes <id>-<theme>-{rest,min,max}.png, a 4x crop
 * <id>-<theme>-zoom4.png, <id>-print.png and <basename>-contact.png. Exit 1 on any failed check, 2 on usage.
 * Hero modules are loaded from each region's src (relative to the document). Needs the unsandboxed shell.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { islandTour } from "../anatomy/hero.mjs";
import { verifyRegisteredFonts } from "../font-faces.mjs";
import { ACCENT_FACES } from "../iso/accent.mjs";
import { anatomyMarkers, anatomyRegions, engineRoots } from "./check-figures.mjs";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..", "..", "..", "..", "..");
const SPREAD_LIMIT = 16;

// Counts rAF calls and outstanding callbacks; the frame loop resolves window.requestAnimationFrame lazily.
const RAF_PROBE = () => {
	const raf = window.requestAnimationFrame.bind(window);
	const caf = window.cancelAnimationFrame.bind(window);
	const pending = new Set();
	window.__vpkRaf = { calls: 0, outstanding: () => pending.size };
	window.requestAnimationFrame = fn => {
		window.__vpkRaf.calls += 1;
		const id = raf(time => {
			pending.delete(id);
			fn(time);
		});
		pending.add(id);
		return id;
	};
	window.cancelAnimationFrame = id => {
		pending.delete(id);
		caf(id);
	};
};

export function defaultRuntimeOut(file) {
	return path.join(REPO_ROOT, "output", "vpk-html", "figures", path.basename(file, path.extname(file)));
}

async function heroSpecs(file) {
	const html = fs.readFileSync(file, "utf8");
	const specs = [];
	for (const root of anatomyRegions(html).roots) {
		const src = root.region?.src;
		const mod = src ? await import(pathToFileURL(path.resolve(path.dirname(file), src)).href) : null;
		const stage = mod?.hero?.stage ?? null;
		const presentAt = value => mod.present(mod.model(value, mod.data), mod.data);
		specs.push({ id: root.id, mod, stage, presentAt });
	}
	return specs;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function open(browser, file, { theme, motion = "reduce", scale = 1, errors = null }) {
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme, reducedMotion: motion, deviceScaleFactor: scale });
	// A step that cannot act (an invisible stage) fails as "B0 error" in 10 s rather than Playwright's 30.
	context.setDefaultTimeout(10000);
	await context.addInitScript(RAF_PROBE);
	const page = await context.newPage();
	if (errors) {
		page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
		page.on("console", message => {
			if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
		});
	}
	await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
	await page.evaluate(value => {
		document.documentElement.dataset.theme = value;
	}, theme);
	return { context, page };
}

const sel = id => ({ root: `[data-vpk-figure="${id}"]`, stage: `[data-vpk-figure="${id}"] .iso-stage`, plate: `[data-vpk-figure="${id}"] .iso-plate`, readout: `[data-vpk-figure="${id}"] [data-readout]` });
const readout = (page, id) => page.locator(sel(id).readout).textContent();
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
// After a viewport change: two frames, then every running CSS transition to its end (capped at 1 s). The shared
// `transition: all .2s` animates a template's breakpoint padding, so layout probes would read a mid-resize column.
const settled = page => page.evaluate(async () => {
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	const running = document.getAnimations().filter(animation => animation instanceof CSSTransition && animation.playState === "running");
	await Promise.race([Promise.all(running.map(animation => animation.finished.catch(() => null))), new Promise(resolve => setTimeout(resolve, 1000))]);
});

// B14 widths: the stacked corner layout (<= 560px) at a small and the reference phone width, and the band where
// the hint shares the bottom row with the readout on a narrow plate.
export const FIT_WIDTHS = Object.freeze([320, 390, 600]);

// The longest readout a slider can present across its input range (the stamped one for other roles).
function longestReadout({ stage, presentAt }) {
	const input = stage?.role === "slider" ? stage.input : null;
	if (!input) return null;
	let longest = "";
	for (let index = 0, count = Math.round((input.max - input.min) / input.step); index <= count; index++) {
		const text = presentAt(Math.min(input.max, input.min + index * input.step)).readout;
		if (text.length > longest.length) longest = text;
	}
	return longest;
}

// In the page: sets the readout (when given), then lists corner text running past the plate inset's left or right
// edge, overlapping corners,
// and a plate wider than the viewport.
export const CORNER_FIT = async ({ selector, text }) => {
	await document.fonts.ready;
	const root = document.querySelector(selector);
	const readoutEl = root.querySelector("[data-readout]");
	if (text && readoutEl) {
		if (readoutEl.firstChild) readoutEl.firstChild.data = text;
		else readoutEl.textContent = text;
	}
	const inset = root.querySelector(".iso-plate-corners").getBoundingClientRect();
	const plate = root.querySelector(".iso-plate").getBoundingClientRect();
	const textRect = el => {
		const range = document.createRange();
		range.selectNodeContents(el);
		const rects = [...range.getClientRects()].filter(rect => rect.width > 0);
		if (!rects.length) return null;
		return { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)), top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)) };
	};
	const corners = [...root.querySelectorAll(".iso-plate-corner")].map(el => ({ name: el.dataset.corner, rect: textRect(el) })).filter(corner => corner.rect);
	const issues = [];
	if (plate.left < -0.5 || plate.right > innerWidth + 0.5) issues.push(`plate spans ${Math.round(plate.left)}–${Math.round(plate.right)} px in a ${innerWidth} px viewport`);
	for (const { name, rect } of corners) {
		// Horizontal only: at line-height 1 the glyph boxes overhang the line box by a pixel or two, harmlessly.
		if (rect.left < inset.left - 0.5 || rect.right > inset.right + 0.5) {
			issues.push(`${name} text spans ${Math.round(rect.left)}–${Math.round(rect.right)} px, outside the inset ${Math.round(inset.left)}–${Math.round(inset.right)} px`);
		}
	}
	for (let i = 0; i < corners.length; i++) {
		for (let j = i + 1; j < corners.length; j++) {
			const [a, b] = [corners[i].rect, corners[j].rect];
			if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) issues.push(`${corners[i].name} and ${corners[j].name} overlap`);
		}
	}
	return issues;
};

// B16: every HTML text node in the hero (plate corners, legend keys, caption) against the background it sits on,
// composited up the ancestors; visually hidden live regions are skipped. Returns [{ text, ratio, size }].
export const TEXT_CONTRAST = selector => {
	const parse = value => {
		const rgb = value.match(/^rgba?\(([^)]+)\)$/);
		if (rgb) {
			const [r, g, b, a = 1] = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
			return [r, g, b, a];
		}
		const srgb = value.match(/^color\(srgb ([^)]+)\)$/);
		if (srgb) {
			const [r, g, b, a = 1] = srgb[1].split(/[\s/]+/).filter(Boolean).map(Number);
			return [r * 255, g * 255, b * 255, a];
		}
		return null;
	};
	const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
	const background = el => {
		const layers = [];
		for (let node = el; node; node = node.parentElement) {
			const color = parse(getComputedStyle(node).backgroundColor);
			if (color && color[3] > 0) layers.push(color);
			if (color && color[3] >= 1) break;
		}
		return layers.reduceRight((under, top) => over(top, under), [255, 255, 255, 1]);
	};
	const luminance = color => {
		const [r, g, b] = color.slice(0, 3).map(c => c / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const out = [];
	const root = document.querySelector(selector);
	for (const el of root.querySelectorAll("*")) {
		if (el.closest("svg") || el.closest("[aria-live]")) continue;
		if (![...el.childNodes].some(node => node.nodeType === 3 && node.data.trim())) continue;
		const style = getComputedStyle(el);
		if (style.display === "none" || style.visibility === "hidden" || !el.getClientRects().length) continue;
		const bg = background(el);
		const fg = parse(style.color);
		if (!fg) {
			out.push({ text: el.textContent.trim().slice(0, 40), ratio: 0, size: style.fontSize, unparsed: style.color });
			continue;
		}
		const [a, b] = [luminance(over(fg, bg)), luminance(bg)].sort((x, y) => y - x);
		out.push({ text: el.textContent.trim().slice(0, 40), ratio: Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100, size: style.fontSize });
	}
	return out;
};
export const CONTRAST_MIN = 4.5;

// B17 viewports: desktop heights where the full-width stage pushed the readout below the fold or under the shell's
// fades, a short phone, and the short ones where the fixed 240px drawing floor did (WCAG 1.4.4): 1280x800,
// 1280x720, 1366x768 and 1440x900 at 200% zoom, and phone landscape.
export const VISIBLE_VIEWPORTS = Object.freeze([
	[1280, 800], [1280, 720], [1440, 900], [1920, 1080], [390, 664],
	[640, 400], [640, 360], [683, 384], [720, 450], [844, 390],
]);

// B17: plate corners (fig, title, hint, readout) inside the viewport, clear of the visible scroll fades and the fixed
// docnav controls. Returns a list of issues.
export const CORNERS_VISIBLE = selector => {
	const root = document.querySelector(selector);
	const hits = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
	const fades = [...document.querySelectorAll(".vpkh-scroll-fade")].filter(el => Number(getComputedStyle(el).opacity) > 0.05).map(el => ({ name: `${el.dataset.edge} fade`, rect: el.getBoundingClientRect() }));
	const fixed = [...document.querySelectorAll(".docnav-controls, [data-vpk-theme-toggle]")].map(el => ({ name: el.className || "theme toggle", rect: el.getBoundingClientRect() }));
	const issues = [];
	for (const corner of root.querySelectorAll(".iso-plate-corner")) {
		const rect = corner.getBoundingClientRect();
		if (!rect.width || getComputedStyle(corner).display === "none") continue;
		const name = corner.dataset.corner;
		if (rect.top < 0 || rect.bottom > innerHeight) issues.push(`${name} at ${Math.round(rect.top)}–${Math.round(rect.bottom)} px is outside the ${innerHeight} px viewport`);
		for (const cover of [...fades, ...fixed]) if (hits(rect, cover.rect)) issues.push(`${name} is under the ${cover.name}`);
	}
	return issues;
};

// B18 viewports: the layout probe runs before anything clicks or hovers the stage.
export const LAYOUT_VIEWPORTS = Object.freeze([[390, 844], [1280, 900]]);

// B18: the plate fills the hero's column and the drawing fills the room its CSS allows (the stage's content width,
// 920px, and the max-height cap at the viewBox ratio). A page rule that collapses the figure (the identity block's
// figure{display:flex!important} once did) fails here by name instead of timing out a click. Returns a list of issues.
export const HERO_LAYOUT = selector => {
	const root = document.querySelector(selector);
	const plate = root?.querySelector(".iso-plate");
	const stage = root?.querySelector(".iso-stage");
	const svg = stage?.querySelector("svg");
	if (!plate || !stage || !svg) return [`missing ${!plate ? ".iso-plate" : !stage ? ".iso-stage" : "the stage <svg>"}`];
	const box = el => el.getBoundingClientRect();
	const [r, p, s] = [box(root), box(plate), box(svg)];
	if (r.width < 1 || r.height < 1) return [`the hero root renders ${Math.round(r.width)}x${Math.round(r.height)} (display:none or a hidden slide?)`];
	const issues = [];
	if (p.width < r.width - 1) issues.push(`plate ${Math.round(p.width)} px wide in a ${Math.round(r.width)} px hero (the figure no longer stretches it)`);
	const style = getComputedStyle(stage);
	const room = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
	const view = svg.viewBox.baseVal;
	const capped = view && view.height ? parseFloat(getComputedStyle(svg).maxHeight) * (view.width / view.height) : Infinity;
	const want = Math.min(room, 920, Number.isFinite(capped) ? capped : Infinity);
	if (s.width < 1 || s.height < 1 || s.width < want - 2) issues.push(`stage drawing ${Math.round(s.width)}x${Math.round(s.height)} px${want >= 1 ? `, want ${Math.round(want)} px wide` : ""}`);
	return issues;
};

// B15: reduce switched on mid-tour must stop the tour, and switched off again must bring it back within resume + 1 s.
// The media feature itself flips (emulateMedia), the path Chromium takes for the OS setting.
export async function reducedMotionToggle(page, id, tour) {
	const touring = () => page.evaluate(figure => window.vpkAnatomy.inspect(figure)?.touring === true, id);
	const waitTouring = async ms => {
		const start = Date.now();
		while (Date.now() - start < ms) {
			if (await touring()) return Date.now() - start;
			await wait(100);
		}
		return null;
	};
	const before = await waitTouring((tour.delay + tour.resume + 1) * 1000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await wait(800);
	const stopped = !(await touring());
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const resumed = await waitTouring((tour.resume + 1) * 1000);
	return { before, stopped, resumed };
}

async function rafCallsOver(page, ms) {
	const before = await page.evaluate(() => window.__vpkRaf.calls);
	await wait(ms);
	return (await page.evaluate(() => window.__vpkRaf.calls)) - before;
}

// Samples the readout every 100 ms for `ms`; returns [{ t, text }].
async function sampleReadout(page, id, ms, step = 100) {
	const samples = [];
	const start = Date.now();
	while (Date.now() - start <= ms) {
		samples.push({ t: Date.now() - start, text: await readout(page, id) });
		await wait(step);
	}
	return samples;
}

function rgbOf(value) {
	const rgb = value.match(/^rgba?\(([^)]+)\)$/);
	if (rgb) {
		const [r, g, b, a = 1] = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
		return { rgb: [r, g, b], alpha: a };
	}
	const srgb = value.match(/^color\(srgb ([^)]+)\)$/);
	if (srgb) {
		const parts = srgb[1].split(/[\s/]+/).filter(Boolean).map(Number);
		return { rgb: parts.slice(0, 3).map(v => v * 255), alpha: parts[3] ?? 1 };
	}
	return null;
}

// The iso kit's one accent (iso/accent.mjs): the focal part's three faces, the hovered part, the focal label chip, its ink
// text and the accent leader dot. Those colours are resolved inside the figure (so the theme's aliases apply) and are the
// only non-grey values B12 iso accepts; anything else outside the grey ramp still fails.
const ISO_ACCENT_PAINTS = [...Object.values(ACCENT_FACES), "var(--ill-accent-ink)"];

async function grayscaleIssues(page, id, root = sel(id).root, { accent = false } = {}) {
	const { colors, allowed } = await page.evaluate(({ selector, paints }) => {
		const out = [];
		const root = document.querySelector(selector);
		for (const el of [root, ...root.querySelectorAll("*")]) {
			const style = getComputedStyle(el);
			for (const property of ["fill", "stroke", "color"]) out.push({ tag: el.tagName.toLowerCase(), cls: el.getAttribute("class") ?? "", property, value: style[property] });
		}
		const allowed = [];
		const host = root.querySelector("svg") ?? root;
		for (const paint of paints) {
			const probe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			probe.style.fill = paint;
			host.appendChild(probe);
			allowed.push(getComputedStyle(probe).fill);
			probe.remove();
		}
		return { colors: out, allowed };
	}, { selector: root, paints: accent ? ISO_ACCENT_PAINTS : [] });
	const issues = [];
	for (const entry of colors) {
		if (!entry.value || entry.value === "none" || entry.value.startsWith("url(")) continue;
		if (allowed.includes(entry.value)) continue;
		const parsed = rgbOf(entry.value);
		if (!parsed) {
			issues.push(`${entry.tag}.${entry.cls} ${entry.property} ${entry.value} (unparsed)`);
			continue;
		}
		if (parsed.alpha === 0) continue;
		const spread = Math.max(...parsed.rgb) - Math.min(...parsed.rgb);
		if (spread > SPREAD_LIMIT) issues.push(`${entry.tag}.${entry.cls} ${entry.property} ${entry.value} spread ${spread.toFixed(1)}`);
	}
	return issues;
}

// B2 on a page with both engines (Tier B): the hero tours while the pointer sweeps the iso stage, so both boards
// wake on the one shared loop, and at most one rAF is ever outstanding. The probe is vacuous unless both stages were
// in view (the viewport is made tall enough) and both boards were awake at the same time, so those are required too.
export const ISO_STAGE = '[data-vpk-engine="iso-kit"] [data-vpk-iso-stage]';

export async function mixedLoopSample(page) {
	await page.setViewportSize({ width: 1280, height: 2400 });
	await settled(page);
	// Every iso stage is swept in turn (a locator on a page with two or more would be strict-mode ambiguous).
	const stages = page.locator(ISO_STAGE);
	const count = await stages.count();
	const perStage = count > 1 ? 30 : 60;
	const seen = { outstanding: 0, awake: 0, visible: 0, boards: 0, loop: false };
	for (let stage = 0; stage < count; stage++) {
		const target = stages.nth(stage);
		await target.evaluate(element => element.scrollIntoView({ block: "center" }));
		await wait(400);
		const box = await target.boundingBox();
		for (let index = 0; index < perStage; index++) {
			if (box && index % 10 === 0) await page.mouse.move(box.x + box.width * [0.3, 0.5, 0.7][(index / 10) % 3], box.y + box.height * 0.55, { steps: 3 });
			const sample = await page.evaluate(() => ({ outstanding: window.__vpkRaf.outstanding(), stats: window.vpkFrameLoop?.stats() ?? null }));
			seen.outstanding = Math.max(seen.outstanding, sample.outstanding);
			seen.loop = sample.stats !== null;
			seen.awake = Math.max(seen.awake, sample.stats?.awake ?? 0);
			seen.visible = Math.max(seen.visible, sample.stats?.visible ?? 0);
			seen.boards = Math.max(seen.boards, sample.stats?.boards ?? 0);
			await wait(50);
		}
	}
	await page.mouse.move(1, 1);
	const ok = count > 0 && seen.loop && seen.outstanding <= 1 && seen.boards >= 2 && seen.visible >= 2 && seen.awake >= 2;
	return { ok, seen, stages: count, detail: `at most ${seen.outstanding} outstanding rAF over ${((count * perStage * 50) / 1000).toFixed(1)} s with the hero touring and ${count} iso stage${count === 1 ? "" : "s"} hovered in turn; ${seen.boards} boards on one vpkFrameLoop, ${seen.visible} visible, ${seen.awake} awake at once` };
}

// B10 enhancer idle: on a settled reduced-motion page nothing asks for animation frames. Recorded once per theme,
// whatever the page carries (a hero, iso-kit figures or both).
async function enhancerIdle(browser, file, theme) {
	const { context, page } = await open(browser, file, { theme });
	try {
		await wait(1500);
		const before = await page.evaluate(() => window.__vpkRaf.calls);
		await wait(2000);
		const calls = (await page.evaluate(() => window.__vpkRaf.calls)) - before;
		return { ok: calls === 0, detail: `${calls} rAF calls in 2 s on the reduced-motion page, settled 1.5 s after load` };
	} finally {
		await context.close();
	}
}

// A page with iso-kit figures and no hero (the documented default engine). The hero phases are skipped; what a
// figure-only page can still break is checked: B6 no page or console errors on the reduced-motion and the
// full-motion page and fonts loaded, B12 iso every figure grayscale, and B2 idle no animation frames once the
// assemble motion has settled and the pointer is parked.
async function isoOnlyChecks(browser, file, isoIds, theme, record) {
	const errors = [];
	const reduced = await open(browser, file, { theme, errors });
	for (const id of isoIds) {
		const gray = await grayscaleIssues(reduced.page, id, `[data-vpk-figure="${id}"]`, { accent: true });
		record("B12 iso", id, theme, gray.length === 0, gray.slice(0, 3).join("; ") || `iso-kit figure fills, strokes and colours within spread ${SPREAD_LIMIT} or the iso accent`);
	}
	const fonts = await verifyRegisteredFonts(reduced.page);
	await reduced.context.close();
	const missing = fonts.filter(font => !font.loaded).map(font => font.family);
	const full = await open(browser, file, { theme, motion: "no-preference", errors });
	try {
		await full.page.mouse.move(1, 1);
		await full.page.evaluate(selector => document.querySelector(selector)?.scrollIntoView({ block: "center" }), ISO_STAGE);
		await wait(2500);
		const calls = await rafCallsOver(full.page, 1000);
		record("B2 idle", "-", theme, calls === 0, `${calls} rAF calls in 1000 ms with the pointer parked, after the iso figures settled`);
	} finally {
		await full.context.close();
	}
	record("B6", "-", theme, errors.length === 0 && missing.length === 0, [...errors, ...missing.map(family => `font ${family} did not load`)].join("; ") || "no page or console errors on the reduced-motion and the full-motion page, fonts loaded");
}

// One hero's checks in one theme; an error any step throws (a stage that never became clickable, a missing node)
// is a failed "B0 error" check naming it, so the gate reports a broken page instead of crashing.
async function guarded(record, id, theme, run) {
	try {
		await run();
	} catch (error) {
		record("B0 error", id, theme, false, `check-runtime stopped: ${String(error?.message ?? error).split("\n")[0]}`);
	}
}

// B5 full: under full motion the keys still land on present(model(input)) within 3 s. Home first, then End (End alone
// can show the rest reading, as the dial's block 1 does); each reading must be there 3 s after the key, settled.
async function fullMotionTruth(browser, file, { id, stage, presentAt }, theme, errors = null) {
	const { input } = stage;
	const s = sel(id);
	const { context, page } = await open(browser, file, { theme, motion: "no-preference", errors });
	try {
		await page.mouse.move(1, 1);
		await page.locator(s.plate).scrollIntoViewIfNeeded();
		await page.focus(s.stage);
		const settle = async (key, value) => {
			const want = presentAt(value);
			await page.keyboard.press(key);
			const start = Date.now();
			let first = null;
			while (Date.now() - start < 3000) {
				if (first === null && (await readout(page, id)) === want.readout) first = Date.now() - start;
				await wait(50);
			}
			const state = { text: await readout(page, id), now: Number(await page.getAttribute(s.stage, "aria-valuenow")), valueText: await page.getAttribute(s.stage, "aria-valuetext") };
			const ok = first !== null && state.text === want.readout && state.valueText === want.valueText && state.now === value;
			return { ok, detail: `${key} → "${state.text}" (${first === null ? "never matched" : `matched at ${first} ms`}), aria-valuenow ${state.now}` };
		};
		const home = await settle("Home", input.min);
		const end = await settle("End", input.max);
		return { ok: home.ok && end.ok, detail: `${home.detail}; ${end.detail}; want present(model(${input.min}/${input.max})) within 3 s` };
	} finally {
		await context.close();
	}
}

export async function checkFigureRuntime(file, { out = null, themes = ["light", "dark"] } = {}) {
	const abs = path.resolve(file);
	if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
	const specs = await heroSpecs(abs);
	// Tier B: the iso-kit figures sharing the page (B12 covers them too; B2 mixed hovers one).
	const isoIds = engineRoots(fs.readFileSync(abs, "utf8")).filter(root => root.engine === "iso-kit" && root.id).map(root => root.id);
	const checks = [];
	const captures = [];
	const record = (id, hero, theme, ok, detail = "") => checks.push({ id, hero, theme, ok: Boolean(ok), detail });
	// Nothing to check is a failure, not a pass: a page whose markers never paired (H6) has no hero root at all.
	// A page with iso-kit figures and no hero is the default engine: it skips the hero phases and runs the page-level checks.
	if (!specs.length && !isoIds.length) {
		const markers = anatomyMarkers(fs.readFileSync(abs, "utf8")).issues.map(issue => `${issue.id}: ${issue.message}`);
		record("B0 heroes", "-", "-", false, ['no data-vpk-engine="anatomy-hero" root in the page', ...markers].join("; "));
		return { file: abs, ok: false, checks, captures };
	}
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		for (const theme of themes) {
			if (!specs.length) {
				try {
					await isoOnlyChecks(browser, abs, isoIds, theme, record);
				} catch (error) {
					record("B0 error", "-", theme, false, `check-runtime stopped: ${String(error?.message ?? error).split("\n")[0]}`);
				}
				await guarded(record, "-", theme, async () => {
					const idle = await enhancerIdle(browser, abs, theme);
					record("B10", "-", theme, idle.ok, idle.detail);
				});
				continue;
			}
			for (const spec of specs) await guarded(record, spec.id, theme, async () => {
				const { id, stage, presentAt } = spec;
				const s = sel(id);
				const input = stage?.role === "slider" ? stage.input : null;

				// Reduced motion: B18 layout first (a collapsed hero cannot be clicked or hovered), then B4, B5, B6,
				// B7 (pose), B9a, B12 and the rest/min/max captures.
				const errors = [];
				const reduced = await open(browser, abs, { theme, errors });
				const { page } = reduced;
				const layout = [];
				for (const [width, height] of LAYOUT_VIEWPORTS) {
					await page.setViewportSize({ width, height });
					await settled(page);
					layout.push(...(await page.evaluate(HERO_LAYOUT, s.root)).map(issue => `${width}x${height}: ${issue}`));
				}
				record("B18 layout", id, theme, layout.length === 0, layout.length ? `${layout.slice(0, 3).join("; ")}; the remaining checks are skipped` : `plate fills the hero and the drawing its room at ${LAYOUT_VIEWPORTS.map(size => size.join("x")).join(", ")}`);
				if (layout.length) {
					await reduced.context.close();
					return;
				}
				// Room above and below the plate keeps it clear of the enhancer's edge scroll fades in the captures.
				await page.setViewportSize({ width: 1280, height: Math.max(900, Math.ceil((await page.locator(s.plate).boundingBox()).height + 320)) });
				await page.evaluate(selector => document.querySelector(selector).scrollIntoView({ block: "center" }), s.plate);
				await wait(500);
				const mutations = await page.evaluate(async selector => {
					let count = 0;
					const observer = new MutationObserver(records => (count += records.filter(record => record.type === "attributes").length));
					observer.observe(document.querySelector(selector), { attributes: true, subtree: true });
					await new Promise(resolve => setTimeout(resolve, 1500));
					observer.disconnect();
					return count;
				}, s.root);
				const restText = await readout(page, id);
				if (out) captures.push(await shot(page, s.plate, out, `${id}-${theme}-rest.png`));
				if (input) {
					await page.focus(s.stage);
					await page.keyboard.press("End");
					await frames(page);
					const atMax = { text: await readout(page, id), now: await page.getAttribute(s.stage, "aria-valuenow"), valueText: await page.getAttribute(s.stage, "aria-valuetext") };
					// When max presents the same reading as rest (the dial's block 1), Home must change it instead.
					const answerKey = atMax.text !== restText ? "End" : "Home";
					const press = async key => {
						await page.keyboard.press(key);
						await frames(page);
					};
					if (answerKey === "Home") await press("Home");
					const answered = await readout(page, id);
					record("B4", id, theme, mutations === 0 && answered !== restText, `${mutations} attribute mutations at rest over 1500 ms; ${answerKey} changed the readout to "${answered}"`);
					if (answerKey === "Home") await press("End");
					const max = presentAt(input.max);
					record("B5 max", id, theme, atMax.text === max.readout && atMax.valueText === max.valueText && Number(atMax.now) === input.max, `End → ${atMax.text} / aria-valuenow ${atMax.now}`);
					if (out) captures.push(await shot(page, s.plate, out, `${id}-${theme}-max.png`));
					await page.keyboard.press("Home");
					await frames(page);
					const min = presentAt(input.min);
					const atMin = { text: await readout(page, id), now: await page.getAttribute(s.stage, "aria-valuenow"), valueText: await page.getAttribute(s.stage, "aria-valuetext") };
					record("B5 min", id, theme, atMin.text === min.readout && atMin.valueText === min.valueText && Number(atMin.now) === input.min, `Home → ${atMin.text} / aria-valuenow ${atMin.now}`);
					if (out) captures.push(await shot(page, s.plate, out, `${id}-${theme}-min.png`));
					await page.keyboard.press("Escape");
					await page.keyboard.press("ArrowRight");
					await frames(page);
					const places = (String(input.step).split(".")[1] || "").length;
					const next = Number(Math.min(input.max, input.rest + input.step).toFixed(places));
					const stepped = presentAt(next);
					const atStep = { text: await readout(page, id), now: await page.getAttribute(s.stage, "aria-valuenow") };
					record("B5 step", id, theme, atStep.text === stepped.readout && Number(atStep.now) === next, `Escape, ArrowRight → ${atStep.text} / aria-valuenow ${atStep.now} (want ${next})`);
					await page.locator(s.stage).blur();
					const box = await page.locator(s.stage).boundingBox();
					await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
					await frames(page);
					const at20 = await readout(page, id);
					await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 4 });
					await frames(page);
					const at80 = await readout(page, id);
					record("B5 pointer", id, theme, at20 !== at80, `hover 20% → ${at20}; 80% → ${at80}`);
					await page.mouse.move(2, 2);
				} else {
					record("B4", id, theme, mutations === 0, `${mutations} attribute mutations at rest over 1500 ms`);
				}
				await page.click(s.stage, { position: { x: 20, y: 20 } });
				await wait(200);
				const lightbox = await page.evaluate(selector => ({ open: document.querySelectorAll(".vpkh-lightbox").length, zoomable: document.querySelector(selector).querySelectorAll(".vpkh-zoomable").length }), s.root);
				record("B9a", id, theme, lightbox.open === 0 && lightbox.zoomable === 0, `${lightbox.open} lightbox, ${lightbox.zoomable} zoomable nodes inside the hero`);
				const contrast = await page.evaluate(TEXT_CONTRAST, s.root);
				const low = contrast.filter(entry => entry.ratio < CONTRAST_MIN);
				record("B16 contrast", id, theme, contrast.length > 0 && low.length === 0, low.slice(0, 4).map(entry => `"${entry.text}" ${entry.ratio}:1`).join("; ") || `${contrast.length} text runs, lowest ${Math.min(...contrast.map(entry => entry.ratio))}:1 (>= ${CONTRAST_MIN}:1)`);
				const gray = await grayscaleIssues(page, id);
				await page.evaluate(selector => document.querySelector(`${selector} .iso-line`).setAttribute("data-tone", "red"), s.root);
				const redTone = await grayscaleIssues(page, id);
				record("B12", id, theme, gray.length === 0 && redTone.length === 0, gray.concat(redTone).slice(0, 3).join("; ") || `fills, strokes and colours within spread ${SPREAD_LIMIT} (data-tone="red" at runtime too)`);
				if (spec === specs[0]) {
					for (const isoId of isoIds) {
						const isoGray = await grayscaleIssues(page, isoId, `[data-vpk-figure="${isoId}"]`, { accent: true });
						record("B12 iso", isoId, theme, isoGray.length === 0, isoGray.slice(0, 3).join("; ") || `iso-kit figure fills, strokes and colours within spread ${SPREAD_LIMIT} or the iso accent`);
					}
				}
				await page.reload({ waitUntil: "load" });
				await page.evaluate(value => {
					document.documentElement.dataset.theme = value;
				}, theme);
				await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
				await page.emulateMedia({ media: "print" });
				const print = await page.evaluate(selector => {
					const root = document.querySelector(selector);
					const display = query => [...root.querySelectorAll(query)].map(el => getComputedStyle(el).display);
					return { hint: display('[data-corner="hint"]'), faceText: display(".iso-face-text"), plate: getComputedStyle(root.querySelector(".iso-plate")).display, transforms: root.querySelectorAll("[transform]:not(.iso-face-text)").length };
				}, s.root);
				record("B7 print", id, theme, print.hint.every(value => value === "none") && print.faceText.every(value => value === "none") && print.plate !== "none" && print.transforms === 0, JSON.stringify(print));
				if (out && theme === "light") captures.push(await shot(page, s.plate, out, `${id}-print.png`));
				await page.emulateMedia({ media: "screen" });
				const fonts = await verifyRegisteredFonts(page);
				await reduced.context.close();
				const missing = fonts.filter(font => !font.loaded).map(font => font.family);
				// B6 (decision 18d) spans every phase that runs the page's scripts: the reduced-motion page above, and the
				// full-motion pages below (B5 full, the idle tour), where the motion code that reduced motion skips runs. The
				// full-motion pages push into the same `errors`, and B6 is recorded once those phases are done.
				const finishB6 = phases => record("B6", id, theme, errors.length === 0 && missing.length === 0, [...errors, ...missing.map(family => `font ${family} did not load`)].join("; ") || `no page or console errors in ${phases}, fonts loaded`);

				// 4x crop of the stage centre (reduced motion, rest pose).
				if (out) {
					const zoom = await open(browser, abs, { theme, scale: 4 });
					await zoom.page.locator(s.plate).scrollIntoViewIfNeeded();
					await wait(300);
					const box = await zoom.page.locator(s.stage).boundingBox();
					const clip = { x: box.x + box.width / 2 - 160, y: box.y + box.height / 2 - 100, width: 320, height: 200 };
					const target = path.join(out, `${id}-${theme}-zoom4.png`);
					await zoom.page.screenshot({ path: target, clip });
					captures.push(target);
					await zoom.context.close();
				}

				// B14 corner fit at phone and narrow-tablet widths, with the longest readout the input can show.
				const fit = await open(browser, abs, { theme });
				const longest = longestReadout(spec);
				const misfits = [];
				for (const width of FIT_WIDTHS) {
					await fit.page.setViewportSize({ width, height: 900 });
					await settled(fit.page);
					misfits.push(...(await fit.page.evaluate(CORNER_FIT, { selector: s.root, text: longest })).map(issue => `${width}px: ${issue}`));
				}
				await fit.context.close();
				record("B14 fit", id, theme, misfits.length === 0, misfits.slice(0, 3).join("; ") || `corner text inside the plate inset, no overlaps, plate inside the viewport at ${FIT_WIDTHS.join(", ")} px with "${longest}"`);

				// B17 the corners stay readable while the hero is operated: after Tab reaches the stage, and with the plate
				// centred for pointer use.
				if (input) {
					const view = await open(browser, abs, { theme });
					const hidden = [];
					for (const [width, height] of VISIBLE_VIEWPORTS) {
						await view.page.setViewportSize({ width, height });
						await view.page.reload({ waitUntil: "load" });
						await view.page.evaluate(value => (document.documentElement.dataset.theme = value), theme);
						let reached = false;
						for (let index = 0; index < 40 && !reached; index++) {
							await view.page.keyboard.press("Tab");
							reached = await view.page.evaluate(selector => document.activeElement === document.querySelector(selector), s.stage);
						}
						await view.page.keyboard.press("Home");
						await wait(400);
						hidden.push(...(reached ? await view.page.evaluate(CORNERS_VISIBLE, s.root) : ["Tab never reached the stage"]).map(issue => `${width}x${height} Tab: ${issue}`));
						await view.page.locator(s.stage).blur();
						await view.page.evaluate(selector => document.querySelector(selector).scrollIntoView({ block: "center" }), s.plate);
						await wait(400);
						hidden.push(...(await view.page.evaluate(CORNERS_VISIBLE, s.root)).map(issue => `${width}x${height} centred: ${issue}`));
					}
					await view.context.close();
					record("B17 visible", id, theme, hidden.length === 0, hidden.slice(0, 3).join("; ") || `corners in view, clear of the fades and docnav after Tab and centred at ${VISIBLE_VIEWPORTS.map(size => size.join("x")).join(", ")}`);
				}

				if (input) {
					const truth = await fullMotionTruth(browser, abs, spec, theme, errors);
					record("B5 full", id, theme, truth.ok, truth.detail);
				}

				// Full motion: B11 idle tour, B2 one outstanding rAF, B3 sleeps off-screen, B7 tour resumes after print.
				// The timings the page's island carries: the module's own, or the 6.3 defaults it leaves out.
				const tour = input ? islandTour(stage.tour) : null;
				if (!tour) {
					finishB6(input ? "the reduced-motion page and B5 full" : "the reduced-motion page");
					return;
				}
				const full = await open(browser, abs, { theme, motion: "no-preference", errors });
				const fp = full.page;
				await fp.mouse.move(1, 1);
				await fp.locator(s.plate).scrollIntoViewIfNeeded();
				const idle = await sampleReadout(fp, id, 5000);
				const rest = presentAt(input.rest).readout;
				const early = idle.filter(sample => sample.t <= 500);
				const changed = idle.some(sample => sample.text !== rest);
				record("B11 tour", id, theme, early.every(sample => sample.text === rest) && changed, `rest "${rest}" until 0.5 s; ${changed ? "changed" : "no change"} by 5 s`);
				let maxOutstanding = 0;
				for (let index = 0; index < 60; index++) {
					maxOutstanding = Math.max(maxOutstanding, await fp.evaluate(() => window.__vpkRaf.outstanding()));
					await wait(50);
				}
				record("B2", id, theme, maxOutstanding <= 1 && (await fp.evaluate(() => typeof window.vpkFrameLoop?.register === "function")), `at most ${maxOutstanding} outstanding rAF while touring`);
				if (isoIds.length && (await fp.locator(ISO_STAGE).count())) {
					const mixed = await mixedLoopSample(fp);
					record("B2 mixed", id, theme, mixed.ok, mixed.detail);
					await fp.setViewportSize({ width: 1280, height: 900 });
					await settled(fp);
					await fp.evaluate(selector => document.querySelector(selector).scrollIntoView({ block: "center" }), s.plate);
					await wait(300);
				}
				const box = await fp.locator(s.stage).boundingBox();
				await fp.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
				await wait(1200);
				const hovered = await sampleReadout(fp, id, 2000);
				record("B11 hover", id, theme, hovered.every(sample => sample.text === hovered[0].text), `stable "${hovered[0].text}" for 2 s while hovering`);
				await fp.mouse.move(1, 1);
				const left = await sampleReadout(fp, id, 8000, 200);
				const firstChange = left.find(sample => sample.text !== left[0].text);
				record("B11 leave", id, theme, firstChange && firstChange.t >= tour.resume * 1000 - 200 && firstChange.t <= 8000, firstChange ? `changed ${(firstChange.t / 1000).toFixed(1)} s after pointerleave` : "no change within 8 s");
				// Focus takes over mid-tour; let the carriage land, then the tour must not resume while focused.
				await fp.focus(s.stage);
				await wait(1500);
				const focused = await sampleReadout(fp, id, 4000, 200);
				record("B11 focus", id, theme, focused.every(sample => sample.text === focused[0].text), `stable from 1.5 s to 5.5 s after focus (resume is ${tour.resume} s)`);
				await fp.locator(s.stage).blur();
				await fp.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
				await frames(fp);
				const printed = await fp.evaluate(selector => document.querySelector(selector).querySelectorAll("[transform]:not(.iso-face-text)").length, s.root);
				await fp.evaluate(() => window.dispatchEvent(new Event("afterprint")));
				const resumeStart = Date.now();
				let touring = false;
				while (!touring && Date.now() - resumeStart < (tour.resume + 1) * 1000) {
					touring = (await fp.evaluate(figure => window.vpkAnatomy.inspect(figure)?.touring, id)) === true;
					if (!touring) await wait(100);
				}
				record("B7 resume", id, theme, printed === 0 && touring, `${printed} transforms after beforeprint; tour ${touring ? `resumed in ${((Date.now() - resumeStart) / 1000).toFixed(1)} s` : "did not resume"}`);
				const toggle = await reducedMotionToggle(fp, id, tour);
				record("B15 reduce", id, theme, toggle.before !== null && toggle.stopped && toggle.resumed !== null, `touring before: ${toggle.before !== null}; stopped under reduce: ${toggle.stopped}; ${toggle.resumed === null ? `no tour within ${tour.resume + 1} s of clearing reduce` : `touring ${(toggle.resumed / 1000).toFixed(1)} s after clearing reduce`}`);
				await fp.evaluate(() => (document.body.style.paddingBottom = "300vh"));
				await fp.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
				await wait(600);
				const offscreen = await rafCallsOver(fp, 1000);
				record("B3", id, theme, offscreen === 0, `${offscreen} rAF calls in 1000 ms with the hero off-screen`);
				await full.context.close();
				finishB6("the reduced-motion page, B5 full and the idle-tour page");
			});
			await guarded(record, "-", theme, async () => {
				const idle = await enhancerIdle(browser, abs, theme);
				record("B10", "-", theme, idle.ok, idle.detail);
			});
		}
	} finally {
		await browser.close();
	}
	if (out && captures.length) captures.push(await contactSheet(captures, out, path.basename(abs, path.extname(abs))));
	return { file: abs, ok: checks.every(check => check.ok), checks, captures };
}

async function shot(page, selector, out, name) {
	fs.mkdirSync(out, { recursive: true });
	const target = path.join(out, name);
	await page.locator(selector).screenshot({ path: target });
	return target;
}

// A grid of every capture, screenshotted from a scratch page of <img> tiles (no image dependency).
async function contactSheet(files, out, basename) {
	const tiles = files.map(file => `<figure><img src="${pathToFileURL(file).href}" alt=""><figcaption>${path.basename(file)}</figcaption></figure>`).join("");
	const scratch = path.join(out, `${basename}-contact.html`);
	fs.writeFileSync(scratch, `<!doctype html><meta charset="utf-8"><style>body{margin:16px;font:12px monospace;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}img{width:100%;border:1px solid #ccc}figure{margin:0}</style>${tiles}`);
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
		await page.goto(pathToFileURL(scratch).href, { waitUntil: "load" });
		const target = path.join(out, `${basename}-contact.png`);
		await page.screenshot({ path: target, fullPage: true });
		return target;
	} finally {
		await browser.close();
		fs.rmSync(scratch, { force: true });
	}
}

async function main(argv) {
	let file = null;
	let out = null;
	let json = false;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--out" && argv[i + 1]) out = path.resolve(argv[++i]);
		else if (argv[i] === "--json") json = true;
		else if (!argv[i].startsWith("--") && !file) file = argv[i];
		else {
			console.error("Usage: check-runtime.mjs <file.html> [--out <dir>] [--json]");
			return 2;
		}
	}
	if (!file) {
		console.error("Usage: check-runtime.mjs <file.html> [--out <dir>] [--json]");
		return 2;
	}
	const result = await checkFigureRuntime(file, { out: out ?? defaultRuntimeOut(file) });
	if (json) console.log(JSON.stringify(result, null, 2));
	else {
		for (const check of result.checks) console.log(`${check.ok ? "✓" : "✗"} ${check.id.padEnd(10)} ${check.hero} · ${check.theme} · ${check.detail}`);
		if (result.captures.length) console.log(`captures: ${path.relative(process.cwd(), path.dirname(result.captures[0]))} (${result.captures.length} files)`);
	}
	return result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	process.exitCode = await main(process.argv.slice(2));
}

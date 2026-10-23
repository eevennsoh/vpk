// ws4b browser suite B2–B13 (spec section 7.3). Opt-in, never in the unit manifest (R25); needs Playwright
// Chromium and the unsandboxed shell:
//   VPK_HTML_BROWSER=1 node --test .agents/skills/vpk-html/scripts/figures/figures.browser.test.mjs
// Runs on the Tier A demo; the cases marked (B) and B8 (isolation and one look across engines) run on Tier B's
// demo-figure-engines.html and skip until it exists.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { islandTour } from "../anatomy/hero.mjs";
import { CONTRAST_MIN, CORNERS_VISIBLE, CORNER_FIT, HERO_LAYOUT, TEXT_CONTRAST, VISIBLE_VIEWPORTS, checkFigureRuntime, reducedMotionToggle } from "./check-runtime.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(HERE, "..");
const DEMOS = path.resolve(SCRIPTS, "..", "assets", "demos");
const DEMO = path.join(DEMOS, "demo-anatomy-hero.html");
const ENGINES = path.join(DEMOS, "demo-figure-engines.html");
const STATIC = path.join(DEMOS, "demo-svg-illustrations.html");
const skip = process.env.VPK_HTML_BROWSER === "1" ? false : "set VPK_HTML_BROWSER=1 to run the browser suite";
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const RAF_PROBE = () => {
	const raf = window.requestAnimationFrame.bind(window);
	window.__vpkRafCalls = 0;
	window.requestAnimationFrame = fn => {
		window.__vpkRafCalls += 1;
		return raf(fn);
	};
};

async function withPage(file, options, run) {
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
		await context.addInitScript(RAF_PROBE);
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));
		await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
		return await run(page, errors);
	} finally {
		await browser.close();
	}
}

test("B2–B7, B9a, B11, B12, B14–B17 on the Tier A demo (check-runtime, light and dark)", { skip }, async () => {
	const result = await checkFigureRuntime(DEMO);
	const failed = result.checks.filter(check => !check.ok).map(check => `${check.id} ${check.theme}: ${check.detail}`);
	assert.deepEqual(failed, []);
	const ran = new Set(result.checks.map(check => check.id.split(" ")[0]));
	for (const id of ["B2", "B3", "B4", "B5", "B6", "B7", "B9a", "B11", "B12", "B14", "B15", "B16", "B17", "B18"]) assert.ok(ran.has(id), `${id} ran`);
	assert.equal(result.checks.filter(check => check.id.startsWith("B5")).length, 10, "B5 max, min, step, pointer and full in both themes");
	assert.deepEqual(result.checks.filter(check => check.id === "B5 full").map(check => check.theme), ["light", "dark"], "B5 full: Home then End under full motion");
});

// A hero built into a template carrying the identity block (scripts/migrate-identity.mjs: figure{display:flex!important;
// align-items:center!important;...}, 27 of 35 templates) once collapsed to a 50px plate and a 0x0 drawing.
test("B18 identity template: a hero built into research-concept-explainer.html fills its column, and check-runtime names the collapse", { skip }, async () => {
	const { buildHeroFile } = await import(pathToFileURL(path.join(SCRIPTS, "anatomy", "build-hero.mjs")).href);
	const template = fs.readFileSync(path.join(SCRIPTS, "..", "assets", "templates", "research-concept-explainer.html"), "utf8");
	assert.ok(template.includes("/* vpk-algebrica-v2:start */") && /figure,\n\.pb-svg \{\n\tdisplay: flex !important;/.test(template), "the template carries the identity block's figure rule");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-anatomy-identity-"));
	fs.mkdirSync(path.join(dir, "_figures"));
	fs.copyFileSync(path.join(SCRIPTS, "anatomy", "fixtures", "carriage.hero.mjs"), path.join(dir, "_figures", "carriage.hero.mjs"));
	const file = path.join(dir, "explainer.html");
	const at = template.indexOf("</h2>") + "</h2>".length;
	fs.writeFileSync(file, `${template.slice(0, at)}\n<!-- vpk-anatomy-hero:start id="carriage" src="_figures/carriage.hero.mjs" -->\n<!-- vpk-anatomy-hero:end id="carriage" -->\n${template.slice(at)}`);
	assert.equal((await buildHeroFile(file)).heroes.length, 1);
	const selector = '[data-vpk-figure="carriage"]';
	const geometry = () => {
		const root = document.querySelector('[data-vpk-figure="carriage"]');
		const size = el => [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)];
		return { root: size(root), plate: size(root.querySelector(".iso-plate")), svg: size(root.querySelector(".iso-stage svg")), display: getComputedStyle(root.querySelector(".iso-figure")).display };
	};
	const stripIdentity = () => {
		for (const style of document.querySelectorAll("style")) {
			const start = style.textContent.indexOf("/* vpk-algebrica-v2:start */");
			if (start >= 0) style.textContent = style.textContent.slice(0, start) + style.textContent.slice(style.textContent.indexOf("/* vpk-algebrica-v2:end */"));
		}
	};
	for (const theme of ["light", "dark"]) {
		for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
			await withPage(file, { reducedMotion: "reduce", colorScheme: theme, viewport }, async (page, errors) => {
				await page.evaluate(value => (document.documentElement.dataset.theme = value), theme);
				// Stripping the identity block starts column transitions (main 650 px to 602 px over about 400 ms at 1280).
				// Without this, the stripped box depends on how late the measurement lands, so a loaded machine failed it.
				await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
				const label = `${theme} ${viewport.width}px`;
				assert.deepEqual(await page.evaluate(HERO_LAYOUT, selector), [], label);
				const shipped = await page.evaluate(geometry);
				assert.equal(shipped.display, "block", label);
				assert.ok(shipped.svg[0] > 200 && shipped.svg[1] > 100 && shipped.plate[0] === shipped.root[0], `${label}: ${JSON.stringify(shipped)}`);
				await page.evaluate(stripIdentity);
				const stripped = await page.evaluate(geometry);
				assert.equal(stripped.display, "block", `${label} stripped`);
				assert.ok(stripped.svg[0] > 200 && stripped.svg[1] > 100 && stripped.plate[0] === stripped.root[0], `${label} stripped: ${JSON.stringify(stripped)}`);
				// The identity block sets the page column, so the hero scales with it. Its own chrome and drawing ratio stay put.
				const near = (a, b) => Math.abs(a - b) <= 1;
				assert.ok(near(shipped.plate[0] - shipped.svg[0], stripped.plate[0] - stripped.svg[0]) && near(shipped.root[1] - shipped.plate[1], stripped.root[1] - stripped.plate[1]), `${label}: the identity block changes no hero chrome (${JSON.stringify({ shipped, stripped })})`);
				assert.ok(Math.abs(shipped.svg[0] / shipped.svg[1] - stripped.svg[0] / stripped.svg[1]) < 0.02, `${label}: the identity block changes the drawing ratio (${JSON.stringify({ shipped, stripped })})`);
				assert.deepEqual(errors, []);
			});
		}
	}
	// The pre-fix rule (no !important) collapses the hero again; the layout probe and check-runtime name it.
	const SHIPPED = "display:block!important;margin:32px 0 36px!important;text-align:left!important";
	const html = fs.readFileSync(file, "utf8");
	assert.equal(html.split(SHIPPED).length - 1, 1, "the page ships the hardened figure rule once");
	const mutant = path.join(dir, "explainer-prefix.html");
	fs.writeFileSync(mutant, html.replace(SHIPPED, "display:block;margin:32px 0 36px;text-align:left"));
	await withPage(mutant, { reducedMotion: "reduce", viewport: { width: 1280, height: 800 } }, async page => {
		const collapsed = await page.evaluate(geometry);
		assert.ok(collapsed.display === "flex" && collapsed.svg[0] === 0 && collapsed.plate[0] < 100, JSON.stringify(collapsed));
		const issues = await page.evaluate(HERO_LAYOUT, selector);
		assert.ok(issues.some(issue => /^plate \d+ px wide in a \d+ px hero/.test(issue)) && issues.some(issue => /^stage drawing 0x0 px/.test(issue)), issues.join("; "));
	});
	const runtime = await checkFigureRuntime(mutant, { themes: ["light"] });
	assert.equal(runtime.ok, false);
	// B10 is page-level and runs whether or not the hero collapsed; every hero check after B18 is skipped.
	assert.deepEqual(runtime.checks.filter(check => check.id !== "B10").map(check => `${check.id} ${check.ok}`), ["B18 layout false"], JSON.stringify(runtime.checks));
	assert.match(runtime.checks[0].detail, /plate \d+ px wide[\s\S]*the remaining checks are skipped/);
	fs.rmSync(dir, { recursive: true, force: true });
});

test("B14 bites: the vendored absolute, nowrap corners overflow the plate at phone widths", { skip }, async () => {
	// The pre-fix layout: corners absolutely placed with white-space:nowrap (the vendored kit CSS alone). The shipped CSS
	// drops the vendored corner offsets, inert on its static corners (round-4 budget fix), so they come back here too.
	const H = '[data-vpk-engine="anatomy-hero"] .iso-plate-corner';
	const VENDORED = `[data-vpk-engine="anatomy-hero"] .iso-plate-corners{display:block!important}${H}{position:absolute!important;line-height:1!important}${H}[data-corner="hint"]{white-space:nowrap!important}${H}[data-corner="fig"]{top:0;left:0}${H}[data-corner="title"]{top:0;right:0}${H}[data-corner="hint"]{bottom:0;left:0}${H}[data-corner="readout"]{right:0;bottom:0}@media (max-width:560px){${H}[data-corner="hint"]{bottom:18px}}`;
	for (const width of [390, 600]) {
		await withPage(DEMO, { reducedMotion: "reduce", viewport: { width, height: 900 } }, async page => {
			const args = { selector: '[data-vpk-figure="dial"]', text: "between blocks · reads 18.0 px" };
			assert.deepEqual(await page.evaluate(CORNER_FIT, args), [], `${width}px: the shipped corners fit`);
			await page.addStyleTag({ content: VENDORED });
			const issues = await page.evaluate(CORNER_FIT, args);
			assert.ok(issues.some(issue => (width === 390 ? /^hint text spans/ : /^hint and readout overlap/).test(issue)), `${width}px: ${issues.join("; ") || "no issue found"}`);
		});
	}
});

test("B15 bites: without the runtime's own reduced-motion listener the tour never comes back", { skip }, async () => {
	// Chromium drops the frame loop's change event for the switch to reduce while a board ticks (the loop reads
	// .matches every frame), and the loop's cached calm then swallows the switch back. A copy of the demo without the
	// mount runtime's own listener is the round-2 page, so the probe must report no resume there.
	const LISTENER = 'win.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener("change", event => resumeAll(event.matches));';
	const html = fs.readFileSync(DEMO, "utf8");
	assert.equal(html.split(LISTENER).length - 1, 1, "the demo inlines the listener once");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-anatomy-b15-"));
	const mutant = path.join(dir, "demo-anatomy-hero.html");
	fs.writeFileSync(mutant, html.replace(LISTENER, ""));
	const { hero } = await import(pathToFileURL(path.join(SCRIPTS, "anatomy", "examples", "dial-indicator.hero.mjs")).href);
	for (const [file, own] of [[DEMO, true], [mutant, false]]) {
		await withPage(file, { reducedMotion: "no-preference" }, async (page, errors) => {
			await page.mouse.move(1, 1);
			await page.locator('[data-vpk-figure="dial"] .iso-plate').scrollIntoViewIfNeeded();
			const toggle = await reducedMotionToggle(page, "dial", islandTour(hero.stage.tour));
			assert.ok(toggle.before !== null && toggle.stopped, `${own ? "shipped" : "mutant"}: touring, then stopped under reduce`);
			if (own) assert.ok(toggle.resumed !== null, "the shipped runtime resumes the tour");
			else assert.equal(toggle.resumed, null, "without its own listener the tour stays off");
			assert.deepEqual(errors, []);
		});
	}
	fs.rmSync(dir, { recursive: true, force: true });
});

test("B16 bites: the round-2 --subtlest-text corners and legend fail 4.5:1 in light", { skip }, async () => {
	await withPage(DEMO, { reducedMotion: "reduce", colorScheme: "light" }, async page => {
		const selector = '[data-vpk-figure="dial"]';
		assert.deepEqual((await page.evaluate(TEXT_CONTRAST, selector)).filter(entry => entry.ratio < CONTRAST_MIN), [], "the shipped tokens pass");
		await page.addStyleTag({ content: '[data-vpk-engine="anatomy-hero"]{--anatomy-muted:var(--subtlest-text)!important}' });
		const low = (await page.evaluate(TEXT_CONTRAST, selector)).filter(entry => entry.ratio < CONTRAST_MIN).map(entry => entry.text);
		assert.ok(low.includes("Dial indicator") && low.some(text => text.startsWith("Hover or use")) && low.length >= 5, low.join("; ") || "nothing found");
	});
});

test("B17 bites: an uncapped stage, a plate without scroll-margin, or the round-4 240px floor hides the readout", { skip }, async () => {
	const UNCAPPED = '[data-vpk-engine="anatomy-hero"] .iso-svg{width:100%!important;max-width:none!important;max-height:none!important}';
	const NO_MARGIN = '[data-vpk-engine="anatomy-hero"] .iso-plate{scroll-margin:0!important}';
	// The round-4 sizing: a 240px drawing floor and a fixed 80px margin, too tall for 200% zoom and phone landscape.
	const FLOOR = '[data-vpk-engine="anatomy-hero"] .iso-svg{max-height:max(240px,100vh - 300px)!important}[data-vpk-engine="anatomy-hero"] .iso-plate{scroll-margin:80px 0!important}';
	const selector = '[data-vpk-figure="dial"]';
	const cases = [[UNCAPPED, "centred", [1280, 800]], [NO_MARGIN, "tab", [1280, 800]], [FLOOR, "tab", [640, 360]], [FLOOR, "tab", [844, 390]], [FLOOR, "centred", [640, 400]]];
	const operate = async (page, how) => {
		if (how === "tab") {
			for (let index = 0; index < 40; index++) {
				await page.keyboard.press("Tab");
				if (await page.evaluate(s => document.activeElement === document.querySelector(`${s} .iso-stage`), selector)) break;
			}
		} else await page.evaluate(s => document.querySelector(`${s} .iso-plate`).scrollIntoView({ block: "center" }), selector);
		await wait(400);
		return page.evaluate(CORNERS_VISIBLE, selector);
	};
	for (const [css, how, [width, height]] of cases) {
		const viewport = { width, height };
		assert.ok(VISIBLE_VIEWPORTS.some(size => size.join("x") === `${width}x${height}`), `${width}x${height} is a B17 viewport`);
		// The shipped sizing keeps every corner clear at the same short viewport.
		if (css === FLOOR) await withPage(DEMO, { reducedMotion: "reduce", viewport }, async page => assert.deepEqual(await operate(page, how), [], `${width}x${height} ${how}: shipped`));
		await withPage(DEMO, { reducedMotion: "reduce", viewport }, async page => {
			await page.addStyleTag({ content: css });
			const issues = await operate(page, how);
			assert.ok(issues.some(issue => /^readout /.test(issue)), `${width}x${height} ${how}: ${issues.join("; ") || "no issue found"}`);
		});
	}
});

// Decision 18d: B6 once read only the reduced-motion page, so an error raised by motion code (which reduced motion
// skips) passed. The error below fires only when the page is not under reduced motion.
test("B6 bites: a console error that only full motion raises fails B6, and nothing else", { skip }, async () => {
	const html = fs.readFileSync(DEMO, "utf8");
	const at = html.lastIndexOf("</body>");
	assert.ok(at > 0);
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-anatomy-b6-"));
	const mutant = path.join(dir, "demo-anatomy-hero.html");
	const motionOnly = '<script>if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setTimeout(() => console.error("full-motion-only failure"), 600);</script>\n';
	// The region's src is relative to the demo's folder; the copy lives elsewhere, so point it at the module.
	const heroModule = path.join(SCRIPTS, "anatomy", "examples", "dial-indicator.hero.mjs");
	const copied = (html.slice(0, at) + motionOnly + html.slice(at)).replace(/(<!-- vpk-anatomy-hero:start id="dial" src=")[^"]*"/, `$1${heroModule}"`);
	assert.ok(copied.includes(heroModule));
	fs.writeFileSync(mutant, copied);
	const result = await checkFigureRuntime(mutant, { themes: ["light"] });
	assert.deepEqual(result.checks.filter(check => !check.ok).map(check => check.id), ["B6"], JSON.stringify(result.checks.filter(check => !check.ok)));
	const b6 = result.checks.filter(check => check.id === "B6");
	assert.equal(b6.length, 1, "B6 is recorded once per hero and theme");
	assert.match(b6[0].detail, /console\.error: full-motion-only failure/);
	fs.rmSync(dir, { recursive: true, force: true });
});

const skipTierB = skip || (!fs.existsSync(ENGINES) && "Tier B (P3) has not built demo-figure-engines.html yet");
// The shared stylesheet animates every colour change (`transition: all`), so computed styles read right after a theme
// switch are mid-transition. Tier B's style probes switch it off.
const NO_TRANSITIONS = "*,*::before,*::after{transition:none!important;animation-duration:0s!important}";

// Computed paint of every drawing element under `selector`, as one comparable string.
const paintOf = selector => {
	const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linejoin", "stroke-linecap", "vector-effect", "opacity", "fill-opacity", "stroke-opacity", "display"];
	return [...document.querySelectorAll(`${selector} :is(path, line, polyline, polygon, ellipse, circle, rect)`)].map(el => {
		const style = getComputedStyle(el);
		return props.map(prop => style.getPropertyValue(prop)).join("|");
	}).join("\n");
};

test("B2, B6 and B12 (B) on the Tier B demo: check-runtime runs the mixed-engine cases in light and dark", { skip: skipTierB }, async () => {
	const result = await checkFigureRuntime(ENGINES);
	const failed = result.checks.filter(check => !check.ok).map(check => `${check.id} ${check.theme}: ${check.detail}`);
	assert.deepEqual(failed, []);
	for (const theme of ["light", "dark"]) {
		const ids = result.checks.filter(check => check.theme === theme).map(check => check.id);
		for (const id of ["B2", "B2 mixed", "B6", "B12", "B12 iso", "B9a", "B5 full", "B11 tour", "B3"]) assert.ok(ids.includes(id), `${theme}: ${id} ran`);
	}
	const mixed = result.checks.find(check => check.id === "B2 mixed");
	assert.match(mixed.detail, /2 boards on one vpkFrameLoop, 2 visible, 2 awake at once/, "both engines were moving at the same time");
});

test("B8 isolation and one look across engines (Tier B)", { skip: skipTierB }, async () => {
	const fillsAt = (page, theme) => page.evaluate(value => {
		document.documentElement.dataset.theme = value;
		const fill = selector => getComputedStyle(document.querySelector(selector)).fill;
		const anatomy = '[data-vpk-engine="anatomy-hero"]';
		const iso = '[data-vpk-engine="iso-kit"]';
		return {
			anatomyTop: fill(`${anatomy} .iso-top`), isoTop: fill(`${iso} [data-vpk-iso-role="top"]`),
			anatomyNear: fill(`${anatomy} [data-shade="3"]`), isoNear: fill(`${iso} [data-vpk-iso-role="fill"]`),
			anatomyFar: fill(`${anatomy} [data-shade="2"]`), anatomyDeep: fill(`${anatomy} [data-shade="0"]`),
		};
	}, theme);
	const luminance = fill => {
		const [r, g, b] = fill.match(/[\d.]+/g).slice(0, 3).map(Number);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	await withPage(ENGINES, { reducedMotion: "reduce" }, async (page, errors) => {
		await page.addStyleTag({ content: NO_TRANSITIONS });
		for (const theme of ["light", "dark"]) {
			const fills = await fillsAt(page, theme);
			// K13 (amended at B2, decision 1): tops and near sides match; far sides need not, and the order holds.
			assert.equal(fills.anatomyTop, fills.isoTop, `${theme}: top faces resolve to the same fill`);
			assert.equal(fills.anatomyNear, fills.isoNear, `${theme}: near sides resolve to the same fill`);
			assert.ok(luminance(fills.anatomyTop) > luminance(fills.anatomyNear) && luminance(fills.anatomyNear) > luminance(fills.anatomyFar) && luminance(fills.anatomyFar) >= luminance(fills.anatomyDeep), `${theme}: luminance top > near > far >= deeper: ${JSON.stringify(fills)}`);
		}
		assert.deepEqual(errors, []);
	});
	// Isolation: each engine's block is the only thing styling its own figure, and neither styles the other.
	const heroPaint = '[data-vpk-engine="anatomy-hero"]';
	const isoPaint = '[data-vpk-engine="iso-kit"]';
	for (const theme of ["light", "dark"]) {
		const measure = async removed => withPage(ENGINES, { reducedMotion: "reduce" }, async page => {
			await page.addStyleTag({ content: NO_TRANSITIONS });
			await page.evaluate(value => (document.documentElement.dataset.theme = value), theme);
			if (removed) await page.evaluate(selector => document.querySelector(selector).remove(), removed);
			return { hero: await page.evaluate(paintOf, heroPaint), iso: await page.evaluate(paintOf, isoPaint) };
		});
		const whole = await measure(null);
		const noIso = await measure("style[data-vpk-iso-css]");
		const noAnatomy = await measure("style[data-vpk-anatomy-css]");
		assert.equal(noIso.hero, whole.hero, `${theme}: without the iso block the hero paints the same`);
		assert.equal(noAnatomy.iso, whole.iso, `${theme}: without the anatomy block the iso figure paints the same`);
		assert.notEqual(noIso.iso, whole.iso, `${theme}: the iso block does style the iso figure (the probe bites)`);
		assert.notEqual(noAnatomy.hero, whole.hero, `${theme}: the anatomy block does style the hero (the probe bites)`);
		assert.ok(whole.hero.length > 1000 && whole.iso.length > 500, `${theme}: both figures were measured`);
	}
});

test("B9a (B) the iso stage opens no lightbox and the page has no zoomable node inside either engine root", { skip: skipTierB }, async () => {
	await withPage(ENGINES, { reducedMotion: "reduce" }, async page => {
		await wait(500);
		await page.locator('[data-vpk-engine="iso-kit"] [data-vpk-iso-stage]').click({ position: { x: 20, y: 20 } });
		await wait(300);
		assert.deepEqual(await page.evaluate(() => ({
			open: document.querySelectorAll(".vpkh-lightbox").length,
			zoomable: document.querySelectorAll('[data-vpk-engine] .vpkh-zoomable, [data-vpk-engine].vpkh-zoomable').length,
		})), { open: 0, zoomable: 0 });
	});
});

test("B9b a static figure outside an opt-out root still opens the lightbox", { skip }, async () => {
	await withPage(STATIC, { reducedMotion: "reduce" }, async page => {
		await wait(500);
		const zoomable = page.locator(".vpkh-zoomable").first();
		assert.ok(await zoomable.count(), "the static demo has zoomable figures");
		await zoomable.click();
		await page.waitForSelector(".vpkh-lightbox", { timeout: 3000 });
	});
});

test("B10 enhancer idle: 0 rAF per second on the settled Tier A demo, the Tier B demo (when built) and a static demo", { skip }, async () => {
	for (const file of [DEMO, ...(fs.existsSync(ENGINES) ? [ENGINES] : []), STATIC]) {
		await withPage(file, { reducedMotion: "reduce" }, async (page, errors) => {
			await wait(1500);
			const before = await page.evaluate(() => window.__vpkRafCalls);
			await wait(2000);
			const calls = (await page.evaluate(() => window.__vpkRafCalls)) - before;
			assert.equal(calls, 0, `${path.basename(file)}: ${calls} rAF calls in 2 s idle`);
			assert.deepEqual(errors, []);
		});
	}
});

// A throwaway figure page: `iso` iso-kit figures (distinct ids) with or without the dial hero, through the same
// shell and runtime pipeline the engine demo uses.
async function enginePage(dir, name, { iso, hero }) {
	const [{ renderIsoFigure }, { buildHero }, { applyRuntimePipeline }, { illustrationPage }] = await Promise.all([
		import("../iso/build-figure.mjs"),
		import("../anatomy/hero.mjs"),
		import("../runtime/pipeline.mjs"),
		import("./page.mjs"),
	]);
	const brief = JSON.parse(fs.readFileSync(path.join(HERE, "briefs", "round-trip.json"), "utf8"));
	const file = path.join(dir, `${name}.html`);
	const sections = [];
	for (let index = 0; index < iso; index++) {
		const figure = renderIsoFigure({ ...brief, id: `round-trip-${index + 1}`, figId: `FIG_00${index + 1}` }, { indent: "\t" });
		sections.push(`\t<section class="engine-figure">\n\t\t<h2>Iso figure ${index + 1}</h2>\n${figure.region}\n\t</section>`);
	}
	if (hero) {
		const mod = await import(pathToFileURL(path.join(SCRIPTS, "anatomy", "examples", "dial-indicator.hero.mjs")).href);
		const built = await buildHero(mod, { audit: false, src: path.relative(dir, path.join(SCRIPTS, "anatomy", "examples", "dial-indicator.hero.mjs")).split(path.sep).join("/") });
		sections.push(`\t<section class="engine-figure">\n\t\t<h2>Anatomy hero</h2>\n${built.fragment}\n\t</section>`);
	}
	const html = illustrationPage({ slug: name, title: name, summary: "A fixture page for the check-runtime gate.", eyebrow: "figure engines · fixture", figureHtml: sections.join("\n"), figureEngine: hero ? (iso ? "both" : "anatomy-hero") : "iso-kit" });
	fs.writeFileSync(file, applyRuntimePipeline(html, { filePath: file }));
	return file;
}

test("P4 item 5: check-runtime passes a hero plus two iso-kit figures (B2 mixed sweeps each stage; B10 runs)", { skip }, async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-two-iso-"));
	try {
		const file = await enginePage(dir, "two-iso", { iso: 2, hero: true });
		const result = await checkFigureRuntime(file, { themes: ["light"] });
		assert.deepEqual(result.checks.filter(check => !check.ok).map(check => `${check.id} ${check.hero}: ${check.detail}`), []);
		const ran = result.checks.map(check => check.id);
		assert.ok(ran.includes("B2 mixed"), "B2 mixed ran on a page with two iso stages");
		assert.ok(ran.includes("B10"), "B10 ran");
		assert.equal(ran.filter(id => id === "B12 iso").length, 2, "both iso figures are checked for grayscale");
		assert.match(result.checks.find(check => check.id === "B2 mixed").detail, /2 iso stages hovered in turn/);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("P4 items 6 and 12: an iso-only page runs B6, B12 iso, B2 idle and B10; a page with no engine root still fails B0 heroes", { skip }, async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-iso-only-"));
	try {
		const file = await enginePage(dir, "iso-only", { iso: 2, hero: false });
		const result = await checkFigureRuntime(file);
		assert.deepEqual(result.checks.filter(check => !check.ok).map(check => `${check.id} ${check.theme}: ${check.detail}`), []);
		for (const theme of ["light", "dark"]) {
			const ids = result.checks.filter(check => check.theme === theme).map(check => check.id).sort();
			assert.deepEqual(ids, ["B10", "B12 iso", "B12 iso", "B2 idle", "B6"], `${theme}: the page-level checks ran, no hero check`);
		}
		const none = await checkFigureRuntime(STATIC, { themes: ["light"] });
		assert.deepEqual(none.checks.map(check => `${check.id} ${check.ok}`), ["B0 heroes false"]);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("B13 review compatibility: typing in the review composer never moves the hero", { skip: skip || (!fs.existsSync(path.join(SCRIPTS, "review", "cli.mjs")) && "ws1 review/cli.mjs is not present yet") }, async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-anatomy-review-"));
	const file = path.join(dir, "demo-anatomy-hero.html");
	fs.copyFileSync(DEMO, file);
	const injected = spawnSync(process.execPath, [path.join(SCRIPTS, "build.mjs"), "--inject-review", file, "--no-ledger", "--seed", "b13"], { encoding: "utf8" });
	assert.equal(injected.status, 0, injected.stdout + injected.stderr);
	await withPage(file, { reducedMotion: "reduce" }, async (page, errors) => {
		const stage = '[data-vpk-figure="dial"] .iso-stage';
		const state = () => page.evaluate(selector => ({ readout: document.querySelector('[data-vpk-figure="dial"] [data-readout]').textContent, now: document.querySelector(selector).getAttribute("aria-valuenow") }), stage);
		await wait(500);
		await page.evaluate(() => window.__VPK_REVIEW__.setIdentity({ name: "Figure reviewer" }));
		await page.keyboard.press("c");
		await page.click("main h1");
		const composer = page.locator("textarea.vr-text");
		await composer.waitFor({ state: "visible", timeout: 5000 });
		await composer.focus();
		const before = await state();
		// The slider's keys, typed into the composer (Escape is left out: it closes the composer).
		for (const key of ["Home", "End", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"]) await page.keyboard.press(key);
		await page.keyboard.type("Reading looks right at block 1.");
		assert.equal(await composer.inputValue(), "Reading looks right at block 1.", "the keys landed in the composer");
		await wait(300);
		assert.deepEqual(await state(), before, "hero readout and aria-valuenow unchanged");
		assert.deepEqual(errors, []);
	});
});

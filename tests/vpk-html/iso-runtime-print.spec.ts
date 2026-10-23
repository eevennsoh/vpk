// vpk-html iso kit in Chromium, second file (split from iso-runtime.spec.ts per B2 decision 6):
// print after interaction (7b, 7c; verifier round 2), host templates (12 status-report, verifier
// round 1; 14 deck host, round 3), narrow plate (15, H6) and touch taps (13a, 13b, round 1).
// file:// only. Run: pnpm exec playwright test tests/vpk-html/iso-runtime*.spec.ts (unsandboxed).
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { activeParts, buildPage, centroid, DEMO, EXEMPLAR, file, inject, lineDs, open, printPose, readout, SELECT_BRIEF, SKILL, stageBox, url } from "./iso-runtime.helpers";

// The print CSS forces part transforms to none, but guide and leader `d` and the active stroke are
// runtime writes it cannot reach, so after an interaction the runtime itself must print the rest
// pose (beforeprint via the frame loop's `rest`, or a print media change) and put the interactive
// state back after printing.
test("(7b) print after interaction: a committed gap, a hover preview and a real PDF all print the rest pose, then the state returns", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await open(page, DEMO);
	await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
	await page.waitForTimeout(2200);
	const rest = await lineDs(page);
	expect(rest.length).toBeGreaterThan(2);
	const control = page.locator('[data-vpk-iso-control="explode"]');
	await control.focus();
	await page.keyboard.press("End");
	await expect.poll(() => readout(page), { timeout: 2500 }).toBe("gap 1.00");
	await page.waitForTimeout(800);
	const exploded = await lineDs(page);
	expect(exploded.filter((d, k) => d !== rest[k]).length).toBeGreaterThan(2);
	// A print media change alone (no beforeprint) is what emulateMedia sends.
	await page.emulateMedia({ media: "print" });
	await expect.poll(() => lineDs(page), { timeout: 1000 }).toEqual(rest);
	expect(await printPose(page)).toEqual({ transforms: 0, active: 0, computed: true });
	// null clears the emulation (an emulated "screen" would also override page.pdf()'s print media).
	await page.emulateMedia({ media: null });
	await expect.poll(() => lineDs(page), { timeout: 1500 }).toEqual(exploded);
	expect(await control.inputValue()).toBe("1");
	// A real page.pdf(): beforeprint lands the rest pose synchronously; afterprint puts the state back.
	await page.evaluate(() => {
		const w = window as unknown as { __printed: (string | null)[] };
		window.addEventListener("beforeprint", () => {
			w.__printed = [...document.querySelectorAll('svg[data-vpk-iso-id] [data-vpk-iso-role="guide"], svg[data-vpk-iso-id] [data-vpk-iso-role="leader"]')].map(node => node.getAttribute("d"));
		});
	});
	await page.pdf({ path: file("print-committed.pdf") });
	expect(await page.evaluate(() => (window as unknown as { __printed: (string | null)[] }).__printed)).toEqual(rest);
	await expect.poll(() => lineDs(page), { timeout: 1500 }).toEqual(exploded);
	// A hover preview, then a dispatched beforeprint/afterprint pair.
	await control.evaluate((input: HTMLInputElement) => {
		input.value = "0.6";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	});
	await expect.poll(() => lineDs(page), { timeout: 2500 }).toEqual(rest);
	const box = await stageBox(page);
	await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
	await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 5 });
	await page.waitForTimeout(900);
	const preview = await lineDs(page);
	expect(preview.filter((d, k) => d !== rest[k]).length).toBeGreaterThan(2);
	expect(await page.evaluate(() => {
		window.dispatchEvent(new Event("beforeprint"));
		return [...document.querySelectorAll('svg[data-vpk-iso-id] [data-vpk-iso-role="guide"], svg[data-vpk-iso-id] [data-vpk-iso-role="leader"]')].map(node => node.getAttribute("d"));
	})).toEqual(rest);
	expect(await printPose(page)).toMatchObject({ transforms: 0, active: 0 });
	await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
	await expect.poll(() => lineDs(page), { timeout: 1500 }).toEqual(preview);
});

test("(7c) print a select figure left active by the keyboard: no active stroke, rest leaders, then the selection returns", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	const labels = [{ text: "Tray", target: "tray", side: "left" }, { text: "Drum", target: "drum", side: "right" }];
	await open(page, buildPage({ ...SELECT_BRIEF, id: "select-print", labels }, "select-print"));
	await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
	await page.waitForTimeout(2200);
	const rest = await lineDs(page);
	const snapshot = await page.locator("svg[data-vpk-iso-id]").evaluate(node => node.outerHTML);
	await page.locator("[data-vpk-iso-stage]").focus();
	await page.keyboard.press("End");
	await expect.poll(() => page.locator('[data-vpk-iso-part="drum"]').getAttribute("transform"), { timeout: 1500 }).not.toBeNull();
	await page.waitForTimeout(900);
	await page.keyboard.press("Tab");
	const lifted = await lineDs(page);
	expect(lifted.filter((d, k) => d !== rest[k]).length).toBeGreaterThan(0);
	await page.emulateMedia({ media: "print" });
	await expect.poll(() => lineDs(page), { timeout: 1000 }).toEqual(rest);
	expect(await printPose(page)).toEqual({ transforms: 0, active: 0, computed: true });
	expect(await page.locator("svg[data-vpk-iso-id]").evaluate(node => node.outerHTML)).toBe(snapshot);
	await page.emulateMedia({ media: "screen" });
	await expect.poll(() => activeParts(page), { timeout: 1500 }).toEqual(["drum"]);
	await expect.poll(() => lineDs(page), { timeout: 1500 }).toEqual(lifted);
});

// Motion at rest (illustrations.md § 8) never reaches paper: print removes data-vpk-iso-rest and every rest animation, the
// printed SVG is the static art, and back on screen the drift returns only after the idle wait.
test("(7d) print while at rest: no rest attribute or animation in print, the static art prints, rest returns on screen", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await open(page, buildPage({ ...SELECT_BRIEF, id: "select-rest-print" }, "select-rest-print"));
	await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
	await page.mouse.move(2, 2);
	const svg = page.locator("svg[data-vpk-iso-id]");
	const stage = page.locator("[data-vpk-iso-stage]");
	await expect.poll(() => stage.getAttribute("data-vpk-iso-rest"), { timeout: 9000 }).toBe("");
	const art = await svg.evaluate(node => node.outerHTML);
	await page.emulateMedia({ media: "print" });
	await expect.poll(() => stage.getAttribute("data-vpk-iso-rest"), { timeout: 1000 }).toBeNull();
	expect(await page.evaluate(() => document.getAnimations().filter(a => String((a as CSSAnimation).animationName).startsWith("vpk-iso-")).length)).toBe(0);
	expect(await svg.evaluate(node => node.outerHTML)).toBe(art);
	await page.emulateMedia({ media: "screen" });
	await expect.poll(() => stage.getAttribute("data-vpk-iso-rest"), { timeout: 5000 }).toBe("");
});

// The documented --inject path (ws3 §4.9) into a real template. status-report carries the unlayered
// vpk-algebrica-v2 `figure { display: flex !important; align-items: center !important; … }`, which
// once shrank the stage to the SVG's 300 px intrinsic width.
test("(12) host template: an injected plate keeps a full-width stage under the template's !important figure rules", async ({ page }) => {
	const host = file("host");
	fs.mkdirSync(path.join(host, "_figures"), { recursive: true });
	fs.writeFileSync(path.join(host, "_figures/fig-001.iso.json"), JSON.stringify({ ...EXEMPLAR, id: "fig-001" }));
	const template = fs.readFileSync(path.join(SKILL, "assets/templates/status-report.html"), "utf8").replace(/\{\{[^}]*\}\}/g, "Filler");
	expect(template).toContain("vpk-algebrica-v2");
	const at = template.indexOf("</p>", template.indexOf("<main")) + 4;
	const marker = '<!-- vpk-figure:begin engine="iso-kit" id="fig-001" src="_figures/fig-001.iso.json" --><!-- vpk-figure:end id="fig-001" -->';
	const target = path.join(host, "status-report.html");
	fs.writeFileSync(target, `${template.slice(0, at)}\n${marker}\n${template.slice(at)}`);
	inject(target);
	await page.setViewportSize({ width: 1280, height: 800 });
	await open(page, target);
	const m = await page.locator("figure.vpk-iso-plate").evaluate(fig => {
		const probe = document.createElement("figure");
		fig.parentElement?.append(probe);
		const host = getComputedStyle(probe);
		const width = (el: Element | null) => (el ? el.getBoundingClientRect().width : 0);
		const result = { hostDisplay: host.display, hostAlign: host.alignItems, display: getComputedStyle(fig).display, plate: width(fig), stage: width(fig.querySelector(".vpk-iso-stage")), svg: width(fig.querySelector("svg[data-vpk-iso-id]")) };
		probe.remove();
		return result;
	});
	expect(m.hostDisplay, "the template's figure rule is in force").toBe("flex");
	expect(m.hostAlign).toBe("center");
	expect(m.display).toBe("block");
	expect(m.svg).toBeGreaterThan(m.plate * 0.8);
	expect(Math.abs(m.svg - m.stage)).toBeLessThanOrEqual(2);
});

// Round-3 verifier: the deck host. slides.html caps every SVG at 105 mm (`svg { max-height; width:
// auto }`) inside a fixed 158 mm slide, which once left the SVG at the stage's left edge and pushed
// the Gap slider, the caption and the page number out of the frame. Same placements as the
// verifier: explode after slide 2's lead (two columns follow), select after slide 4's body (the
// pinned `.co` callout follows).
test("(14) deck host: injected plates are centred and end inside the slide at three desktop sizes", async ({ page }) => {
	const host = file("deck");
	fs.mkdirSync(path.join(host, "_figures"), { recursive: true });
	fs.writeFileSync(path.join(host, "_figures/fig-001.iso.json"), JSON.stringify({ ...EXEMPLAR, id: "fig-001" }));
	fs.writeFileSync(path.join(host, "_figures/fig-002.iso.json"), JSON.stringify({ ...SELECT_BRIEF, id: "fig-002", figId: "FIG_002" }));
	let html = fs.readFileSync(path.join(SKILL, "assets/templates/slides.html"), "utf8").replace(/\{\{[^}]*\}\}/g, "Filler");
	const marker = (id: string) => `<!-- vpk-figure:begin engine="iso-kit" id="${id}" src="_figures/${id}.iso.json" --><!-- vpk-figure:end id="${id}" -->`;
	const after = (slide: number, needle: string, id: string) => {
		const at = html.indexOf(needle, [...html.matchAll(/<section class="slide[^"]*">/g)][slide].index) + needle.length;
		html = `${html.slice(0, at)}\n${marker(id)}\n${html.slice(at)}`;
	};
	after(3, '<p class="mb">Filler</p>', "fig-002");
	after(1, '<p class="lead">Filler</p>', "fig-001");
	const target = path.join(host, "slides.html");
	fs.writeFileSync(target, html);
	inject(target);
	const errors: string[] = [];
	page.on("pageerror", error => errors.push(error.message));
	for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
		await page.setViewportSize(viewport);
		for (const [slide, id] of [[2, "fig-001"], [4, "fig-002"]] as const) {
			await page.goto("about:blank");
			await page.goto(`${url(target)}#slide-${slide}`);
			await page.waitForTimeout(900);
			const m = await page.locator(`#vpk-iso-${id}`).evaluate(fig => {
				const r = (el: Element | null) => (el as Element).getBoundingClientRect();
				const slide = fig.closest("section.slide") as HTMLElement;
				const k = r(slide).height / slide.offsetHeight;
				const pinned = slide.querySelector(".co");
				const room = Math.min(r(slide).top + (slide.clientHeight - parseFloat(getComputedStyle(slide).paddingBottom)) * k, pinned ? r(pinned).top : Infinity);
				const svg = r(fig.querySelector("svg")), stage = r(fig.querySelector(".vpk-iso-stage"));
				return { active: slide.classList.contains("is-active"), offset: (svg.left + svg.right - stage.left - stage.right) / 2, over: r(fig).bottom - room, pageNum: r(slide.querySelector(".page-num")).top - r(fig).bottom, low: Math.max(r(fig.querySelector("figcaption")).bottom, r(fig.querySelector(".vpk-iso-plate__foot") ?? fig).bottom) - innerHeight, half: svg.height / k / ((105 * 96) / 25.4 / 2) };
			});
			const where = `${viewport.width} ${id}`;
			expect(m.active, where).toBe(true);
			expect(Math.abs(m.offset), `${where}: svg centred in the stage`).toBeLessThanOrEqual(2);
			expect(m.over, `${where}: the plate ends inside the slide's room`).toBeLessThanOrEqual(1);
			expect(m.pageNum, `${where}: the plate clears the page number`).toBeGreaterThanOrEqual(0);
			expect(m.low, `${where}: foot and caption in the viewport`).toBeLessThanOrEqual(0);
			expect(m.half, `${where}: at least half the template's 105 mm`).toBeGreaterThanOrEqual(0.99);
		}
	}
	await page.goto(`${url(target)}#slide-2`);
	await page.locator("#vpk-iso-fig-001 [data-vpk-iso-control]").focus();
	await page.keyboard.press("End");
	await expect.poll(() => page.locator("#vpk-iso-fig-001 [data-vpk-iso-readout]").textContent(), { timeout: 2000 }).toBe("gap 1.00");
	expect(new URL(page.url()).hash, "slider keys stay with the slider").toBe("#slide-2");
	expect(errors).toEqual([]);
});

// H6 (reads at 320 px). validateBrief allows a 48-char title and a 40-char meta.corner. The kit's one style draws no
// corner chrome (the frame holds the drawing and its readout only), so a schema-length title and meta never reach the
// plate: at every width the frame stays inside the plate and the stage (which clips the cropped SVG) inside the frame, with no corner text at all.
test("(15) narrow plate: no corner chrome at any width, and the frame holds the SVG inside the plate", async ({ page }) => {
	const brief = { ...EXEMPLAR, id: "long-title", title: "Exploded stack with a title at the schema limit", meta: { corner: "META CORNER TEXT AT THE FORTY CHAR LIMIT" } };
	const target = buildPage(brief, "long-title");
	for (const width of [320, 390, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto(url(target));
		await page.evaluate(() => document.fonts.ready);
		const m = await page.locator("figure.vpk-iso-plate").evaluate(fig => {
			const plate = fig.getBoundingClientRect();
			const frame = (fig.querySelector(".vpk-iso-frame") as Element).getBoundingClientRect();
			// The narrow crop widens the svg past the stage on purpose (the stage clips it), so the visible box is the stage.
			const stage = (fig.querySelector(".vpk-iso-stage") as Element).getBoundingClientRect();
			return { corners: fig.querySelectorAll("[data-corner], .vpk-iso-plate__chrome").length, text: fig.textContent ?? "", frameIn: frame.left >= plate.left - 0.5 && frame.right <= plate.right + 0.5, svgIn: stage.left >= frame.left - 0.5 && stage.right <= frame.right + 0.5, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
		});
		expect(m.corners, `${width}: no corner chrome`).toBe(0);
		expect(m.text, `${width}: the meta corner text is not drawn`).not.toContain("META CORNER TEXT");
		expect(m.frameIn, `${width}: the frame sits inside the plate`).toBe(true);
		expect(m.svgIn, `${width}: the stage that shows the SVG sits inside the frame`).toBe(true);
		expect(m.overflow, `${width}: no horizontal page overflow`).toBeLessThanOrEqual(0);
	}
});

// Verifier round 5: on Back, Chromium restored the range's form state after the runtime had read
// it, so the slider said 1 over a 0.60 figure and the next leave settled at 0.60. The slider, the
// readout and the parts must agree after Back: either the committed pose (bfcache) or the rest pose.
test("(16) back navigation: the Gap slider, readout and parts agree after End → another page → Back", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	const other = file("other.html");
	fs.writeFileSync(other, '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Other</title></head><body><p>Other page</p></body></html>\n');
	const pose = () => page.evaluate(() => ({
		slider: (document.querySelector('[data-vpk-iso-control="explode"]') as HTMLInputElement).value,
		readout: document.querySelector("[data-vpk-iso-readout]")?.textContent,
		shell: document.querySelector('[data-vpk-iso-part="shell"]')?.getAttribute("transform") ?? null,
		svg: (document.querySelector("svg[data-vpk-iso-id]") as SVGSVGElement).outerHTML,
	}));
	for (const target of [DEMO, path.join(SKILL, "assets/illustrations/iso-exploded-stack.html")]) {
		const name = path.basename(target);
		await page.goto(url(target));
		await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
		await page.waitForTimeout(2200);
		const rest = await pose();
		expect(rest.slider, name).toBe("0.6");
		await page.locator('[data-vpk-iso-control="explode"]').focus();
		await page.keyboard.press("End");
		await expect.poll(() => readout(page), { timeout: 2000 }).toBe("gap 1.00");
		await page.waitForTimeout(1200);
		const committed = await pose();
		expect(committed.shell, name).not.toBeNull();
		await page.goto(url(other));
		await page.goBack();
		expect(await page.evaluate(() => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).type), name).toBe("back_forward");
		await page.waitForTimeout(2500);
		const after = await pose();
		expect(after.readout, `${name}: the readout names the slider's value`).toBe(`gap ${Number(after.slider).toFixed(2)}`);
		expect([rest, committed].some(state => state.slider === after.slider && state.shell === after.shell && state.svg === after.svg), `${name}: ${after.slider} / ${after.readout} / ${after.shell}`).toBe(true);
		// A hover and leave settles on the slider's value, not on a stale committed gap.
		const box = await stageBox(page);
		await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
		await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 4 });
		await page.mouse.move(2, 2);
		await expect.poll(() => readout(page), { timeout: 2000 }).toBe(after.readout);
		await page.waitForTimeout(400);
		expect((await pose()).svg, `${name}: the leave settles on the same pose`).toBe(after.svg);
	}
});

// Run 8: a second iso figure on a deck slide inside a hidden container (an inactive tab panel, a
// narrow-screen variant) measured 0 px. It took half the overflow, so the visible plate ran 91 px
// past the slide and over the page number, and it was written max-height: 0px, so it stayed
// invisible once shown. Only rendered SVGs share the room.
test("(17) deck host: a hidden second figure on the slide neither shrinks the visible fit nor stays at 0 px", async ({ page }) => {
	const host = file("deck-hidden");
	fs.mkdirSync(path.join(host, "_figures"), { recursive: true });
	for (const [id, figId] of [["fig-001", "FIG_001"], ["fig-002", "FIG_002"]]) fs.writeFileSync(path.join(host, `_figures/${id}.iso.json`), JSON.stringify({ ...EXEMPLAR, id, figId }));
	let html = fs.readFileSync(path.join(SKILL, "assets/templates/slides.html"), "utf8").replace(/\{\{[^}]*\}\}/g, "Filler");
	const marker = (id: string) => `<!-- vpk-figure:begin engine="iso-kit" id="${id}" src="_figures/${id}.iso.json" --><!-- vpk-figure:end id="${id}" -->`;
	const lead = '<p class="lead">Filler</p>';
	const at = html.indexOf(lead, [...html.matchAll(/<section class="slide[^"]*">/g)][1].index) + lead.length;
	html = `${html.slice(0, at)}\n${marker("fig-001")}\n<div hidden id="alt">\n${marker("fig-002")}\n</div>\n${html.slice(at)}`;
	const target = path.join(host, "slides.html");
	fs.writeFileSync(target, html);
	inject(target);
	const errors: string[] = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto(`${url(target)}#slide-2`);
	await page.waitForTimeout(900);
	const m = await page.locator("#vpk-iso-fig-001").evaluate(fig => {
		const r = (el: Element) => el.getBoundingClientRect();
		const slide = fig.closest("section.slide") as HTMLElement;
		const k = r(slide).height / slide.offsetHeight;
		const room = r(slide).top + (slide.clientHeight - parseFloat(getComputedStyle(slide).paddingBottom)) * k;
		return { over: r(fig).bottom - room, pageNum: r(slide.querySelector(".page-num") as Element).top - r(fig).bottom, hidden: (document.querySelector("#vpk-iso-fig-002 svg") as SVGElement).style.maxHeight };
	});
	expect(m.over, "the visible plate ends inside the slide's room").toBeLessThanOrEqual(1);
	expect(m.pageNum, "the visible plate clears the page number").toBeGreaterThanOrEqual(0);
	expect(m.hidden, "the hidden SVG gets no max-height").toBe("");
	await page.evaluate(() => {
		(document.getElementById("alt") as HTMLElement).hidden = false;
	});
	expect(await page.locator("#vpk-iso-fig-002 svg").evaluate(svg => svg.getBoundingClientRect().height), "shown later, it renders").toBeGreaterThan(100);
	expect(errors).toEqual([]);
});

// G2 J2: under reduced motion styles.css gives every element `transition-duration: 200ms !important`
// (`body[data-vpk-motion] *`), and the plate's own box rules arrive in the iso block at the end of <body>,
// after the first style pass. The plate used to glide from its pre-CSS box to 293 px (343 → 293 at
// 390 px, 13 distinct widths over ~200 ms). Nothing in the plate may transition, and its size must hold.
test("(18) reduced motion: the plate and everything in it lands in one step, with no size change on load", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.addInitScript(() => {
		const w = window as unknown as { __runs: string[]; __sizes: string[] };
		w.__runs = [];
		w.__sizes = [];
		document.addEventListener("transitionrun", event => {
			const node = event.target as Element;
			if (node.closest?.(".vpk-iso-plate")) w.__runs.push(`${node.tagName} ${(event as TransitionEvent).propertyName}`);
		}, true);
		document.addEventListener("DOMContentLoaded", () => {
			const sample = () => {
				const plate = document.querySelector(".vpk-iso-plate");
				const svg = document.querySelector("svg[data-vpk-iso]");
				if (plate && svg) w.__sizes.push(`${plate.getBoundingClientRect().width.toFixed(1)}x${svg.getBoundingClientRect().height.toFixed(1)}`);
				if (performance.now() < 2500) requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
	});
	await page.goto(url(DEMO));
	await page.waitForTimeout(2600);
	const { runs, sizes } = await page.evaluate(() => {
		const w = window as unknown as { __runs: string[]; __sizes: string[] };
		return { runs: w.__runs, sizes: [...new Set(w.__sizes)] };
	});
	expect(runs, "no transition starts inside the plate").toEqual([]);
	expect(sizes.length, `plate × figure sizes after parse: ${sizes.join(", ")}`).toBe(1);
	// The same holds in the dark theme and for a select figure (the rule covers the plate subtree, not one figure).
	await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
	await page.goto(url(buildPage(SELECT_BRIEF, "select-reduced")));
	await page.waitForTimeout(600);
	const durations = await page.evaluate(() => [...new Set([document.querySelector(".vpk-iso-plate"), document.querySelector(".vpk-iso-stage"), document.querySelector("svg[data-vpk-iso]")].map(node => getComputedStyle(node as Element).transitionDuration))]);
	expect(durations, "plate, stage and svg compute a 0 s transition").toEqual(["0s"]);
});

// G2 J4: at 390 px the 11-unit callout text rendered near 4 px (SVG scale 0.41). Below 720 px the figure now
// shows numbered tags on the targets, the label text moves to an HTML legend, and the empty label gutters are
// cropped, so the scene is drawn about twice as large. Rendered size = font-size × the SVG's screen scale.
test("(19) narrow stage: callouts stay legible from 320 px up (numbered tags + legend), labels keep ≥ 9 px at 721 px and above", async ({ page }) => {
	const measure = () => page.evaluate(() => {
		const svg = document.querySelector("svg[data-vpk-iso]") as SVGSVGElement;
		const scale = (svg.getScreenCTM() as DOMMatrix).a;
		const shown = (node: Element) => getComputedStyle(node).display !== "none" && node.getBoundingClientRect().width > 0;
		const px = (nodes: Element[]) => nodes.filter(shown).map(node => Number(node.getAttribute("font-size")) * scale);
		const legend = document.querySelector(".vpk-iso-legend") as HTMLElement;
		const stage = (document.querySelector(".vpk-iso-stage") as HTMLElement).getBoundingClientRect();
		const view = svg.getBoundingClientRect();
		const tagBoxes = [...svg.querySelectorAll("[data-vpk-iso-tag] circle")].filter(shown).map(node => node.getBoundingClientRect());
		return {
			// The one style draws its narrow tags inside the labels group, so callout text is read per label-for group.
			labels: px([...svg.querySelectorAll("[data-vpk-iso-label-for] text")]),
			digits: px([...svg.querySelectorAll("[data-vpk-iso-tag] text")]),
			legend: getComputedStyle(legend).display !== "none" ? { font: parseFloat(getComputedStyle(legend).fontSize), items: [...legend.querySelectorAll("li")].map(li => li.textContent) } : null,
			overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
			tagsInStage: tagBoxes.every(box => box.left >= stage.left - 1 && box.right <= stage.right + 1 && box.top >= view.top - 1 && box.bottom <= view.bottom + 1),
		};
	});
	for (const scheme of ["light", "dark"] as const) {
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
		for (const width of [320, 390, 720]) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto(url(DEMO));
			await page.evaluate(() => document.fonts.ready);
			const m = await measure();
			const label = `${scheme} ${width}px`;
			expect(m.labels, `${label}: SVG callout text is replaced, never rendered tiny`).toEqual([]);
			expect(m.digits.length, `${label}: one tag per label`).toBe(4);
			expect(Math.min(...m.digits), `${label}: tag digits render ≥ 9 px`).toBeGreaterThanOrEqual(9);
			expect(m.legend?.font, `${label}: legend text`).toBeGreaterThanOrEqual(11);
			expect(m.legend?.items, label).toEqual(["1Top shell", "2Module", "3Core board", "4Base plate"]);
			expect(m.overflowX, `${label}: no horizontal page overflow`).toBeLessThanOrEqual(0);
			expect(m.tagsInStage, `${label}: every tag is inside the visible stage`).toBe(true);
		}
		for (const width of [721, 900, 1280]) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto(url(DEMO));
			await page.evaluate(() => document.fonts.ready);
			const m = await measure();
			const label = `${scheme} ${width}px`;
			expect(m.digits, `${label}: tags are narrow-only`).toEqual([]);
			expect(m.legend, `${label}: legend is narrow-only`).toBeNull();
			expect(m.labels.length, `${label}: callout labels show`).toBe(4);
			expect(Math.min(...m.labels), `${label}: labels render ≥ 9 px`).toBeGreaterThanOrEqual(9);
		}
	}
	// The cropped svg is wider than the stage, but hovering anywhere on the visible stage still opens the gap, and
	// a tag's leader follows its part when the gap changes (the one style parks the tag disc in the gutter; only the
	// leader's end rides on the part, illustrations.md § Style).
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(url(DEMO));
	await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
	await page.waitForTimeout(2200);
	const tagY = () => page.locator('[data-vpk-iso-tag="1"] [data-vpk-iso-role="leader"]').evaluate(node => { const pts = (node.getAttribute("d") ?? "").match(/-?\d+(?:\.\d+)?/g) ?? []; return Number(pts[pts.length - 1]) * (((node as SVGElement).ownerSVGElement as SVGSVGElement).getScreenCTM() as DOMMatrix).d; });
	const before = await tagY();
	const box = await stageBox(page);
	await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
	await page.mouse.move(box.x + box.width * 0.97, box.y + box.height * 0.5);
	await expect.poll(async () => Number((await readout(page))?.split(" ")[1]), { timeout: 1500 }).toBeGreaterThan(0.95);
	expect(Math.abs((await tagY()) - before), "tag 1's leader end moved with the shell").toBeGreaterThan(8);
	await page.mouse.move(box.x + box.width * 0.5, box.y - 40);
	await expect.poll(() => readout(page), { timeout: 3000 }).toBe("gap 0.60");
	expect(Math.abs((await tagY()) - before), "back at rest").toBeLessThan(1);
});

test.describe("touch", () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	// A finger tap is pointerdown, pointerup, pointerleave with no pointermove.
	test("(13a) touch tap on a select tile selects it, holds through the touch leave, then rests", async ({ page }) => {
		await open(page, buildPage(SELECT_BRIEF, "select-touch"));
		await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
		await page.waitForTimeout(2200);
		const point = await centroid(page, '[data-vpk-iso-part="tile-b"] [data-vpk-iso-role="fill"]');
		await page.touchscreen.tap(point.x, point.y);
		await expect.poll(() => activeParts(page), { timeout: 500 }).toEqual(["tile-b"]);
		expect(await readout(page)).toBe("tile b");
		await expect.poll(() => page.locator('[data-vpk-iso-part="tile-b"]').getAttribute("transform"), { timeout: 800 }).not.toBeNull();
		expect(await activeParts(page)).toEqual(["tile-b"]);
		await expect.poll(() => readout(page), { timeout: 2500 }).toBe("rest");
		await expect.poll(() => page.locator("svg[data-vpk-iso-id]").evaluate(node => node.querySelectorAll("[class], [transform]").length), { timeout: 2500 }).toBe(0);
	});

	test("(13b) a touch tap opens the explode stage to the full gap without writing the slider; the next tap closes it", async ({ page }) => {
		await open(page, DEMO);
		await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
		await page.waitForTimeout(2200);
		expect(await readout(page)).toBe("gap 0.60");
		const box = await stageBox(page);
		await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height / 2);
		await expect.poll(() => readout(page), { timeout: 1500 }).toBe("gap 1.00");
		expect(await page.locator('[data-vpk-iso-control="explode"]').inputValue()).toBe("0.6");
		await page.waitForTimeout(1600);
		expect(await readout(page), "stays open until the next tap").toBe("gap 1.00");
		await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height / 2);
		await expect.poll(() => readout(page), { timeout: 3000 }).toBe("gap 0.60");
		await expect.poll(() => page.locator("svg[data-vpk-iso-id] [transform]").count(), { timeout: 2500 }).toBe(0);
	});
});

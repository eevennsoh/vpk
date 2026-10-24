// vpk-html iso kit in Chromium (ws3 §8 checks 1–11; illustrations.md A13/A14). The print-after-
// interaction, host-template, narrow-chrome and touch checks (7b, 7c, 12–15) live in
// iso-runtime-print.spec.ts and the shared fixtures in iso-runtime.helpers.ts (B2 decision 6).
// file:// only: the committed demo plus temp pages built with scripts/iso/build-figure.mjs.
// Run: pnpm exec playwright test tests/vpk-html/iso-runtime*.spec.ts (unsandboxed).
import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { activeParts, allAtRest, belowFold, buildPage, centroid, DEMO, ENGINES_DEMO, EXEMPLAR, file, FRAME_LOOP, fragment, open, type ProbeWindow, rafSummary, readout, resetRaf, SELECT_BRIEF, stageBox, tones, topGroupDy, url } from "./iso-runtime.helpers";

test.describe("reduced motion", () => {
	test.use({ contextOptions: { reducedMotion: "reduce" } });

	test("(1) static ≡ reduced: nothing begins, every group sits at rest, labels are opaque", async ({ page }) => {
		await open(page, DEMO);
		await page.evaluate(async () => {
			for (let y = 0; y <= document.documentElement.scrollHeight; y += 400) {
				window.scrollTo(0, y);
				await new Promise(resolve => setTimeout(resolve, 60));
			}
		});
		await page.waitForTimeout(2500);
		expect(await page.evaluate(() => (window as unknown as ProbeWindow).__begins)).toBe(0);
		expect(await allAtRest(page)).toBe(true);
		expect(await page.locator("svg[data-vpk-iso-id] [data-vpk-iso-part][transform]").count()).toBe(0);
		expect(await page.evaluate(() => [...document.querySelectorAll("[data-vpk-iso-labels]")].every(g => getComputedStyle(g).opacity === "1"))).toBe(true);
	});

	test("(5) reduced pointer: a hover lands in one frame and nothing self-animates", async ({ page }) => {
		await open(page, DEMO);
		const box = await stageBox(page);
		await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2);
		const samples = await page.evaluate(async () => {
			const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
			const read = () => `${document.querySelector("[data-vpk-iso-readout]")?.textContent}|${document.querySelector('[data-vpk-iso-part="shell"]')?.getAttribute("transform")}`;
			await frame();
			await frame();
			const a = read();
			await frame();
			return [a, read()];
		});
		expect(samples[0]).toBe(samples[1]);
		expect(samples[0]).toContain("gap 1.00");
		expect(await page.evaluate(() => (window as unknown as ProbeWindow).__begins)).toBe(0);
	});
});

test("(2) entry: armed below the fold at keyframe 0, assembles on entry, lands at rest", async ({ page }) => {
	const target = belowFold(DEMO, "below-fold");
	await page.setViewportSize({ width: 1280, height: 800 });
	await open(page, target);
	expect(await page.evaluate(() => (document.querySelector("svg[data-vpk-iso-id]") as SVGSVGElement).animationsPaused())).toBe(true);
	expect(await topGroupDy(page)).toBeLessThan(0);
	await page.locator("[data-vpk-iso-stage]").scrollIntoViewIfNeeded();
	await page.waitForTimeout(300);
	expect(Math.abs(await topGroupDy(page))).toBeGreaterThan(0.5);
	const total = await page.evaluate(() => Number.parseFloat(document.querySelector("svg[data-vpk-iso-id] animateTransform")?.getAttribute("dur") ?? "0"));
	await page.waitForTimeout(total + 200);
	expect(await allAtRest(page)).toBe(true);
});

test("(3) explode hover: opens to the full gap without writing the slider, closes on leave, slider commits and speaks", async ({ page }) => {
	await open(page, DEMO);
	await page.waitForTimeout(2200);
	expect(await readout(page)).toBe("gap 0.60");
	const snapshot = await page.locator("svg[data-vpk-iso-id]").evaluate(svg => svg.outerHTML);
	const box = await stageBox(page);
	await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
	await expect.poll(() => readout(page), { timeout: 1500 }).toBe("gap 1.00");
	await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 4 });
	await page.waitForTimeout(200);
	expect(await readout(page), "pointer position plays no part").toBe("gap 1.00");
	expect(await page.locator('[data-vpk-iso-part="shell"]').getAttribute("transform")).not.toBeNull();
	expect(await page.locator('[data-vpk-iso-control="explode"]').inputValue()).toBe("0.6");
	await page.mouse.move(2, 2);
	await expect.poll(() => readout(page), { timeout: 1200 }).toBe("gap 0.60");
	await expect.poll(() => page.locator("svg[data-vpk-iso-id] [transform]").count(), { timeout: 1200 }).toBe(0);
	expect(await page.locator("svg[data-vpk-iso-id]").evaluate(svg => svg.outerHTML)).toBe(snapshot);
	await page.locator('[data-vpk-iso-control="explode"]').evaluate((input: HTMLInputElement) => {
		input.value = "0.9";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	});
	await expect.poll(() => readout(page), { timeout: 1500 }).toBe("gap 0.90");
	expect(await page.locator("[data-vpk-iso-live]").textContent()).toBe("gap 0.90");
	await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 3 });
	await expect.poll(() => readout(page), { timeout: 1500 }).toBe("gap 1.00");
	await page.mouse.move(2, 2);
	await expect.poll(() => readout(page), { timeout: 1500 }).toBe("gap 0.90");
});

test("(4) select pointer and keyboard: one active part, lift, isolation, exact rest restore", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await open(page, buildPage(SELECT_BRIEF, "select"));
	await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
	await page.waitForTimeout(2200);
	const svg = page.locator("svg[data-vpk-iso-id]");
	const snapshot = await svg.evaluate(node => node.outerHTML);
	const point = await centroid(page, '[data-vpk-iso-part="tile-b"] [data-vpk-iso-role="fill"]');
	await page.mouse.move(point.x - 30, point.y - 60);
	await page.mouse.move(point.x, point.y, { steps: 3 });
	await expect.poll(() => activeParts(page)).toEqual(["tile-b"]);
	expect(await readout(page)).toBe("tile b");
	await expect.poll(() => page.locator('[data-vpk-iso-part="tile-b"]').getAttribute("transform"), { timeout: 800 }).not.toBeNull();
	await page.mouse.move(2, 2);
	await expect.poll(() => svg.evaluate(node => node.querySelectorAll("[class], [transform]").length), { timeout: 1200 }).toBe(0);
	expect(await readout(page)).toBe("rest");
	expect(await svg.evaluate(node => node.outerHTML)).toBe(snapshot);

	await page.evaluate(() => {
		(window as unknown as { __docKeys: string[] }).__docKeys = [];
		document.addEventListener("keydown", event => (window as unknown as { __docKeys: string[] }).__docKeys.push(event.key));
	});
	await page.locator("[data-vpk-iso-stage]").focus();
	await page.keyboard.press("ArrowRight");
	await expect.poll(() => activeParts(page)).toEqual(["tray:back", "tray:front"]);
	await page.keyboard.press("ArrowRight");
	await expect.poll(() => page.locator("svg [data-vpk-iso-part].is-active").count()).toBe(1);
	await page.keyboard.press("Escape");
	await expect.poll(() => page.locator("svg [data-vpk-iso-part].is-active").count()).toBe(0);
	expect(await page.evaluate(() => (window as unknown as { __docKeys: string[] }).__docKeys)).toEqual([]);
});

test("(6) one loop: ≤ 1 rAF request per frame while sweeping, no enhancer frames, 0 at rest, stops off-screen", async ({ page }) => {
	await open(page, DEMO);
	await page.waitForTimeout(2200);
	const box = await stageBox(page);
	await page.mouse.move(box.x + 4, box.y + box.height / 2);
	await resetRaf(page);
	for (let i = 0; i <= 30; i++) {
		await page.mouse.move(box.x + 4 + (box.width - 8) * (i / 30), box.y + box.height / 2);
		await page.waitForTimeout(33);
	}
	const moving = await rafSummary(page);
	expect(moving.loopFrames).toBeGreaterThan(10);
	expect(moving.maxPerFrame).toBe(1);
	expect(moving.enhancer).toBe(0);
	await page.mouse.move(2, 2);
	await page.waitForTimeout(1600);
	await resetRaf(page);
	await page.waitForTimeout(1000);
	expect((await rafSummary(page)).frames).toBe(0);
	// Off-screen: start motion on a below-the-fold copy, then scroll the figure out of view.
	await page.goto(url(belowFold(DEMO, "offscreen")));
	await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
	await page.waitForTimeout(2200);
	const lower = await stageBox(page);
	await page.mouse.move(lower.x + lower.width * 0.2, lower.y + lower.height / 2);
	await page.mouse.move(lower.x + lower.width * 0.95, lower.y + lower.height / 2, { steps: 3 });
	await page.waitForTimeout(50);
	expect((await rafSummary(page)).loopFrames).toBeGreaterThan(0);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(100);
	await resetRaf(page);
	await page.waitForTimeout(400);
	expect((await rafSummary(page)).loopFrames).toBe(0);
});

test("(7) print: transforms collapse mid-assembly and beforeprint lands the timeline", async ({ page }) => {
	await open(page, belowFold(DEMO, "print"));
	await page.locator("[data-vpk-iso-stage]").scrollIntoViewIfNeeded();
	await page.waitForTimeout(300);
	await page.emulateMedia({ media: "print" });
	expect(await page.evaluate(() => [...document.querySelectorAll("[data-vpk-iso-enter], [data-vpk-iso-part]")].every(node => getComputedStyle(node).transform === "none"))).toBe(true);
	await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
	const time = await page.evaluate(() => (document.querySelector("svg[data-vpk-iso-id]") as SVGSVGElement).getCurrentTime());
	expect(time).toBeGreaterThanOrEqual(1.44);
});

test("(8) a live switch to reduced motion mid-assembly lands at once", async ({ page }) => {
	await open(page, belowFold(DEMO, "live-reduce"));
	await page.locator("[data-vpk-iso-stage]").scrollIntoViewIfNeeded();
	await page.waitForTimeout(300);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.waitForTimeout(100);
	expect(await allAtRest(page)).toBe(true);
});

test("(9) dark theme: tops lightest, away sides darkest, edges on the dark line token mixed 60% over the paper", async ({ page }) => {
	await open(page, DEMO);
	await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
	// Read the resting tone map: the top layer drops last in the accent (SMIL animates the class, so poll the computed fill
	// until the hand-off has returned it to the dark tone).
	await expect.poll(() => page.evaluate(() => {
		const top = document.querySelector('[data-vpk-iso-part="shell"] [data-vpk-iso-tone="top"]') as Element;
		return getComputedStyle(top).fill === `rgb(${[1, 3, 5].map(i => Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--ill-tone2").trim().slice(i, i + 2), 16)).join(", ")})`;
	}), { timeout: 5000 }).toBe(true);
	// Let the edge stroke transition and the 300 ms hand-off finish before reading resolved values.
	await page.waitForTimeout(500);
	const result = await page.evaluate(() => {
		const rgb = (hex: string) => `rgb(${[1, 3, 5].map(i => Number.parseInt(hex.trim().slice(i, i + 2), 16)).join(", ")})`;
		const token = (name: string) => rgb(getComputedStyle(document.documentElement).getPropertyValue(name));
		const part = document.querySelector('[data-vpk-iso-part="shell"]') as Element;
		const fill = (tone: string) => getComputedStyle(part.querySelector(`[data-vpk-iso-tone="${tone}"]`) as Element).fill;
		const luminance = (value: string) => {
			const [r, g, b] = (value.match(/\d+/g) ?? []).map(Number).map(c => c / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		return {
			top: [fill("top"), token("--ill-tone2")],
			light: [fill("light"), token("--ill-tone1")],
			dark: [fill("dark"), token("--surface-sunken")],
			// Edges are --ill-line at 60% over the paper (illustrations.md § Style, rule 2; receded from 72% so the accented part
			// leads, iso/accent.mjs NEUTRAL_LINES); resolve that mix on a probe.
			edge: [getComputedStyle(part.querySelector('[data-vpk-iso-role="edge"]') as Element).stroke, (() => { const probe = document.createElementNS("http://www.w3.org/2000/svg", "path"); probe.setAttribute("stroke", "color-mix(in srgb, var(--ill-line) 60%, var(--paper))"); part.appendChild(probe); const value = getComputedStyle(probe).stroke; probe.remove(); return value; })()],
			order: luminance(fill("top")) > luminance(fill("light")) && luminance(fill("light")) > luminance(fill("dark")),
		};
	});
	for (const key of ["top", "light", "dark", "edge"] as const) expect(result[key][0], key).toBe(result[key][1]);
	expect(result.order).toBe(true);
});

// Round-4 verifier: the lightbox shows the bare SVG outside the plate, so the dark tone overrides and
// the stroke rule must not depend on the [data-vpk-engine] ancestor (K13: top > near > far in both
// themes, in the zoom too).
test("(10) lightbox: interactive stages opt out; static iso figures stay zoomable and keep their tones in both themes", async ({ page }) => {
	await open(page, DEMO);
	await page.waitForTimeout(500);
	await page.locator("[data-vpk-iso-stage]").click();
	await page.waitForTimeout(200);
	expect(await page.locator(".vpkh-lightbox").count()).toBe(0);
	expect(await page.locator("[data-vpk-engine=\"iso-kit\"] .vpkh-zoomable, [data-vpk-engine=\"iso-kit\"].vpkh-zoomable").count()).toBe(0);
	const target = buildPage({ ...EXEMPLAR, id: "static-stack", interact: null }, "static");
	for (const theme of ["light", "dark"]) {
		await page.goto(url(target));
		await page.evaluate(value => document.documentElement.setAttribute("data-theme", value), theme);
		// Wait out the entry (at most 1800 ms): a dropping layer wears the accent until the hand-off, and the zoom is a still copy.
		await page.waitForTimeout(2200);
		expect(await page.locator('[data-vpk-engine="iso-kit"] .vpkh-zoomable, [data-vpk-engine="iso-kit"].vpkh-zoomable').count()).toBeGreaterThan(0);
		const inline = await tones(page, "figure svg[data-vpk-iso-id]");
		await page.locator("svg[data-vpk-iso-id]").click();
		await expect(page.locator(".vpkh-lightbox")).toHaveCount(1);
		const zoomed = await tones(page, ".vpkh-lightbox svg[data-vpk-iso]");
		expect(zoomed.parts.length, `${theme}: three-tone parts in the zoom`).toBeGreaterThan(1);
		expect(zoomed.parts.filter(part => !part.ordered), `${theme}: top > near > far in the zoom`).toEqual([]);
		expect(zoomed.parts.map(part => part.fills), `${theme}: the zoom keeps the plate's fills`).toEqual(inline.parts.map(part => part.fills));
		expect(zoomed.edge, `${theme}: the zoom keeps the stroke rule`).toEqual(inline.edge);
		expect(zoomed.edge).toEqual(["non-scaling-stroke", "round"]);
	}
});

test("(11a) mixed page: two iso figures and a third registrant share one vpkFrameLoop and one rAF chain", async ({ page }) => {
	const base = fs.readFileSync(buildPage(EXEMPLAR, "mixed-base"), "utf8");
	const loopSource = fs.readFileSync(FRAME_LOOP, "utf8").replace(/^export (?=(async )?function|const|let|class)/gm, "");
	const dummy = `<script>(() => {\n${loopSource}\nconst loop = getFrameLoop(window);\nwindow.__loopBefore = loop;\nwindow.__dummyTicks = 0;\nconst el = document.getElementById("dummy-board");\nlet until = 0;\nconst board = loop.register(el, (dt, now) => { window.__dummyTicks += 1; return now < until; });\nwindow.addEventListener("pointermove", () => { until = performance.now() + 500; board.wake(); }, { once: true });\n})();</script>`;
	const select = fragment(SELECT_BRIEF, "mixed-select");
	const html = base.replace("<main>", `<main><div id="dummy-board" style="height: 40px" aria-hidden="true"></div>${dummy}`).replace(/\n<\/main>/, `\n${select}</main>`);
	const target = file("mixed.html");
	fs.writeFileSync(target, html);
	await open(page, target);
	await page.waitForTimeout(2200);
	expect(await page.evaluate(() => (window as unknown as ProbeWindow).vpkFrameLoop === (window as unknown as ProbeWindow).__loopBefore)).toBe(true);
	expect(await page.locator("[data-vpk-iso-stage][data-vpk-iso-behavior]").count()).toBe(2);
	await resetRaf(page);
	const first = await stageBox(page, 0);
	await page.mouse.move(first.x + first.width * 0.9, first.y + first.height / 2, { steps: 5 });
	const second = await stageBox(page, 1);
	await page.mouse.move(second.x + second.width * 0.5, second.y + second.height * 0.6, { steps: 5 });
	await page.waitForTimeout(300);
	const summary = await rafSummary(page);
	expect(summary.loopFrames).toBeGreaterThan(5);
	expect(summary.maxPerFrame).toBe(1);
	expect(await page.evaluate(() => (window as unknown as ProbeWindow).__dummyTicks ?? 0)).toBeGreaterThan(5);
});

test("(11b) figure-engines demo: one camera, one loop, no CSS clash", async ({ page }) => {
	test.skip(!fs.existsSync(ENGINES_DEMO), "demo-figure-engines.html lands with ws4b Tier B (P3)");
	await open(page, ENGINES_DEMO);
	await page.waitForTimeout(2500);
	const cameras = await page.locator("[data-vpk-engine]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-vpk-camera")));
	expect(cameras.length).toBeGreaterThanOrEqual(2);
	for (const camera of cameras) expect(camera).toBe("45 30");
	await resetRaf(page);
	const iso = await page.locator('[data-vpk-engine="iso-kit"] [data-vpk-iso-stage]').first().boundingBox();
	if (iso) await page.mouse.move(iso.x + iso.width * 0.8, iso.y + iso.height / 2, { steps: 6 });
	const hero = await page.locator('[data-vpk-engine="anatomy-hero"]').first().boundingBox();
	if (hero) await page.mouse.move(hero.x + hero.width / 2, hero.y + hero.height / 2, { steps: 6 });
	await page.waitForTimeout(300);
	expect((await rafSummary(page)).maxPerFrame).toBeLessThanOrEqual(1);
	const styles = (selector: string) => page.evaluate(scope => [...document.querySelectorAll(`${scope}, ${scope} *`)].map(node => {
		const cs = getComputedStyle(node);
		return [cs.fill, cs.stroke, cs.strokeWidth, cs.opacity, cs.display, cs.transform].join("|");
	}), selector);
	const anatomyBefore = await styles('[data-vpk-engine="anatomy-hero"]');
	await page.evaluate(() => document.querySelector("style[data-vpk-iso-css]")?.remove());
	expect(await styles('[data-vpk-engine="anatomy-hero"]')).toEqual(anatomyBefore);
	await page.reload();
	await page.waitForTimeout(2500);
	const isoBefore = await styles('[data-vpk-engine="iso-kit"]');
	await page.evaluate(() => document.querySelector("style[data-vpk-anatomy-css]")?.remove());
	expect(await styles('[data-vpk-engine="iso-kit"]')).toEqual(isoBefore);
});

// P5 (ws3-manual, illustrations.md § Style): the kit's one style in Chromium. A select figure has no corner chrome,
// draws no entry ghost or arrow (the user's redline), activates a part with a 2px ink outline and one blink, and under reduced motion neither blinks nor leaves any opacity behind.
test("(20) the style: no chrome, no entry ghost or arrow, a 2px outline and one blink on the active part, none when reduced", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await open(page, buildPage({ ...SELECT_BRIEF, id: "select-manual" }, "select-manual"));
	await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
	await page.waitForTimeout(2600);
	const svg = page.locator("svg[data-vpk-iso-id]");
	expect(await svg.getAttribute("data-vpk-iso-style")).toBe("manual");
	expect(await page.locator(".vpk-iso-plate__chrome").count()).toBe(0);
	expect(await page.locator("[data-vpk-iso-ghost], [data-vpk-iso-cue], [opacity]").count(), "no ghost, entry arrow or opacity attribute").toBe(0);
	// The entry has landed: the scene rests on the hand-off's rest class, which paints nothing.
	expect(await svg.evaluate(node => node.querySelector("[data-vpk-iso-scene]")?.getAttribute("class") ?? "")).toBe("");
	expect(await allAtRest(page)).toBe(true);
	const snapshot = await svg.evaluate(node => node.outerHTML);
	const sampleOpacity = (selector: string) => page.evaluate(async sel => {
		const frame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
		const seen: number[] = [];
		const start = await frame();
		for (let now = start; now - start < 900; now = await frame()) seen.push(Number(document.querySelector(sel)?.getAttribute("opacity") ?? 1));
		return seen;
	}, selector);

	const point = await centroid(page, '[data-vpk-iso-part="tile-b"] [data-vpk-iso-role="fill"]');
	await page.mouse.move(point.x - 30, point.y - 60);
	const sampled = sampleOpacity('[data-vpk-iso-part="tile-b"]');
	await page.mouse.move(point.x, point.y, { steps: 3 });
	const seen = await sampled;
	await expect.poll(() => activeParts(page)).toEqual(["tile-b"]);
	expect(Math.min(...seen), "the part blinks as it lifts").toBeLessThan(0.8);
	expect(Math.min(...seen)).toBeGreaterThan(0.3);
	expect(await page.locator('[data-vpk-iso-part="tile-b"]').getAttribute("opacity"), "a part at full opacity carries no attribute").toBeNull();
	expect(await page.locator('[data-vpk-iso-part="tile-b"] > [data-vpk-iso-role="edge"]').evaluate(node => getComputedStyle(node).strokeWidth)).toBe("2px");
	expect(await readout(page)).toBe("tile b");
	await page.mouse.move(2, 2);
	await expect.poll(() => svg.evaluate(node => node.querySelectorAll("[class], [transform]").length), { timeout: 1500 }).toBe(0);
	expect(await svg.evaluate(node => node.outerHTML)).toBe(snapshot);

	await page.emulateMedia({ reducedMotion: "reduce" });
	const reduced = page.locator('[data-vpk-iso-part="tile-a"]');
	const other = await centroid(page, '[data-vpk-iso-part="tile-a"] [data-vpk-iso-role="fill"]');
	await page.mouse.move(other.x - 30, other.y - 60);
	const calm = sampleOpacity('[data-vpk-iso-part="tile-a"]');
	await page.mouse.move(other.x, other.y, { steps: 3 });
	expect((await calm).every(value => value === 1)).toBe(true);
	await expect.poll(() => activeParts(page)).toEqual(["tile-a"]);
	expect(await reduced.getAttribute("opacity")).toBeNull();
	expect(await page.locator("[data-vpk-iso-ghost], [data-vpk-iso-cue]").count()).toBe(0);
});

// The one accent and the motion at rest (iso/accent.mjs, shared with the 3D prototype; illustrations.md § 4 and § 8).
// The focal part paints the accent faces and its label chip the accent with ink text; hovering another part gives it the
// same faces and chip. data-vpk-iso-rest (on the stage) appears only after the entrance plus 3 s idle, drives CSS animations
// (no rAF), goes at once on input and never appears under reduced motion; the svg's outerHTML stays the static art.
test("(21) accent and motion at rest: accent focal and hover, rest after 3 s idle, off on input and when reduced, no rAF", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const labels = [{ text: "Tile B", target: "tile-b", side: "left" }, { text: "Drum", target: "drum", side: "right" }];
	await open(page, buildPage({ ...SELECT_BRIEF, id: "select-accent", labels }, "select-accent"));
	await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
	await page.mouse.move(2, 2);
	const svg = page.locator("svg[data-vpk-iso-id]");
	const stage = page.locator("[data-vpk-iso-stage]");
	const fillOf = (selector: string) => page.locator(selector).first().evaluate(node => getComputedStyle(node).fill);
	const strokeOf = (selector: string) => page.locator(selector).first().evaluate(node => getComputedStyle(node).stroke);
	const accent = await page.evaluate(() => {
		const probe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		const host = document.querySelector("svg[data-vpk-iso-id]") as SVGSVGElement;
		const read = (paint: string) => { probe.style.fill = paint; host.appendChild(probe); const value = getComputedStyle(probe).fill; probe.remove(); return value; };
		return { top: read("var(--ill-accent)"), ink: read("var(--ill-accent-ink)"), grey: read("var(--surface-raised)") };
	});
	expect(accent.top).not.toBe(accent.grey);
	expect(await fillOf('[data-vpk-iso-focal] > [data-vpk-iso-role="top"]')).toBe(accent.top);
	expect(await fillOf('[data-vpk-iso-accent] > [data-vpk-iso-chip]'), "label chips stay unpainted").not.toBe(accent.top);
	expect(await fillOf('[data-vpk-iso-accent] > text'), "label text stays ink").not.toBe(accent.top);
	expect(await fillOf('[data-vpk-iso-part="tile-b"] > [data-vpk-iso-role="top"]')).not.toBe(accent.top);

	// Rest: not before the entrance plus the idle wait, then on, with running CSS animations and no frame callbacks.
	expect(await stage.getAttribute("data-vpk-iso-rest")).toBeNull();
	await expect.poll(() => stage.getAttribute("data-vpk-iso-rest"), { timeout: 9000 }).toBe("");
	const snapshot = await svg.evaluate(node => node.outerHTML);
	const animations = await page.evaluate(() => document.getAnimations().map(a => (a as CSSAnimation).animationName).sort());
	expect(animations).toEqual(expect.arrayContaining(["vpk-iso-bob", "vpk-iso-drift-x", "vpk-iso-drift-y"]));
	await resetRaf(page);
	await page.waitForTimeout(1000);
	expect((await rafSummary(page)).loopFrames, "rest motion asks the frame loop for nothing").toBe(0);
	const drift = await page.evaluate(async () => {
		const svg = document.querySelector("svg[data-vpk-iso-id]") as SVGSVGElement;
		const seen = new Set<string>();
		for (let i = 0; i < 6; i++) { seen.add(`${getComputedStyle(svg).translate}|${getComputedStyle(svg).transform}`); await new Promise(resolve => setTimeout(resolve, 300)); }
		return seen.size;
	});
	expect(drift, "the drawing drifts while at rest").toBeGreaterThan(1);

	// Input pauses it in place (no snap back); the hovered part takes the accent faces, its label stays ink.
	const point = await centroid(page, '[data-vpk-iso-part="tile-b"] [data-vpk-iso-role="fill"]');
	await page.mouse.move(point.x, point.y, { steps: 3 });
	expect(await stage.getAttribute("data-vpk-iso-rest"), "paused where it is").toBe("paused");
	await expect.poll(() => activeParts(page)).toEqual(["tile-b"]);
	await expect.poll(() => strokeOf('[data-vpk-iso-part="tile-b"] > [data-vpk-iso-role="edge"]'), "the hovered part takes an accent outline").toBe(accent.top);
	expect(await fillOf('[data-vpk-iso-part="tile-b"] > [data-vpk-iso-role="top"]'), "its faces keep their tone").not.toBe(accent.top);
	expect(await fillOf('[data-vpk-iso-label-for="tile-b"] > [data-vpk-iso-chip]')).not.toBe(accent.top);
	await page.mouse.move(2, 2);
	await page.waitForTimeout(2000);
	expect(await stage.getAttribute("data-vpk-iso-rest"), "still paused inside the 3 s idle wait").toBe("paused");
	await expect.poll(() => stage.getAttribute("data-vpk-iso-rest"), { timeout: 4000 }).toBe("");
	await page.waitForTimeout(400);
	expect(await svg.evaluate(node => node.outerHTML), "the svg is the static art while it drifts").toBe(snapshot);

	// Reduced motion: off at once and stays off.
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect.poll(() => stage.getAttribute("data-vpk-iso-rest")).toBeNull();
	await page.waitForTimeout(3500);
	expect(await stage.getAttribute("data-vpk-iso-rest")).toBeNull();
});

// Hover physics: a guide end named by a tray id follows its lifted part, the support is fixed, a grown part keeps its bottom
// edge, and a lifted part keeps its painter-order place.
const HOVER_BRIEF = {
	schema: "vpk-iso-brief/1",
	id: "hover-physics",
	figId: "FIG_006",
	title: "Hover physics",
	label: "A card floating over a plinth beside a pillar and two upright cards.",
	parts: [
		{ id: "plinth", kind: "tray", at: [0, 0, 0], size: [140, 90, 4], label: "plinth" },
		{ id: "card", kind: "slab", at: [10, 10, 24], size: [40, 40, 3], label: "card" },
		{ id: "pillar", kind: "box", at: [70, 20, 4], size: [12, 12, 12], r: 0, label: "pillar", liftMode: "grow" },
		{ id: "back-card", kind: "slab", at: [96, 30, 4], size: [36, 2, 30], label: "back card" },
		{ id: "front-card", kind: "slab", at: [96, 50, 4], size: [36, 2, 26], label: "front card" },
	],
	focal: "card",
	interact: { behavior: "select", rest: "rest", guides: true },
};

test("(22) hover physics: guides follow a tray end, the support is fixed, a grown part keeps its base, lifts keep paint order", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await open(page, buildPage(HOVER_BRIEF, "hover-physics"));
	await page.evaluate(() => document.querySelector("[data-vpk-iso-stage]")?.scrollIntoView({ block: "center" }));
	await page.waitForTimeout(2200);
	const svg = page.locator("svg[data-vpk-iso-id]");
	const guide = page.locator('[data-vpk-iso-role="guide"][data-vpk-iso-to="plinth"]').first();
	const guideRest = await guide.getAttribute("d");
	const order = () => svg.evaluate(node => [...node.querySelectorAll("[data-vpk-iso-part]")].map(el => el.getAttribute("data-vpk-iso-part")).join(" "));
	const restOrder = await order();

	// The guide's upper end rides the card's lift; its lower end stays on the plinth.
	const card = await centroid(page, '[data-vpk-iso-part="card"] [data-vpk-iso-role="top"]');
	await page.mouse.move(card.x, card.y, { steps: 3 });
	await expect.poll(() => activeParts(page)).toEqual(["card"]);
	await expect.poll(() => guide.getAttribute("d"), { timeout: 800 }).not.toBe(guideRest);
	const ends = (d: string | null) => (d ?? "").match(/-?[\d.]+ -?[\d.]+/g)?.map(pair => pair.split(" ").map(Number)) ?? [];
	await page.waitForTimeout(400);
	const [a, b] = [ends(guideRest), ends(await guide.getAttribute("d"))];
	expect(Math.abs(b[1][1] - a[1][1]), "lower end on the plinth").toBeLessThan(0.11);
	expect(a[0][1] - b[0][1], "upper end lifted").toBeGreaterThan(5);

	// The fixed plinth: hovering its floor selects nothing and nothing moves.
	await page.mouse.move(2, 2);
	await expect.poll(() => svg.evaluate(node => node.querySelectorAll("[class], [transform]").length), { timeout: 1200 }).toBe(0);
	const floor = await svg.evaluate(node => {
		const d = node.querySelector('[data-vpk-iso-part="plinth:back"] [data-vpk-iso-role="fill"]')?.getAttribute("d") ?? "";
		const pts = (d.match(/-?[\d.]+ -?[\d.]+/g) ?? []).map(pair => pair.split(" ").map(Number));
		const left = pts.reduce((best, p) => (p[0] < best[0] ? p : best));
		const r = node.getBoundingClientRect();
		const vb = (node as SVGSVGElement).viewBox.baseVal;
		const s = Math.min(r.width / vb.width, r.height / vb.height);
		return { x: r.left + (r.width - vb.width * s) / 2 + (left[0] + 14) * s, y: r.top + (r.height - vb.height * s) / 2 + left[1] * s };
	});
	await page.mouse.move(floor.x, floor.y, { steps: 3 });
	await page.waitForTimeout(400);
	expect(await activeParts(page), "the plinth takes no hover").toEqual([]);
	expect(await svg.evaluate(node => node.querySelectorAll("[transform]").length)).toBe(0);

	// The grown pillar: its lowest point stays put while its top rises.
	const pillarBox = () => page.locator('[data-vpk-iso-part="pillar"] [data-vpk-iso-role="fill"]').boundingBox();
	const before = await pillarBox();
	const pillar = await centroid(page, '[data-vpk-iso-part="pillar"] [data-vpk-iso-role="top"]');
	await page.mouse.move(pillar.x, pillar.y, { steps: 3 });
	await expect.poll(() => activeParts(page)).toEqual(["pillar"]);
	await page.waitForTimeout(500);
	const after = await pillarBox();
	expect(Math.abs((after!.y + after!.height) - (before!.y + before!.height)), "bottom edge in place").toBeLessThan(0.6);
	expect(before!.y - after!.y, "top rose").toBeGreaterThan(5);
	expect(await page.locator('[data-vpk-iso-part="pillar"]').getAttribute("transform")).toBeNull();

	// The back card lifts but stays behind the front card in paint order.
	const back = await centroid(page, '[data-vpk-iso-part="back-card"] [data-vpk-iso-role="top"]');
	await page.mouse.move(back.x, back.y - 2, { steps: 3 });
	await expect.poll(() => activeParts(page)).toEqual(["back-card"]);
	await page.waitForTimeout(500);
	expect(await order(), "lifting does not reorder").toBe(restOrder);
	expect(restOrder.indexOf("back-card")).toBeLessThan(restOrder.indexOf("front-card"));
});

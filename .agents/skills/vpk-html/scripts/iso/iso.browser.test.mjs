// iso-kit browser suite. Opt-in, never in the unit manifest (R25); needs Playwright Chromium and the unsandboxed
// shell:
//   VPK_HTML_BROWSER=1 node --test .agents/skills/vpk-html/scripts/iso/iso.browser.test.mjs
// Covers the narrow-stage CSS on a real page: the callouts hide at 390 px and the flow arrows stay, and the legend
// keeps its type against a host page's unlayered `li { ... !important }` (P4 items 10 and 22).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const skip = process.env.VPK_HTML_BROWSER === "1" ? false : "set VPK_HTML_BROWSER=1 to run the browser suite";

// The template shell's own `li` rule (identity block), which once beat the legend's class rule.
const HOST_LI = 'li { font-size: 17px !important; line-height: 23px !important; font-family: "Geist Mono Numeric", var(--font-body) !important; }';

async function figurePage(dir) {
	const [{ renderIsoFigure }, { applyRuntimePipeline }, { illustrationPage }] = await Promise.all([
		import("./build-figure.mjs"),
		import("../runtime/pipeline.mjs"),
		import("../figures/page.mjs"),
	]);
	const brief = JSON.parse(fs.readFileSync(path.join(HERE, "..", "figures", "briefs", "round-trip.json"), "utf8"));
	brief.annotations = [
		{ kind: "dimension", from: [0, 64, 0], to: [160, 64, 0], text: "160 MM" },
		{ kind: "arrow", from: [52, 36, 10], to: [60, 36, 10] },
		{ kind: "arrow", from: [104, 36, 10], to: [112, 36, 10] },
	];
	const file = path.join(dir, "iso-narrow.html");
	const html = illustrationPage({ slug: "iso-narrow", title: "Narrow stage", summary: "Fixture.", eyebrow: "fixture", figureHtml: `\t${renderIsoFigure(brief, { indent: "\t" }).region}`, figureEngine: "iso-kit" });
	fs.writeFileSync(file, applyRuntimePipeline(html, { filePath: file }).replace("</head>", `<style>${HOST_LI}</style>\n</head>`));
	return file;
}

const PROBE = () => {
	const display = el => getComputedStyle(el).display;
	const box = el => {
		const rect = el.getBoundingClientRect();
		return rect.width > 0 || rect.height > 0;
	};
	const li = document.querySelector(".vpk-iso-legend li");
	const dot = li?.querySelector("span");
	const type = el => (el ? { size: getComputedStyle(el).fontSize, line: getComputedStyle(el).lineHeight, family: getComputedStyle(el).fontFamily } : null);
	return {
		arrows: [...document.querySelectorAll('[data-vpk-iso-annotation="arrow"] path')].map(box),
		labels: [...document.querySelectorAll("[data-vpk-iso-label-for]")].map(display),
		dimensions: [...document.querySelectorAll('[data-vpk-iso-annotation="dimension"]')].map(display),
		legend: li ? display(li.parentElement) : null,
		li: type(li),
		dot: type(dot),
		dotBox: dot ? (({ height }) => height)(dot.getBoundingClientRect()) : null,
		arrowStroke: getComputedStyle(document.querySelector('[data-vpk-iso-annotation="arrow"] path')).strokeWidth,
		leaderStroke: getComputedStyle(document.querySelector('[data-vpk-iso-role="leader"]')).strokeWidth,
	};
};

test("390 px: callouts hide, flow arrows stay visible and heavier than leaders, legend type is 11 px mono", { skip }, async () => {
	const fs2 = await import("node:fs");
	const os = await import("node:os");
	const dir = fs2.mkdtempSync(path.join(os.tmpdir(), "vpk-iso-narrow-"));
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		const file = await figurePage(dir);
		for (const [width, narrow] of [[390, true], [1280, false]]) {
			const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
			try {
				const page = await context.newPage();
				const errors = [];
				page.on("pageerror", error => errors.push(error.message));
				await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
				await page.evaluate(async () => {
					try { await document.fonts.ready; } catch { /* noop */ }
				});
				const probe = await page.evaluate(PROBE);
				const label = `${width}px`;
				assert.equal(probe.arrows.length, 2, `${label}: two arrow annotations`);
				assert.deepEqual(probe.arrows, [true, true], `${label}: every arrow path has a non-zero box`);
				assert.ok(Number.parseFloat(probe.arrowStroke) > Number.parseFloat(probe.leaderStroke), `${label}: flow arrows are heavier than leaders (${probe.arrowStroke} vs ${probe.leaderStroke})`);
				if (narrow) {
					assert.ok(probe.labels.length > 0 && probe.labels.every(value => value === "none"), `${label}: label callouts hidden`);
					assert.ok(probe.dimensions.length > 0 && probe.dimensions.every(value => value === "none"), `${label}: dimension notes hidden (their text is in the legend)`);
					assert.equal(probe.legend, "flex", `${label}: the legend is shown`);
					assert.equal(probe.li.size, "11px", `${label}: legend type is 11 px, not the host li rule's 17 px (${JSON.stringify(probe.li)})`);
					assert.match(probe.li.family, /mono/i, `${label}: legend is set in the mono face (${probe.li.family})`);
					assert.notEqual(probe.li.line, "23px", `${label}: the host li line-height does not apply`);
					assert.equal(probe.dot.line, "10px", `${label}: the digit's line box (${probe.dot.line}) fits its 18 px circle`);
					assert.ok(probe.dotBox <= 20, `${label}: the circle stays 18 px tall (${probe.dotBox})`);
				} else {
					assert.ok(probe.labels.every(value => value !== "none"), `${label}: label callouts shown`);
					assert.ok(probe.dimensions.every(value => value !== "none"), `${label}: dimension notes shown`);
				}
				assert.deepEqual(errors, [], `${label}: no page errors`);
			} finally {
				await context.close();
			}
		}
	} finally {
		await browser.close();
		fs2.rmSync(dir, { recursive: true, force: true });
	}
});

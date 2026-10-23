// Shared fixtures for the vpk-html iso kit Chromium specs: iso-runtime.spec.ts (ws3 §8 checks 1–11)
// and iso-runtime-print.spec.ts (print after interaction, host templates, narrow chrome, touch).
// Split per B2 decision 6 so every file stays under 500 lines (ws3 §9 item 6). file:// only: the
// committed demo plus temp pages built with scripts/iso/build-figure.mjs. No dev server.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "@playwright/test";

export const ROOT = process.cwd();
export const SKILL = path.join(ROOT, ".agents/skills/vpk-html");
export const BUILD_FIGURE = path.join(SKILL, "scripts/iso/build-figure.mjs");
export const DEMO = path.join(SKILL, "assets/demos/demo-illustration-iso-exploded-stack.html");
export const ENGINES_DEMO = path.join(SKILL, "assets/demos/demo-figure-engines.html");
export const FRAME_LOOP = path.join(SKILL, "scripts/runtime/frame-loop.mjs");
export const EXEMPLAR = JSON.parse(fs.readFileSync(path.join(SKILL, "scripts/iso/briefs/exploded-stack.json"), "utf8")) as Record<string, unknown>;
export const NODE_ENV = { ...process.env, OPENSSL_CONF: "/dev/null" };

// A select figure for check 4 and the select checks in (20).
export const SELECT_BRIEF = {
	schema: "vpk-iso-brief/1",
	id: "select-wall",
	figId: "FIG_003",
	title: "Select wall",
	label: "A small wall of tiles beside a tray; each part lifts and names itself when pointed at.",
	caption: "Pointing at a tile lifts it and names it; neighbours settle in order of distance.",
	parts: [
		{ id: "tray", kind: "tray", at: [0, 0, 0], size: [60, 100, 6], label: "tray" },
		{ id: "card-a", kind: "plate", at: [5, 8, 4], size: [50, 40, 2], label: "card a" },
		{ id: "card-b", kind: "plate", at: [5, 54, 4], size: [50, 40, 2], label: "card b" },
		{ id: "tile-a", kind: "box", at: [90, 0, 0], size: [40, 40, 10], label: "tile a" },
		{ id: "tile-b", kind: "box", at: [90, 50, 0], size: [40, 40, 14], label: "tile b" },
		{ id: "drum", kind: "cylinder", at: [160, 30, 0], size: [16, 16, 24], label: "drum" },
	],
	focal: "drum",
	assemble: { layers: [["tray", "tile-a"], ["card-a", "card-b", "tile-b"], ["drum"]] },
	interact: { behavior: "select", rest: "rest" },
};

type Frame = { loop: number; enhancer: number; other: number };
export type ProbeWindow = Window & {
	__begins: number;
	__raf: { frames: Map<number, Frame>; reset(): void };
	__loopBefore?: unknown;
	__dummyTicks?: number;
	vpkFrameLoop?: unknown;
};

// One temp directory per worker, created on first use; every spec names its files uniquely.
let dir = "";
export const file = (name: string) => {
	if (!dir) dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-iso-spec-"));
	return path.join(dir, name);
};
export const url = (target: string) => pathToFileURL(target).href;

export function buildPage(brief: Record<string, unknown>, name: string): string {
	const briefPath = file(`${name}.json`);
	fs.writeFileSync(briefPath, JSON.stringify(brief));
	const out = file(`${name}.html`);
	execFileSync(process.execPath, [BUILD_FIGURE, "--brief", briefPath, "--out", out], { env: NODE_ENV, stdio: "pipe" });
	return out;
}

export function fragment(brief: Record<string, unknown>, name: string): string {
	const briefPath = file(`${name}.json`);
	fs.writeFileSync(briefPath, JSON.stringify(brief));
	return execFileSync(process.execPath, [BUILD_FIGURE, "--brief", briefPath, "--fragment"], { env: NODE_ENV, encoding: "utf8" });
}

// The documented --inject path (ws3 §4.9) on a host page that already carries region markers.
export function inject(target: string) {
	execFileSync(process.execPath, [BUILD_FIGURE, "--inject", target], { env: NODE_ENV, stdio: "pipe" });
}

// A copy of a page with a tall spacer, so the figure starts below the fold.
export function belowFold(source: string, name: string): string {
	const out = file(`${name}.html`);
	fs.writeFileSync(out, fs.readFileSync(source, "utf8").replace("<main>", '<main><div style="height: 1800px" aria-hidden="true"></div>'));
	return out;
}

function probes() {
	const w = window as unknown as ProbeWindow;
	w.__begins = 0;
	window.addEventListener("beginEvent", () => { w.__begins += 1; }, true);
	const original = window.requestAnimationFrame.bind(window);
	const frames = new Map<number, Frame>();
	w.__raf = { frames, reset: () => frames.clear() };
	window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
		const source = String(callback);
		const kind: keyof Frame = /gen\s*&&\s*run\(\)/.test(source) ? "loop" : /updateScrollFades|refreshZoomables/.test(source) ? "enhancer" : "other";
		return original(time => {
			const frame = frames.get(time) ?? { loop: 0, enhancer: 0, other: 0 };
			frame[kind] += 1;
			frames.set(time, frame);
			callback(time);
		});
	};
}

export async function open(page: Page, target: string) {
	await page.addInitScript(probes);
	await page.goto(url(target));
	await page.waitForLoadState("load");
}

export const rafSummary = (page: Page) => page.evaluate(() => {
	const list = [...(window as unknown as ProbeWindow).__raf.frames.values()];
	return { frames: list.length, maxPerFrame: Math.max(0, ...list.map(f => f.loop + f.enhancer + f.other)), loopFrames: list.filter(f => f.loop).length, maxLoop: Math.max(0, ...list.map(f => f.loop)), enhancer: list.reduce((sum, f) => sum + f.enhancer, 0) };
});
export const resetRaf = (page: Page) => page.evaluate(() => (window as unknown as ProbeWindow).__raf.reset());

// Every [data-vpk-iso-enter] / [data-vpk-iso-part] has the identity local CTM (equal to its parent's).
export const allAtRest = (page: Page, root = "svg[data-vpk-iso-id]") => page.evaluate(selector => {
	const same = (a: DOMMatrix | null, b: DOMMatrix | null) => !!a && !!b && ["a", "b", "c", "d", "e", "f"].every(key => Math.abs(a[key as "a"] - b[key as "a"]) < 1e-3);
	const nodes = [...document.querySelectorAll(`${selector} [data-vpk-iso-enter], ${selector} [data-vpk-iso-part]`)] as SVGGraphicsElement[];
	return nodes.length > 0 && nodes.every(node => same(node.getCTM(), (node.parentNode as SVGGraphicsElement).getCTM()));
}, root);

export const topGroupDy = (page: Page) => page.evaluate(() => {
	const groups = [...document.querySelectorAll("[data-vpk-iso-enter]")] as SVGGraphicsElement[];
	const top = groups[groups.length - 1];
	return (top.getCTM()?.f ?? 0) - ((top.parentNode as SVGGraphicsElement).getCTM()?.f ?? 0);
});

export const readout = (page: Page) => page.locator("[data-vpk-iso-readout]").first().textContent();

export async function stageBox(page: Page, nth = 0) {
	const box = await page.locator("[data-vpk-iso-stage][data-vpk-iso-behavior]").nth(nth).boundingBox();
	if (!box) throw new Error("stage not rendered");
	return box;
}

// Screen point at the centre of an SVG element's bounding box.
export const centroid = (page: Page, selector: string) => page.evaluate(sel => {
	const fill = document.querySelector(sel) as SVGPathElement;
	const box = fill.getBBox();
	const matrix = (fill.ownerSVGElement as SVGSVGElement).getScreenCTM() as DOMMatrix;
	const p = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(matrix);
	return { x: p.x, y: p.y };
}, selector);

// Computed top/near/far fills of every three-tone part under one SVG, with the luminance order
// (K13: top > near > far in both themes), plus the first edge's vector-effect and line join.
export const tones = (page: Page, selector: string) => page.evaluate(sel => {
	const svg = document.querySelector(sel) as SVGSVGElement;
	const luminance = (value: string) => {
		const [r, g, b] = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map(c => c / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const parts = [...svg.querySelectorAll("[data-vpk-iso-part]")].filter(part => ["top", "light", "dark"].every(tone => part.querySelector(`[data-vpk-iso-tone="${tone}"]`))).map(part => {
		const fills = ["top", "light", "dark"].map(tone => getComputedStyle(part.querySelector(`[data-vpk-iso-tone="${tone}"]`) as Element).fill);
		const [top, near, far] = fills.map(luminance);
		return { part: part.getAttribute("data-vpk-iso-part"), fills, ordered: top > near && near > far };
	});
	const edge = getComputedStyle(svg.querySelector('[data-vpk-iso-role="edge"]') as Element);
	return { parts, edge: [edge.vectorEffect, edge.strokeLinejoin] };
}, selector);

export const activeParts =(page: Page) => page.locator("svg [data-vpk-iso-part].is-active").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-vpk-iso-part")));

// Verifier round 2: the print CSS forces part transforms to none, but guide and leader `d` and the
// active stroke are runtime writes it cannot reach, so the print checks read both.
export const lineDs = (page: Page) => page.evaluate(() => [...document.querySelectorAll('svg[data-vpk-iso-id] [data-vpk-iso-role="guide"], svg[data-vpk-iso-id] [data-vpk-iso-role="leader"]')].map(node => node.getAttribute("d")));
export const printPose = (page: Page) => page.evaluate(() => {
	const svg = document.querySelector("svg[data-vpk-iso-id]") as SVGSVGElement;
	return { transforms: svg.querySelectorAll("[data-vpk-iso-part][transform]").length, active: svg.querySelectorAll(".is-active").length, computed: [...svg.querySelectorAll("[data-vpk-iso-part]")].every(node => getComputedStyle(node).transform === "none") };
});

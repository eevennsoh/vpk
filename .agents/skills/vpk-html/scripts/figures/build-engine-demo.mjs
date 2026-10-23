#!/usr/bin/env node
/*
 * figures/build-engine-demo — the figure-engine demo pages (ws4b spec section 6.8; integration R31, K2, K11).
 *
 *   node .agents/skills/vpk-html/scripts/figures/build-engine-demo.mjs [--page anatomy|engines|all] [--check]
 *
 * Tier A writes assets/demos/demo-anatomy-hero.html: the dial-indicator hero (scripts/anatomy/examples/
 * dial-indicator.hero.mjs) in the neutral figures/page.mjs shell, with a "How the hero is built" table of
 * measured parts, audit result, truth-model range and bytes.
 * Tier B writes assets/demos/demo-figure-engines.html: one iso-kit figure (the ws3 renderIsoFigure over
 * figures/briefs/round-trip.json) and the same dial hero in one page. It carries the vpk-figure-engine meta
 * "both" (R4), both roots with data-vpk-camera "45 30" (R2, R3), the lightbox opt-out on both (R6) and one shared
 * vpkFrameLoop (R1), and a "How they share the page" table whose every byte figure is measured from the builders'
 * output and the page itself (the page total is a fixed point: the table is part of the page it measures).
 * renderEngineDemo() returns applyRuntimePipeline(html, { filePath }), so the committed file is the pipeline's
 * fixed point and --check compares whole files. The hero audit must pass or nothing is written. Writing under
 * .agents/skills/ needs the unsandboxed shell; --check is read-only.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEMOS } from "../shared.mjs";
import { illustrationPage } from "./page.mjs";

const __filename = fileURLToPath(import.meta.url);
const SCRIPTS = path.resolve(path.dirname(__filename), "..");
const DIAL_MODULE = path.join(SCRIPTS, "anatomy", "examples", "dial-indicator.hero.mjs");
const ROUND_TRIP_BRIEF = path.join(SCRIPTS, "figures", "briefs", "round-trip.json");

const kb = n => `${(n / 1024).toFixed(1)} KB`;
const escapeHtml = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toPosix = p => p.split(path.sep).join("/");

const EXTRA_CSS = `.hero-notes {
\tdisplay: grid;
\tgap: 12px;
\tmax-width: 72ch;
}

.hero-notes h2 {
\tcolor: var(--headline);
\tfont-size: 20px;
\tfont-weight: 500;
}

.hero-notes p {
\tcolor: var(--body-text);
}

.hero-facts {
\tmargin: 0;
}

.hero-facts th,
.hero-facts td {
\ttext-align: left;
\twhite-space: normal;
}`;

// Tier B: each engine's figure sits in its own section with a heading and one sentence of when-to-use.
const ENGINES_CSS = `${EXTRA_CSS}

.engine-figure {
\tdisplay: grid;
\tgap: 14px;
}

.engine-figure h2 {
\tcolor: var(--headline);
\tfont-size: 20px;
\tfont-weight: 500;
}

.engine-figure > p {
\tcolor: var(--body-text);
\tmax-width: 72ch;
}`;

const factsTable = (caption, rows) => {
	const body = rows.map(([label, value]) => `\t\t\t<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("\n");
	return `\t\t<table class="hero-facts">\n\t\t\t<caption>${escapeHtml(caption)}</caption>\n${body}\n\t\t</table>`;
};

// The dial hero, built with its audit (the demo is written only when it passes).
async function buildDial(filePath) {
	const { buildHero } = await import("../anatomy/hero.mjs");
	const mod = await import(pathToFileURL(DIAL_MODULE).href);
	const src = toPosix(path.relative(path.dirname(filePath), DIAL_MODULE));
	const built = await buildHero(mod, { audit: true, src });
	if (built.audit.failures) throw new Error(`the dial hero fails its audit (${built.audit.failures} problems):\n${built.audit.report}`);
	return { mod, built };
}

async function renderAnatomyDemo() {
	const [{ anatomyCssBlock, anatomyRuntimeBlock }, { applyRuntimePipeline }] = await Promise.all([import("../anatomy/runtime.mjs"), import("../runtime/pipeline.mjs")]);
	const filePath = path.join(DEMOS, "demo-anatomy-hero.html");
	const { mod, built } = await buildDial(filePath);
	const { input } = mod.hero.stage;
	const presentAt = value => mod.present(mod.model(value, mod.data), mod.data).readout;
	const rows = [
		["Parts (recorder items with a solid)", `${built.parts}, Figure tier (40–80)`],
		["Solids", String(built.solids)],
		["Audit", "passed: 0 problems across depth order, supports, sunk pairs, clearances and stand-in coverage"],
		["Truth-model input", `carriage travel ${input.min}–${input.max} px, rest ${input.rest} px, step ${input.step} px`],
		["Presented range", `${presentAt(input.min)} at ${input.min} px; ${presentAt(input.rest)} at rest; ${presentAt(input.max)} at ${input.max} px`],
		["Camera", `${built.camera} (azimuth and elevation, shared by both figure engines)`],
		["Hero region", `${kb(built.sizes.region)}: SVG ${kb(built.sizes.svg)}, live script ${kb(built.sizes.script)}, data island ${kb(built.sizes.data)}`],
		["Anatomy CSS block", kb(Buffer.byteLength(anatomyCssBlock()))],
		["Anatomy runtime block", `${kb(Buffer.byteLength(anatomyRuntimeBlock()))} (kit subset, shared frame loop, mount runtime)`],
	];
	const afterHtml = `\t<section class="hero-notes">
\t\t<h2>How the hero is built</h2>
\t\t<p>The hero module holds a pure truth model and presenter. The build draws the rest pose from the model, records a shape for every part and settles painter's order from real geometry; the live code moves the same parts by delta from rest, so the static SVG, the printed page and reduced motion all show the true rest pose.</p>
${factsTable("Measured from build-hero output", rows)}
\t</section>`;
	const html = illustrationPage({
		slug: "anatomy-hero",
		title: "An anatomy hero: the dial indicator",
		summary: "Choose an anatomy hero when one physical mechanism carries the story and the reader should be able to work it: here the carriage slides three gauge blocks under the plunger, and the needle reads the height of whichever block is beneath it. One hero per document, Figure tier by default.",
		eyebrow: "figure engines · anatomy hero",
		figureHtml: built.fragment,
		figureEngine: "anatomy-hero",
		afterHtml,
		extraCss: EXTRA_CSS,
	});
	return { file: filePath, html: applyRuntimePipeline(html, { filePath }), summary: `hero ${built.id} · ${built.parts} parts · region ${kb(built.sizes.region)}` };
}

const blockBytes = (html, name) => {
	const match = new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`).exec(html);
	return match ? Buffer.byteLength(match[0]) : 0;
};

async function renderEnginesDemo() {
	const [{ renderIsoFigure }, { isoRuntimeBlock }, { anatomyCssBlock, anatomyRuntimeBlock }, { FIGURE_FACE_ROLES }, { FIGURE_CAMERA, cameraAttr }, { applyRuntimePipeline }] = await Promise.all([
		import("../iso/build-figure.mjs"),
		import("../iso/inline.mjs"),
		import("../anatomy/runtime.mjs"),
		import("../anatomy/tokens.mjs"),
		import("./camera.mjs"),
		import("../runtime/pipeline.mjs"),
	]);
	const filePath = path.join(DEMOS, "demo-figure-engines.html");
	const { mod, built } = await buildDial(filePath);
	const brief = JSON.parse(fs.readFileSync(ROUND_TRIP_BRIEF, "utf8"));
	const iso = renderIsoFigure(brief, { indent: "\t" });
	const camera = cameraAttr(FIGURE_CAMERA);
	const roles = FIGURE_FACE_ROLES;
	const isoBlock = Buffer.byteLength(isoRuntimeBlock());
	const anatomyBlocks = Buffer.byteLength(anatomyCssBlock()) + Buffer.byteLength(anatomyRuntimeBlock());
	const figures = iso.sizes.region + built.sizes.region;
	const { input } = mod.hero.stage;

	const render = total => {
		// Everything in the page that is not a figure region or a runtime block: the shell, the copy and this table.
		const shell = total - figures - isoBlock - anatomyBlocks;
		const rows = [
			["Camera", `${camera} (azimuth, elevation) on both roots as data-vpk-camera; the iso kit and the hero fit their projections to the one shared FIGURE_CAMERA`],
			["Frame loop", "one window.vpkFrameLoop: one requestAnimationFrame chain and one IntersectionObserver for every board; the iso stage and the hero register on it, and off-screen boards never tick"],
			["CSS scopes", `iso kit: [data-vpk-engine="iso-kit"] and the vpk-iso-* classes; anatomy hero: :where([data-vpk-engine="anatomy-hero"]) and the bare iso-* classes; neither selects the other's elements`],
			["Face tones", `top ${roles.light.top} in light and ${roles.dark.top} in dark, near side ${roles.light.sideNear} in both, in both engines; an anatomy far side may be one step deeper (${roles.light.sideDeep} in light)`],
			["Lightbox", "both interactive roots carry data-vpkh-no-lightbox, so the enhancer never zooms them and never wakes on their motion"],
			["Truth model", `the hero's readout comes from present(model(input)): ${mod.present(mod.model(input.rest, mod.data), mod.data).readout} at rest (${input.min}–${input.max} px of travel)`],
			["Iso figure region", `${kb(iso.sizes.region)}: SVG ${kb(iso.sizes.svg)}`],
			["Iso runtime block", kb(isoBlock)],
			["Hero region", `${kb(built.sizes.region)}: SVG ${kb(built.sizes.svg)}, live script ${kb(built.sizes.script)}, data island ${kb(built.sizes.data)}`],
			["Anatomy CSS and runtime blocks", `${kb(anatomyBlocks)}: CSS ${kb(Buffer.byteLength(anatomyCssBlock()))}, runtime ${kb(Buffer.byteLength(anatomyRuntimeBlock()))}`],
			["Shell, copy and this table", kb(shell)],
			["Page total", kb(total)],
		];
		const isoSection = `\t<section class="engine-figure">
\t\t<h2>Iso kit: the review round trip</h2>
\t\t<p>Choose the iso kit for figures that sit inside the argument: stacks, trays and assemblies. This one is a short brief; point at a plate, or use the arrow keys, to lift it and name it.</p>
${iso.region}
\t</section>`;
		const heroSection = `\t<section class="engine-figure">
\t\t<h2>Anatomy hero: the dial indicator</h2>
\t\t<p>Choose the hero when one machine carries the story and the reader should work it. Slide the carriage; the readout names the block under the plunger and comes from the same model that moves the parts.</p>
${built.fragment}
\t</section>`;
		const afterHtml = `\t<section class="hero-notes">
\t\t<h2>How they share the page</h2>
\t\t<p>One document can carry both engines. They keep one camera, one frame loop, one set of grayscale tones and one frame, and each engine ships its own CSS and runtime block under its own scope.</p>
${factsTable("Measured from the builders' output and this page", rows)}
\t</section>`;
		const html = illustrationPage({
			slug: "figure-engines",
			title: "Two figure engines, one camera",
			summary: "One document can mix an iso-kit figure and an anatomy hero. They share one camera, one frame loop and one set of grayscale face tones, so the page reads as a single drawing system; the table at the end measures what each engine costs.",
			eyebrow: "figure engines · both engines",
			figureHtml: `${isoSection}\n${heroSection}`,
			figureEngine: "both",
			afterHtml,
			extraCss: ENGINES_CSS,
		});
		return applyRuntimePipeline(html, { filePath });
	};

	// The table prints the page's own size, so the page is a fixed point: html === render(bytes(html)).
	let html = render(0);
	for (let pass = 0; ; pass++) {
		const next = render(Buffer.byteLength(html));
		if (next === html) break;
		if (pass >= 5) throw new Error("the page total did not settle");
		html = next;
	}
	return { file: filePath, html, summary: `iso ${iso.sizes.region} B · hero ${built.parts} parts, region ${kb(built.sizes.region)} · blocks ${blockBytes(html, "vpk-iso")} B iso, ${anatomyBlocks} B anatomy` };
}

const PAGES = Object.freeze({ anatomy: renderAnatomyDemo, engines: renderEnginesDemo });

export async function renderEngineDemo(page) {
	const render = PAGES[page];
	if (!render) throw new Error(`unknown demo page ${JSON.stringify(page)} (available: ${Object.keys(PAGES).join(", ")})`);
	return render();
}

export async function runBuildEngineDemo({ page = "all", check = false } = {}) {
	const pages = page === "all" ? Object.keys(PAGES) : [page];
	let stale = 0;
	for (const name of pages) {
		const { file, html, summary } = await renderEngineDemo(name);
		const rel = path.relative(process.cwd(), file);
		const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
		if (check) {
			if (current === html) console.log(`✓ ${rel} is up to date`);
			else {
				stale += 1;
				console.log(`✗ ${rel} ${current === null ? "is missing" : "differs from its builder"}: run node .agents/skills/vpk-html/scripts/figures/build-engine-demo.mjs --page ${name} (unsandboxed)`);
			}
			continue;
		}
		if (current !== html) fs.writeFileSync(file, html, "utf8");
		console.log(`${current === html ? "✓ unchanged" : "✓ wrote"} ${rel} · ${summary} · page ${kb(Buffer.byteLength(html))}`);
	}
	return stale ? 1 : 0;
}

async function main(argv) {
	const args = { page: "all", check: false };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--check") args.check = true;
		else if (argv[i] === "--page" && argv[i + 1]) args.page = argv[++i];
		else {
			console.error("Usage: build-engine-demo.mjs [--page anatomy|engines|all] [--check]");
			return 2;
		}
	}
	if (args.page !== "all" && !(args.page in PAGES)) {
		console.error(`unknown --page ${args.page} (available: ${Object.keys(PAGES).join(", ")}, all)`);
		return 2;
	}
	return runBuildEngineDemo(args);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	process.exitCode = await main(process.argv.slice(2));
}

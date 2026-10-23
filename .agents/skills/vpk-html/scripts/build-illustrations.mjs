#!/usr/bin/env node
/*
 * build-illustrations (v2) — the technical-illustration exemplar generator.
 *
 *   node .agents/skills/vpk-html/scripts/build-illustrations.mjs            # brief exemplars only (unsandboxed write)
 *   node .agents/skills/vpk-html/scripts/build-illustrations.mjs --check    # exit 1 if a brief exemplar drifted
 *   node .agents/skills/vpk-html/scripts/build-illustrations.mjs --legacy   # also rewrite the 5 hand SVG exemplars
 *
 * BRIEF_EXAMPLES are iso-kit briefs (scripts/iso/briefs/*.json): buildFigure() → illustrationPage()
 * (figures/page.mjs) → the ws0 runtime pipeline per target, written to assets/illustrations/<slug>.html
 * and assets/demos/demo-illustration-<slug>.html. GALLERY puts all of them on one demo page,
 * assets/demos/demo-illustration-gallery.html (one inlined iso block, a distinct FIG_nnn per figure).
 * Every output passes check-html and the iso audit before anything is written.
 * LEGACY_EXAMPLES are the five v1 hand SVGs. They are maintained in place by
 * build.mjs --refresh-library; --legacy regenerates them and warns, because the committed copies
 * have drifted from this source (ws0 V9: about −13,000 lines). They keep their paths and markup.
 * Finish with: node .agents/skills/vpk-html/scripts/build.mjs --refresh-library (barrier step).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { illustrationPage } from "./figures/page.mjs";
import { buildFigure } from "./iso/build-figure.mjs";
import { auditHtml } from "./iso/audit.mjs";
import { DEMOS, ILLUSTRATIONS } from "./shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BRIEF_EXAMPLES = Object.freeze([
	{
		slug: "iso-exploded-stack",
		brief: "iso/briefs/exploded-stack.json",
		title: "Exploded Stack",
		summary: "An isometric stack built by the iso kit from a JSON brief. It assembles once on entry, separates under the pointer or the Gap slider, and holds still under reduced motion.",
	},
	{
		slug: "iso-flatpack-shelf",
		brief: "iso/briefs/flatpack-shelf.json",
		title: "Flat-pack shelf, step 3",
		summary: "An assembly-manual exploded view of a small wall shelf. Hover to pull the panels apart along the dowel axis; the orange middle shelf is the part this step adds.",
	},
	{
		slug: "iso-phone-anatomy",
		brief: "iso/briefs/phone-anatomy.json",
		title: "Anatomy of a phone",
		summary: "A phone pulled apart into its stacked layers, from back glass to cover glass. Hover a layer to lift it and read its name; the battery is the part to watch.",
	},
	{
		slug: "iso-cache-shelves",
		brief: "iso/briefs/cache-shelves.json",
		title: "Select a cache tier",
		summary: "A system figure of a three-tier read path: CPU, L1/L2 caches and memory as stacked plates on a board. Select any tier to lift it; the L2 cache is the one under discussion.",
	},
	{
		slug: "iso-parcel-tray",
		brief: "iso/briefs/parcel-tray.json",
		title: "Parcel sorting tray",
		summary: "An open sorting tray holding three parcels and a coiled tape roll, seen from above. Hover to lift the parcels out of the tray; the urgent parcel carries the accent.",
	},
	{
		slug: "iso-turntable-anatomy",
		brief: "iso/briefs/turntable-anatomy.json",
		title: "Anatomy of a turntable",
		summary: "A record player built from a plinth, a cylindrical platter, a record and a tonearm block, with its true depth dimensioned. Hover to explode it upward; the record is the focal part.",
	},
	{
		slug: "iso-card-stack-ui",
		brief: "iso/briefs/card-stack-ui.json",
		title: "Anatomy of a card",
		summary: "A UI card pulled apart into its interface layers: surface, media, text block, action button and focus ring. Select a layer to lift it out; the primary button is the part to watch.",
	},
]);

export const LEGACY_EXAMPLES = Object.freeze([
	{
		slug: "isometric-device",
		title: "Isometric Device",
		summary: "An isometric hardware shell using the grayscale figure ramp for faces, edges, and labels.",
		svg: `\t\t<svg data-vpk-illustration viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Isometric device shell with labeled screen, base, and connector rail.">
\t\t\t<path d="M170 132 390 64 552 136 332 214Z" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M332 214 552 136 552 264 332 342Z" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<path d="M170 132 332 214 332 342 170 258Z" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M228 148 390 100 494 144 332 198Z" fill="var(--paper)" stroke="var(--ill-line)"/>
\t\t\t<path d="M252 232 302 256M252 250 302 274M252 268 302 292" stroke="var(--ill-hatch)" stroke-width="2"/>
\t\t\t<path d="M426 246h82M426 264h60M426 282h72" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<path d="M116 110h94" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<path d="M210 110 196 102v16Z" fill="var(--ill-line)"/>
\t\t\t<text x="72" y="114" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">screen</text>
\t\t\t<path d="M556 304c34 0 42-18 64-18" stroke="var(--ill-line)"/>
\t\t\t<text x="626" y="290" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">rail</text>
\t\t</svg>`,
	},
	{
		slug: "exploded-assembly",
		title: "Exploded Assembly",
		summary: "An exploded component stack with indefinite SMIL transforms started only when motion is allowed.",
		svg: `\t\t<svg data-vpk-illustration data-vpk-smil-stagger="90" viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Exploded assembly with three isometric plates moving into assembled position.">
\t\t\t<g>
\t\t\t\t<path d="M180 158 350 104 520 158 350 220Z" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t\t<animateTransform attributeName="transform" type="translate" begin="indefinite" dur="240ms" values="0 -46; 0 0" keySplines="0.25 0.1 0.25 1" calcMode="spline" fill="freeze"/>
\t\t\t</g>
\t\t\t<g>
\t\t\t\t<path d="M180 216 350 162 520 216 350 278Z" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t\t<path d="M250 218h200" stroke="var(--ill-hatch)" stroke-width="2" stroke-dasharray="10 10"/>
\t\t\t\t<animateTransform attributeName="transform" type="translate" begin="indefinite" dur="240ms" values="0 0; 0 0" keySplines="0.25 0.1 0.25 1" calcMode="spline" fill="freeze"/>
\t\t\t</g>
\t\t\t<g>
\t\t\t\t<path d="M180 274 350 220 520 274 350 336Z" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t\t<animateTransform attributeName="transform" type="translate" begin="indefinite" dur="240ms" values="0 46; 0 0" keySplines="0.25 0.1 0.25 1" calcMode="spline" fill="freeze"/>
\t\t\t</g>
\t\t\t<path d="M112 158h60M112 216h60M112 274h60" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<text x="66" y="162" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">top</text>
\t\t\t<text x="52" y="220" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">core</text>
\t\t\t<text x="44" y="278" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">base</text>
\t\t</svg>`,
	},
	{
		slug: "annotated-mechanism",
		title: "Annotated Mechanism",
		summary: "Dimension lines, leader curls, and compact mono labels for a compact mechanism diagram.",
		svg: `\t\t<svg data-vpk-illustration viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Annotated mechanism with dimension line, curled leader, actuator, and guide rail.">
\t\t\t<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10Z" fill="var(--ill-line)"/></marker></defs>
\t\t\t<rect x="180" y="164" width="300" height="82" rx="8" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M208 204h242" stroke="var(--ill-hatch)" stroke-width="2" stroke-dasharray="12 10"/>
\t\t\t<circle cx="268" cy="204" r="34" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<circle cx="396" cy="204" r="34" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M268 204h128" stroke="var(--ill-line)" stroke-width="2.5"/>
\t\t\t<path d="M180 286h300" stroke="var(--ill-line)" stroke-dasharray="24 6" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
\t\t\t<path d="M180 252v50M480 252v50" stroke="var(--ill-line)"/>
\t\t\t<text x="330" y="312" text-anchor="middle" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">300 unit span</text>
\t\t\t<path d="M520 154c34-18 52 2 40 22-10 16 8 28 36 20" stroke="var(--ill-line)"/>
\t\t\t<text x="602" y="202" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">curl leader</text>
\t\t</svg>`,
	},
	{
		slug: "hatched-cross-section",
		title: "Hatched Cross Section",
		summary: "A cutaway panel using bundled hatch strokes and two-tone faces without gradients.",
		svg: `\t\t<svg data-vpk-illustration viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hatched cross section with outer shell, inner channel, and material layers.">
\t\t\t<path d="M160 108h400v190H160Z" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M212 156h296v94H212Z" fill="var(--paper)" stroke="var(--ill-line)"/>
\t\t\t<path d="M176 126 248 298M206 126 278 298M236 126 308 298M266 126 338 298M296 126 368 298M326 126 398 298M356 126 428 298M386 126 458 298M416 126 488 298M446 126 518 298" stroke="var(--ill-hatch)" stroke-width="2"/>
\t\t\t<path d="M212 156h296v24H212Z" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<path d="M212 226h296v24H212Z" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M520 152h76" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<text x="604" y="156" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">layer A</text>
\t\t\t<path d="M520 240h76" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<text x="604" y="244" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">layer B</text>
\t\t</svg>`,
	},
	{
		slug: "isometric-pipeline",
		title: "Isometric Pipeline",
		summary: "A remixable architecture-pipeline illustration with modules, flow arrows, and shaded joins.",
		svg: `\t\t<svg data-vpk-illustration viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Isometric pipeline connecting source, transform, model, and delivery modules.">
\t\t\t<defs><marker id="pipe-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10Z" fill="var(--ill-line)"/></marker></defs>
\t\t\t<path d="M90 170 174 132 258 170 174 210Z" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M280 170 364 132 448 170 364 210Z" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<path d="M470 170 554 132 638 170 554 210Z" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M174 210v58L90 226v-56M174 268l84-42v-56" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<path d="M364 210v58l-84-42v-56M364 268l84-42v-56" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M554 210v58l-84-42v-56M554 268l84-42v-56" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M248 204h58M438 204h58" stroke="var(--ill-line)" stroke-width="2" marker-end="url(#pipe-arrow)"/>
\t\t\t<path d="M136 226h78M326 226h78M516 226h78" stroke="var(--ill-hatch)" stroke-width="2" stroke-dasharray="12 10"/>
\t\t\t<text x="174" y="118" text-anchor="middle" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">source</text>
\t\t\t<text x="364" y="118" text-anchor="middle" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">transform</text>
\t\t\t<text x="554" y="118" text-anchor="middle" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">deliver</text>
\t\t</svg>`,
	},
]);

const targetsFor = slug => [path.join(ILLUSTRATIONS, `${slug}.html`), path.join(DEMOS, `demo-illustration-${slug}.html`)];

// The v1 page body: the hand SVG inside a framed figure with the summary as its caption.
function legacyFigureHtml({ svg, summary }) {
	return `\t<figure class="figure-frame">\n${svg}\n\t\t<figcaption class="caption">${summary}</figcaption>\n\t</figure>`;
}

async function renderExample(example, kind) {
	const { applyRuntimePipeline } = await import("./runtime/pipeline.mjs");
	const { validateHtmlString } = await import("./check-html.mjs");
	let base;
	if (kind === "brief") {
		const built = await buildFigure({ brief: path.join(__dirname, example.brief), runtime: false, slug: example.slug, title: example.title, summary: example.summary });
		const errors = built.findings.filter(finding => finding.severity === "error");
		if (errors.length) throw new Error(`${example.slug}: iso audit errors: ${errors.map(f => `${f.rule} ${f.message}`).join("; ")}`);
		base = built.html;
	} else {
		base = illustrationPage({ slug: example.slug, title: example.title, summary: example.summary, figureHtml: legacyFigureHtml(example) });
	}
	return targetsFor(example.slug).map(filePath => {
		const html = applyRuntimePipeline(base, { filePath });
		const failures = validateHtmlString(html, filePath).failures;
		if (failures.length) throw new Error(`${path.relative(process.cwd(), filePath)} fails check-html:\n  - ${failures.join("\n  - ")}`);
		if (kind === "brief") {
			const errors = auditHtml(html).findings.filter(finding => finding.severity === "error");
			if (errors.length) throw new Error(`${path.relative(process.cwd(), filePath)}: iso audit errors after the pipeline`);
		}
		return { filePath, html };
	});
}

// The gallery demo: every brief exemplar on one page, one iso block for all of them (the pipeline inserts it once).
export const GALLERY = Object.freeze({
	slug: "illustration-gallery",
	title: "Generated illustrations",
	summary: "Seven figures built by the iso kit from JSON briefs in its one manual style: white plates, thin lines, one orange accent on the focal part and flat cast shadows. Each assembles on entry; hover or select a part to explode it.",
});

const GALLERY_CSS = `.gallery-figure {
\tdisplay: grid;
\tgap: 12px;
}

.gallery-figure + .gallery-figure {
\tborder-top: 1px solid var(--rule);
\tpadding-top: 24px;
}

.gallery-figure h2 {
\tcolor: var(--headline);
\tfont-size: 20px;
\tfont-weight: 500;
}

.gallery-figure > p {
\tcolor: var(--body-text);
\tmax-width: 72ch;
}

/* The house figcaption centres a 62ch box; under a full-width plate that leaves ragged lines, so the gallery aligns it to the plate's left edge. */
.gallery-figure figcaption {
\tmax-width: 72ch;
\ttext-align: left;
}`;

const escapeText = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Briefs all carry figId FIG_001 (one figure per page); on the shared page each gets its own FIG_nnn (audit A9).
export async function renderGallery() {
	const { renderIsoFigure, loadBrief } = await import("./iso/build-figure.mjs");
	const { auditScene } = await import("./iso/audit.mjs");
	const { applyRuntimePipeline } = await import("./runtime/pipeline.mjs");
	const { validateHtmlString } = await import("./check-html.mjs");
	const sections = BRIEF_EXAMPLES.map((example, index) => {
		const brief = { ...loadBrief(path.join(__dirname, example.brief)), figId: `FIG_${String(index + 1).padStart(3, "0")}` };
		const built = renderIsoFigure(brief, { indent: "\t\t" });
		const errors = auditScene(built.scene).filter(finding => finding.severity === "error");
		if (errors.length) throw new Error(`${GALLERY.slug} ${example.slug}: iso audit errors: ${errors.map(f => `${f.rule} ${f.message}`).join("; ")}`);
		return `\t<section class="gallery-figure" aria-labelledby="gallery-${example.slug}">\n\t\t<h2 id="gallery-${example.slug}">${escapeText(example.title)}</h2>\n\t\t<p>${escapeText(example.summary)}</p>\n\t\t${built.region}\n\t</section>`;
	});
	const base = illustrationPage({ slug: GALLERY.slug, title: GALLERY.title, summary: GALLERY.summary, figureHtml: sections.join("\n"), figureEngine: "iso-kit", eyebrow: "technical illustration · iso kit gallery", extraCss: GALLERY_CSS });
	const filePath = path.join(DEMOS, `demo-${GALLERY.slug}.html`);
	const html = applyRuntimePipeline(base, { filePath });
	const failures = validateHtmlString(html, filePath).failures;
	if (failures.length) throw new Error(`${path.relative(process.cwd(), filePath)} fails check-html:\n  - ${failures.join("\n  - ")}`);
	const errors = auditHtml(html).findings.filter(finding => finding.severity === "error");
	if (errors.length) throw new Error(`${path.relative(process.cwd(), filePath)}: iso audit errors after the pipeline: ${errors.map(f => `${f.rule} ${f.figure} ${f.message}`).join("; ")}`);
	return { filePath, html };
}

/** Builds every output in memory: [{ filePath, html }]. */
export async function buildIllustrations({ legacy = false } = {}) {
	const outputs = [];
	for (const example of BRIEF_EXAMPLES) outputs.push(...(await renderExample(example, "brief")));
	outputs.push(await renderGallery());
	if (legacy) for (const example of LEGACY_EXAMPLES) outputs.push(...(await renderExample(example, "legacy")));
	return outputs;
}

export async function main(argv = process.argv.slice(2)) {
	const unknown = argv.filter(arg => !["--check", "--legacy"].includes(arg));
	if (unknown.length) {
		console.error(`unknown argument ${unknown[0]}\nUsage: build-illustrations.mjs [--check] [--legacy]`);
		return 2;
	}
	const check = argv.includes("--check");
	const legacy = argv.includes("--legacy");
	if (legacy && !check) console.warn("warn --legacy rewrites the 5 v1 exemplars from this source; the committed copies are maintained by --refresh-library and will drift (ws0 V9). Review the diff before keeping it.");
	let outputs;
	try {
		outputs = await buildIllustrations({ legacy });
	} catch (error) {
		console.error(`✗ ${error.message}`);
		return 1;
	}
	const rel = filePath => path.relative(process.cwd(), filePath);
	if (check) {
		const stale = outputs.filter(({ filePath, html }) => !fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== html);
		for (const { filePath } of stale) console.error(`✗ ${rel(filePath)} is stale (run build-illustrations.mjs, unsandboxed)`);
		if (!stale.length) console.log(`✓ ${outputs.length} illustration outputs match their source`);
		return stale.length ? 1 : 0;
	}
	fs.mkdirSync(ILLUSTRATIONS, { recursive: true });
	fs.mkdirSync(DEMOS, { recursive: true });
	for (const { filePath, html } of outputs) {
		const changed = !fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== html;
		if (changed) fs.writeFileSync(filePath, html, "utf8");
		console.log(`${changed ? "wrote" : "unchanged"} ${rel(filePath)}`);
	}
	console.log(`${BRIEF_EXAMPLES.length + (legacy ? LEGACY_EXAMPLES.length : 0)} technical illustration exemplar(s) and the gallery generated from ${rel(__dirname)}; finish with build.mjs --refresh-library`);
	return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().then(code => (process.exitCode = code));

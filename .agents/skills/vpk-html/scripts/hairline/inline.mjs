// hairline/inline — the hairline engine's page blocks (figure-engines.md § 10):
//   <style data-vpk-hairline-css> in <head>: upstream's stylesheet (vendored core/styles.ts css()) with its raw-hex
//     palette fallbacks dropped, and the five --hairline-* colours set from vpk tokens, so figures follow the theme;
//   <!-- vpk-hairline:start --><script data-vpk-hairline-runtime>…</script><!-- vpk-hairline:end --> before </body>:
//     the shared frame loop (runtime/frame-loop.mjs, inlined as the iso block does) around one esbuild bundle that
//     holds only the figures the page shows (tree-shaken from the vendored package), and the boot.
// The vendored files are bundled as they are. A plugin points their `core/stage` and `core/styles` imports at the
// adapters in ./runtime (register on window.vpkFrameLoop; the stylesheet written here), and turns each Marks page's
// figure script into a module. esbuild is pinned by the lockfile, so the block is deterministic.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ACCENT_TOKENS_CSS } from "../iso/accent.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "vendor/packages/hairline/src");
const SKILL_PAGES = path.join(HERE, "vendor/apps/site/public/skill");
const RUNTIME = path.join(HERE, "runtime");
const FRAME_LOOP = new URL("../runtime/frame-loop.mjs", import.meta.url);

export const HAIRLINE_RUNTIME_ID = "hairline";
export const HAIRLINE_START = `<!-- vpk-${HAIRLINE_RUNTIME_ID}:start -->`;
export const HAIRLINE_END = `<!-- vpk-${HAIRLINE_RUNTIME_ID}:end -->`;
export const HAIRLINE_NOTICE = "/* vpk hairline runtime · figures from hairline 0.5.1 (MIT, Copyright (c) 2026 Lucas Marques, github.com/lucasmarkes/hairline), vendored unmodified · see scripts/hairline/NOTICE.md in the vpk-html skill */";

// Hairline's five colours, set to the iso kit's manual style (illustrations.md § 4, iso/accent.mjs) so a hairline figure
// reads like an iso-kit figure: plates on the raised surface, ink edges at 60% (NEUTRAL_LINES.edge), creases at 38%, the
// bright `hi` stroke (hairline's active part) in the accent edge colour. Dark mirrors the iso dark overrides.
export const HAIRLINE_PALETTE = Object.freeze({
	light: Object.freeze({ plate: "var(--surface-raised)", hi: "color-mix(in srgb, var(--ill-accent) 55%, var(--ill-line))", edge: "color-mix(in srgb, var(--ill-line) 60%, var(--paper))", mid: "color-mix(in srgb, var(--ill-line) 60%, var(--paper))", lo: "color-mix(in srgb, var(--ill-line) 38%, var(--paper))" }),
	dark: Object.freeze({ plate: "var(--ill-tone2)", hi: "var(--ill-accent)", edge: "color-mix(in srgb, var(--ill-line) 60%, var(--paper))", mid: "color-mix(in srgb, var(--ill-line) 60%, var(--paper))", lo: "color-mix(in srgb, var(--ill-line) 38%, var(--paper))" }),
});

const paletteVars = palette => Object.entries(palette).map(([key, value]) => `--hairline-${key}: ${value};`).join(" ");

// The iso tone map on hairline solids (runtime/stage.mjs adds the side bands): top = plate, near (left) side tone 1, far
// (right) side tone 2; an active solid (hairline's `.hi` silhouette) takes the iso accent faces, as a hovered iso part does.
const SVG = '[data-vpk-engine="hairline"] [data-vpk-hairline] > svg';
const TONE_CSS = `${SVG} [data-hl-side] { stroke: none; }
${SVG} [data-hl-side="l"] { fill: var(--ill-tone1); }
${SVG} [data-hl-side="r"] { fill: var(--ill-tone2); }
${SVG} [data-hl-edge] { stroke: var(--hl-edge); }
${SVG} :is(.sil.hi, .hi) ~ [data-hl-edge], ${SVG} g:has(> .sil.hi) > [data-hl-edge] { stroke: var(--hl-hi); stroke-width: 1.6; }
${SVG} .sil.hi { fill: var(--ill-accent); }
${SVG} g:has(> .sil.hi) > [data-hl-side="l"] { fill: color-mix(in srgb, var(--ill-accent) 62%, var(--surface-raised)); }
${SVG} g:has(> .sil.hi) > [data-hl-side="r"] { fill: color-mix(in srgb, var(--ill-accent) 70%, var(--ill-line)); }
${SVG} :where(path.hi:not(.nf), polygon.hi, ellipse.hi:not(.nf)) { fill: var(--ill-accent); }
${SVG} .ghost { display: none; }
${SVG} .dot { fill: var(--ill-line); }
${SVG} .dot.m { fill: var(--ill-accent); }
${SVG} .dot.off { fill: color-mix(in srgb, var(--ill-line) 25%, var(--paper)); }
[data-theme="dark"] ${SVG} [data-hl-side="r"] { fill: var(--surface-sunken); }
[data-theme="dark"] ${SVG} [data-hl-side="l"] { fill: var(--ill-tone1); }`;

// The plate around a figure: the iso kit's frame (iso/runtime-css .vpk-iso-frame and .vpk-iso-plate__foot): a ruled box on
// the paper, the stage at upstream's 5:4, a mono readout in the foot, and the caption below in the house figcaption style.
const PLATE_CSS = `:where([data-vpk-engine="hairline"]) { ${paletteVars(HAIRLINE_PALETTE.light)} }
[data-theme="dark"] :where([data-vpk-engine="hairline"]) { ${paletteVars(HAIRLINE_PALETTE.dark)} }
.vpk-hairline-plate { display: block !important; margin: 0; text-align: start !important; }
.vpk-hairline-frame { padding: 20px 16px 12px; border: 1px solid var(--rule); background: var(--paper); }
.vpk-hairline-stage { margin: 0 auto; max-width: 720px; width: 100%; }
:where([data-vpk-hairline]) { aspect-ratio: 5 / 4; display: block; position: relative; --hairline-stroke: 1; }
.vpk-hairline-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--rule); }
.vpk-hairline-read { margin: 0; min-width: 9ch; color: var(--ink); font: 12px/1.4 var(--font-numeric, var(--font-mono)); font-variant-numeric: tabular-nums; }
.vpk-hairline-plate > figcaption { max-width: 72ch; text-align: left; }
${TONE_CSS}`;

// Upstream's rules, untouched apart from the palette fallbacks: `var(--hairline-x,#hex)` → `var(--hairline-x)`,
// so the only colours are the vpk tokens above (the dark-ancestor and theme-option rules then restate the same
// variables, which is harmless).
// The vendored css() itself, compiled by esbuild rather than imported: Node 22 before 22.18 cannot load .ts.
function upstreamCss() {
	const source = fs.readFileSync(path.join(SRC, "core/styles.ts"), "utf8");
	const module = { exports: {} };
	new Function("module", "exports", loadEsbuild().transformSync(source, { loader: "ts", format: "cjs" }).code)(module, module.exports);
	return module.exports.css(false);
}

export function hairlineCss() {
	const upstream = upstreamCss().replace(/var\(--hairline-(plate|hi|edge|mid|lo),#[0-9a-fA-F]{3,8}\)/g, "var(--hairline-$1)");
	if (/#[0-9a-fA-F]{3,8}\b/.test(upstream)) throw new Error("hairline css still carries a raw colour after the palette swap; the vendored styles.ts changed");
	return `${PLATE_CSS}\n${upstream}`;
}

// The iso accent alias pair is declared here too: a hairline page carries no iso block, and the active part takes the accent.
export const hairlineStyleTag = () => `<style data-vpk-hairline-css>\n${ACCENT_TOKENS_CSS}\n${hairlineCss()}\n</style>`;

/* ---------- what the vendored sources say about each figure ---------- */

let specs = null;

// { id: { label, rest, focusable } } from index.ts's create() calls; the Marks from their pages' hairline({ … }).
export function hairlineSpecs() {
	if (specs) return specs;
	specs = {};
	const index = fs.readFileSync(path.join(SRC, "index.ts"), "utf8");
	for (const match of index.matchAll(/export function (\w+)\(el[^{]*\{\s*return create\(\{([\s\S]*?)\}, el, options\);/g)) {
		const body = match[2];
		specs[match[1]] = { label: body.match(/label: "([^"]*)"/)[1], rest: body.match(/rest: "([^"]*)"/)[1], focusable: /focusable: true/.test(body), mark: false };
	}
	for (const file of fs.readdirSync(SKILL_PAGES).sort()) {
		const id = file.match(/^hairline-([a-z]+)\.html$/)?.[1];
		if (!id) continue;
		const source = markSource(id);
		specs[id] = { label: source.match(/means: "([^"]*)"/)[1], rest: "rest", focusable: false, mark: true };
	}
	return specs;
}

// The figure module of a hairline-create page: its <script type="module" id="hl-figure"> body.
function markSource(id) {
	const html = fs.readFileSync(path.join(SKILL_PAGES, `hairline-${id}.html`), "utf8");
	const body = html.match(/<script type="module" id="hl-figure">([\s\S]*?)<\/script>/)?.[1];
	if (!body) throw new Error(`hairline-${id}.html has no hl-figure script`);
	return body;
}

/* ---------- the bundle ---------- */

function loadEsbuild() {
	try {
		return createRequire(import.meta.url)("esbuild");
	} catch (error) {
		throw new Error(`the hairline runtime block needs esbuild (a repo devDependency); run pnpm install first (${error.message})`);
	}
}

// Vendored modules swapped for adapters: core/stage (loop, tour, toned solids), core/styles (no injection), core/iso and
// slab (prisms and slabs that also return their side bands for the iso tone map). Keyed by the vendored path they replace.
const ADAPTED = new Map([
	[path.join(SRC, "core", "stage"), path.join(RUNTIME, "stage.mjs")],
	[path.join(SRC, "core", "styles"), path.join(RUNTIME, "styles.mjs")],
	[path.join(SRC, "core", "iso"), path.join(RUNTIME, "iso.mjs")],
	[path.join(SRC, "slab"), path.join(RUNTIME, "slab.mjs")],
]);

const vendorPlugin = {
	name: "vpk-hairline",
	setup(build) {
		// A vendored import of an adapted module goes to its adapter; the adapters' own `.ts` imports pass.
		build.onResolve({ filter: /^\.\.?\/(?:\.\.\/)?(?:core\/)?(?:stage|styles|iso|slab)$/ }, args => {
			if (!args.importer.startsWith(SRC)) return undefined;
			const adapter = ADAPTED.get(path.resolve(args.resolveDir, args.path));
			return adapter ? { path: adapter, sideEffects: false } : undefined;
		});
		// Extensionless vendored imports resolve to their .ts file; the package declares no side effects.
		build.onResolve({ filter: /^\.\.?\// }, args => {
			if (!args.importer.startsWith(SRC) || path.extname(args.path)) return undefined;
			return { path: `${path.resolve(args.resolveDir, args.path)}.ts`, sideEffects: false };
		});
		build.onResolve({ filter: /^hairline-mark:/ }, args => ({ path: args.path.slice("hairline-mark:".length), namespace: "hairline-mark" }));
		// A Marks figure reads the global HL and calls hairline(spec); as a module it gets HL from the kernel adapter
		// and exports the spec it was given.
		build.onLoad({ filter: /.*/, namespace: "hairline-mark" }, args => ({
			contents: `import * as HL from ${JSON.stringify(path.join(RUNTIME, "kernel.mjs"))};\nlet spec = null;\nconst hairline = given => { spec = given; };\n${markSource(args.path)}\nexport default spec;\n`,
			loader: "js",
			resolveDir: RUNTIME,
		}));
	},
};

function entrySource(ids) {
	const all = hairlineSpecs();
	const unknown = ids.filter(id => !all[id]);
	if (unknown.length) throw new Error(`unknown hairline figure${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`);
	const lines = [`import { boot } from ${JSON.stringify(path.join(RUNTIME, "boot.mjs"))};`];
	const packaged = ids.filter(id => !all[id].mark);
	if (packaged.length) lines.push(`import { ${packaged.join(", ")} } from ${JSON.stringify(path.join(SRC, "index.ts"))};`);
	const marks = ids.filter(id => all[id].mark);
	if (marks.length) lines.push(`import { markFigure } from ${JSON.stringify(path.join(RUNTIME, "marks.mjs"))};`);
	for (const id of marks) lines.push(`import ${id}Spec from "hairline-mark:${id}";`);
	lines.push(`boot({ ${ids.map(id => (all[id].mark ? `${id}: markFigure(${id}Spec)` : id)).join(", ")} });`);
	return lines.join("\n");
}

const bundles = new Map();

// The figures' bundle as one IIFE, minified, with `getFrameLoop` left free for the inlined loop around it.
// Async because esbuild runs plugins only in its async API; the gallery builder awaits it.
export async function hairlineBundle(ids) {
	const key = ids.join(",");
	if (bundles.has(key)) return bundles.get(key);
	const result = await loadEsbuild().build({
		stdin: { contents: entrySource(ids), resolveDir: HERE, sourcefile: "hairline-entry.mjs", loader: "js" },
		bundle: true,
		write: false,
		format: "iife",
		target: "es2020",
		minify: true,
		legalComments: "none",
		charset: "utf8",
		plugins: [vendorPlugin],
		logLevel: "silent",
	});
	const code = result.outputFiles[0].text.trim();
	bundles.set(key, code);
	return code;
}

const STRIP_EXPORT = /^export (?=(async )?function|const|let|class)/gm;

export async function hairlineRuntimeScript(ids) {
	const loop = fs.readFileSync(FRAME_LOOP, "utf8").replace(STRIP_EXPORT, "");
	const wrapped = loadEsbuild().transformSync(`(() => {\n"use strict";\n${loop}\n${await hairlineBundle(ids)}\n})();`, { loader: "js", minifyWhitespace: true, minifySyntax: true, legalComments: "none", charset: "utf8" }).code.trim();
	return ["<script data-vpk-hairline-runtime>", HAIRLINE_NOTICE, wrapped.replace(/<\/(script)/gi, "<\\/$1"), "</script>"].join("\n");
}

export const hairlineRuntimeBlock = async ids => `${HAIRLINE_START}\n${await hairlineRuntimeScript(ids)}\n${HAIRLINE_END}`;

/* ---------- markup ---------- */

const escapeText = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = text => escapeText(text).replace(/"/g, "&quot;");

// One figure's plate. The host carries the figure's own accessible name (the figure keeps it when it mounts:
// mount.ts never overwrites an attribute the host already has); the readout shows the rest caption until the
// figure's onRead replaces it. A keyboard figure (riffle) is a focusable group; the rest are images.
export function hairlinePlate({ id, caption, indent = "\t\t" }) {
	const spec = hairlineSpecs()[id];
	if (!spec) throw new Error(`unknown hairline figure: ${id}`);
	const role = spec.focusable ? ` role="group" tabindex="0"` : ` role="img"`;
	return [
		`<figure class="vpk-hairline-plate" id="vpk-hairline-${id}" data-vpk-engine="hairline" data-vpk-figure="hl-${id}" data-vpk-camera="45 30" data-vpk-block data-vpkh-no-lightbox>`,
		`\t<div class="vpk-hairline-frame" data-vpk-review-ignore>`,
		`\t\t<div class="vpk-hairline-stage" data-vpk-review-ignore><div data-vpk-hairline="${id}"${role} aria-label="${escapeAttr(spec.label)}"></div></div>`,
		`\t\t<div class="vpk-hairline-foot" data-vpk-review-ignore><p class="vpk-hairline-read" data-vpk-hairline-read>${escapeText(spec.rest)}</p></div>`,
		`\t</div>`,
		`\t<figcaption data-vpk-review-ignore>${escapeText(caption)}</figcaption>`,
		"</figure>",
	].join(`\n${indent}`);
}

export const hasHairlineFigures = html => /<[a-z]+\b[^>]*\sdata-vpk-hairline="/i.test(String(html));

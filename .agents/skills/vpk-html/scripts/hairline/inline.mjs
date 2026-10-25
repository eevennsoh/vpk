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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "vendor/packages/hairline/src");
const SKILL_PAGES = path.join(HERE, "vendor/apps/site/public/skill");
const RUNTIME = path.join(HERE, "runtime");
const FRAME_LOOP = new URL("../runtime/frame-loop.mjs", import.meta.url);

export const HAIRLINE_RUNTIME_ID = "hairline";
export const HAIRLINE_START = `<!-- vpk-${HAIRLINE_RUNTIME_ID}:start -->`;
export const HAIRLINE_END = `<!-- vpk-${HAIRLINE_RUNTIME_ID}:end -->`;
export const HAIRLINE_NOTICE = "/* vpk hairline runtime · figures from hairline 0.5.1 (MIT, Copyright (c) 2026 Lucas Marques, github.com/lucasmarkes/hairline), vendored unmodified · see scripts/hairline/NOTICE.md in the vpk-html skill */";

// Hairline's five colours as vpk tokens. Light: plate on --paper, hi --ink, lo --ill-tone2; mid and edge sit
// between --ill-tone2, --ill-tone3 and --ill-ink50 at upstream's lightness (#c3c3c9, #a4a4ac). Dark keeps the same
// steps above the paper: lo --ill-tone2, mid --ill-tone3, edge --ill-hatch, hi --ink.
export const HAIRLINE_PALETTE = Object.freeze({
	light: Object.freeze({ plate: "var(--paper)", hi: "var(--ink)", edge: "color-mix(in srgb, var(--ill-tone3) 85%, var(--ill-ink50))", mid: "color-mix(in srgb, var(--ill-tone3) 70%, var(--ill-tone2))", lo: "var(--ill-tone2)" }),
	dark: Object.freeze({ plate: "var(--paper)", hi: "var(--ink)", edge: "var(--ill-hatch)", mid: "var(--ill-tone3)", lo: "var(--ill-tone2)" }),
});

const paletteVars = palette => Object.entries(palette).map(([key, value]) => `--hairline-${key}: ${value};`).join(" ");

// The plate around a figure: a vpk frame like the iso plate, the stage at upstream's 5:4, and the mono readout.
const PLATE_CSS = `:where([data-vpk-engine="hairline"]) { ${paletteVars(HAIRLINE_PALETTE.light)} }
[data-theme="dark"] :where([data-vpk-engine="hairline"]) { ${paletteVars(HAIRLINE_PALETTE.dark)} }
.vpk-hairline-plate { background: var(--paper); border: 1px solid var(--rule); border-radius: 6px; display: grid !important; gap: 10px; margin: 0; padding: clamp(14px, 3vw, 24px); text-align: left !important; }
.vpk-hairline-stage { margin: 0 auto; max-width: 640px; width: 100%; }
:where([data-vpk-hairline]) { aspect-ratio: 5 / 4; display: block; position: relative; }
.vpk-hairline-read { color: var(--ink); font-family: var(--font-mono); font-size: 12px; font-variant-numeric: tabular-nums; line-height: 1.4; min-height: 1.4em; text-align: center; }
.vpk-hairline-plate figcaption { border-top: 1px solid var(--rule); color: var(--muted-text); font-size: 14px; padding-top: 10px; }`;

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

export const hairlineStyleTag = () => `<style data-vpk-hairline-css>\n${hairlineCss()}\n</style>`;

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

const ADAPTED = { stage: path.join(RUNTIME, "stage.mjs"), styles: path.join(RUNTIME, "styles.mjs") };

const vendorPlugin = {
	name: "vpk-hairline",
	setup(build) {
		// A vendored import of core/stage or core/styles goes to its adapter; the adapters' own `.ts` imports pass.
		build.onResolve({ filter: /^\.\.?\/(?:core\/)?(?:stage|styles)$/ }, args => {
			if (!args.importer.startsWith(SRC)) return undefined;
			const name = args.path.endsWith("stage") ? "stage" : "styles";
			if (path.resolve(args.resolveDir, args.path) !== path.join(SRC, "core", name)) return undefined;
			return { path: ADAPTED[name], sideEffects: false };
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
		`\t<div class="vpk-hairline-stage" data-vpk-review-ignore><div data-vpk-hairline="${id}"${role} aria-label="${escapeAttr(spec.label)}"></div></div>`,
		`\t<p class="vpk-hairline-read" data-vpk-hairline-read data-vpk-review-ignore>${escapeText(spec.rest)}</p>`,
		`\t<figcaption data-vpk-review-ignore>${escapeText(caption)}</figcaption>`,
		"</figure>",
	].join(`\n${indent}`);
}

export const hasHairlineFigures = html => /<[a-z]+\b[^>]*\sdata-vpk-hairline="/i.test(String(html));

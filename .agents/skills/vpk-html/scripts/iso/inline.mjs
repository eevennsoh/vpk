// iso/inline — builds the `vpk-iso` runtime block (ws3 §4.8, C-iso-3; integration K2 row `iso`):
//   <!-- vpk-iso:start -->
//   <style data-vpk-iso-css>…</style>
//   <script data-vpk-iso-runtime>(() => { frame-loop; const kit = (() => { iso/core + iso/runtime })(); vpkIso })()</script>
//   <!-- vpk-iso:end -->
// The three sources are inlined by text: each must have no import; `export ` is stripped with the
// ws4a kit regex, and full-line `//` comments and blank lines are dropped (the sources keep their
// documentation, the block keeps its budget). Files are read lazily on first build (R28), so
// importing this module through the registry costs nothing.
// The block never contains "<svg", so hasIsoFigures() cannot match the block itself.

import fs from "node:fs";
import { createRequire } from "node:module";
import { ACCENT_TOKENS_CSS, RAY_TOKENS_CSS } from "./accent.mjs";
import { ISO_CSS } from "./runtime-css.mjs";

export const ISO_RUNTIME_ID = "iso";
// The one iso block (the style's CSS, the select blink, the accent tokens and rules, the rest motion, the cast shadows, the entry
// hand-off, the received shadows) fits this budget. Measured 2026-10-23: 27,432 B = style 9,445 B + script 17,987 B (markers
// included). It was 26,335 B on 2026-10-22 (budget 26,624 B, 26 KiB). Since then the hover explode shrank the script by about
// 140 B, the accent line work (redline 2a) added about 700 B of CSS, and the received shadows (redline 1) add about 500 B: three
// CSS rules (dark tone, accent on the focal, .is-active and dropping-layer tops) and the cast-on term in the runtime's shadow
// move, which keeps a shadow on a moving top exact under the Gap. The budget rose to 27,648 B (27 KiB), about 216 B of headroom.
// 2026-10-23 (redline 2c): 27,378 B. The accent pair became ADS hex token declarations, one per line (about -54 B net).
// 2026-10-25 (iso upgrade, phase 0): 29,703 B = style 11,159 B + script 18,499 B. The entry CSS is layer-agnostic (generic wait/drop classes, any layer count), and the ink tone
// and the ink emphasis add a few rules. The budget rose to 49,152 B (48 KiB): the coming step, scrub and variant runtime adds
// roughly 8–12 KB, and this keeps one budget for the whole upgrade instead of raising it per phase.
// Re-measure when the block changes and keep this comment, figure-engines.md § 9 and illustrations.md in step.
// 2026-10-25 (iso upgrade, phase 2): 37,557 B = style 8,154 B + script (step, scrub, variants, per-state and per-scrub-segment order: state-runtime.mjs).
// The layer-agnostic entry CSS shrank the style by about 3 KB.
export const ISO_BUDGET_BYTES = 49152;
export const ISO_START = `<!-- vpk-${ISO_RUNTIME_ID}:start -->`;
export const ISO_END = `<!-- vpk-${ISO_RUNTIME_ID}:end -->`;
export const ISO_NOTICE = "/* vpk iso runtime v1 · motion clocks and behaviours ported from hairline (MIT, Copyright (c) 2026 Lucas Marques, github.com/lucasmarkes/hairline) · see scripts/iso/NOTICE.md in the vpk-html skill */";

const STRIP_EXPORT = /^export (?=(async )?function|const|let|class)/gm;
const FRAME_LOOP = ["runtime/frame-loop.mjs", new URL("../runtime/frame-loop.mjs", import.meta.url)];
const KIT_SOURCES = Object.freeze([
	["iso/core.mjs", new URL("./core.mjs", import.meta.url)],
	["iso/runtime.mjs", new URL("./runtime.mjs", import.meta.url)],
	["iso/manual-runtime.mjs", new URL("./manual-runtime.mjs", import.meta.url)],
	["iso/state-runtime.mjs", new URL("./state-runtime.mjs", import.meta.url)],
]);
const KIT_NAMES = "{ createIsoRuntime, hull, padHull, parsePolyPath, parseVec, topmostHit, blink, tagLines, mountStates, partPoly }";

export function inlineSource(text, label = "source") {
	if (/^\s*import\b/m.test(text)) throw new Error(`${label} must have no import statements to be inlined`);
	return text
		.replace(STRIP_EXPORT, "")
		.split("\n")
		.filter(line => line.trim() !== "" && !/^\s*\/\//.test(line))
		.join("\n");
}

const read = ([label, url]) => inlineSource(fs.readFileSync(url, "utf8"), label);

// iso/core + iso/runtime in their own function scope, returning what the boot line needs. The
// scope lets the minifier rename the kit's locals (about 3 KB, which keeps the block inside
// ISO_BUDGET_BYTES with the deck fit) while the frame loop stays outside under its own names: it is
// the shared window.vpkFrameLoop instance, and the browser spec's rAF probe recognises its frame
// callback by source text (`gen && run()`).
export function isoKitSource() {
	return ["(() => {", "\"use strict\";", ...KIT_SOURCES.map(read), `return ${KIT_NAMES};`, "})()"].join("\n");
}

// The program, unminified by default (the vm test runs it to catch ReferenceErrors and duplicate
// top-level names); isoRuntimeScript passes the renamed kit in.
export function isoRuntimeSource(kit = isoKitSource()) {
	return [
		"(() => {",
		"\"use strict\";",
		read(FRAME_LOOP),
		`const kit = ${kit};`,
		"window.vpkIso ??= kit.createIsoRuntime(window, getFrameLoop(window), kit);",
		"})();",
	].join("\n");
}

// Whitespace and syntax minification (the esbuild path ws1's review runtime uses), plus local
// renaming for the kit scope only. esbuild is loaded lazily (R28) and pinned by the lockfile, so
// the block is deterministic; a version change shows up as --refresh-library --check drift.
function minify(code, renameLocals = false) {
	let esbuild;
	try {
		esbuild = createRequire(import.meta.url)("esbuild");
	} catch (error) {
		throw new Error(`the iso runtime block needs esbuild (a repo devDependency); run pnpm install first (${error.message})`);
	}
	return esbuild.transformSync(code, { loader: "js", minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: renameLocals, legalComments: "none" }).code.trim();
}

let script = null;

export function isoRuntimeScript() {
	script ??= ["<script data-vpk-iso-runtime>", ISO_NOTICE, minify(isoRuntimeSource(minify(isoKitSource(), true).replace(/;$/, ""))), "</script>"].join("\n");
	return script;
}

// The accent alias pair (iso/accent.mjs) leads the iso CSS: it is the token layer the accent rules and the emitted focal faces
// read, declared once per iso document. Its hex values are ADS tokens listed in references/tokens.json (illAccent, illAccentInk),
// so check-html's literal scan reads them as token declarations.
export const isoStyleTag = () => `<style data-vpk-iso-css>\n${ACCENT_TOKENS_CSS}\n${RAY_TOKENS_CSS}\n${ISO_CSS}\n</style>`;

export const isoRuntimeBlockBody = () => `${isoStyleTag()}\n${isoRuntimeScript()}`;

export const isoRuntimeBlock = () => `${ISO_START}\n${isoRuntimeBlockBody()}\n${ISO_END}`;

export const hasIsoFigures = html => /<svg\b[^>]*\bdata-vpk-iso-id="/i.test(String(html));

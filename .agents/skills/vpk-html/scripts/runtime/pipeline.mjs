/*
 * runtime/pipeline — the one runtime pipeline for every vpk-html HTML file.
 *
 * Commands:
 *   node .agents/skills/vpk-html/scripts/build.mjs --refresh-library [--check]   # the committed skill library
 *   node .agents/skills/vpk-html/scripts/build.mjs --inject-runtime <file…>      # user artifacts (kind by path)
 * Both write under .agents/skills/ or artifacts/, so run them unsandboxed. retrofit.mjs,
 * inject-enhancements.mjs and build-index.mjs are aliases of --refresh-library.
 *
 * Kinds (classifyTarget, first match wins, relative to the realpathed skill root):
 *   index.html → index · assets/templates/*.html → template · assets/demos/*.html → demo
 *   assets/diagrams/*.html → diagram · assets/illustrations/*.html → illustration
 *   assets/landing/*.html → landing · assets/html-effectiveness/**, assets/video/**, assets/lab/** → skip
 *   anything else, including paths outside the skill → artifact
 * New asset directories add a row here; until then they classify as artifact.
 *
 * Steps, in this fixed order (a step not listed for a kind is skipped):
 *   retrofit      template demo index diagram illustration   retrofitHtml (shared CSS, chart runtime, favicons, deck/docnav)
 *   font-faces    every kind except skip                      repairFontFaces (invalid faces, corrupted font-family declarations)
 *   theme         template demo index landing artifact        retrofitThemeRuntime
 *   nav           artifact                                    retrofitDeck | retrofitDocumentNav (library kinds get it inside retrofit)
 *   RUNTIME_STEPS each step's own `kinds`                     runtime/registry.mjs, in registry order
 *   enhancements  template demo index artifact               injectEnhancements, ALWAYS LAST
 * Diagram and illustration primitives get no theme, nav, or enhancement chrome: they are copy
 * sources pasted into documents that already carry it. Landing gets no retrofit/nav/enhancements
 * because landing.mjs owns its shells.
 *
 * Fixed-point rules: registry steps replace their block in place and insert before the last
 * </body> only when absent (never move a block). Enhancements strip and re-append, so they must
 * run last: `X ENH` → `X ENH SMIL` (insert) → `X SMIL ENH` (move); a second run is a no-op.
 *
 * Import rules (no ESM cycles, no import side effects):
 *   - runtime/blocks.mjs imports nothing local; runtime/define.mjs imports only blocks.mjs.
 *   - adapters (runtime/<id>.mjs) import blocks.mjs, define.mjs, ../shared.mjs and their own domain
 *     modules, never registry.mjs, pipeline.mjs or check-html.mjs; no file reads or heavy imports at
 *     module top level.
 *   - registry.mjs imports only adapters; this module imports the registry and the classic steps.
 *   - check-html.mjs may import adapters' pure checks, never the registry or this module.
 *   - CLIs that delegate here import it dynamically inside main().
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../shared.mjs";
import { buildIndexHtml } from "../build-index.mjs";
import { repairFontFaces } from "../font-faces.mjs";
import { injectEnhancements } from "../inject-enhancements.mjs";
import { isDeck, retrofitDeck, retrofitDocumentNav } from "../presentation.mjs";
import { retrofitHtml } from "../retrofit.mjs";
import { retrofitThemeRuntime } from "../theme.mjs";
import { RUNTIME_STEPS } from "./registry.mjs";

export const KINDS = ["template", "demo", "index", "diagram", "illustration", "landing", "artifact", "skip"];

const LIBRARY_KINDS = ["template", "demo", "index", "diagram", "illustration", "landing"];
const LIBRARY_DIRECTORIES = ["assets/templates", "assets/demos", "assets/diagrams", "assets/illustrations", "assets/landing"];

const KIND_ROWS = [
	[/^index\.html$/, "index"],
	[/^assets\/templates\/[^/]+\.html$/, "template"],
	[/^assets\/demos\/[^/]+\.html$/, "demo"],
	[/^assets\/diagrams\/[^/]+\.html$/, "diagram"],
	[/^assets\/illustrations\/[^/]+\.html$/, "illustration"],
	[/^assets\/landing\/[^/]+\.html$/, "landing"],
	[/^assets\/(?:html-effectiveness|video|lab)\//, "skip"],
];

const CLASSIC_STEPS = [
	{ id: "retrofit", kinds: ["template", "demo", "index", "diagram", "illustration"], apply: (html, ctx) => retrofitHtml(html, ctx.filePath) },
	{ id: "font-faces", kinds: ["template", "demo", "index", "diagram", "illustration", "landing", "artifact"], apply: html => repairFontFaces(html) },
	{ id: "theme", kinds: ["template", "demo", "index", "landing", "artifact"], apply: html => retrofitThemeRuntime(html) },
	{ id: "nav", kinds: ["artifact"], apply: html => (isDeck(html) ? retrofitDeck(html) : retrofitDocumentNav(html)) },
];

const ENHANCEMENTS_STEP = { id: "enhancements", kinds: ["template", "demo", "index", "artifact"], apply: (html, ctx) => injectEnhancements(html, ctx.filePath) };

// Realpath of the longest existing prefix plus the remaining segments, so symlinked
// (.claude/skills → .agents/skills) and virtual test paths classify like real ones.
function realpathLoose(target) {
	const rest = [];
	let current = path.resolve(target);
	for (;;) {
		try {
			return path.join(fs.realpathSync(current), ...rest);
		} catch {
			const parent = path.dirname(current);
			if (parent === current) return path.join(current, ...rest);
			rest.unshift(path.basename(current));
			current = parent;
		}
	}
}

export function classifyTarget(absPath, { root = ROOT } = {}) {
	if (!absPath) throw new Error("classifyTarget requires a file path");
	const relative = path.relative(realpathLoose(root), realpathLoose(absPath));
	if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return "artifact";
	const posix = relative.split(path.sep).join("/");
	return KIND_ROWS.find(([pattern]) => pattern.test(posix))?.[1] ?? "artifact";
}

export function pipelineStepsFor(kind, { steps = RUNTIME_STEPS } = {}) {
	if (kind === "skip") return [];
	return [...CLASSIC_STEPS, ...steps, ENHANCEMENTS_STEP]
		.filter(step => step.kinds.includes(kind))
		.map(({ id, apply }) => ({ id, apply }));
}

export function runRuntimePipeline(html, { filePath, kind, root = ROOT, steps = RUNTIME_STEPS } = {}) {
	if (!filePath) throw new Error("runRuntimePipeline requires filePath (a real or virtual path)");
	const resolvedKind = kind ?? classifyTarget(filePath, { root });
	if (!KINDS.includes(resolvedKind)) throw new Error(`unknown runtime kind: ${resolvedKind}`);
	const ctx = { filePath, kind: resolvedKind, root };
	const changed = [];
	let out = html;
	for (const step of pipelineStepsFor(resolvedKind, { steps })) {
		const next = step.apply(out, ctx);
		if (typeof next !== "string") throw new Error(`runtime step ${step.id} returned ${typeof next} for ${filePath}`);
		if (next !== out) changed.push(step.id);
		out = next;
	}
	return { html: out, steps: changed };
}

// Generators call this before writing so their drift checks can compare whole files.
export function applyRuntimePipeline(html, opts) {
	return runRuntimePipeline(html, opts).html;
}

function htmlFilesIn(directory) {
	if (!fs.existsSync(directory)) return [];
	return fs.readdirSync(directory).filter(name => name.endsWith(".html")).sort().map(name => path.join(directory, name));
}

export function listLibraryFiles({ root = ROOT } = {}) {
	const files = LIBRARY_DIRECTORIES.flatMap(directory => htmlFilesIn(path.join(root, directory)));
	const index = path.join(root, "index.html");
	return fs.existsSync(index) ? [...files, index] : files;
}

// Step ids reported by the library refresh: every step whose kinds meet a library kind, then index.
function reportedStepIds(steps) {
	return [...CLASSIC_STEPS, ...steps, ENHANCEMENTS_STEP]
		.filter(step => step.kinds.some(kind => LIBRARY_KINDS.includes(kind)))
		.map(step => step.id);
}

function toPosix(relative) {
	return relative.split(path.sep).join("/");
}

export async function refreshLibrary({ write = true, root = ROOT, steps = RUNTIME_STEPS } = {}) {
	const files = listLibraryFiles({ root });
	const indexAbs = path.join(root, "index.html");
	const byStep = Object.fromEntries([...reportedStepIds(steps), "index"].map(id => [id, 0]));
	const changed = [];
	const refreshedSizes = new Map();
	for (const abs of files) {
		if (classifyTarget(abs, { root }) === "index") continue;
		const before = fs.readFileSync(abs, "utf8");
		const result = runRuntimePipeline(before, { filePath: abs, root, steps });
		if (result.html === before) continue;
		const rel = toPosix(path.relative(root, abs));
		refreshedSizes.set(rel, Buffer.byteLength(result.html));
		changed.push({ file: rel, steps: result.steps });
		for (const id of result.steps) byStep[id] = (byStep[id] ?? 0) + 1;
		if (write) fs.writeFileSync(abs, result.html, "utf8");
	}

	const sizeOf = name => {
		const rel = `assets/demos/${name}`;
		if (refreshedSizes.has(rel)) return refreshedSizes.get(rel);
		const abs = path.join(root, rel);
		return fs.existsSync(abs) ? fs.statSync(abs).size : null;
	};
	const index = runRuntimePipeline(buildIndexHtml({ sizeOf }), { filePath: indexAbs, kind: "index", root, steps }).html;
	const indexBefore = fs.existsSync(indexAbs) ? fs.readFileSync(indexAbs, "utf8") : null;
	if (index !== indexBefore) {
		changed.push({ file: "index.html", steps: ["index"] });
		byStep.index += 1;
		if (write) fs.writeFileSync(indexAbs, index, "utf8");
	}
	const total = files.length + (indexBefore === null ? 1 : 0);
	return { total, changed, byStep, write };
}

const REFRESH_FIX = "Run: node .agents/skills/vpk-html/scripts/build.mjs --refresh-library (unsandboxed). After a dependency update, @atlaskit/icon glyphs baked into the theme runtime and enhancement block may have changed; refreshing is the fix.";

export function formatRefreshReport(result, { check = false } = {}) {
	const lines = [`vpk-html library refresh (${check ? "check" : "write"})`];
	for (const [id, count] of Object.entries(result.byStep)) {
		lines.push(`  ${id.padEnd(14)}${String(count).padStart(5)} changed${id === "index" ? " (build-index)" : ""}`);
	}
	const count = result.changed.length;
	if (count === 0) {
		lines.push(`✓ library is at its fixed point (${result.total} files)`);
	} else if (check) {
		lines.push(`✗ vpk-html library drift: ${count} of ${result.total} files differ from the runtime pipeline`);
		for (const { file, steps } of result.changed.slice(0, 20)) lines.push(`  ${file} (${steps.join(", ")})`);
		if (count > 20) lines.push(`  …and ${count - 20} more`);
		lines.push(REFRESH_FIX);
	} else {
		lines.push(`✓ ${count} of ${result.total} files changed`);
	}
	return lines.join("\n");
}

// --inject-runtime body: one pipeline run per file, kind chosen by path.
export async function injectRuntimeFiles(filePaths) {
	if (!filePaths || filePaths.length === 0) throw new Error("--inject-runtime requires at least one file path");
	let changed = 0;
	let unchanged = 0;
	for (const filePath of filePaths) {
		const abs = path.resolve(filePath);
		if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
		const before = fs.readFileSync(abs, "utf8");
		const after = applyRuntimePipeline(before, { filePath: abs });
		if (after === before) {
			unchanged += 1;
			continue;
		}
		fs.writeFileSync(abs, after, "utf8");
		changed += 1;
	}
	console.log(`✓ injected runtime into ${changed} changed, ${unchanged} unchanged file${filePaths.length === 1 ? "" : "s"}`);
	return { ok: true, changed, unchanged };
}

// Shared body of the alias CLIs (retrofit.mjs, inject-enhancements.mjs, build-index.mjs). → exit code
export async function runLibraryRefreshCli({ script, argv = [] } = {}) {
	const unknown = argv.filter(arg => arg !== "--check");
	if (unknown.length > 0) {
		console.error(`Unknown argument(s): ${unknown.join(", ")}`);
		console.error(`Usage: node .agents/skills/vpk-html/scripts/${script} [--check]`);
		return 1;
	}
	const check = argv.includes("--check");
	console.log(`note: ${script} runs the full library refresh (build.mjs --refresh-library)`);
	const result = await refreshLibrary({ write: !check });
	console.log(formatRefreshReport(result, { check }));
	return check && result.changed.length > 0 ? 1 : 0;
}

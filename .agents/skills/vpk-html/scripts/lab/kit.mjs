#!/usr/bin/env node
// vpk-lab kit · build, inject, refresh and check the lab block (references/lab-kit.md).
//
//   node .agents/skills/vpk-html/scripts/lab/kit.mjs --inject <file.html…>   add or refresh the block (writes)
//   node .agents/skills/vpk-html/scripts/lab/kit.mjs --check <file.html…>    exit 1 when a block is stale or missing;
//                                                                              markup issues print as warn on stderr
//   node .agents/skills/vpk-html/scripts/lab/kit.mjs --print                 the block on stdout
// Writing under .agents/skills/ must run unsandboxed; artifacts are fine in the sandbox.
//
// The block is <!-- vpk-lab:start --><style data-vpk-lab>…</style><script data-vpk-lab-runtime>…</script><!-- vpk-lab:end -->:
// lab.css with ":kit " expanded to the kit-root scope, then the runtime modules concatenated in this order —
// ../runtime/frame-loop.mjs (window.vpkFrameLoop, integration K4/R1), core, color, loop-adapter, frame, film, gantt,
// widgets, index — with single-line relative imports dropped, `export ` stripped, inside one strict IIFE that ends
// with installLab(globalThis). It is replaced in place, or inserted before the last </body> (runtime/blocks.mjs).
// The registry step (runtime/lab.mjs) only refreshes blocks that exist. This module reads no file on import.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findJsonIslands, parseJsonIsland } from "../json-island.mjs";
import { markerPair, replaceMarkedBlock, upsertMarkedBlock } from "../runtime/blocks.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LAB_MARKERS = Object.freeze(markerPair("lab"));
export const LAB_RUNTIME_FILES = Object.freeze([
	"../runtime/frame-loop.mjs", "runtime/core.mjs", "runtime/color.mjs", "runtime/loop-adapter.mjs", "runtime/frame.mjs",
	"runtime/film.mjs", "runtime/gantt.mjs", "runtime/widgets.mjs", "runtime/index.mjs",
]);
export const LAB_ROOT_ATTRIBUTES = Object.freeze(["film", "cues", "gantt", "lab", "filters", "flip-deck", "layers"]);
export const LAB_SCOPE = `:where(${LAB_ROOT_ATTRIBUTES.map(name => `[data-vpk-${name}]`).join(", ")})`;
const SINGLE_LINE_IMPORT = /^import \{[^}\n]*\} from "\.{1,2}\/[\w./-]+\.mjs";\n/gm;
const STRIP_EXPORT = /^export (?=(async )?function|const|let|class)/gm;
const memo = new Map();

const read = file => fs.readFileSync(path.join(HERE, file), "utf8");

/** One runtime module with its single-line relative imports dropped and `export ` stripped. Throws on any other
 * import form (multi-line, default, namespace, dynamic) or on a surviving export. */
export function stripModule(source, file = "module") {
	const out = source.replace(SINGLE_LINE_IMPORT, "").replace(STRIP_EXPORT, "");
	if (/^\s*import\b|\bimport\s*\(/m.test(out)) throw new Error(`lab/kit: ${file} uses an import form the bundler cannot inline (single-line relative named imports only)`);
	if (/^\s*export\b/m.test(out)) throw new Error(`lab/kit: ${file} keeps an export the bundler cannot strip`);
	return out;
}

/** Drop whole-line comments (line and block comments that start a line) and blank lines; code is untouched. */
export function stripLineComments(source) {
	return source.replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n/gm, "").replace(/^[ \t]*\/\/.*\n/gm, "").replace(/\n{2,}/g, "\n");
}

/** The inlined runtime: every module in LAB_RUNTIME_FILES order inside one strict IIFE. Memoised. */
export function buildLabRuntimeSource() {
	if (!memo.has("js")) {
		const body = LAB_RUNTIME_FILES.map(file => `// ${path.basename(file)}\n${stripLineComments(stripModule(read(file), file)).trim()}`).join("\n");
		memo.set("js", `(() => {\n"use strict";\n${body}\ninstallLab(globalThis);\n})();`);
	}
	return memo.get("js");
}

/** lab.css without comments, each "@kit {" wrapper replaced by the kit-root :where() scope. Memoised. */
export function buildLabCss() {
	if (!memo.has("css")) memo.set("css", read("lab.css").replace(/\/\*[\s\S]*?\*\/\n?/g, "").split("@kit {").join(`${LAB_SCOPE} {`).trim());
	return memo.get("css");
}

/** The complete marked block. `css`/`js` overrides exist for tests. */
export function buildLabBlock({ css = buildLabCss(), js = buildLabRuntimeSource() } = {}) {
	return [LAB_MARKERS.start, "<style data-vpk-lab>", css, "</style>", "<script data-vpk-lab-runtime>", js, "</script>", LAB_MARKERS.end].join("\n");
}

export function hasLabBlock(html) {
	return html.includes(LAB_MARKERS.start) && html.includes(LAB_MARKERS.end);
}

/** Replace-only refresh (the registry step): documents without the markers come back byte-identical. */
export function refreshLabKit(html, { block } = {}) {
	if (!hasLabBlock(html)) return html;
	return replaceMarkedBlock(html, LAB_MARKERS.start, LAB_MARKERS.end, block ?? buildLabBlock()) ?? html;
}

/** Add the block (before the last </body>) or refresh it in place. */
export function injectLabKit(html, { block } = {}) {
	return upsertMarkedBlock(html, { ...LAB_MARKERS, block: block ?? buildLabBlock() });
}

/** The current block text in `html`, or null. */
export function extractLabBlock(html) {
	const start = html.indexOf(LAB_MARKERS.start);
	const end = html.indexOf(LAB_MARKERS.end, start);
	return start < 0 || end < 0 ? null : html.slice(start, end + LAB_MARKERS.end.length);
}

// Blank scripts, styles and comments (same length, so offsets stay true): kit roots live in the markup only.
function stripScripts(html) {
	const blank = match => " ".repeat(match.length);
	return html.replace(/<script\b[\s\S]*?<\/script>/gi, blank).replace(/<style\b[\s\S]*?<\/style>/gi, blank).replace(/<!--[\s\S]*?-->/g, blank);
}

const tagsWith = (html, attribute) => [...html.matchAll(new RegExp(`<[a-z][\\w-]*\\b[^>]*\\s${attribute}(?=[\\s>=/])[^>]*>`, "gi"))].map(match => ({ tag: match[0], index: match.index }));
const hasAttr = (tag, name) => new RegExp(`\\s${name}(?=[\\s>=/])`, "i").test(tag);

/** Advisory markup issues for documents that carry kit roots (lab-kit.md, Markup contract). → string[] */
export function collectLabMarkupIssues(html) {
	const source = stripScripts(String(html));
	const issues = [];
	for (const name of LAB_ROOT_ATTRIBUTES) {
		for (const { tag } of tagsWith(source, `data-vpk-${name}`)) {
			if (!hasAttr(tag, "data-vpkh-no-lightbox")) issues.push(`kit root [data-vpk-${name}] lacks data-vpkh-no-lightbox: ${tag.slice(0, 120)}`);
		}
	}
	const labs = tagsWith(source, "data-vpk-lab");
	labs.forEach(({ tag, index }, position) => {
		const id = /data-vpk-lab="([^"]*)"/.exec(tag)?.[1] ?? "?";
		const slice = source.slice(index, labs[position + 1]?.index ?? source.length);
		if (!/\sdata-vpk-lab-source(?=[\s>=/])/.test(slice)) issues.push(`lab "${id}" has no [data-vpk-lab-source] (the source file:lines of the maths it ports)`);
	});
	for (const { tag } of tagsWith(source, "data-vpk-film-video")) {
		if (hasAttr(tag, "autoplay")) issues.push(`film video must not autoplay: ${tag.slice(0, 120)}`);
		for (const name of ["muted", "playsinline"]) if (!hasAttr(tag, name)) issues.push(`film video lacks ${name}: ${tag.slice(0, 120)}`);
	}
	for (const name of ["beat", "film-time", "readout", "lab-note", "select-detail", "out"]) {
		for (const { tag } of tagsWith(source, `data-vpk-${name}`)) {
			if (!hasAttr(tag, "data-vpk-review-ignore")) issues.push(`[data-vpk-${name}] mirrors runtime text and needs data-vpk-review-ignore: ${tag.slice(0, 120)}`);
		}
	}
	if (tagsWith(source, "data-vpk-swatch").length) {
		const reason = /data-vpk-lab-swatches="([^"]*)"/.exec(source)?.[1] ?? "";
		if (reason.trim().length < 12) issues.push("[data-vpk-swatch] needs svg[data-vpk-external-asset][data-vpk-lab-swatches=\"<reason, 12+ characters>\"] and an explicit_deviations entry (decision 2)");
	}
	return [...issues, ...collectDuplicateCueIssues(html), ...collectFilmClockIssues(html)];
}

const attrOf = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag)?.[1] ?? null;

/** Cue buttons that share a data-vpk-cue id (a cue's identity in the content IR, its island and the cue sheet). → string[] */
export function collectDuplicateCueIssues(html) {
	const ids = tagsWith(stripScripts(String(html)), "data-vpk-cue").map(({ tag }) => attrOf(tag, "data-vpk-cue"));
	return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].map(id => `${ids.filter(other => other === id).length} cue buttons share data-vpk-cue="${id}"; cue ids must be unique (fix cues[].id in the content IR and re-render)`);
}

/**
 * Dead cue sheets: cues and Gantts whose data-clock names a segment missing from their film's data, so their seeks do
 * nothing. Only films with an embedded film (film data with a duration) are checked. A cue or Gantt follows its own
 * data-film-target (a cue also its [data-vpk-cues] list's), else the first film, as the runtime does. → string[]
 */
export function collectFilmClockIssues(html) {
	const text = String(html);
	const source = stripScripts(text);
	const islands = findJsonIslands(text, "data-vpk-film-data");
	const films = tagsWith(source, "data-vpk-film").map(({ tag, index }, position, all) => {
		const island = islands.find(item => item.start > index && item.start < (all[position + 1]?.index ?? text.length));
		let data = null;
		try { data = island ? parseJsonIsland(island.raw) : null; } catch { data = null; }
		return { id: attrOf(tag, "id"), data, ids: Array.isArray(data?.segments) && data.segments.length ? data.segments.map(segment => segment.id) : ["film"] };
	});
	const lists = tagsWith(source, "data-vpk-cues");
	const dead = new Map();
	for (const { tag, index } of tagsWith(source, "data-clock")) {
		const kind = hasAttr(tag, "data-vpk-gantt") ? "Gantt" : hasAttr(tag, "data-vpk-cue") ? "cue" : null;
		const list = kind === "cue" ? lists.filter(item => item.index < index).at(-1) : null;
		const target = attrOf(tag, "data-film-target") ?? (list ? attrOf(list.tag, "data-film-target") : null);
		const film = films.find(item => target && item.id === target) ?? films[0];
		const clock = attrOf(tag, "data-clock");
		if (!kind || !film || !(Number(film.data?.duration) > 0) || film.ids.includes(clock)) continue;
		const key = `${film.id} ${clock}`;
		if (!dead.has(key)) dead.set(key, { film, clock, users: [] });
		dead.get(key).users.push(`${kind} ${attrOf(tag, kind === "cue" ? "data-vpk-cue" : "id") ?? "?"}`);
	}
	return [...dead.values()].map(({ film, clock, users }) => `${users.join(", ")} follow${users.length === 1 ? "s" : ""} clock segment "${clock}", which the film data of "${film.id}" lacks (segments: ${film.ids.join(", ")}), so seeking from ${users.length === 1 ? "it" : "them"} does nothing; name the captured segment "${clock}" (capture.mjs --url … --segment-id ${clock}, or the spec's segment id) or set film.clock_id to a captured segment and re-render`);
}

/** `{ ok, stale, missing, issues }` for one document: ok when a current block exists. */
export function checkLabHtml(html) {
	const current = extractLabBlock(html);
	const missing = current === null;
	const stale = !missing && current !== buildLabBlock();
	return { ok: !missing && !stale, missing, stale, issues: collectLabMarkupIssues(html) };
}

function main(argv) {
	const [mode, ...files] = argv;
	if (mode === "--print" && files.length === 0) {
		process.stdout.write(`${buildLabBlock()}\n`);
		return 0;
	}
	if (!["--inject", "--check"].includes(mode) || files.length === 0) {
		console.error("Usage: kit.mjs --inject <file.html…> | --check <file.html…> | --print");
		return 2;
	}
	let failed = 0;
	for (const file of files) {
		const abs = path.resolve(process.cwd(), file);
		const rel = path.relative(process.cwd(), abs);
		const html = fs.readFileSync(abs, "utf8");
		if (mode === "--inject") {
			const next = injectLabKit(html);
			if (next !== html) fs.writeFileSync(abs, next);
			console.log(`${next === html ? "unchanged" : "✓ injected"} ${rel}`);
		} else {
			const result = checkLabHtml(html);
			if (result.ok) console.log(`✓ ${rel}: lab block current`);
			else {
				failed += 1;
				console.error(`✗ ${rel}: lab block ${result.missing ? "missing" : "stale"}; run kit.mjs --inject ${rel}`);
			}
			for (const issue of result.issues) console.warn(`warn ${rel}: ${issue}`);
		}
	}
	return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}

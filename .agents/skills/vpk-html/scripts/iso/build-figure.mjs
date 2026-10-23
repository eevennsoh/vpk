#!/usr/bin/env node
// iso/build-figure — iso-kit brief → standalone page, region fragment, or in-place regions.
//
//   node .agents/skills/vpk-html/scripts/iso/build-figure.mjs --brief <brief.json> [--style manual] [--out <file>] [--fragment] [--no-runtime] [--print-bytes]
//   node .agents/skills/vpk-html/scripts/iso/build-figure.mjs --inject <doc.html> [--check]
//
// A page goes through validateBrief → auditScene → illustrationPage → the ws0 runtime pipeline →
// check-html → auditHtml; any failure exits 1 and writes nothing. --inject rebuilds every iso-kit
// region that has a `src` brief (relative to the document's folder; marker text inside <script> or
// <style> is ignored with a warning), carries the plate root's
// data-vpk-id / data-vpk-revision over byte-exact (integration R20), inserts
// <meta name="vpk-figure-engine"> when absent (R4), then runs the pipeline on the document; an audit
// error leaves the document as it was (exit 1), and
// --check writes nothing and exits 1 when the file would change. Exit codes: 0 ok, 1 validation /
// audit / drift failure, 2 usage error (including a --style other than manual, the kit's one style). Writing under .agents/skills/ or artifacts/ is unsandboxed.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { blankCode, engineRoots, figureEngineMetas } from "../figures/check-figures.mjs";
import { ensureFigureEngineMeta, illustrationPage } from "../figures/page.mjs";
import { auditHtml, auditScene, formatFindings, uniqueFindings } from "./audit.mjs";
import { assertRegionSrc, renderFigure } from "./emit.mjs";
import { presetFor } from "./palette.mjs";
import { BriefError, buildScene } from "./scene.mjs";

export function loadBrief(input) {
	if (input && typeof input === "object") return input;
	const file = path.resolve(String(input));
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch (error) {
		throw new BriefError([`cannot read brief ${file}: ${error.message}`]);
	}
}

/** Region HTML for one brief (deterministic). ws4b's engine demo calls this. */
export function renderIsoFigure(brief, { style, src, indent = "", attrs = "" } = {}) {
	const scene = buildScene(loadBrief(brief), style ? { style } : {});
	const figure = renderFigure(scene, { src, indent, attrs });
	return { region: figure.region, sizes: figure.sizes, scene, warnings: scene.warnings };
}

const errorsIn = findings => findings.filter(finding => finding.severity === "error");

/**
 * Builds a figure page (or fragment). Never writes; returns
 * { html, region, sizes, warnings, findings, failures }.
 */
export async function buildFigure({ brief, style, fragment = false, runtime = true, src, filePath, slug, title, summary, eyebrow } = {}) {
	const data = loadBrief(brief);
	const { region, sizes, scene, warnings } = renderIsoFigure(data, { style, src, indent: "\t" });
	const findings = auditScene(scene);
	if (fragment) {
		const audit = auditHtml(region);
		return { html: `${region}\n`, region, sizes, warnings, findings: uniqueFindings([...findings, ...audit.findings]), failures: [] };
	}
	const name = slug ?? data.id;
	let html = illustrationPage({ slug: name, title: title ?? data.title, summary: summary ?? data.caption ?? data.label, figureHtml: `\t${region}`, figureEngine: "iso-kit", eyebrow });
	let failures = [];
	if (runtime) {
		const { applyRuntimePipeline } = await import("../runtime/pipeline.mjs");
		html = applyRuntimePipeline(html, { filePath: filePath ?? path.join(os.tmpdir(), `${name}.html`) });
		const { validateHtmlString } = await import("../check-html.mjs");
		failures = validateHtmlString(html, filePath ?? name).failures;
	}
	return { html, region, sizes, warnings, findings: uniqueFindings([...findings, ...auditHtml(html).findings]), failures };
}

const BEGIN = /<!-- vpk-figure:begin\b([^>]*?)-->/g;
const attrOf = (text, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(text)?.[1];
const CARRY = /\s(?:data-vpk-id|data-vpk-revision)="[^"]*"/g;

/** Rebuilds iso-kit regions in an HTML string. `readBrief(src)` returns the brief object. */
export function injectIsoRegions(html, { readBrief }) {
	const warnings = [];
	const findings = [];
	const rebuilt = [];
	const skipped = [];
	const regions = [];
	// Markers are matched against a copy with script and style bodies blanked (same length): marker text
	// inside script or style is not a region, and rewriting it would break that code, so it is left as is.
	const code = blankCode(html);
	for (const match of html.matchAll(BEGIN)) {
		if (attrOf(match[1], "engine") !== "iso-kit") continue;
		const id = attrOf(match[1], "id");
		if (!code.startsWith(match[0], match.index)) {
			warnings.push(`region marker "${id ?? ""}" is inside <script> or <style> text; ignored (place regions in the document body)`);
			continue;
		}
		const endMarker = `<!-- vpk-figure:end id="${id}" -->`;
		const end = code.indexOf(endMarker, match.index);
		if (!id || end < 0) throw new Error(`iso-kit region ${JSON.stringify(id ?? "")} has no matching <!-- vpk-figure:end id="${id ?? ""}" -->`);
		regions.push({ id, src: attrOf(match[1], "src"), start: match.index, end: end + endMarker.length });
	}
	const ids = regions.map(region => region.id);
	for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) throw new Error(`figure id "${id}" is used by more than one iso-kit region`);
	const figIds = new Map();
	let out = "";
	let cursor = 0;
	for (const region of regions) {
		const current = html.slice(region.start, region.end);
		const lineStart = html.lastIndexOf("\n", region.start) + 1;
		const indent = /^[\t ]*/.exec(html.slice(lineStart, region.start))[0];
		let next = current;
		if (!region.src) {
			skipped.push(region.id);
			warnings.push(`region "${region.id}" has no src brief; left as is`);
		} else {
			assertRegionSrc(region.src);
			const brief = readBrief(region.src);
			if (brief.id !== region.id) throw new Error(`region "${region.id}" points at a brief with id "${brief.id}"`);
			const root = /<figure\b[^>]*\bdata-vpk-engine="iso-kit"[^>]*>/.exec(current)?.[0] ?? "";
			const carry = (root.match(CARRY) ?? []).join("");
			const built = renderIsoFigure(brief, { src: region.src, indent, attrs: carry });
			warnings.push(...built.warnings.map(text => `${region.id}: ${text}`));
			// The model-level audit (A7 at every pose) runs here too: the emitted SVG holds the rest pose only.
			findings.push(...auditScene(built.scene));
			next = built.region;
			rebuilt.push(region.id);
		}
		const figId = /\bdata-vpk-fig-id="([^"]*)"/.exec(next)?.[1];
		if (figId) {
			if (figIds.has(figId)) throw new Error(`${figId} is used by iso-kit regions "${figIds.get(figId)}" and "${region.id}"`);
			figIds.set(figId, region.id);
		}
		out += html.slice(cursor, region.start) + next;
		cursor = region.end;
	}
	return { html: out + html.slice(cursor), rebuilt, skipped, warnings, findings };
}

/** --inject: rebuild regions from their src briefs, upsert the engine meta, run the pipeline. */
export async function injectIsoFigures(file, { check = false } = {}) {
	const target = path.resolve(file);
	const base = path.dirname(target);
	const html = fs.readFileSync(target, "utf8");
	const readBrief = src => {
		const resolved = path.resolve(base, src);
		if (path.relative(base, resolved).startsWith("..")) throw new Error(`region src ${src} leaves the document folder`);
		return loadBrief(resolved);
	};
	const result = injectIsoRegions(html, { readBrief });
	const { applyRuntimePipeline } = await import("../runtime/pipeline.mjs");
	const next = applyRuntimePipeline(ensureFigureEngineMeta(result.html), { filePath: target });
	const findings = uniqueFindings([...result.findings, ...auditHtml(next).findings]);
	const warnings = [...result.warnings];
	// R4: an existing meta is never overwritten, but one that does not cover the iso-kit roots now present
	// makes check-html fail with E2, so say so here instead of exiting 0 silently (B2 decision 17c).
	const meta = figureEngineMetas(next)[0];
	if (meta !== undefined && meta !== "iso-kit" && meta !== "both" && engineRoots(next).some(root => root.engine === "iso-kit")) {
		warnings.push(`<meta name="vpk-figure-engine" content="${meta}"> does not cover the iso-kit figures in this document (check-html fails with E2); set it to "${engineRoots(next).some(root => root.engine === "anatomy-hero") ? "both" : "iso-kit"}"`);
	}
	const changed = next !== html;
	// Audit errors are fatal (C-iso-10): the document is written only when the rebuilt figures pass.
	const written = changed && !check && errorsIn(findings).length === 0;
	if (written) fs.writeFileSync(target, next, "utf8");
	return { file: target, changed, written, html: next, rebuilt: result.rebuilt, skipped: result.skipped, warnings, findings };
}

const USAGE = `Usage:
  build-figure.mjs --brief <brief.json> [--style manual] [--out <file>] [--fragment] [--no-runtime] [--print-bytes]
  build-figure.mjs --inject <doc.html> [--check]`;

function parseArgs(argv) {
	const args = { check: false, fragment: false, runtime: true, printBytes: false };
	const value = (i, flag) => {
		if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error(`${flag} needs a value`);
		return argv[i + 1];
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--brief") args.brief = value(i++, arg);
		else if (arg === "--style") presetFor((args.style = value(i++, arg)));
		else if (arg === "--out") args.out = value(i++, arg);
		else if (arg === "--inject") args.inject = value(i++, arg);
		else if (arg === "--fragment") args.fragment = true;
		else if (arg === "--no-runtime") args.runtime = false;
		else if (arg === "--check") args.check = true;
		else if (arg === "--print-bytes") args.printBytes = true;
		else throw new Error(`unknown argument ${arg}`);
	}
	if (Boolean(args.brief) === Boolean(args.inject)) throw new Error("give exactly one of --brief or --inject");
	if (args.check && !args.inject) throw new Error("--check works with --inject");
	return args;
}

export async function main(argv = process.argv.slice(2)) {
	let args;
	try {
		args = parseArgs(argv);
	} catch (error) {
		console.error(`${error.message}\n${USAGE}`);
		return 2;
	}
	try {
		if (args.inject) {
			const result = await injectIsoFigures(args.inject, { check: args.check });
			for (const warning of result.warnings) console.warn(`warn ${warning}`);
			const errors = errorsIn(result.findings);
			if (errors.length) console.error(formatFindings({ figures: result.rebuilt.length + result.skipped.length, findings: result.findings }, { label: result.file }));
			const name = path.relative(process.cwd(), result.file);
			// One status line. With audit errors the regions are neither "current" nor "stale": they cannot be built (B2 decision 17a).
			if (errors.length) {
				const count = `${errors.length} audit error${errors.length === 1 ? "" : "s"}`;
				console.log(args.check ? `✗ ${name}: ${count}; fix the brief, then run build-figure.mjs --inject ${name}` : `✗ ${name}: not written (${count})`);
				return 1;
			}
			if (args.check) {
				console.log(result.changed ? `✗ ${name}: iso-kit regions are stale (run build-figure.mjs --inject ${name})` : `✓ ${name}: iso-kit regions are current`);
				return result.changed ? 1 : 0;
			}
			console.log(`${result.written ? "wrote" : "unchanged"} ${name} (${result.rebuilt.length} rebuilt, ${result.skipped.length} without src)`);
			return 0;
		}
		const out = args.out ? path.resolve(args.out) : undefined;
		const result = await buildFigure({ brief: args.brief, style: args.style, fragment: args.fragment, runtime: args.runtime, filePath: out });
		for (const warning of result.warnings) console.warn(`warn ${warning}`);
		const errors = errorsIn(result.findings);
		if (errors.length || result.failures.length) {
			if (errors.length) console.error(formatFindings({ figures: 1, findings: result.findings }, { label: args.brief }));
			for (const failure of result.failures) console.error(`- ${failure}`);
			return 1;
		}
		if (args.printBytes) console.error(`bytes: region ${result.sizes.region}, svg ${result.sizes.svg}, page ${Buffer.byteLength(result.html)}`);
		if (out) {
			fs.mkdirSync(path.dirname(out), { recursive: true });
			fs.writeFileSync(out, result.html, "utf8");
			console.error(`wrote ${path.relative(process.cwd(), out)}`);
		} else process.stdout.write(result.html);
		return 0;
	} catch (error) {
		console.error(error instanceof BriefError ? error.message : `build-figure: ${error.message}`);
		return 1;
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().then(code => (process.exitCode = code));

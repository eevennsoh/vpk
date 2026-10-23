#!/usr/bin/env node
/*
 * anatomy/build-hero — rebuild every anatomy hero region of a document from its hero module
 * (ws4b spec section 6.4; integration K11, K20, R4, R20).
 *
 *   node .agents/skills/vpk-html/scripts/anatomy/build-hero.mjs <artifact.html> [--audit] [--check] [--json]
 *   node .agents/skills/vpk-html/scripts/anatomy/build-hero.mjs --audit-only <hero.mjs>
 *   node .agents/skills/vpk-html/scripts/build.mjs --build-hero <artifact.html> [--audit] [--check] [--json]
 *
 * A region is <!-- vpk-anatomy-hero:start id="<id>" src="_figures/<id>.hero.mjs" --> … <!-- vpk-anatomy-hero:end id="<id>" -->;
 * `src` resolves against the document's folder and must be relative. Each region is rebuilt in place, the
 * root's ws1 data-vpk-id/data-vpk-revision are carried over byte-exact, <meta name="vpk-figure-engine"> is
 * inserted when absent (never overwritten), and the anatomy CSS and runtime blocks are refreshed. Idempotent.
 * --check writes nothing and exits 1 when the rebuilt bytes differ. Exit codes: 0 ok; 1 audit, sanitizer,
 * validation or stale --check; 2 usage. Writing under .agents/skills/ needs the unsandboxed shell.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { anatomyMarkers, engineRoots } from "../figures/check-figures.mjs";
import { ensureFigureEngineMeta } from "../figures/page.mjs";
import { buildHero } from "./hero.mjs";
import { refreshAnatomyRuntime } from "./runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT_START = /<div\b[^>]*\sdata-vpk-engine="anatomy-hero"[^>]*>/;

const kb = n => `${(n / 1024).toFixed(1)} KB`;

export class HeroBuildError extends Error {}

export function assertHeroSrc(src, id) {
	if (!src) throw new HeroBuildError(`anatomy hero ${id}: the start marker has no src="_figures/${id}.hero.mjs"`);
	if (src.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.includes("\\")) {
		throw new HeroBuildError(`anatomy hero ${id}: src "${src}" must be a relative path from the document's folder`);
	}
	return src;
}

export async function loadHeroModule(file) {
	return import(pathToFileURL(path.resolve(file)).href);
}

// The engine record the roots present call for (R4: inserted when absent, never overwritten).
export function engineForRoots(html) {
	const kinds = new Set(engineRoots(html).map(root => root.engine).filter(engine => engine === "iso-kit" || engine === "anatomy-hero"));
	if (kinds.size === 2) return "both";
	return kinds.size ? [...kinds][0] : undefined;
}

export function summaryLine(result) {
	const audit = result.audit ? ` · audit ${result.audit.failures ? `failed: ${result.audit.failures} problem${result.audit.failures === 1 ? "" : "s"}` : "passed"} in ${(result.audit.ms / 1000).toFixed(1)} s` : "";
	return `hero ${result.id} · ${result.tier} · ${result.parts} parts (${result.solids} solids) · region ${kb(result.sizes.region)} · script ${kb(result.sizes.script)} · camera ${result.camera}${audit}`;
}

// Rebuilds every region in `html`. → { html, heroes: [result] }; throws HeroBuildError on bad input,
// including any marker that is not part of a complete same-id pair (H6), so a broken region never reads as none.
export async function rebuildHeroRegions(html, { baseDir, audit = false } = {}) {
	const { pairs, issues } = anatomyMarkers(html);
	if (issues.length) throw new HeroBuildError(issues.map(issue => `anatomy hero ${issue.id}: ${issue.message}`).join("\n✗ "));
	const twice = pairs.map(pair => pair.id).find((id, index, ids) => ids.indexOf(id) !== index);
	if (twice) throw new HeroBuildError(`anatomy hero ${twice}: H2 more than one region with id "${twice}" (hero ids are unique across figure engines)`);
	const results = [];
	let out = "";
	let cursor = 0;
	for (const pair of pairs) {
		const { id } = pair;
		const src = assertHeroSrc(pair.src, id);
		const file = path.resolve(baseDir, src);
		if (!fs.existsSync(file)) throw new HeroBuildError(`anatomy hero ${id}: hero module not found at ${src}`);
		const mod = await loadHeroModule(file);
		if (mod.hero?.id !== id) throw new HeroBuildError(`anatomy hero ${id}: ${src} exports hero.id ${JSON.stringify(mod.hero?.id)}`);
		const previousRoot = pair.text.match(ROOT_START)?.[0] ?? null;
		const result = await buildHero(mod, { audit, previousRoot, src });
		results.push(result);
		out += html.slice(cursor, pair.start) + result.fragment;
		cursor = pair.end;
	}
	out += html.slice(cursor);
	if (results.length) {
		out = ensureFigureEngineMeta(out, engineForRoots(out));
	}
	return { html: refreshAnatomyRuntime(out), heroes: results };
}

export async function buildHeroFile(filePath, { audit = false, check = false } = {}) {
	const abs = path.resolve(filePath);
	if (!fs.existsSync(abs)) throw new HeroBuildError(`File not found: ${abs}`);
	const before = fs.readFileSync(abs, "utf8");
	const { html, heroes } = await rebuildHeroRegions(before, { baseDir: path.dirname(abs), audit });
	const changed = html !== before;
	const auditFailures = heroes.reduce((sum, hero) => sum + (hero.audit?.failures ?? 0), 0);
	// A failed audit writes nothing (decision 18b): the document stays as it was, like build-figure --inject.
	const written = !check && changed && auditFailures === 0;
	if (written) fs.writeFileSync(abs, html, "utf8");
	return { file: abs, heroes, changed, written, stale: check && changed, auditFailures, ok: auditFailures === 0 && !(check && changed) };
}

function usage() {
	console.error("Usage: build-hero.mjs <artifact.html> [--audit] [--check] [--json]");
	console.error("       build-hero.mjs --audit-only <hero.mjs>");
	return 2;
}

export async function runBuildHero({ file, audit = false, check = false, json = false, auditOnly = null } = {}) {
	try {
		if (auditOnly) {
			const abs = path.resolve(auditOnly);
			if (!fs.existsSync(abs)) throw new HeroBuildError(`Hero module not found: ${abs}`);
			const result = await buildHero(await loadHeroModule(abs), { audit: true });
			if (json) console.log(JSON.stringify({ ...result, fragment: undefined }, null, 2));
			else {
				console.log(result.audit.report);
				console.log(summaryLine(result));
				for (const warning of result.warnings) console.log(`  ⚠ ${warning}`);
				console.log(result.audit.failures ? `audit failed: ${result.audit.failures} problem${result.audit.failures === 1 ? "" : "s"}` : "audit passed");
			}
			return result.audit.failures ? 1 : 0;
		}
		if (!file) return usage();
		const result = await buildHeroFile(file, { audit, check });
		if (json) console.log(JSON.stringify({ ...result, heroes: result.heroes.map(hero => ({ ...hero, fragment: undefined })) }, null, 2));
		else {
			const rel = path.relative(process.cwd(), result.file);
			if (!result.heroes.length) console.log(`${rel}: no vpk-anatomy-hero regions`);
			for (const hero of result.heroes) {
				console.log(summaryLine(hero));
				for (const warning of hero.warnings) console.log(`  ⚠ ${warning}`);
				if (hero.audit?.failures) console.log(hero.audit.report);
			}
			if (result.auditFailures) console.log(`✗ ${rel}: not ${check ? "checked clean" : "written"} (audit failed: ${result.auditFailures} problem${result.auditFailures === 1 ? "" : "s"})`);
			else if (check) console.log(result.stale ? `✗ ${rel} is stale: rebuild with node .agents/skills/vpk-html/scripts/build.mjs --build-hero ${rel}` : `✓ ${rel} is up to date`);
			else console.log(result.changed ? `✓ wrote ${rel}` : `✓ ${rel} unchanged`);
		}
		return result.ok ? 0 : 1;
	} catch (error) {
		if (!(error instanceof HeroBuildError) && !/^anatomy hero /.test(error.message)) throw error;
		console.error(`✗ ${error.message}`);
		return 1;
	}
}

async function main(argv) {
	const args = { file: null, audit: false, check: false, json: false, auditOnly: null };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--audit") args.audit = true;
		else if (arg === "--check") args.check = true;
		else if (arg === "--json") args.json = true;
		else if (arg === "--audit-only") {
			args.auditOnly = argv[++i];
			if (!args.auditOnly) return usage();
		} else if (!arg.startsWith("--") && !args.file) args.file = arg;
		else return usage();
	}
	return runBuildHero(args);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	process.exitCode = await main(process.argv.slice(2));
}

#!/usr/bin/env node

// Shrink-only ratchet over Knip (knip.jsonc). Enforced: unused files, unused and unlisted
// dependencies, unlisted binaries and unresolved imports; today's findings of those live in
// scripts/unused-code-baseline.json. Unused exports and exported types are only reported
// (their counts and the delta against the base commit), never enforced: whether an export
// nothing imports yet should fail is an owner decision. An enforced finding the baseline
// does not record fails with its path; a recorded entry Knip no longer reports is
// stale and fails until the baseline drops it (`--update`, also `pnpm run fix:generated
// --only unused-code`); and the baseline may not gain entries over the one at the base
// commit (scripts/lib/ratchet-base.js), so hand-adding an entry fails too. `--update` only
// removes: it keeps the entries Knip still reports that the base baseline already had.
//
// A new or stale entry the base commit already had (main changed code without updating the
// baseline, or two changes raced) is not this change's. Once the base commit has a baseline,
// Knip also runs on an extract of the base tree: problems that tree shows against its own
// baseline are printed as a warning instead of failing, and the report's delta comes from it.
//
// A legitimate new entry point (started by a path string, a spawn, a manifest) is an `entry`
// line in knip.jsonc with its reason, never a baseline entry.

"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const { isBaseRequired, resolveBaseRef, runGit } = require("./lib/ratchet-base");

const REPO_ROOT = path.resolve(__dirname, "..");
const BASELINE_FILE = "scripts/unused-code-baseline.json";
const UPDATE_COMMAND = "pnpm run fix:generated --only unused-code";

// Knip's JSON issue keys. `files` entries are paths; the rest are `<file>#<name>` (a
// dependency's file is the package.json that lists it). ENFORCED ones are baselined and
// may only shrink; REPORTED ones are counted and compared with the base, never failed on.
const ENFORCED = Object.freeze([
	"files",
	"dependencies",
	"devDependencies",
	"optionalPeerDependencies",
	"unlisted",
	"binaries",
	"unresolved",
	"catalog",
]);
const REPORTED = Object.freeze(["exports", "nsExports", "types", "nsTypes", "enumMembers", "namespaceMembers"]);
const CATEGORIES = Object.freeze([...ENFORCED, ...REPORTED]);

const LABELS = Object.freeze({
	binaries: "unlisted binary",
	catalog: "unused catalog entry",
	dependencies: "unused dependency",
	devDependencies: "unused devDependency",
	enumMembers: "unused enum member",
	exports: "unused export",
	files: "unused file",
	namespaceMembers: "unused namespace member",
	nsExports: "unused namespace export",
	nsTypes: "unused namespace type",
	optionalPeerDependencies: "unused optional peer dependency",
	types: "unused exported type",
	unlisted: "unlisted dependency",
	unresolved: "unresolved import",
});


function memberName(item) {
	return item.parentSymbol ? `${item.parentSymbol}.${item.name}` : item.name;
}

// Knip's JSON report → sorted, de-duplicated keys per category. No line numbers, so moving
// code inside a file keeps its entry.
function collectFindings(report) {
	const sets = Object.fromEntries(CATEGORIES.map((category) => [category, new Set()]));
	for (const issue of report.issues ?? []) {
		for (const category of CATEGORIES) {
			for (const item of issue[category] ?? []) {
				sets[category].add(category === "files" ? item.name : `${issue.file}#${memberName(item)}`);
			}
		}
	}
	return Object.fromEntries(CATEGORIES.map((category) => [category, [...sets[category]].sort()]));
}

// The baseline holds only the enforced categories; anything else in the file is ignored.
function normalizeBaseline(baseline) {
	return Object.fromEntries(ENFORCED.map((category) => [category, [...(baseline?.[category] ?? [])].sort()]));
}

function difference(left, right) {
	const exclude = new Set(right);
	return left.filter((entry) => !exclude.has(entry));
}

// Three ways to fail: Knip reports something the baseline lacks (new), the baseline
// records something Knip no longer reports (stale), or the baseline holds an entry the
// base commit's baseline did not (grown).
function compareFindings({ base = null, baseline, current }) {
	const problems = [];
	for (const category of ENFORCED) {
		for (const entry of difference(current[category], baseline[category])) problems.push({ category, entry, type: "new" });
		for (const entry of difference(baseline[category], current[category])) problems.push({ category, entry, type: "stale" });
		if (base) {
			for (const entry of difference(baseline[category], base[category])) problems.push({ category, entry, type: "grown" });
		}
	}
	return problems;
}

// What `--update` writes: current findings the allowed baseline already records. The
// allowed baseline is the base commit's when there is one, so a conflicted or hand-edited
// working copy cannot carry entries in; with no baseline anywhere, this change introduces it.
function shrinkBaseline({ allowed, current }) {
	return Object.fromEntries(ENFORCED.map((category) => {
		if (!allowed) return [category, [...current[category]]];
		const keep = new Set(allowed[category]);
		return [category, current[category].filter((entry) => keep.has(entry))];
	}));
}

function formatProblems(problems, { baseRef = null } = {}) {
	const lines = [];
	const byType = (type) => problems.filter((problem) => problem.type === type);
	const added = byType("new");
	if (added.length > 0) {
		lines.push(`Unused code: ${added.length} new finding(s) not in ${BASELINE_FILE}:`);
		for (const { category, entry } of added) lines.push(`- ${LABELS[category]}: ${entry}`);
		lines.push("Use it or delete it. If a path string starts it (spawned, required by path, named in a manifest), add it to `entry` in knip.jsonc with the reason. The baseline never takes new entries.");
	}
	const stale = byType("stale");
	if (stale.length > 0) {
		lines.push(`Unused code: ${stale.length} baseline entr${stale.length === 1 ? "y is" : "ies are"} no longer reported:`);
		for (const { category, entry } of stale) lines.push(`- ${LABELS[category]}: ${entry}`);
		lines.push(`Drop them in the same change: ${UPDATE_COMMAND}`);
	}
	const grown = byType("grown");
	if (grown.length > 0) {
		lines.push(`${BASELINE_FILE} may only shrink, but it gained ${grown.length} entr${grown.length === 1 ? "y" : "ies"} over ${baseRef ? baseRef.slice(0, 9) : "the base"}:`);
		for (const { category, entry } of grown) lines.push(`- ${LABELS[category]}: ${entry}`);
		lines.push(`Remove them from the baseline and fix the code instead (then ${UPDATE_COMMAND}).`);
	}
	return lines.join("\n");
}

function countFindings(findings, categories = ENFORCED) {
	return categories.reduce((sum, category) => sum + findings[category].length, 0);
}

function summarize(findings, categories = ENFORCED) {
	return categories.filter((category) => findings[category].length > 0)
		.map((category) => `${findings[category].length} ${category}`)
		.join(", ");
}

const REPORT_LIST_LIMIT = 20;

// The report-only half: counts of unused exports and types, the delta against the base
// tree, and the entries that are new since the base, so they can be worked down.
function formatReport(current, { baseFindings = null, baseRef = null } = {}) {
	const parts = REPORTED.filter((category) => current[category].length > 0 || baseFindings?.[category]?.length > 0).map((category) => {
		const count = current[category].length;
		if (!baseFindings) return `${count.toLocaleString("en-US")} ${category}`;
		const delta = count - baseFindings[category].length;
		return `${count.toLocaleString("en-US")} ${category} (${delta > 0 ? "+" : ""}${delta} vs ${baseRef.slice(0, 9)})`;
	});
	const lines = [`Unused exports and types (reported, not enforced): ${parts.join(", ") || "none"}.`];
	if (baseFindings) {
		const added = REPORTED.flatMap((category) => difference(current[category], baseFindings[category]).map((entry) => `- ${LABELS[category]}: ${entry}`));
		if (added.length > 0) {
			lines.push(`New since ${baseRef.slice(0, 9)}:`, ...added.slice(0, REPORT_LIST_LIMIT));
			if (added.length > REPORT_LIST_LIMIT) lines.push(`- … and ${added.length - REPORT_LIST_LIMIT} more`);
		}
	}
	return lines.join("\n");
}

function runKnip({ cwd = REPO_ROOT, knipRoot = cwd } = {}) {
	// The package exports neither its bin nor package.json, so take the linked install.
	const knip = path.join(knipRoot, "node_modules", "knip", "bin", "knip.js");
	const result = spawnSync(process.execPath, [knip, "--reporter", "json", "--no-progress", "--no-exit-code", "--no-config-hints"], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, FORCE_COLOR: "0" },
		maxBuffer: 256 * 1024 * 1024,
	});
	if (result.status !== 0) {
		throw new Error(`knip exited with ${result.status ?? result.signal}:\n${result.stderr || result.stdout}`);
	}
	return JSON.parse(result.stdout);
}

// Knip's findings for the base commit's tree: an extract of that commit (without the asset
// folders Knip ignores) that borrows this checkout's installed packages.
function knipAtBase(baseRef, { cwd = REPO_ROOT, knip = runKnip } = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), "vpk-unused-code-base-"));
	try {
		const excludes = ["artifacts", "public", "media", ".agents/skills/vpk-html/assets", "**/.env*"].map((pattern) => `':(exclude,glob)${pattern}'`).join(" ");
		const extract = spawnSync("/bin/sh", ["-c", `git archive ${baseRef} -- . ${excludes} | tar -x -C '${dir}'`], { cwd, encoding: "utf8" });
		if (extract.status !== 0) throw new Error(`could not extract ${baseRef}: ${extract.stderr}`);
		for (const modules of ["node_modules", "backend/node_modules"]) {
			if (existsSync(path.join(cwd, modules)) && existsSync(path.dirname(path.join(dir, modules)))) {
				symlinkSync(path.join(cwd, modules), path.join(dir, modules));
			}
		}
		return collectFindings(knip({ cwd: dir, knipRoot: cwd }));
	} finally {
		rmSync(dir, { force: true, recursive: true });
	}
}

function problemKey({ category, entry, type }) {
	return `${type}\0${category}\0${entry}`;
}

// Splits failures into this change's and those the base tree already shows against its own
// baseline. Grown entries are always this change's.
function splitInherited(problems, { base, baseFindings }) {
	const inherited = new Set(compareFindings({ baseline: base, current: baseFindings }).map(problemKey));
	return {
		inherited: problems.filter((problem) => problem.type !== "grown" && inherited.has(problemKey(problem))),
		own: problems.filter((problem) => problem.type === "grown" || !inherited.has(problemKey(problem))),
	};
}

function readBaselineAt(baseRef, { cwd = REPO_ROOT, git = runGit } = {}) {
	const source = git(["show", `${baseRef}:${BASELINE_FILE}`], { cwd });
	return source === null ? null : normalizeBaseline(JSON.parse(source));
}

function readWorkingBaseline({ cwd = REPO_ROOT } = {}) {
	const file = path.join(cwd, BASELINE_FILE);
	return existsSync(file) ? normalizeBaseline(JSON.parse(readFileSync(file, "utf8"))) : null;
}

function writeBaseline(findings, { cwd = REPO_ROOT } = {}) {
	writeFileSync(path.join(cwd, BASELINE_FILE), `${JSON.stringify(findings, null, "\t")}\n`);
}

function resolveBase({ cwd = REPO_ROOT, env = process.env, git = runGit } = {}) {
	const baseRef = resolveBaseRef({ env, git: (args) => git(args, { cwd }) });
	if (!baseRef) {
		const message = "Unused code: base ref unavailable (fetch origin/main, check out with fetch-depth: 2 in CI, or set VPK_SUPPRESSIONS_BASE).";
		if (isBaseRequired(env)) throw new Error(message);
		return { base: null, baseRef: null, warning: `${message} Skipping the shrink-only comparison.` };
	}
	return { base: readBaselineAt(baseRef, { cwd, git }), baseRef, warning: null };
}

function main(argv = process.argv.slice(2), { cwd = REPO_ROOT, env = process.env, knip = runKnip, baseKnip = knipAtBase, git = runGit, log = console.log, error = console.error } = {}) {
	const update = argv.includes("--update");
	const started = performance.now();
	let resolved;
	try {
		resolved = resolveBase({ cwd, env, git });
	} catch (caught) {
		error(caught.message);
		return 1;
	}
	if (resolved.warning) error(resolved.warning);
	const current = collectFindings(knip({ cwd }));

	if (update) {
		let working = null;
		try {
			working = readWorkingBaseline({ cwd });
		} catch {
			// A conflicted working copy: the base baseline decides.
		}
		const next = shrinkBaseline({ allowed: resolved.base ?? working, current });
		writeBaseline(next, { cwd });
		const added = compareFindings({ baseline: next, current }).filter((problem) => problem.type === "new");
		log(`Wrote ${BASELINE_FILE}: ${countFindings(next)} entries (${summarize(next) || "none"}).`);
		if (added.length > 0) {
			error(formatProblems(added));
			return 1;
		}
		return 0;
	}

	const baseline = readWorkingBaseline({ cwd });
	if (!baseline) {
		error(`Unused code: ${BASELINE_FILE} is missing. Restore it from main; it is never regenerated from scratch.`);
		return 1;
	}
	// With a base baseline the base tree is analysed too: for the report's delta, and so a
	// problem the base already had is not blamed on this change.
	const baseFindings = resolved.base ? baseKnip(resolved.baseRef, { cwd, knip }) : null;
	let problems = compareFindings({ base: resolved.base, baseline, current });
	if (baseFindings && problems.some((problem) => problem.type !== "grown")) {
		const { inherited, own } = splitInherited(problems, { base: resolved.base, baseFindings });
		if (inherited.length > 0) {
			log(`Unused code: ${inherited.length} problem(s) already present at ${resolved.baseRef.slice(0, 9)}, not this change's (refresh with ${UPDATE_COMMAND} when convenient):`);
			log(formatProblems(inherited, { baseRef: resolved.baseRef }));
		}
		problems = own;
	}
	const report = formatReport(current, { baseFindings, baseRef: resolved.baseRef });
	if (problems.length > 0) {
		error(formatProblems(problems, { baseRef: resolved.baseRef }));
		log(report);
		return 1;
	}
	const baseNote = resolved.base
		? `${countFindings(resolved.base) - countFindings(baseline)} fixed vs ${resolved.baseRef.slice(0, 9)}`
		: resolved.baseRef ? `${resolved.baseRef.slice(0, 9)} has no baseline; this change introduces it` : "no base to compare";
	const seconds = ((performance.now() - started) / 1000).toFixed(1);
	log(`Verified unused files and dependencies only shrink (${countFindings(baseline)} baselined: ${summarize(baseline) || "none"}; ${baseNote}; ${seconds} s).`);
	log(report);
	return 0;
}

if (require.main === module) {
	process.exitCode = main();
}

module.exports = {
	BASELINE_FILE,
	CATEGORIES,
	ENFORCED,
	REPORTED,
	collectFindings,
	compareFindings,
	formatProblems,
	formatReport,
	knipAtBase,
	main,
	normalizeBaseline,
	runKnip,
	shrinkBaseline,
	splitInherited,
};

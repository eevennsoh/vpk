#!/usr/bin/env node
/*
 * playbooks: per-template playbooks, the template routing check and the playbook/eval
 * baselines (ws6 §5.8, integration K22 and R9). The playbook shape follows lavish-axi's
 * src/playbooks.js (MIT): use when, choose, structure, pitfalls.
 *
 *   node scripts/build.mjs --playbook [<template>] [--json]
 *
 * --check-evals runs collectRoutingIssues (every template and diagram has a CHEATSHEET row) and collectPlaybookIssues (evals.mjs), so the
 * rules hold in CI. The legacy baselines below may only shrink.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FIGURE_ENGINE_IDS } from "./content-ir.mjs";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const REQUIRED_SECTIONS = Object.freeze(["Use when", "Choose", "Structure", "Pitfalls"]);
export const OPTIONAL_SECTIONS = Object.freeze(["Design rules", "Figures", "Contract"]);
export const FIGURE_ENGINES = FIGURE_ENGINE_IDS;
export const FRONTMATTER_KEYS = Object.freeze(["template", "demo", "schema", "evals", "figure_engines"]);
export const MAX_PLAYBOOK_LINES = 150;

const html = names => Object.freeze(names.map(name => `${name}.html`));

// Templates that predate playbooks. Write one the first time a template gets an eval finding
// or a second-round feedback escalation, then remove its entry here.
export const LEGACY_TEMPLATES_WITHOUT_PLAYBOOK = html([
	"annual-report", "broadsheet", "changelog", "code-review-pr", "code-understanding", "component-variants",
	"design-system", "editor-feature-flags", "editor-prompt-tuner", "editor-triage-board", "equity-report",
	"exploration-code-approaches", "exploration-visual-designs", "feature-essay", "flowchart-diagram",
	"implementation-plan", "incident-report", "interview", "letter", "long-doc", "lookbook", "portfolio",
	"pr-writeup", "prototype-animation", "prototype-interaction", "research-concept-explainer",
	"research-feature-explainer", "resume", "slide-deck", "slides", "svg-illustrations",
]);

// Templates with no eval scenario yet. implementation-plan left with eval 8 (B2);
// research-concept-explainer left with eval 9 (B3); code-understanding left with the story-explainer evals.
export const LEGACY_TEMPLATES_WITHOUT_EVAL = html([
	"annual-report", "broadsheet", "changelog", "code-review-pr", "component-variants",
	"design-system", "editor-feature-flags", "editor-prompt-tuner", "editor-triage-board", "equity-report",
	"exploration-visual-designs", "feature-essay", "flowchart-diagram", "incident-report",
	"interview", "letter", "long-doc", "lookbook", "portfolio", "pr-writeup", "prototype-animation",
	"resume", "slides", "svg-illustrations",
]);

const normalizeTitle = title => title.trim().replace(/\s+/g, " ").toLowerCase();
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const readIfExists = file => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);

function listHtml(skillRoot, folder) {
	const dir = path.join(skillRoot, "assets", folder);
	return fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith(".html")).sort() : [];
}

const listTemplates = skillRoot => listHtml(skillRoot, "templates");

function loadCorpus(skillRoot) {
	try { return JSON.parse(fs.readFileSync(path.join(skillRoot, "evals", "evals.json"), "utf8")); }
	catch { return { evals: [] }; }
}

export function parsePlaybook(source, file = "playbook.md") {
	const issues = [];
	const frontmatter = {};
	const text = String(source).replace(/\r\n/g, "\n");
	const block = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
	if (!block) issues.push("missing the --- frontmatter block");
	for (const raw of block ? block[1].split("\n") : []) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (!pair) { issues.push(`unreadable frontmatter line: ${line}`); continue; }
		const value = pair[2].replace(/\s+#.*$/, "").trim();
		frontmatter[pair[1]] = /^\[.*\]$/.test(value) ? value.slice(1, -1).split(",").map(item => item.trim()).filter(Boolean) : value;
	}
	const sections = {};
	let current = null;
	let afterTitle = false;
	let loadLine = null;
	for (const line of (block ? text.slice(block[0].length) : text).split("\n")) {
		if (/^#\s/.test(line)) { afterTitle = true; continue; }
		if (afterTitle && loadLine === null && line.trim()) { loadLine = /^##\s/.test(line) ? "" : line.trim(); afterTitle = false; }
		const heading = /^##\s+(.+?)\s*$/.exec(line);
		if (heading) { current = normalizeTitle(heading[1]); sections[current] ??= []; continue; }
		if (current && /^- \S/.test(line)) sections[current].push(line.slice(2).trim());
	}
	const lineCount = text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
	return { file, stem: path.basename(file, ".md"), frontmatter, sections, lineCount, loadLine, issues };
}

export function loadPlaybooks(skillRoot = SKILL_ROOT) {
	const dir = path.join(skillRoot, "references", "playbooks");
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir).filter(name => name.endsWith(".md")).sort()
		.map(name => parsePlaybook(fs.readFileSync(path.join(dir, name), "utf8"), path.join(dir, name)));
}

// Every pointer states when to load it: the line under each playbook's H1 (create-skill's rule).
export const playbookLoadLine = template => `Load before you draft \`${template}\`. Back to [SKILL.md](../../SKILL.md).`;

export function validatePlaybook(playbook, { skillRoot = SKILL_ROOT, corpus = loadCorpus(skillRoot), indexHtml = readIfExists(path.join(skillRoot, "index.html")) ?? "" } = {}) {
	const label = `references/playbooks/${playbook.stem}.md`;
	const issues = playbook.issues.map(issue => `${label}: ${issue}`);
	const add = message => issues.push(`${label}: ${message}`);
	const { frontmatter: meta, sections } = playbook;
	for (const key of Object.keys(meta)) {
		if (key === "content_ir") add("content_ir was withdrawn; name the content schema with schema: (R9)");
		else if (!FRONTMATTER_KEYS.includes(key)) add(`unknown frontmatter key "${key}" (allowed: ${FRONTMATTER_KEYS.join(", ")})`);
	}
	for (const key of ["template", "demo", "evals", "figure_engines"]) if (!(key in meta)) add(`frontmatter needs ${key}:`);
	const template = typeof meta.template === "string" ? meta.template : null;
	if ("template" in meta && !template) add("template must be a file name such as one-pager.html");
	if (template && !fs.existsSync(path.join(skillRoot, "assets", "templates", template))) add(`template ${template} does not exist in assets/templates/`);
	if (template && path.basename(template, ".html") !== playbook.stem) add(`template ${template} does not match the playbook file name ${playbook.stem}.md`);
	if (typeof meta.demo === "string") {
		if (!fs.existsSync(path.join(skillRoot, "assets", "demos", meta.demo))) add(`demo ${meta.demo} does not exist in assets/demos/`);
		else if (!indexHtml.includes(`href="assets/demos/${meta.demo}"`)) add(`demo ${meta.demo} is not linked from index.html`);
	} else if ("demo" in meta) add("demo must be a file name such as demo-one-pager.html");
	if ("schema" in meta) {
		const schema = String(meta.schema);
		if (!fs.existsSync(path.join(skillRoot, "references", "schemas", `${schema}.json`))) add(`schema ${schema} has no references/schemas/${schema}.json`);
		else if (template && schema !== path.basename(template, ".html")) add(`schema ${schema} must equal the template stem ${path.basename(template, ".html")}`);
	}
	if ("evals" in meta && !Array.isArray(meta.evals)) add("evals must be a list of scenario names, e.g. evals: [renewal-recommendation]");
	for (const name of Array.isArray(meta.evals) ? meta.evals : []) {
		const scenario = (corpus?.evals ?? []).find(entry => entry?.name === name);
		if (!scenario) add(`evals entry "${name}" names no scenario in evals/evals.json (use scenario names, not ids)`);
		else if (template && scenario.template !== template) add(`eval "${name}" uses ${scenario.template}, not ${template}`);
	}
	if ("figure_engines" in meta) {
		const engines = Array.isArray(meta.figure_engines) ? meta.figure_engines : [];
		if (engines.length === 0) add(`figure_engines must list at least one of: ${FIGURE_ENGINES.join(", ")}`);
		for (const engine of engines) if (!FIGURE_ENGINES.includes(engine)) add(`figure_engines entry "${engine}" is not one of: ${FIGURE_ENGINES.join(", ")}`);
	}
	if (template) {
		const expected = playbookLoadLine(template);
		if (playbook.loadLine !== expected) add(`the first line under the H1 must be "${expected}" (load condition and back-link)`);
	}
	for (const section of REQUIRED_SECTIONS) {
		const bullets = sections[normalizeTitle(section)];
		if (!bullets) add(`missing section "## ${section}"`);
		else if (bullets.length === 0) add(`section "## ${section}" needs at least one "- " bullet`);
	}
	if (playbook.lineCount > MAX_PLAYBOOK_LINES) add(`has ${playbook.lineCount} lines; the limit is ${MAX_PLAYBOOK_LINES}`);
	return issues;
}

export function collectPlaybookIssues(skillRoot = SKILL_ROOT, {
	corpus = null,
	legacyWithoutPlaybook = LEGACY_TEMPLATES_WITHOUT_PLAYBOOK,
	legacyWithoutEval = LEGACY_TEMPLATES_WITHOUT_EVAL,
} = {}) {
	const scenarios = corpus && Array.isArray(corpus.evals) ? corpus : loadCorpus(skillRoot);
	const indexHtml = readIfExists(path.join(skillRoot, "index.html")) ?? "";
	const playbooks = loadPlaybooks(skillRoot);
	const issues = playbooks.flatMap(playbook => validatePlaybook(playbook, { skillRoot, corpus: scenarios, indexHtml }));
	const templates = listTemplates(skillRoot);
	const withPlaybook = new Set(playbooks.map(playbook => `${playbook.stem}.html`));
	const withEval = new Set(scenarios.evals.map(entry => entry?.template));
	for (const template of templates) {
		if (!withPlaybook.has(template) && !legacyWithoutPlaybook.includes(template)) {
			issues.push(`assets/templates/${template} has no playbook: write references/playbooks/${template.replace(/\.html$/, ".md")} (format in references/contract.md)`);
		}
		if (!withEval.has(template) && !legacyWithoutEval.includes(template)) {
			issues.push(`assets/templates/${template} has no eval scenario: add one to evals/evals.json`);
		}
	}
	const stale = (name, entries, covered, what) => {
		for (const template of entries) {
			if (!templates.includes(template)) issues.push(`${name} lists ${template}, which no longer exists: remove it; the baseline may only shrink`);
			else if (covered.has(template)) issues.push(`${name} lists ${template}, which now has ${what}: remove it; the baseline may only shrink`);
		}
	};
	stale("LEGACY_TEMPLATES_WITHOUT_PLAYBOOK", legacyWithoutPlaybook, withPlaybook, "a playbook");
	stale("LEGACY_TEMPLATES_WITHOUT_EVAL", legacyWithoutEval, withEval, "an eval scenario");
	return issues;
}

export function collectRoutingIssues(skillRoot = SKILL_ROOT) {
	const cheatsheet = readIfExists(path.join(skillRoot, "CHEATSHEET.md"));
	const authoring = readIfExists(path.join(skillRoot, "references", "authoring-detail.md"));
	if (cheatsheet === null || authoring === null) return ["CHEATSHEET.md and references/authoring-detail.md must both exist to route templates"];
	const issues = [];
	for (const template of listTemplates(skillRoot)) {
		if (!cheatsheet.includes(`assets/templates/${template}`)) issues.push(`CHEATSHEET.md does not route assets/templates/${template}`);
		if (!new RegExp(`\\|\\s*\`?${escapeRegExp(template)}\`?\\s*\\|`).test(authoring)) issues.push(`references/authoring-detail.md has no template-map row for ${template}`);
	}
	for (const diagram of listHtml(skillRoot, "diagrams")) {
		if (!cheatsheet.includes(`assets/diagrams/${diagram}`)) issues.push(`CHEATSHEET.md does not route assets/diagrams/${diagram}`);
	}
	return issues;
}

export function playbookCatalog(skillRoot = SKILL_ROOT) {
	const corpus = loadCorpus(skillRoot);
	const playbooks = new Map(loadPlaybooks(skillRoot).map(playbook => [`${playbook.stem}.html`, playbook]));
	return listTemplates(skillRoot).map(template => {
		const stem = template.slice(0, -5);
		const playbook = playbooks.get(template) ?? null;
		const schema = playbook?.frontmatter.schema ?? (fs.existsSync(path.join(skillRoot, "references", "schemas", `${stem}.json`)) ? stem : null);
		const demo = fs.existsSync(path.join(skillRoot, "assets", "demos", `demo-${stem}.html`)) ? `demo-${stem}.html` : null;
		return {
			template,
			playbook: playbook ? `references/playbooks/${stem}.md` : null,
			schema,
			evals: corpus.evals.filter(entry => entry?.template === template).map(entry => entry.name),
			demo: typeof playbook?.frontmatter.demo === "string" ? playbook.frontmatter.demo : demo,
		};
	});
}

// Returns an exit code: 0 printed, 1 no playbook for the requested template.
export function runPlaybook(stem, args = {}, { skillRoot = SKILL_ROOT, log = console.log, error = console.error } = {}) {
	if (!stem) {
		const rows = playbookCatalog(skillRoot);
		if (args.json) { log(JSON.stringify(rows, null, 2)); return 0; }
		const table = [["template", "playbook", "schema", "evals", "demo"], ...rows.map(row => [row.template, row.playbook ? "✓" : "—", row.schema ?? "—", row.evals.join(", ") || "—", row.demo ?? "—"])];
		const widths = table[0].map((_, column) => Math.max(...table.map(row => [...row[column]].length)));
		for (const row of table) log(row.map((cell, column) => cell + " ".repeat(widths[column] - [...cell].length)).join("  ").trimEnd());
		log(`${rows.filter(row => row.playbook).length} of ${rows.length} templates have a playbook`);
		return 0;
	}
	const name = path.basename(String(stem)).replace(/\.(?:html|md)$/i, "");
	const file = path.join(skillRoot, "references", "playbooks", `${name}.md`);
	if (!fs.existsSync(file)) {
		error(`no playbook for ${name}; route via CHEATSHEET.md and references/authoring-detail.md`);
		return 1;
	}
	const source = fs.readFileSync(file, "utf8");
	if (args.json) {
		const { frontmatter, sections } = parsePlaybook(source, file);
		log(JSON.stringify({ template: `${name}.html`, playbook: `references/playbooks/${name}.md`, frontmatter, sections }, null, 2));
	} else {
		log(source.trimEnd());
	}
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	const argv = process.argv.slice(2);
	process.exitCode = runPlaybook(argv.find(arg => !arg.startsWith("--")), { json: argv.includes("--json") });
}

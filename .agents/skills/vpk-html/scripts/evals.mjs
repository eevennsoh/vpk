#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectPlaybookIssues, collectRoutingIssues, loadPlaybooks } from "./playbooks.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, "..");
const DEFAULT_CORPUS_PATH = path.join(SKILL_ROOT, "evals", "evals.json");
const CATALOG_SNAPSHOT_DOCUMENTS = ["README.md", "llms.txt"];
const CATALOG_CLAIM_DOCUMENTS = [...CATALOG_SNAPSHOT_DOCUMENTS, "references/diagrams.md"];
export const STORY_KIT = "story-kit";
const SNAPSHOT_PATTERN = /vpk-html-catalog-counts:\s*templates=(\d+)\s+diagrams=(\d+)\s+demos=(\d+)/;
const CATALOG_CLAIM_PATTERNS = {
	templates: [
		/\b(\d+)\s+(?:HTML\s+)?document templates\b/g,
		/\b(\d+)\s+offline (?:HTML\s+)?(?:document )?templates\b/g,
		/\|\s*Templates\s*\|\s*(\d+)\b/g,
	],
	diagrams: [
		/\b(\d+)\s+(?:standalone\s+)?SVG diagram\/chart primitives\b/g,
		/\|\s*Diagrams and charts\s*\|\s*(\d+)\s+SVG primitives\b/g,
		/ships\s+(\d+)\s+standalone SVG diagram and chart primitives\b/g,
	],
	demos: [
		/\b(\d+)\s+HTML demos\b/g,
		/\b(\d+)\s+demo HTML outputs\b/g,
		/assets\/demos\/\s+—\s+(\d+)\s+curated, restyled, diagram, and illustration showcases\b/g,
	],
};

function countHtmlFiles(directory) {
	if (!fs.existsSync(directory)) return 0;
	return fs.readdirSync(directory).filter(name => name.endsWith(".html")).length;
}

function isNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function requireString(issues, value, label) {
	if (!isNonEmptyString(value)) issues.push(`${label} must be a non-empty string`);
}

function requireStringArray(issues, value, label, minimumLength = 1) {
	if (!Array.isArray(value) || value.length < minimumLength || value.some(item => !isNonEmptyString(item))) {
		issues.push(`${label} must contain at least ${minimumLength} non-empty string${minimumLength === 1 ? "" : "s"}`);
	}
}

export function collectCatalogCounts(skillRoot = SKILL_ROOT) {
	return {
		demos: countHtmlFiles(path.join(skillRoot, "assets", "demos")),
		diagrams: countHtmlFiles(path.join(skillRoot, "assets", "diagrams")),
		templates: countHtmlFiles(path.join(skillRoot, "assets", "templates")),
	};
}

export function validateEvalCorpus(corpus, {
	minimumEvalCount = 7,
	skillRoot = SKILL_ROOT,
} = {}) {
	const issues = [];
	if (!corpus || typeof corpus !== "object" || Array.isArray(corpus)) {
		return ["evaluation corpus must be a JSON object"];
	}
	if (corpus.version !== 1) issues.push("evaluation corpus version must be 1");
	if (corpus.skill_name !== "vpk-html") issues.push('evaluation corpus skill_name must be "vpk-html"');
	if (!Array.isArray(corpus.evals)) return [...issues, "evaluation corpus evals must be an array"];
	if (corpus.evals.length < minimumEvalCount) {
		issues.push(`evaluation corpus must contain at least ${minimumEvalCount} scenarios`);
	}

	const ids = new Set();
	const names = new Set();
	for (const [index, entry] of corpus.evals.entries()) {
		const label = `evals[${index}]`;
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
			issues.push(`${label} must be an object`);
			continue;
		}

		if (!Number.isInteger(entry.id) || entry.id < 1) {
			issues.push(`${label}.id must be a positive integer`);
		} else if (ids.has(entry.id)) {
			issues.push(`${label} has duplicate id ${entry.id}`);
		} else {
			ids.add(entry.id);
		}

		requireString(issues, entry.name, `${label}.name`);
		if (isNonEmptyString(entry.name)) {
			if (names.has(entry.name)) issues.push(`${label} has duplicate name ${entry.name}`);
			names.add(entry.name);
		}
		requireString(issues, entry.category, `${label}.category`);
		requireString(issues, entry.template, `${label}.template`);
		if (entry.template === STORY_KIT) {
			// Story explainers copy the repo-only story kit (references/story-modes.md), not a template.
			if (entry.category !== "story-explainer") issues.push(`${label}.template "${STORY_KIT}" is only for category "story-explainer"`);
		} else if (isNonEmptyString(entry.template)) {
			if (path.basename(entry.template) !== entry.template || !entry.template.endsWith(".html")) {
				issues.push(`${label}.template must be an HTML filename under assets/templates`);
			} else if (!fs.existsSync(path.join(skillRoot, "assets", "templates", entry.template))) {
				issues.push(`${label}.template does not exist: ${entry.template}`);
			}
		}

		requireString(issues, entry.prompt, `${label}.prompt`);
		if (isNonEmptyString(entry.prompt) && !entry.prompt.includes("/vpk-html")) {
			issues.push(`${label}.prompt must explicitly invoke /vpk-html`);
		}
		requireString(issues, entry.expected_output, `${label}.expected_output`);
		if (!Array.isArray(entry.files)) issues.push(`${label}.files must be an array`);

		if (!entry.viewport || typeof entry.viewport !== "object") {
			issues.push(`${label}.viewport must define width and height`);
		} else {
			if (!Number.isInteger(entry.viewport.width) || entry.viewport.width < 320) {
				issues.push(`${label}.viewport.width must be an integer of at least 320`);
			}
			if (!Number.isInteger(entry.viewport.height) || entry.viewport.height < 320) {
				issues.push(`${label}.viewport.height must be an integer of at least 320`);
			}
		}

		if (!entry.reader_job || typeof entry.reader_job !== "object") {
			issues.push(`${label}.reader_job must define quick_read and deep_audit`);
		} else {
			requireString(issues, entry.reader_job.quick_read, `${label}.reader_job.quick_read`);
			requireString(issues, entry.reader_job.deep_audit, `${label}.reader_job.deep_audit`);
		}

		requireStringArray(issues, entry.expectations, `${label}.expectations`, 3);
		requireStringArray(issues, entry.human_rubric, `${label}.human_rubric`, 3);
	}

	return issues;
}

export function validateCatalogSnapshot(documents, counts) {
	const expected = `templates=${counts.templates} diagrams=${counts.diagrams} demos=${counts.demos}`;
	const issues = [];
	for (const [file, source] of Object.entries(documents)) {
		const match = SNAPSHOT_PATTERN.exec(source);
		if (!match) {
			issues.push(`${file}: missing vpk-html catalog snapshot; expected ${expected}`);
			continue;
		}
		const actual = `templates=${Number(match[1])} diagrams=${Number(match[2])} demos=${Number(match[3])}`;
		if (actual !== expected) issues.push(`${file}: catalog snapshot is ${actual}; expected ${expected}`);
	}
	return issues;
}

export function validateCatalogClaims(documents, counts) {
	const issues = [];
	for (const [file, source] of Object.entries(documents)) {
		for (const [kind, patterns] of Object.entries(CATALOG_CLAIM_PATTERNS)) {
			for (const pattern of patterns) {
				pattern.lastIndex = 0;
				for (const match of source.matchAll(pattern)) {
					const documented = Number(match[1]);
					if (documented !== counts[kind]) {
						issues.push(`${file}: documented ${kind.slice(0, -1)} count is ${documented}; expected ${counts[kind]}`);
					}
				}
			}
		}
	}
	return issues;
}

export function checkEvaluationSystem({
	corpusPath = DEFAULT_CORPUS_PATH,
	skillRoot = SKILL_ROOT,
} = {}) {
	const issues = [];
	let corpus = null;
	try {
		corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
	} catch (error) {
		issues.push(`${path.relative(skillRoot, corpusPath)}: ${error.message}`);
	}
	if (corpus) issues.push(...validateEvalCorpus(corpus, { skillRoot }));

	const catalogCounts = collectCatalogCounts(skillRoot);
	const documents = Object.fromEntries(CATALOG_CLAIM_DOCUMENTS.map(file => [
		file,
		fs.existsSync(path.join(skillRoot, file)) ? fs.readFileSync(path.join(skillRoot, file), "utf8") : "",
	]));
	const snapshotDocuments = Object.fromEntries(CATALOG_SNAPSHOT_DOCUMENTS.map(file => [file, documents[file]]));
	issues.push(...validateCatalogSnapshot(snapshotDocuments, catalogCounts));
	issues.push(...validateCatalogClaims(documents, catalogCounts));
	issues.push(...collectRoutingIssues(skillRoot));
	issues.push(...collectPlaybookIssues(skillRoot, { corpus }));

	return {
		catalogCounts,
		evalCount: corpus?.evals?.length ?? 0,
		issues,
		ok: issues.length === 0,
		playbookCount: loadPlaybooks(skillRoot).length,
	};
}

function main() {
	const args = process.argv.slice(2);
	if (args.length > 1 || (args[0] && args[0] !== "--check")) {
		console.error("Usage: node scripts/evals.mjs [--check]");
		process.exitCode = 1;
		return;
	}
	const result = checkEvaluationSystem();
	if (!result.ok) {
		console.error(`✗ vpk-html evaluation system: ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}`);
		for (const issue of result.issues) console.error(`  ${issue}`);
		process.exitCode = 1;
		return;
	}
	const { demos, diagrams, templates } = result.catalogCounts;
	console.log(`✓ vpk-html evaluation system: ${result.evalCount} scenarios; ${templates} templates, ${diagrams} diagrams, ${demos} demos`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

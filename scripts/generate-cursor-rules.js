#!/usr/bin/env node

"use strict";

// Cursor ignores plain .md rules, so each canonical .agents/rules/*.md gets a generated
// .mdc mirror whose globs come from the rule's `paths:` frontmatter.

const { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const RULES_DIR = path.join(__dirname, "..", ".agents", "rules");
const CURSOR_DIR = path.join(RULES_DIR, "cursor");

function parseRule(source, fileName) {
	const match = source.match(/^---\n([\s\S]*?)\n---\n/u);
	if (!match) throw new Error(`${fileName}: missing frontmatter`);
	const description = match[1].match(/^description:\s*(.+)$/mu)?.[1].trim();
	if (!description) throw new Error(`${fileName}: missing description`);
	const pathsBlock = match[1].match(/^paths:\n((?:\s+- .+\n?)+)/mu)?.[1];
	const globs = pathsBlock ? [...pathsBlock.matchAll(/- "([^"]+)"/gu)].map((entry) => entry[1]) : [];
	return { body: source.slice(match[0].length).replace(/^\n+/u, ""), description, globs };
}

function renderCursorRule(source, fileName) {
	const { body, description, globs } = parseRule(source, fileName);
	const frontmatter = globs.length > 0
		? [`description: ${description}`, `globs: ${globs.join(", ")}`, "alwaysApply: false"]
		: [`description: ${description}`, "alwaysApply: true"];
	return [
		"---",
		...frontmatter,
		"---",
		"",
		`<!-- Generated from .agents/rules/${fileName} by scripts/generate-cursor-rules.js. Edit the .md source, then rerun the script. -->`,
		"",
		body,
	].join("\n");
}

function expectedCursorRules(rulesDir = RULES_DIR) {
	const expected = new Map();
	for (const fileName of readdirSync(rulesDir).filter((name) => name.endsWith(".md")).sort()) {
		const source = readFileSync(path.join(rulesDir, fileName), "utf8");
		expected.set(fileName.replace(/\.md$/u, ".mdc"), renderCursorRule(source, fileName));
	}
	return expected;
}

function syncCursorRules({ cursorDir = CURSOR_DIR, rulesDir = RULES_DIR, write = true } = {}) {
	const expected = expectedCursorRules(rulesDir);
	const existing = existsSync(cursorDir) ? readdirSync(cursorDir).filter((name) => name.endsWith(".mdc")) : [];
	const drift = [];
	for (const [fileName, content] of expected) {
		const target = path.join(cursorDir, fileName);
		if (!existsSync(target) || readFileSync(target, "utf8") !== content) drift.push(fileName);
	}
	const stale = existing.filter((fileName) => !expected.has(fileName));
	if (write) {
		mkdirSync(cursorDir, { recursive: true });
		for (const fileName of drift) writeFileSync(path.join(cursorDir, fileName), expected.get(fileName));
		for (const fileName of stale) rmSync(path.join(cursorDir, fileName));
	}
	return { drift, stale };
}

function main() {
	const check = process.argv.includes("--check");
	const { drift, stale } = syncCursorRules({ write: !check });
	const relative = path.relative(process.cwd(), CURSOR_DIR);
	if (check && (drift.length > 0 || stale.length > 0)) {
		console.error(`${relative} is out of date (${[...drift, ...stale.map((name) => `${name} (stale)`)].join(", ")}). Run: node scripts/generate-cursor-rules.js`);
		process.exitCode = 1;
		return;
	}
	console.log(check ? `${relative} mirrors every .agents/rules/*.md.` : `Wrote ${drift.length} and removed ${stale.length} Cursor rule mirror(s) in ${relative}.`);
}

if (require.main === module) {
	main();
}

module.exports = {
	renderCursorRule,
	syncCursorRules,
};

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const RULES_DIR = path.join(ROOT, ".agents", "rules");
const AGENTS_MD = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");

function readFrontmatterPaths(source) {
	const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/u)?.[1] ?? "";
	const block = frontmatter.match(/^paths:\n((?:\s+- .+\n?)+)/mu)?.[1];
	return block ? [...block.matchAll(/- "([^"]+)"/gu)].map((match) => match[1]) : null;
}

function readScopeTable(markdown) {
	const section = markdown.slice(markdown.indexOf("## Contextual Rules"));
	const rows = new Map();
	for (const match of section.matchAll(/^\| `([^`]+\.mdc?)` \| (.+) \|$/gmu)) {
		const scope = match[2] === "`*` (always)" ? null : [...match[2].matchAll(/`([^`]+)`/gu)].map((glob) => glob[1]);
		rows.set(match[1], scope);
	}
	return rows;
}

test("AGENTS.md lists every rule with exactly its paths: frontmatter", () => {
	const table = readScopeTable(AGENTS_MD);
	const ruleFiles = fs.readdirSync(RULES_DIR).filter((file) => file.endsWith(".md")).sort();
	assert.deepEqual([...table.keys()].filter((file) => file.endsWith(".md")).sort(), ruleFiles);

	for (const file of ruleFiles) {
		const paths = readFrontmatterPaths(fs.readFileSync(path.join(RULES_DIR, file), "utf8"));
		assert.deepEqual(table.get(file), paths, `${file}: AGENTS.md scope row must equal its paths: frontmatter`);
	}
});

test("only token-priority.md loads in every Claude Code session", () => {
	const alwaysLoaded = fs.readdirSync(RULES_DIR)
		.filter((file) => file.endsWith(".md"))
		.filter((file) => readFrontmatterPaths(fs.readFileSync(path.join(RULES_DIR, file), "utf8")) === null);
	assert.deepEqual(alwaysLoaded, ["token-priority.md"], "scope new rules with paths: frontmatter");
});

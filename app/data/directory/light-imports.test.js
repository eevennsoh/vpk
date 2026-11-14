// Modules that need only people, agents or the skill-name helper must not reach the large
// directory catalogs (agent-templates, skills, tools, knowledge: about 360 KB of JSON) through
// static imports; through the barrel they pulled all of it into first load (C-8g item 3).
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { findStaticDependencyPaths } = require(path.join(process.cwd(), "scripts/verify-lazy-load-boundaries.js"));

const CATALOG_LOADERS = ["agent-templates", "knowledge", "skills", "tools"].map((name) => `app/data/directory/${name}.ts`);
const LIGHT_MODULES = [
	"app/data/directory/agents.ts",
	"app/data/directory/people.ts",
	"app/data/directory/skill-frontmatter.ts",
	"components/blocks/agent/lib/agent-config-model.ts",
	"components/blocks/jira-work-item/data/metadata-people.ts",
];

for (const entryFile of LIGHT_MODULES) {
	test(`${entryFile} reaches no directory catalog`, () => {
		const reached = findStaticDependencyPaths({ cwd: process.cwd(), entryFile, targetFiles: CATALOG_LOADERS });
		assert.deepEqual([...reached.values()].map((chain) => chain.join(" -> ")), []);
	});
}

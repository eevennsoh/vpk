const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const ROOT = join(__dirname, "..", "..", "..");

function readProjectFile(...segments) {
	return readFileSync(join(ROOT, ...segments), "utf8");
}

const COMPONENTS_SOURCE = readProjectFile("app/data/components.ts");
const MANIFEST_SOURCE = readProjectFile("app/data/component-manifest.ts");
const DETAILS_SOURCE = readDetailCategorySource("ui-custom");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const DEMO_SOURCE = readProjectFile("components/website/demos/ui-custom/entity-card-demo.tsx");
const COMPONENT_PAGE_SOURCE = readProjectFile("app/components/[category]/[slug]/page.tsx");
const PREVIEW_PAGE_SOURCE = readProjectFile("app/preview/ui-custom/[slug]/page.tsx");

test("Entity Card is the visible ui-custom catalog entry", () => {
	assert.match(COMPONENTS_SOURCE, /customComponent\("entity-card", "Entity Card"\)/u);
	assert.match(MANIFEST_SOURCE, /customComponent\("entity-card", "Entity Card"\)/u);
	assert.doesNotMatch(COMPONENTS_SOURCE, /customComponent\("skill-card", "Skill Card"\)/u);
	assert.doesNotMatch(MANIFEST_SOURCE, /customComponent\("skill-card", "Skill Card"\)/u);
});

test("Entity Card docs and demo use entity-card directory cards instead of the SkillCard shim", () => {
	assert.match(DETAILS_SOURCE, /"entity-card": \{/u);
	assert.match(DETAILS_SOURCE, /from "@\/components\/ui-custom\/entity-card"/u);
	assert.match(DETAILS_SOURCE, /<EntityCardSkillCard/u);
	assert.doesNotMatch(DETAILS_SOURCE, /from "@\/components\/ui-custom\/skill-card"/u);
	assert.match(DEMO_SOURCE, /EntityCardSkillCard/u);
	assert.match(DEMO_SOURCE, /EntityCardAppCard/u);
	assert.match(DEMO_SOURCE, /EntityCardToolCard/u);
	assert.match(DEMO_SOURCE, /EntityCardAgentCard/u);
	assert.match(DEMO_SOURCE, /EntityCardKnowledgeCard/u);
	assert.doesNotMatch(DEMO_SOURCE, /\bSkillCard\b/u);
	for (const demoSlug of [
		"entity-card-demo-skills",
		"entity-card-demo-apps",
		"entity-card-demo-tools",
		"entity-card-demo-agents",
		"entity-card-demo-knowledge",
	]) {
		assert.match(DETAILS_SOURCE, new RegExp(demoSlug, "u"));
		assert.match(REGISTRY_SOURCE, new RegExp(`"${demoSlug}"`, "u"));
	}
});

test("legacy skill-card docs and preview URLs redirect to Entity Card", () => {
	assert.match(COMPONENT_PAGE_SOURCE, /slug === "skill-card"[\s\S]*redirect\("\/components\/ui-custom\/entity-card"\)/u);
	assert.match(PREVIEW_PAGE_SOURCE, /slug === "skill-card"[\s\S]*redirect\("\/preview\/ui-custom\/entity-card"\)/u);
	assert.match(REGISTRY_SOURCE, /"entity-card": dynamic\(\(\) => import\("\.\/demos\/ui-custom\/entity-card-demo"\)/u);
	assert.doesNotMatch(REGISTRY_SOURCE, /"skill-card": dynamic/u);
	assert.doesNotMatch(REGISTRY_SOURCE, /"skill-card-demo-/u);
});

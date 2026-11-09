const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const COMPONENT_SOURCE = fs.readFileSync(path.join(__dirname, "components/skill-selector.tsx"), "utf8");
const PAGE_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/website/demos/blocks/skill-selector-demo.tsx"), "utf8");
const DETAILS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app/data/details/blocks/skill-selector.ts"), "utf8");
const REGISTRY_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/website/registry/blocks.ts"), "utf8");
const VARIANT_REGISTRY_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/website/registry/blocks-variants.ts"), "utf8");

test("SkillSelector reuses AgentSelector design with Skill Directory data", () => {
	assert.match(COMPONENT_SOURCE, /DEFAULT_SKILLS/u);
	assert.match(COMPONENT_SOURCE, /skills = DEFAULT_SKILLS/u);
	assert.match(COMPONENT_SOURCE, /<AgentSelector/u);
	assert.match(COMPONENT_SOURCE, /getSkillDirectoryVisual/u);
	assert.match(COMPONENT_SOURCE, /<RichTextMentionVisualMark category="skill"[\s\S]*size="menu-compact"/u);
	assert.match(COMPONENT_SOURCE, /\theading,\n/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /heading = "Select a skill"/u);
	assert.match(COMPONENT_SOURCE, /searchPlaceholder = "Search skills"/u);
	assert.match(COMPONENT_SOURCE, /browseAgentsLabel=\{browseSkillsLabel\}/u);
	assert.match(COMPONENT_SOURCE, /createAgentLabel=\{createSkillLabel\}/u);
	assert.match(COMPONENT_SOURCE, /moreItemsLabel="More skills"/u);
	assert.match(COMPONENT_SOURCE, /onPinnedAgentIdsChange=\{onPinnedSkillIdsChange\}/u);
	assert.match(COMPONENT_SOURCE, /pinnedAgentIds=\{pinnedSkillIds\}/u);
	assert.match(COMPONENT_SOURCE, /pinnedItemsLabel=\{pinnedItemsLabel\}/u);
	assert.match(COMPONENT_SOURCE, /const CREATE_SKILL_DIRECTORY_ID = "create-skill";/u);
	assert.match(COMPONENT_SOURCE, /\.filter\(\(skill\) => !hasCreateSkillFooter \|\| skill\.id !== CREATE_SKILL_DIRECTORY_ID\)/u);
});

test("SkillSelector is cataloged with dropdown and standalone demos", () => {
	assert.match(PAGE_SOURCE, /presentation\?: "dropdown" \| "standalone";/u);
	assert.match(PAGE_SOURCE, /data-skill-selector-demo="standalone"/u);
	assert.match(DEMO_SOURCE, /export function SkillSelectorDemoStandalone/u);
	assert.match(DETAILS_SOURCE, /demoSlug: "skill-selector-demo-standalone"/u);
	assert.match(REGISTRY_SOURCE, /"skill-selector"[\s\S]*skill-selector-demo/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"skill-selector-demo-standalone"[\s\S]*SkillSelectorDemoStandalone/u);
});

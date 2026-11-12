const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const SKILL_CONFIG_SOURCE = readProjectFile("components/blocks/skill-config/components/skill-config.tsx");
const FRONTMATTER_NODE_VIEW_SOURCE = readProjectFile("components/ui-custom/rich-text-editor/frontmatter-node-view.tsx");
const AGENT_CONFIG_CORE_INDEX_SOURCE = readProjectFile("components/blocks/agent-config-core/index.ts");
const AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE = readProjectFile("components/blocks/agent-config-core/components/agent-compact-header-nav.tsx");
const AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE = readProjectFile("components/blocks/agent-config-core/components/agent-compact-header-nav-data.tsx");

test("Skill Config reads compact header navigation from the canonical agent config owner", () => {
	assert.match(
		SKILL_CONFIG_SOURCE,
		/from "@\/components\/blocks\/agent-config-core";/u,
	);
	assert.doesNotMatch(SKILL_CONFIG_SOURCE, /skill-config\/components\/agent-compact-header-nav/u);
	assert.doesNotMatch(SKILL_CONFIG_SOURCE, /const AGENT_COMPACT_HEADER_NAV_ITEMS/u);
	assert.doesNotMatch(SKILL_CONFIG_SOURCE, /function AgentCompactHeaderNavButton/u);
	assert.doesNotMatch(SKILL_CONFIG_SOURCE, /export function AgentCompactHeaderNav/u);
	assert.match(
		AGENT_CONFIG_CORE_INDEX_SOURCE,
		/from "@\/components\/blocks\/agent-config-core\/components\/agent-compact-header-nav";/u,
	);
	assert.match(
		AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE,
		/const AGENT_COMPACT_HEADER_NAV_ITEMS = \[[\s\S]*<LayoutDashboardIcon size="small" \/>[\s\S]*label: "Details"[\s\S]*label: "Insights"/u,
	);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE, /export type AgentCompactHeaderSection/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /export interface AgentCompactHeaderNavProps/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE, /export const AGENT_COMPACT_HEADER_DEFAULT_NAV_ITEMS/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE, /export const AGENT_COMPACT_HEADER_DETAILS_NAV_ITEM/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /function AgentCompactHeaderNavButton/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /export function AgentCompactHeaderNav/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /computeContextBarOverflow/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /aria-label="More agent sections"/u);
	assert.doesNotMatch(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /DEFAULT_COLLAPSED_SECTIONS/u);
});

test("Skill Config toolbar visibility is an explicit apps-only model", () => {
	assert.match(
		SKILL_CONFIG_SOURCE,
		/const SKILL_CONFIG_VISIBLE_TOOLBAR_FIELD_NAMES: ReadonlySet<AgentConfigToolbarFieldName> =\s+new Set<AgentConfigToolbarFieldName>\(\["apps"\]\);/u,
	);
	assert.match(
		SKILL_CONFIG_SOURCE,
		/visibleFieldNames=\{SKILL_CONFIG_VISIBLE_TOOLBAR_FIELD_NAMES\}/u,
	);
	assert.doesNotMatch(
		SKILL_CONFIG_SOURCE,
		/visibleFieldNames=\{new Set/u,
	);
	assert.doesNotMatch(
		SKILL_CONFIG_SOURCE,
		/filter\(\(row\) => row\.key === "apps"/u,
	);
});

test("Skill Config frontmatter renders allowed tools as non-pill tags", () => {
	assert.match(FRONTMATTER_NODE_VIEW_SOURCE, /<Tag[\s\S]*type="default"/u);
	assert.doesNotMatch(FRONTMATTER_NODE_VIEW_SOURCE, /getRichTextMentionTagType/u);
});

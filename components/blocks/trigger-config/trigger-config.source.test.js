const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const TRIGGER_CONFIG_SOURCE = readProjectFile("components/blocks/trigger-config/components/trigger-config.tsx");
const AGENT_CONFIG_CORE_INDEX_SOURCE = readProjectFile("components/blocks/agent-config-core/index.ts");
const AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE = readProjectFile("components/blocks/agent-config-core/components/agent-compact-header-nav.tsx");
const AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE = readProjectFile("components/blocks/agent-config-core/components/agent-compact-header-nav-data.tsx");

test("Trigger Config reads compact header navigation from the canonical agent config owner", () => {
	assert.match(
		TRIGGER_CONFIG_SOURCE,
		/from "@\/components\/blocks\/agent-config-core";/u,
	);
	assert.doesNotMatch(TRIGGER_CONFIG_SOURCE, /trigger-config\/components\/agent-compact-header-nav/u);
	assert.doesNotMatch(TRIGGER_CONFIG_SOURCE, /const AGENT_COMPACT_HEADER_NAV_ITEMS/u);
	assert.doesNotMatch(TRIGGER_CONFIG_SOURCE, /function AgentCompactHeaderNavButton/u);
	assert.doesNotMatch(TRIGGER_CONFIG_SOURCE, /export function AgentCompactHeaderNav/u);
	assert.match(
		AGENT_CONFIG_CORE_INDEX_SOURCE,
		/from "@\/components\/blocks\/agent-config-core\/components\/agent-compact-header-nav";/u,
	);
	assert.match(
		AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE,
		/const AGENT_COMPACT_HEADER_NAV_ITEMS = \[[\s\S]*<LayoutDashboardIcon size="small" \/>[\s\S]*label: "Details"[\s\S]*label: "Insights"/u,
	);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE, /export type AgentCompactHeaderSection/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE, /export const AGENT_COMPACT_HEADER_DEFAULT_NAV_ITEMS/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_DATA_SOURCE, /export const AGENT_COMPACT_HEADER_DETAILS_NAV_ITEM/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /function AgentCompactHeaderNavButton/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /export function AgentCompactHeaderNav/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /computeContextBarOverflow/u);
	assert.match(AGENT_CONFIG_CORE_COMPACT_HEADER_NAV_SOURCE, /aria-label="More agent sections"/u);
});

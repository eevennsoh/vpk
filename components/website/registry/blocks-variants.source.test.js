const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const REGISTRY_SOURCE = readFileSync(join(__dirname, "blocks-variants.ts"), "utf8");
const AGENT_CARD_DEMO_SOURCE = readFileSync(join(__dirname, "..", "demos", "blocks", "agent-card-demo.tsx"), "utf8");
const AGENT_CARD_DETAIL_SOURCE = readFileSync(join(__dirname, "..", "..", "..", "app", "data", "details", "blocks", "agent-card.ts"), "utf8");

test("agent-card catalog retains the named experimental template demo without its retired alias", () => {
	assert.match(REGISTRY_SOURCE, /"agent-card-demo-experimental-template"/u);
	assert.doesNotMatch(REGISTRY_SOURCE, /"agent-card-demo-experimental"\s*:/u);
	assert.match(AGENT_CARD_DEMO_SOURCE, /export function AgentCardDemoExperimentalTemplate\(\)/u);
	assert.doesNotMatch(AGENT_CARD_DEMO_SOURCE, /export function AgentCardDemoExperimental\(\)/u);
	assert.doesNotMatch(AGENT_CARD_DETAIL_SOURCE, /"agent-card-demo-experimental"/u);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const SCREEN = "components/blocks/agent-insight/components/agent-insight.tsx";
const INDEX = "components/blocks/agent-insight/index.ts";
const RETIRED_STUDIO_FORWARDER = "components/projects/studio/components/agent-insight-panel.tsx";

test("Agent Insight is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/blockComponent\("agent-insight", "Agent Insight"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("agent-insight", "Agent Insight"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ AgentInsight \} from "@\/components\/blocks\/agent-insight";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"agent-insight": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/agent-insight-demo"\)/u,
	);
});

test("Agent Insight keeps the harvested performance sections", () => {
	const source = readProjectFile(SCREEN);
	assert.match(source, /export function AgentInsight/u);
	assert.match(source, /Review your agent&apos;s performance and gather insights\./u);
	assert.match(source, /Total conversations/u);
	assert.match(source, /Active users/u);
	assert.match(source, /Successful answer rate/u);
	assert.match(source, /Escalation rate/u);
	assert.match(source, /Feedback score/u);
	assert.match(source, /Adoption trend/u);
	assert.match(source, /Answer quality/u);
	assert.match(source, /Conversation outcomes/u);
	assert.match(source, /Top topics/u);
	assert.match(source, /Feedback mix/u);
	assert.match(source, /Recommended improvements/u);
	assert.match(source, /Next review focus/u);
	assert.match(source, /<ChartContainer/u);
	assert.doesNotMatch(source, /bg-\[var\(--ds-/u);
	assert.doesNotMatch(source, /text-\[var\(--ds-/u);
});

test("Agent Insight index re-exports the public API", () => {
	const index = readProjectFile(INDEX);
	assert.match(index, /export \{ AgentInsight \}/u);
	assert.match(index, /AgentInsightProps/u);
});

test("Agent Insight has no retired Studio forwarding module", () => {
	assert.equal(fs.existsSync(path.join(process.cwd(), RETIRED_STUDIO_FORWARDER)), false);
});

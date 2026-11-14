const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const SCREEN = "components/blocks/agent-surface/components/agent-surface.tsx";
const INDEX = "components/blocks/agent-surface/index.ts";
const AGENT_FRAME = "components/blocks/agent/components/agent-frame.tsx";

test("Agent Surface is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("agent-surface", "Agent Surface"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("agent-surface", "Agent Surface"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ AgentSurface \} from "@\/components\/blocks\/agent-surface";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"agent-surface": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/agent-surface-demo"\)/u,
	);
});

test("Agent Surface keeps default and extended surface rows", () => {
	const source = readProjectFile(SCREEN);
	assert.match(source, /export function AgentSurface/u);
	assert.match(source, /Choose where this agent appears across Atlassian apps and connected channels\./u);
	assert.match(source, /Default surfaces/u);
	assert.match(source, /Extended surfaces/u);
	assert.match(source, /Rovo Chat/u);
	assert.match(source, /Editor/u);
	assert.match(source, /Automation/u);
	assert.match(source, /Work items/u);
	assert.match(source, /Rovo browser extension/u);
	assert.match(source, /Slack/u);
	assert.match(source, /Customer portal/u);
	assert.match(source, /Help center/u);
	assert.match(source, /Managed elsewhere/u);
});

test("Agent block exposes Agent Surface through its compact section wrapper", () => {
	const source = readProjectFile(AGENT_FRAME);
	assert.match(source, /import \{ AgentSurface \} from "@\/components\/blocks\/agent-surface";/u);
	assert.match(source, /export type AgentCompactSurfacesPanelProps = ComponentProps<typeof AgentSurface>;/u);
	assert.match(source, /return <AgentSurface \{\.\.\.props\} \/>;/u);
});

test("Agent Surface index re-exports the public API", () => {
	const index = readProjectFile(INDEX);
	assert.match(index, /export \{ AgentSurface \}/u);
	assert.match(index, /AgentSurfaceProps/u);
	assert.match(index, /AgentDefaultSurface/u);
	assert.match(index, /AgentExtendedSurface/u);
	assert.match(index, /AgentSurfaceStatus/u);
	assert.match(index, /AGENT_DEFAULT_SURFACES/u);
	assert.match(index, /AGENT_EXTENDED_SURFACES/u);
});

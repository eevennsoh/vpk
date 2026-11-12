const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const AGENT_INDEX_SOURCE = readProjectFile("components/blocks/agent/index.ts");
const AGENT_PAGE_SOURCE = readProjectFile("components/blocks/agent/page.tsx");
const AGENT_PREVIEW_PAGE_SOURCE = readProjectFile("app/preview/blocks/agent/page.tsx");
const AGENT_2_PREVIEW_PAGE_SOURCE = readProjectFile("app/preview/blocks/agent-2/page.tsx");
const AGENT_DEMO_SOURCE = readProjectFile("components/website/demos/blocks/agent-demo.tsx");
const AGENT_DETAIL_SOURCE = readProjectFile("app/data/details/blocks/agent.ts");
const AGENT_DETAIL_HELPER_SOURCE = readProjectFile("app/data/details/blocks/agent-detail.ts");
const BLOCK_DETAILS_SOURCE = readDetailCategorySource("blocks");
const COMPONENTS_SOURCE = readProjectFile("app/data/components.ts");
const COMPONENT_MANIFEST_SOURCE = readProjectFile("app/data/component-manifest.ts");
const WEBSITE_REGISTRY_SOURCE = readWebsiteRegistrySource();

test("Agent index re-exports the canonical implementation", () => {
	assert.equal(AGENT_INDEX_SOURCE.trim(), 'export * from "./components/agent";');
	assert.match(AGENT_DETAIL_SOURCE, /createAgentDetail\(\{\s*demoSlugPrefix: "agent",\s*importPath: "@\/components\/blocks\/agent",\s*\}\)/u);
});

test("Agent page and preview routes keep the compatibility layer", () => {
	assert.match(AGENT_PAGE_SOURCE, /import AgentDemo from "@\/components\/website\/demos\/blocks\/agent-demo";/u);
	assert.match(AGENT_PAGE_SOURCE, /export default function AgentPage\(\): React\.ReactElement \{\s*return <AgentDemo \/>;\s*\}/u);
	assert.match(AGENT_PREVIEW_PAGE_SOURCE, /import AgentPage from "@\/components\/blocks\/agent\/page";/u);
	assert.match(AGENT_PREVIEW_PAGE_SOURCE, /return <AgentPage \/>;/u);
	assert.match(AGENT_2_PREVIEW_PAGE_SOURCE, /import \{ redirect \} from "next\/navigation";/u);
	assert.match(AGENT_2_PREVIEW_PAGE_SOURCE, /redirect\("\/preview\/blocks\/agent"\);/u);
});

test("Agent remains registered as a block demo through the canonical owner", () => {
	assert.match(COMPONENTS_SOURCE, /blockComponent\("agent"\)/u);
	assert.match(COMPONENT_MANIFEST_SOURCE, /blockComponent\("agent"\)/u);
	assert.match(
		WEBSITE_REGISTRY_SOURCE,
		/const BLOCK_DEMOS: Record<string, ComponentType> = \{[\s\S]*agent: dynamic\(\(\) => import\("\.\/demos\/blocks\/agent-demo"\), \{ ssr: false \}\)/u,
	);
	assert.match(BLOCK_DETAILS_SOURCE, /agent: AGENT_DETAIL/u);
	assert.match(AGENT_DETAIL_HELPER_SOURCE, /demoSlug: `\$\{demoSlugPrefix\}-demo-full`/u);
	assert.match(AGENT_DETAIL_HELPER_SOURCE, /demoSlug: `\$\{demoSlugPrefix\}-demo-empty`/u);
});

test("Agent demo consumes the legacy facade and exposes configured variants", () => {
	assert.match(AGENT_DEMO_SOURCE, /from "@\/components\/blocks\/agent";/u);
	assert.match(AGENT_DEMO_SOURCE, /export default function AgentDemo\(\) \{[\s\S]*return <AgentDemoFull \/>;/u);
	assert.match(AGENT_DEMO_SOURCE, /export function AgentDemoFull\(\)/u);
	assert.match(AGENT_DEMO_SOURCE, /export function AgentDemoEmpty\(\)/u);
	assert.match(AGENT_DEMO_SOURCE, /activeSection === "surfaces"[\s\S]*<AgentCompactSurfacesPanel \/>/u);
});

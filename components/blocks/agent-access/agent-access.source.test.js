const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const SCREEN = "components/blocks/agent-access/components/agent-access.tsx";
const DATA = "components/blocks/agent-access/data/access.ts";
const INDEX = "components/blocks/agent-access/index.ts";

test("Agent Access is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/blockComponent\("agent-access", "Agent Access"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("agent-access", "Agent Access"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/importStatement: `import \{ AgentAccess \} from "@\/components\/blocks\/agent-access";`/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"agent-access": dynamic\(\(\) => import\("\.\/demos\/blocks\/agent-access-demo"\)/u,
	);
});

test("Agent Access defaults to requesting-user permissions", () => {
	const screen = readProjectFile(SCREEN);
	const data = readProjectFile(DATA);

	assert.match(screen, /defaultValue = "requesting-user"/u);
	assert.match(data, /value: "requesting-user"/u);
	assert.match(data, /The agent acts on behalf of the user who triggered it\./u);
	assert.match(data, /only access what the requesting user has access to/u);
	assert.match(data, /ask for permission before using tools in Rovo Chat/u);
});

test("Agent Access confirms before switching to the broader agent account mode", () => {
	const screen = readProjectFile(SCREEN);
	const data = readProjectFile(DATA);

	assert.match(data, /value: "agent-account"/u);
	assert.match(data, /own app access and permissions/u);
	assert.match(screen, /if \(mode === "agent-account" && selected !== "agent-account"\) \{[\s\S]*setWarningOpen\(true\);[\s\S]*return;[\s\S]*\}[\s\S]*commit\(mode\);/u);
	assert.match(screen, /const confirmAgentAccount = useCallback\(\(\) => \{[\s\S]*setWarningOpen\(false\);[\s\S]*commit\("agent-account"\);/u);
	assert.match(screen, /<AlertDialogTitle>This agent is available to all users<\/AlertDialogTitle>/u);
	assert.match(screen, /<AlertDialogAction variant="warning" onClick=\{confirmAgentAccount\}>/u);
});

test("Agent Access shows app access summaries only for agent-account mode", () => {
	const screen = readProjectFile(SCREEN);
	const data = readProjectFile(DATA);

	assert.match(screen, /const showAppAccess = selected === "agent-account";/u);
	assert.match(screen, /\{showAppAccess \? \(/u);
	assert.match(screen, /Atlassian app access/u);
	assert.match(screen, /Connected app access/u);
	assert.match(screen, /onGoToAgentDetails/u);
	assert.match(screen, /Your agent doesn&apos;t use any connected apps/u);
	assert.match(data, /DEFAULT_ATLASSIAN_APP_ACCESS/u);
	assert.match(data, /id: "confluence", name: "Confluence", icon: ConfluenceIcon, access: "granted"/u);
	assert.match(data, /id: "jsm"[\s\S]*access: "denied"/u);
});

test("Agent Access index re-exports the public API", () => {
	const index = readProjectFile(INDEX);

	assert.match(index, /export \{ AgentAccess \}/u);
	assert.match(index, /AgentAccessProps/u);
	assert.match(index, /AgentAccessMode/u);
	assert.match(index, /AgentAccessOption/u);
	assert.match(index, /AtlassianAppAccess/u);
	assert.match(index, /ConnectedApp/u);
	assert.match(index, /AGENT_ACCESS_OPTIONS/u);
	assert.match(index, /DEFAULT_ATLASSIAN_APP_ACCESS/u);
	assert.match(index, /SAMPLE_ATLASSIAN_APP_ACCESS/u);
});

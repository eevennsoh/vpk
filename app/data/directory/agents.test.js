const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { loadDirectoryModule } = require(path.join(__dirname, "__tests__", "load-directory-module.js"));

const DIR = __dirname;

const AGENTS_SOURCE = fs.readFileSync(path.join(DIR, "agents.ts"), "utf8");
const AGENTS_JSON = JSON.parse(fs.readFileSync(path.join(DIR, "agents.json"), "utf8"));
const SUBAGENTS_JSON = JSON.parse(fs.readFileSync(path.join(DIR, "subagents.json"), "utf8"));
const LEGACY_SNAPSHOT = JSON.parse(
	fs.readFileSync(path.join(DIR, "__snapshots__", "agent-profiles.legacy.json"), "utf8"),
);
const DEMO_AGENTS_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent-selector/data/demo-agents.ts"),
	"utf8",
);
const AGENT_SELECTOR_PAGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/agent-selector/page.tsx"),
	"utf8",
);

// The two agents the Studio superset originally added on top of the rovo fork.
// They are the floor — the catalog may now add more OOTB agents beyond them.
const ADDED_AGENT_IDS = ["release-notes-drafter", "atlassian"];

let agentsModulePromise;
function loadAgents() {
	agentsModulePromise ??= loadDirectoryModule('export * from "@/app/data/directory/agents";');
	return agentsModulePromise;
}

/** Projects an object down to a snapshot entry's own keys for byte-for-byte parity. */
function projectToShape(value, shape) {
	const projected = {};
	for (const key of Object.keys(shape)) {
		projected[key] = value[key];
	}
	return projected;
}

/** Strips the live `icon` component from starters so they compare against JSON. */
function serializeStarters(starters) {
	return (starters ?? []).map(({ id, label, prompt, type }) => ({ id, label, prompt, type }));
}

function serializeProfile(profile, shape) {
	const projected = projectToShape(profile, shape);
	if ("starters" in shape) {
		projected.starters = serializeStarters(profile.starters);
	}
	return projected;
}

test("unified catalog includes the Studio superset floor (>=21 agents incl. release-notes-drafter and atlassian)", () => {
	// Floor, not a freeze: the catalog grows as OOTB agents are added.
	assert.ok(AGENTS_JSON.length >= 21, `expected >=21 agents, got ${AGENTS_JSON.length}`);

	const ids = new Set(AGENTS_JSON.map((agent) => agent.id));
	for (const id of ADDED_AGENT_IDS) {
		assert.ok(ids.has(id), `unified catalog must include ${id}`);
	}
	// Rovo Dev remains the built-in default.
	assert.ok(ids.has("rovo-dev"));
	// Ids stay unique as the catalog grows.
	assert.equal(ids.size, AGENTS_JSON.length, "agent ids must be unique");
});

test("Rovo Dev stays available as the fallback profile but is not a selector example", () => {
	// Catalog + derivations come from agents.json via the loader's map.
	assert.match(AGENTS_SOURCE, /ROVO_AGENT_PROFILES: readonly RovoAgentProfile\[\] =\s*UNIFIED_AGENTS\.map\(toAgentProfile\)/u);
	assert.match(
		AGENTS_SOURCE,
		/ROVO_AGENT_SELECTOR_AGENTS[\s\S]*\.filter\(\(agent\) => agent\.id !== ROVO_AGENT_ID\)[\s\S]*\.map/u,
	);
	assert.match(
		AGENTS_SOURCE,
		/ROVO_CUSTOM_AGENT_SELECTOR_AGENTS: readonly AgentSelectorAgent\[\] = ROVO_AGENT_SELECTOR_AGENTS;/u,
	);

	// The selector excludes Rovo Dev; exactly one rovo-dev exists, all others remain.
	assert.equal(
		AGENTS_JSON.filter((agent) => agent.id !== "rovo-dev").length,
		AGENTS_JSON.length - 1,
		"exactly one rovo-dev entry; every other agent is selector-eligible",
	);

	assert.doesNotMatch(DEMO_AGENTS_SOURCE, /ROVO_AGENT_ID/u);
	assert.doesNotMatch(DEMO_AGENTS_SOURCE, /rovo-dev/u);
	assert.match(AGENT_SELECTOR_PAGE_SOURCE, /variant === "selected-agent-actions"\s*\?\s*\["ai-insights-agent"\]/u);
	assert.match(AGENT_SELECTOR_PAGE_SOURCE, /variant === "jira"\s*\?\s*\[[\s\S]*"github-copilot"[\s\S]*"readiness-checker"[\s\S]*\]\s*:\s*\["github-copilot"\]/u);
	assert.doesNotMatch(AGENT_SELECTOR_PAGE_SOURCE, /rovo-dev/u);
});

test("the subagent reference catalog resolves curated ids against the unified catalog", () => {
	assert.ok(SUBAGENTS_JSON.length >= 11, `expected >=11 subagents, got ${SUBAGENTS_JSON.length}`);

	const seen = new Set();
	const agentIds = new Set(AGENTS_JSON.map((agent) => agent.id));
	for (const { agentId } of SUBAGENTS_JSON) {
		assert.ok(agentIds.has(agentId), `subagent ${agentId} must exist in the unified catalog`);
		assert.ok(!seen.has(agentId), `duplicate subagent ref ${agentId}`);
		seen.add(agentId);
	}
});

test("agent browser projection carries card stats from agents.json", async () => {
	const agents = await loadAgents();

	for (const agent of agents.DEMO_AGENT_BROWSER_AGENTS) {
		const source = AGENTS_JSON.find((record) => record.id === agent.id);
		assert.ok(source, `expected source JSON for ${agent.id}`);
		assert.equal(agent.rating, source.rating, `${agent.id}: rating should come from JSON`);
		assert.equal(agent.feedbackCount, source.feedbackCount, `${agent.id}: feedbackCount should come from JSON`);
		assert.equal(agent.chatCount, source.chatCount, `${agent.id}: chatCount should come from JSON`);
		assert.equal(agent.verified, source.verified, `${agent.id}: verified should come from JSON`);
	}
});

test("unified directory + selector are a superset floor of the legacy forks (nothing removed; additions allowed)", async () => {
	const agents = await loadAgents();

	// --- Directory profiles: every legacy studio-fork profile must still be present
	// and byte-for-byte identical. The catalog may add more beyond the snapshot. ---
	const directoryById = new Map(
		agents.ROVO_DIRECTORY_AGENT_PROFILES.map((profile) => [profile.id, profile]),
	);
	const studioDirectory = LEGACY_SNAPSHOT.studio.ROVO_DIRECTORY_AGENT_PROFILES;

	assert.ok(
		agents.ROVO_DIRECTORY_AGENT_PROFILES.length >= studioDirectory.length,
		"directory must be a superset of the studio fork (>= length)",
	);
	for (const legacyProfile of studioDirectory) {
		const unifiedProfile = directoryById.get(legacyProfile.id);
		assert.ok(unifiedProfile, `unified directory must contain ${legacyProfile.id}`);
		assert.deepEqual(
			serializeProfile(unifiedProfile, legacyProfile),
			legacyProfile,
			`directory profile ${legacyProfile.id} must match the studio fork byte-for-byte`,
		);
	}

	// --- Selector agents: must still contain every studio-fork agent unchanged,
	// and remain a superset of the rovo fork. New OOTB agents may be added. ---
	const selectorById = new Map(
		agents.ROVO_AGENT_SELECTOR_AGENTS.map((agent) => [agent.id, agent]),
	);
	const studioSelector = LEGACY_SNAPSHOT.studio.ROVO_AGENT_SELECTOR_AGENTS;
	const rovoSelector = LEGACY_SNAPSHOT.rovo.ROVO_AGENT_SELECTOR_AGENTS;

	assert.ok(
		agents.ROVO_AGENT_SELECTOR_AGENTS.length >= studioSelector.length,
		"selector must be a superset of the studio fork (>= length)",
	);
	for (const legacyAgent of studioSelector) {
		const unifiedAgent = selectorById.get(legacyAgent.id);
		assert.ok(unifiedAgent, `unified selector must contain ${legacyAgent.id}`);
		assert.deepEqual(
			projectToShape(unifiedAgent, legacyAgent),
			legacyAgent,
			`selector agent ${legacyAgent.id} must match the studio fork`,
		);
	}

	// Strict superset of the rovo fork: every rovo selector id present, identical shape.
	for (const legacyAgent of rovoSelector) {
		const unifiedAgent = selectorById.get(legacyAgent.id);
		assert.ok(unifiedAgent, `unified selector must still contain rovo-fork ${legacyAgent.id}`);
		assert.deepEqual(projectToShape(unifiedAgent, legacyAgent), legacyAgent);
	}

	// The studio-fork additions (release-notes-drafter, atlassian) remain present on
	// top of the rovo fork — that's the floor; extra OOTB additions are permitted.
	const rovoSelectorIds = new Set(rovoSelector.map((agent) => agent.id));
	const addedIds = new Set(
		agents.ROVO_AGENT_SELECTOR_AGENTS
			.map((agent) => agent.id)
			.filter((id) => !rovoSelectorIds.has(id)),
	);
	for (const id of ADDED_AGENT_IDS) {
		assert.ok(addedIds.has(id), `selector must add ${id} on top of the rovo fork`);
	}

	// ROVO_CUSTOM_AGENT_SELECTOR_AGENTS aliases the selector list.
	assert.deepEqual(
		agents.ROVO_CUSTOM_AGENT_SELECTOR_AGENTS,
		agents.ROVO_AGENT_SELECTOR_AGENTS,
	);
});

test("mention visuals use complete new avatars for every first-party lanyard agent", async () => {
	const { mapAgentToMentionItem, AGENT_LANYARD_FIRST_PARTY_AGENTS } = await loadDirectoryModule(`
		export { mapAgentToMentionItem } from "@/components/blocks/editor-palette/data/mention-sources";
		export { AGENT_LANYARD_FIRST_PARTY_AGENTS } from "@/components/blocks/agent-lanyard/first-party-data";
	`);
	for (const agent of AGENT_LANYARD_FIRST_PARTY_AGENTS) {
		const { visual } = mapAgentToMentionItem(agent);
		assert.equal(visual.kind, "avatar", agent.name);
		assert.equal(visual.shape, "hexagon", agent.name);
		assert.ok(visual.src.startsWith("/avatar-agent-new/"), agent.name);
		assert.ok(fs.existsSync(path.join(process.cwd(), "public", visual.src)), agent.name);
	}
	assert.deepEqual(mapAgentToMentionItem({ id: "custom", name: "Custom", byline: "", avatarSrc: "/custom.svg" }).visual, {
		kind: "image", shape: "square", src: "/custom.svg",
	});
	assert.deepEqual(mapAgentToMentionItem({ id: "claude", name: "Claude", byline: "", brandName: "claude" }).visual, {
		kind: "third-party", name: "claude",
	});
});

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	AGENT_CONFIG_DIRECTORY_INITIAL_STATE: CLOSED,
	agentConfigDirectoryReducer: reduce,
	createAppsSeed,
	createSkillsSeed,
	createToolsSeed,
	selectAgentConfigDirectorySelection: select,
} = require("./rovo-app-agent-config-directory-machine.ts");

const KINDS = ["knowledge", "tools", "apps", "skills", "memory", "conversationStarters"];

test("open shows one directory with what it was opened on", () => {
	const apps = reduce(CLOSED, { type: "open", kind: "apps", seed: createAppsSeed("jira") });
	assert.deepEqual(apps, { open: "apps", seed: { kind: "apps", appId: "jira" } });
	assert.deepEqual(select(apps), { appId: "jira", detailSkillId: null, selectedSkillIds: [], toolId: null });
	const tools = reduce(apps, { type: "open", kind: "tools", seed: createToolsSeed(null) });
	assert.deepEqual(tools, { open: "tools", seed: { kind: "tools", toolId: null } }, "opening another directory replaces the seed");
	for (const kind of ["knowledge", "memory", "conversationStarters"]) {
		assert.deepEqual(reduce(apps, { type: "open", kind }), { open: kind, seed: apps.seed }, `${kind} opens without a seed`);
	}
});

test("dismiss closes and forgets the dismissed directory's seed; close after an add keeps it", () => {
	const apps = reduce(CLOSED, { type: "open", kind: "apps", seed: createAppsSeed("jira") });
	assert.deepEqual(reduce(apps, { type: "dismiss", kind: "apps" }), CLOSED);
	assert.deepEqual(reduce(apps, { type: "close" }), { open: null, seed: apps.seed });
	const memory = reduce(apps, { type: "open", kind: "memory" });
	assert.deepEqual(reduce(memory, { type: "dismiss", kind: "memory" }), { open: null, seed: apps.seed }, "memory has no seed to forget");
});

test("skills keeps its bulk selection until dismissed or added", () => {
	const skills = reduce(CLOSED, { type: "open", kind: "skills", seed: createSkillsSeed("release-notes") });
	const selected = reduce(skills, { type: "select-skills", skillIds: ["a", "b"] });
	assert.deepEqual(select(selected), { appId: null, detailSkillId: "release-notes", selectedSkillIds: ["a", "b"], toolId: null });
	const added = reduce(selected, { type: "clear-skill-selection" });
	assert.deepEqual(select(added).selectedSkillIds, []);
	assert.equal(added.open, "skills", "adding skills keeps the directory open for more");
	assert.deepEqual(reduce(selected, { type: "dismiss", kind: "skills" }), CLOSED);
});

test("cannot happen: no-op events return the same state", () => {
	assert.equal(reduce(CLOSED, { type: "close" }), CLOSED, "close while closed");
	for (const kind of KINDS) {
		assert.equal(reduce(CLOSED, { type: "dismiss", kind }), CLOSED, `dismiss ${kind} while closed`);
	}
	const apps = reduce(CLOSED, { type: "open", kind: "apps", seed: createAppsSeed("jira") });
	assert.equal(reduce(apps, { type: "open", kind: "apps" }), apps, "a dialog reopening itself keeps its seed");
	assert.equal(reduce(apps, { type: "select-skills", skillIds: ["a"] }), apps, "skill selection outside skills");
	assert.equal(reduce(apps, { type: "clear-skill-selection" }), apps, "clearing a skill selection outside skills");
	const skills = reduce(CLOSED, { type: "open", kind: "skills", seed: createSkillsSeed(null) });
	assert.equal(reduce(skills, { type: "clear-skill-selection" }), skills, "clearing an empty selection");
	const ids = ["a"];
	const selected = reduce(skills, { type: "select-skills", skillIds: ids });
	assert.equal(reduce(selected, { type: "select-skills", skillIds: ids }), selected, "the same selection again");
	assert.deepEqual(select(CLOSED), { appId: null, detailSkillId: null, selectedSkillIds: [], toolId: null });
});

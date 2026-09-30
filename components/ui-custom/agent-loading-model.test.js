const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const {
	AGENT_LOADING_SIZE_PX,
	areAllAgentLoadingAgentsFinished,
	getAgentLoadingSlotStyle,
	getAgentLoadingSlots,
	listAgentLoadingSlots,
	shouldCycleAgentLoading,
} = require("./agent-loading-model.ts");

const COMPONENT_SOURCE = readFileSync(`${__dirname}/agent-loading.tsx`, "utf8");
const MOTION_SOURCE = readFileSync(`${__dirname}/../../app/tailwind-theme-agent-loading.css`, "utf8");

test("Agent loading cycles multiple agents until every agent is finished", () => {
	const workingAgents = [{ status: "working" }, { status: "finished" }];
	const finishedAgents = [{ status: "finished" }, { status: "finished" }];

	assert.equal(shouldCycleAgentLoading(workingAgents), true);
	assert.equal(areAllAgentLoadingAgentsFinished(workingAgents), false);
	assert.equal(shouldCycleAgentLoading(finishedAgents), false);
	assert.equal(areAllAgentLoadingAgentsFinished(finishedAgents), true);
	assert.equal(areAllAgentLoadingAgentsFinished([]), false);
});

test("Agent loading assigns front, back, and hidden slots and wraps safely", () => {
	const twoAgents = ["Cursor", "Jira Coding agent"];
	const agents = ["Cursor", "Jira Coding agent", "Rovo"];
	const fourAgents = ["Cursor", "Jira Coding agent", "Rovo", "Claude"];

	assert.deepEqual(getAgentLoadingSlots(twoAgents, 0), {
		front: "Cursor",
		back: "Jira Coding agent",
		hidden: null,
	});
	assert.deepEqual(getAgentLoadingSlots(twoAgents, 1), {
		front: "Jira Coding agent",
		back: "Cursor",
		hidden: null,
	});
	assert.deepEqual(getAgentLoadingSlots(agents, 0), {
		front: "Cursor",
		back: "Jira Coding agent",
		hidden: "Rovo",
	});
	assert.deepEqual(getAgentLoadingSlots(agents, 3), {
		front: "Cursor",
		back: "Jira Coding agent",
		hidden: "Rovo",
	});
	assert.deepEqual(getAgentLoadingSlots(fourAgents, 0), {
		front: "Cursor",
		back: "Jira Coding agent",
		hidden: "Rovo",
	});
	assert.deepEqual(getAgentLoadingSlots(fourAgents, 1), {
		front: "Jira Coding agent",
		back: "Rovo",
		hidden: "Claude",
	});
	assert.deepEqual(getAgentLoadingSlots(fourAgents, 3), {
		front: "Claude",
		back: "Cursor",
		hidden: "Jira Coding agent",
	});
	assert.equal(getAgentLoadingSlots([], 0), null);
	assert.equal(getAgentLoadingSlots(["Cursor"], 0), null);
	assert.deepEqual(listAgentLoadingSlots({
		front: "Cursor",
		back: "Jira Coding agent",
		hidden: "Rovo",
	}), [
		{ agent: "Rovo", slot: "hidden" },
		{ agent: "Jira Coding agent", slot: "back" },
		{ agent: "Cursor", slot: "front" },
	]);
	assert.deepEqual(getAgentLoadingSlotStyle("front"), {
		x: 0,
		y: 0,
		scale: 1,
		opacity: 1,
		zIndex: 3,
	});
	assert.deepEqual(getAgentLoadingSlotStyle("back"), {
		x: 12,
		y: 12,
		scale: 0.75,
		opacity: 0.8,
		zIndex: 2,
	});
	assert.deepEqual(getAgentLoadingSlotStyle("hidden"), {
		x: 0,
		y: 20,
		scale: 0.25,
		opacity: 0,
		zIndex: 1,
	});
});

test("Agent loading exposes visible status copy, size variants, and uses VPK motion tokens", () => {
	assert.deepEqual(AGENT_LOADING_SIZE_PX, { default: 24, small: 16 });
	assert.match(COMPONENT_SOURCE, /return <span className="sr-only">\{announcement\}\. <\/span>/u);
	assert.match(COMPONENT_SOURCE, /<span className="min-w-0 self-center whitespace-nowrap text-sm text-text">/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /<span aria-hidden="true" className="min-w-0 self-center/u);
	assert.match(COMPONENT_SOURCE, /AGENT_LOADING_SWAP_MS = 600; \/\/ duration-slowest/u);
	assert.match(COMPONENT_SOURCE, /duration: 0\.6, ease: motionEase\.inOut \}; \/\/ duration-slowest \+ ease-in-out/u);
	assert.match(COMPONENT_SOURCE, /duration: 0\.4, ease: motionEase\.in \}; \/\/ duration-slower \+ ease-in/u);
	assert.match(COMPONENT_SOURCE, /from "motion\/react"/u);
	assert.match(COMPONENT_SOURCE, /size = "default"/u);
	assert.match(COMPONENT_SOURCE, /data-size=\{size\}/u);
	assert.match(COMPONENT_SOURCE, /data-agent-id=\{agent\.id\}/u);
	assert.match(COMPONENT_SOURCE, /data-reduced-motion=\{shouldReduceMotion \? "true" : undefined\}/u);
	assert.match(COMPONENT_SOURCE, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/u);
	assert.match(MOTION_SOURCE, /&\[data-size="small"\]/u);
	assert.match(MOTION_SOURCE, /transform: scale\(calc\(4 \/ 6\)\)/u);
	assert.doesNotMatch(MOTION_SOURCE, /@keyframes agent-loading-/u);
});

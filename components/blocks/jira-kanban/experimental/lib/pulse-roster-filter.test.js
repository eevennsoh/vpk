const assert = require("node:assert/strict");
const test = require("node:test");
const { getHeaderFacepileAssigneeLimit } = require("../header-facepile.ts");

test("the facepile retains its default placeholder or uses all seven slots for a complete roster", () => {
	assert.equal(getHeaderFacepileAssigneeLimit(), 6);
	assert.equal(getHeaderFacepileAssigneeLimit(true), 6);
	assert.equal(getHeaderFacepileAssigneeLimit(false), 7);
});

const {
	PULSE_PRESENTATION_MEMBER_ID,
	fillBoardFacepileAssignees,
	mergeBoardFilterAssignees,
	promoteAssignee,
	toInsightsAssigneeIds,
	toPulseMemberAssigneeIds,
	toPulseMemberId,
} = require("./pulse-roster-filter.ts");

const PULSE_MEMBER_IDS = new Set(["venn", "maya", "review-agent"]);

test("Pulse member id is the first selected assignee that is on the roster", () => {
	assert.equal(toPulseMemberId(new Set(), PULSE_MEMBER_IDS), null);
	assert.equal(toPulseMemberId(new Set(["elena"]), PULSE_MEMBER_IDS), null);
	assert.equal(toPulseMemberId(new Set(["venn"]), PULSE_MEMBER_IDS), "venn");
	assert.equal(
		toPulseMemberId(new Set(["elena", "review-agent"]), PULSE_MEMBER_IDS),
		"review-agent",
	);
	assert.equal(
		toPulseMemberId(new Set(["maya", "venn"]), PULSE_MEMBER_IDS),
		"maya",
		"insertion order decides when two roster members are selected",
	);
});

test("Pulse member id resolves route-specific assignee aliases", () => {
	const aliases = {
		"jordan-okafor": "jordan",
		"maya-ferreira": "maya",
	};

	assert.equal(
		toPulseMemberId(new Set(["maya-ferreira"]), PULSE_MEMBER_IDS, aliases),
		"maya",
	);
	assert.equal(
		toPulseMemberId(new Set(["jordan-okafor"]), PULSE_MEMBER_IDS, aliases),
		null,
		"an alias must still resolve to a member on the active roster",
	);
});

test("Clicking a Pulse face writes a singleton assignee filter", () => {
	assert.deepEqual([...toPulseMemberAssigneeIds(null)], []);
	assert.deepEqual([...toPulseMemberAssigneeIds("venn")], ["venn"]);
	assert.deepEqual([...toPulseMemberAssigneeIds("review-agent")], ["review-agent"]);
});

test("Insights defaults to Venn unless a roster member is already selected", () => {
	assert.equal(PULSE_PRESENTATION_MEMBER_ID, "venn");
	assert.deepEqual(
		[...toInsightsAssigneeIds(new Set(), PULSE_MEMBER_IDS)],
		["venn"],
	);
	assert.deepEqual(
		[...toInsightsAssigneeIds(new Set(["elena"]), PULSE_MEMBER_IDS)],
		["venn"],
		"a board-only assignee is not a Pulse filter, so Insights still defaults to Venn",
	);
	assert.deepEqual(
		[...toInsightsAssigneeIds(new Set(["maya"]), PULSE_MEMBER_IDS)],
		["maya"],
	);
	assert.deepEqual(
		[...toInsightsAssigneeIds(new Set(["review-agent"]), PULSE_MEMBER_IDS)],
		["review-agent"],
		"an agent face is the same shorthand as a human face",
	);
	assert.deepEqual(
		[...toInsightsAssigneeIds(new Set(["elena", "venn"]), PULSE_MEMBER_IDS)],
		["elena", "venn"],
		"an existing Venn selection is kept rather than rewritten",
	);
	assert.deepEqual(
		[...toInsightsAssigneeIds(new Set(["elena"]), new Set(["maya"]))],
		["elena"],
		"without Venn on the roster, a board-only selection is left alone",
	);
});

test("Venn is promoted to the front of the board facepile when present", () => {
	const assignees = [
		{ id: "maya-chen", name: "Maya Chen", avatarSrc: "/maya.png" },
		{ id: "venn", name: "Venn", avatarSrc: "/venn.png" },
		{ id: "jordan-lee", name: "Jordan Lee", avatarSrc: "/jordan.png" },
	];
	assert.deepEqual(
		promoteAssignee(assignees, "venn").map((assignee) => assignee.id),
		["venn", "maya-chen", "jordan-lee"],
	);
	assert.deepEqual(
		promoteAssignee(assignees, "ghost").map((assignee) => assignee.id),
		["maya-chen", "venn", "jordan-lee"],
	);
});

test("Filter assignee options union the Pulse roster with board people", () => {
	const merged = mergeBoardFilterAssignees(
		[
			{ id: "venn", name: "Venn", avatarSrc: "/board-venn.png" },
			{ id: "elena", name: "Elena Ruiz", avatarSrc: "/elena.png" },
		],
		[
			{ id: "venn", name: "Venn", kind: "human", role: "Software engineer", avatarSrc: "/pulse-venn.png" },
			{ id: "review-agent", name: "Review Agent", kind: "agent", role: "Reviews every PR", avatarSrc: "/review.svg" },
		],
	);
	assert.deepEqual(
		merged.map((assignee) => assignee.id),
		["venn", "review-agent", "elena"],
	);
	assert.equal(merged[0].avatarSrc, "/pulse-venn.png", "Pulse identity wins on a shared id");
});

test("board facepile extras fill remaining slots after Venn", () => {
	const filled = fillBoardFacepileAssignees(
		[
			{ id: "maya", name: "Maya Ferreira", avatarSrc: "/maya.png" },
			{ id: "jordan", name: "Jordan Okafor", avatarSrc: "/jordan.png" },
		],
		[
			{ id: "venn", name: "Venn", avatarSrc: "/venn.png" },
			{ id: "review-agent", name: "Review Agent", avatarSrc: "/review.svg" },
			{ id: "test-agent", name: "Test Author Agent", avatarSrc: "/test.svg" },
		],
	);
	assert.deepEqual(
		filled.map((assignee) => assignee.id),
		["venn", "review-agent", "test-agent", "maya", "jordan"],
	);
	assert.deepEqual(
		fillBoardFacepileAssignees([
			{ id: "maya", name: "Maya Ferreira", avatarSrc: "/maya.png" },
		]).map((assignee) => assignee.id),
		["maya"],
	);
});

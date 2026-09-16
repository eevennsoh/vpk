const assert = require("node:assert/strict");
const test = require("node:test");

const { moveJiraKanbanAgentSession } = require("../../state.ts");

const {
	cancelBoardAgentSessionDragTransaction,
	createBoardAgentSessionDragTransaction,
	isCreateZoneEligible,
	parseBoardCardGapZones,
	parseBoardEmptyColumnGapZone,
	parseListRowDropZone,
	resolveBoardAgentSessionAttachProximity,
	resolveBoardAgentSessionDropAction,
	resolveBoardAgentSessionDropTarget,
	resolveBoardCreateDropzoneDrag,
	SESSION_ATTACH_PROXIMITY_RANGE_PX,
	toBoardAgentSessionCardProximity,
	toChinFreeBoardCardBounds,
	toListSessionDropIntent,
	updateBoardAgentSessionDragTransaction,
	shouldPublishBoardAgentSessionDrag,
} = require("./board-agent-session-drag.ts");

const SOURCE_ISSUE = {
	bounds: { bottom: 200, left: 0, right: 200, top: 0 },
	cardCode: "PAY-121",
	kind: "issue",
};
const SOURCE_UNLINK = {
	bounds: { bottom: 200, left: 0, right: 200, top: 150 },
	cardCode: "PAY-121",
	kind: "unlink",
};
const TARGET_ISSUE = {
	bounds: { bottom: 200, left: 220, right: 420, top: 0 },
	cardCode: "PAY-128",
	kind: "issue",
};
const UNTRACKED = {
	bounds: { bottom: 200, left: 400, right: 760, top: 0 },
	kind: "untracked",
};
const CREATE_WORK_ITEM = {
	bounds: { bottom: 280, left: 220, right: 420, top: 220 },
	columnTitle: "In review",
	kind: "create",
};
const ZONES = [SOURCE_ISSUE, SOURCE_UNLINK, TARGET_ISSUE];

function session(id = "review-agent") {
	return { id, label: "Review Agent", name: "Review Agent", state: "working" };
}

function cohortOf(member = session()) {
	return { key: member.id, members: [member] };
}

test("pointer travel within the untracked rail does not republish unchanged board chrome", () => {
	const current = createBoardAgentSessionDragTransaction(cohortOf(), { kind: "detached", sourceCardCode: "PAY-121" }, { x: 500, y: 80 }, [UNTRACKED]);
	const next = updateBoardAgentSessionDragTransaction(current, { x: 550, y: 90 }, [UNTRACKED]);
	assert.equal(shouldPublishBoardAgentSessionDrag(null, current), true);
	assert.equal(shouldPublishBoardAgentSessionDrag(current, next), false);
	assert.deepEqual(next.pointer, { x: 550, y: 90 });
	assert.equal(shouldPublishBoardAgentSessionDrag(current, { ...next, target: { kind: "untracked" } }), true);
	const outside = { ...next, target: null };
	assert.equal(shouldPublishBoardAgentSessionDrag(outside, { ...outside, pointer: { x: 1000, y: 700 } }), false);
	assert.equal(shouldPublishBoardAgentSessionDrag(outside, { ...outside, target: { kind: "attach", cardCode: "PAY-128" } }), true);
	assert.equal(shouldPublishBoardAgentSessionDrag(outside, { ...outside, cohort: cohortOf(session("other")) }), true);
	const approaching = { ...outside, proximity: { cardCode: "PAY-128", nearness: 0.2 } };
	assert.equal(shouldPublishBoardAgentSessionDrag(approaching, { ...approaching, pointer: { x: 230, y: 100 } }), true);
});

test("moving an attached session atomically preserves the exact activity and derives both card modes", () => {
	const movingActivity = {
		id: "review-agent",
		label: "Review Agent",
		name: "Review Agent",
		message: "Reviewing telemetry gates",
		state: "awaiting-input",
	};
	const columns = [{
		title: "In review",
		count: 2,
		cards: [
			{
				code: "PAY-121",
				agentActivityMode: "awaiting-input",
				agentActivities: [
					{ id: "release-agent", label: "Release Agent", name: "Release Agent", state: "working" },
					movingActivity,
				],
			},
			{
				code: "PAY-128",
				agentActivityMode: "working",
				agentActivities: [
					{ id: "settlement-agent", label: "Settlement Agent", name: "Settlement Agent", state: "working" },
				],
			},
		],
	}];

	const moved = moveJiraKanbanAgentSession(columns, "PAY-121", "PAY-128", "review-agent");
	const source = moved[0].cards[0];
	const target = moved[0].cards[1];

	assert.deepEqual(source.agentActivities.map((activity) => activity.id), ["release-agent"]);
	assert.equal(source.agentActivityMode, "working");
	assert.deepEqual(target.agentActivities.map((activity) => activity.id), ["settlement-agent", "review-agent"]);
	assert.equal(target.agentActivities[1], movingActivity);
	assert.equal(target.agentActivityMode, "awaiting-input");
});

test("moving an attached session refuses same-card, unknown, and duplicate destinations", () => {
	const activity = { id: "review-agent", label: "Review Agent", name: "Review Agent", state: "working" };
	const columns = [{
		title: "In review",
		count: 2,
		cards: [
			{ code: "PAY-121", agentActivityMode: "working", agentActivities: [activity] },
			{
				code: "PAY-128",
				agentActivityMode: "awaiting-input",
				agentActivities: [
					{ id: "review-agent", label: "Duplicate", name: "Duplicate", state: "awaiting-input" },
				],
			},
		],
	}];

	for (const result of [
		moveJiraKanbanAgentSession(columns, "PAY-121", "PAY-121", "review-agent"),
		moveJiraKanbanAgentSession(columns, "UNKNOWN", "PAY-128", "review-agent"),
		moveJiraKanbanAgentSession(columns, "PAY-121", "UNKNOWN", "review-agent"),
		moveJiraKanbanAgentSession(columns, "PAY-121", "PAY-128", "missing-agent"),
		moveJiraKanbanAgentSession(columns, "PAY-121", "PAY-128", "review-agent"),
	]) {
		assert.deepEqual(result, columns);
		assert.equal(result[0].cards[0].agentActivities[0], activity);
	}
});

test("attached drags resolve only the source unlink well or a different issue", () => {
	const origin = { kind: "attached", sourceCardCode: "PAY-121" };

	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 175 }, ZONES),
		{ cardCode: "PAY-121", kind: "unlink" },
	);
	assert.equal(resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 80 }, ZONES), null);
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 300, y: 80 }, ZONES),
		{ cardCode: "PAY-128", kind: "attach" },
	);
});

test("detached and untracked drags attach to any issue and never resolve unlink targets", () => {
	for (const origin of [
		{ kind: "detached", sourceCardCode: "PAY-121" },
		{ kind: "untracked" },
	]) {
		assert.deepEqual(
			resolveBoardAgentSessionDropTarget(origin, { x: 100, y: 175 }, ZONES),
			{ cardCode: "PAY-121", kind: "attach" },
		);
		assert.deepEqual(
			resolveBoardAgentSessionDropTarget(origin, { x: 300, y: 80 }, ZONES),
			{ cardCode: "PAY-128", kind: "attach" },
		);
	}
});

test("only untracked sessions resolve a create-work-item column target", () => {
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(
			{ kind: "untracked" },
			{ x: 300, y: 250 },
			[CREATE_WORK_ITEM],
		),
		{ columnTitle: "In review", kind: "create" },
	);
	assert.deepEqual(
		resolveBoardAgentSessionDropAction(
			createBoardAgentSessionDragTransaction(
				cohortOf(session()),
				{ kind: "untracked" },
				{ x: 300, y: 250 },
				[CREATE_WORK_ITEM],
			),
		),
		{ columnTitle: "In review", kind: "create", sessionIds: ["review-agent"] },
	);
	assert.equal(
		resolveBoardAgentSessionDropTarget(
			{ kind: "attached", sourceCardCode: "PAY-121" },
			{ x: 300, y: 250 },
			[CREATE_WORK_ITEM],
		),
		null,
	);
	assert.equal(
		resolveBoardAgentSessionDropTarget(
			{ kind: "detached", sourceCardCode: "PAY-121" },
			{ x: 300, y: 250 },
			[CREATE_WORK_ITEM],
		),
		null,
	);
});

test("create wells stay idle unless the drag origin can land in them", () => {
	const pointer = { x: 0, y: 0 };
	const cohort = cohortOf();
	assert.equal(isCreateZoneEligible({ kind: "untracked" }), true);
	assert.equal(isCreateZoneEligible({ kind: "attached", sourceCardCode: "PAY-121" }), false);
	assert.equal(isCreateZoneEligible({ kind: "detached", sourceCardCode: "PAY-121" }), false);
	assert.equal(resolveBoardCreateDropzoneDrag(null, "To do"), "idle");
	assert.equal(
		resolveBoardCreateDropzoneDrag(
			createBoardAgentSessionDragTransaction(
				cohort,
				{ kind: "attached", sourceCardCode: "PAY-121" },
				pointer,
				[],
			),
			"To do",
		),
		"idle",
	);
	assert.equal(
		resolveBoardCreateDropzoneDrag(
			createBoardAgentSessionDragTransaction(
				cohort,
				{ kind: "detached", sourceCardCode: "PAY-121" },
				pointer,
				[],
			),
			"To do",
		),
		"idle",
	);
	assert.equal(
		resolveBoardCreateDropzoneDrag(
			createBoardAgentSessionDragTransaction(cohort, { kind: "untracked" }, pointer, []),
			"To do",
		),
		"active",
	);
	const armed = createBoardAgentSessionDragTransaction(
		cohort,
		{ kind: "untracked" },
		{ x: 300, y: 250 },
		[CREATE_WORK_ITEM],
	);
	assert.equal(resolveBoardCreateDropzoneDrag(armed, "In review"), "armed");
	assert.equal(resolveBoardCreateDropzoneDrag(armed, "To do"), "active");
});

test("an explicit create target wins over an overlapping issue card", () => {
	const overlappingIssue = {
		bounds: CREATE_WORK_ITEM.bounds,
		cardCode: "PAY-127",
		kind: "issue",
	};
	const transaction = createBoardAgentSessionDragTransaction(
		cohortOf(session()),
		{ kind: "untracked" },
		{ x: 300, y: 250 },
		[overlappingIssue, CREATE_WORK_ITEM],
	);

	assert.deepEqual(transaction.target, { columnTitle: "In review", kind: "create" });
	assert.deepEqual(
		resolveBoardAgentSessionDropAction(transaction),
		{ columnTitle: "In review", kind: "create", sessionIds: ["review-agent"] },
	);
});

test("overlapping eligible issues are ambiguous instead of arming multiple targets", () => {
	const overlappingZones = [
		TARGET_ISSUE,
		{ ...TARGET_ISSUE, cardCode: "PAY-130" },
	];

	assert.equal(
		resolveBoardAgentSessionDropTarget({ kind: "untracked" }, { x: 300, y: 80 }, overlappingZones),
		null,
	);
});

test("transactions record the session, origin, pointer, and one current target", () => {
	const draggedSession = session();
	const draggedCohort = cohortOf(draggedSession);
	const transaction = createBoardAgentSessionDragTransaction(
		draggedCohort,
		{ kind: "attached", sourceCardCode: "PAY-121" },
		{ x: 100, y: 80 },
		ZONES,
	);
	assert.equal(transaction.cohort, draggedCohort);
	assert.deepEqual(transaction.pointer, { x: 100, y: 80 });
	assert.equal(transaction.target, null);

	const updated = updateBoardAgentSessionDragTransaction(transaction, { x: 300, y: 80 }, ZONES);
	assert.deepEqual(updated.target, { cardCode: "PAY-128", kind: "attach" });
	assert.deepEqual(updated.pointer, { x: 300, y: 80 });
	assert.equal(updated.cohort, draggedCohort);
});

test("drop actions distinguish detach, cross-card move, attach, and invalid cancellation", () => {
	const draggedSession = session();
	const cases = [
		{
			expected: { kind: "detach", sessionIds: ["review-agent"], sourceCardCode: "PAY-121" },
			origin: { kind: "attached", sourceCardCode: "PAY-121" },
			pointer: { x: 100, y: 175 },
		},
		{
			expected: { kind: "move", sessionIds: ["review-agent"], sourceCardCode: "PAY-121", targetCardCode: "PAY-128" },
			origin: { kind: "attached", sourceCardCode: "PAY-121" },
			pointer: { x: 300, y: 80 },
		},
		{
			expected: { kind: "attach", sessionIds: ["review-agent"], targetCardCode: "PAY-128" },
			origin: { kind: "detached", sourceCardCode: "PAY-121" },
			pointer: { x: 300, y: 80 },
		},
		{
			expected: { kind: "attach", sessionIds: ["review-agent"], targetCardCode: "PAY-128" },
			origin: { kind: "untracked" },
			pointer: { x: 300, y: 80 },
		},
		{
			expected: { kind: "none" },
			origin: { kind: "attached", sourceCardCode: "PAY-121" },
			pointer: { x: 800, y: 800 },
		},
	];

	for (const { expected, origin, pointer } of cases) {
		const transaction = createBoardAgentSessionDragTransaction(
			cohortOf(draggedSession),
			origin,
			pointer,
			ZONES,
		);
		assert.deepEqual(resolveBoardAgentSessionDropAction(transaction), expected);
	}
});

test("attached drags prefer Untracked over an issue the rail overlays", () => {
	const origin = { kind: "attached", sourceCardCode: "PAY-121" };
	const overlayingIssue = {
		bounds: UNTRACKED.bounds,
		cardCode: "PAY-128",
		kind: "issue",
	};

	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 500, y: 80 }, [overlayingIssue, UNTRACKED]),
		{ kind: "untracked" },
	);
	assert.deepEqual(
		resolveBoardAgentSessionDropAction(
			createBoardAgentSessionDragTransaction(
				cohortOf(session()),
				origin,
				{ x: 500, y: 80 },
				[overlayingIssue, UNTRACKED],
			),
		),
		{ kind: "detach", sessionIds: ["review-agent"], sourceCardCode: "PAY-121" },
	);
});

test("untracked origins ignore the Untracked rail and still attach to issues underneath", () => {
	const overlayingIssue = {
		bounds: UNTRACKED.bounds,
		cardCode: "PAY-128",
		kind: "issue",
	};

	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(
			{ kind: "untracked" },
			{ x: 500, y: 80 },
			[overlayingIssue, UNTRACKED],
		),
		{ cardCode: "PAY-128", kind: "attach" },
	);
});

const LIST_ROW = {
	bounds: { bottom: 90, left: 0, right: 400, top: 0 },
	issueKey: "PAY-118",
	kind: "list-row",
	rowIndex: 0,
};
const NEXT_LIST_ROW = {
	bounds: { bottom: 180, left: 0, right: 400, top: 90 },
	issueKey: "PAY-107",
	kind: "list-row",
	rowIndex: 1,
};
const LIST_ZONES = [LIST_ROW, NEXT_LIST_ROW];

test("untracked list-row middle thirds attach and boundary thirds create at insertAtIndex", () => {
	const origin = { kind: "untracked" };

	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 40, y: 45 }, LIST_ZONES),
		{ cardCode: "PAY-118", kind: "attach" },
	);
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(origin, { x: 40, y: 10 }, LIST_ZONES),
		{
			insertion: { insertAtIndex: 0, position: "before", relativeToIssueKey: "PAY-118" },
			kind: "create-list",
		},
	);
	const afterFirst = resolveBoardAgentSessionDropTarget(origin, { x: 40, y: 80 }, LIST_ZONES);
	const beforeSecond = resolveBoardAgentSessionDropTarget(origin, { x: 40, y: 100 }, LIST_ZONES);
	const sharedEdge = resolveBoardAgentSessionDropTarget(origin, { x: 40, y: 90 }, LIST_ZONES);
	assert.deepEqual(afterFirst, {
		insertion: { insertAtIndex: 1, position: "after", relativeToIssueKey: "PAY-118" },
		kind: "create-list",
	});
	assert.deepEqual(beforeSecond, {
		insertion: { insertAtIndex: 1, position: "before", relativeToIssueKey: "PAY-107" },
		kind: "create-list",
	});
	assert.equal(afterFirst.insertion.insertAtIndex, beforeSecond.insertion.insertAtIndex);
	assert.equal(sharedEdge?.kind, "create-list");
	assert.equal(sharedEdge?.insertion.insertAtIndex, 1);
});

test("list-row create is untracked-only and attached origins ignore create strips", () => {
	assert.equal(
		resolveBoardAgentSessionDropTarget(
			{ kind: "attached", sourceCardCode: "PAY-121" },
			{ x: 40, y: 10 },
			LIST_ZONES,
		),
		null,
	);
	assert.equal(
		resolveBoardAgentSessionDropTarget(
			{ kind: "detached", sourceCardCode: "PAY-121" },
			{ x: 40, y: 10 },
			LIST_ZONES,
		),
		null,
	);
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(
			{ kind: "detached", sourceCardCode: "PAY-121" },
			{ x: 40, y: 45 },
			LIST_ZONES,
		),
		{ cardCode: "PAY-118", kind: "attach" },
	);
});

test("overlapping list-row attach cards stay ambiguous", () => {
	const overlappingRows = [
		LIST_ROW,
		{ ...LIST_ROW, issueKey: "PAY-130", rowIndex: 2 },
	];

	assert.equal(
		resolveBoardAgentSessionDropTarget({ kind: "untracked" }, { x: 40, y: 45 }, overlappingRows),
		null,
	);
});

test("list-row create actions carry insertion and cancel to none", () => {
	const draggedSession = session();
	const createTransaction = createBoardAgentSessionDragTransaction(
		cohortOf(draggedSession),
		{ kind: "untracked" },
		{ x: 40, y: 10 },
		LIST_ZONES,
	);
	assert.deepEqual(
		resolveBoardAgentSessionDropAction(createTransaction),
		{
			insertion: { insertAtIndex: 0, position: "before", relativeToIssueKey: "PAY-118" },
			kind: "create-list",
			sessionIds: ["review-agent"],
		},
	);
	assert.deepEqual(
		toListSessionDropIntent(createTransaction.target),
		{
			insertion: { insertAtIndex: 0, position: "before", relativeToIssueKey: "PAY-118" },
			kind: "create",
		},
	);
	assert.deepEqual(
		toListSessionDropIntent({ cardCode: "PAY-118", kind: "attach" }),
		{ issueKey: "PAY-118", kind: "attach" },
	);
	assert.deepEqual(toListSessionDropIntent({ kind: "untracked" }), { kind: "none" });
	assert.deepEqual(toListSessionDropIntent(null), { kind: "none" });

	const cancelled = cancelBoardAgentSessionDragTransaction(createTransaction);
	assert.equal(cancelled.target, null);
	assert.deepEqual(resolveBoardAgentSessionDropAction(cancelled), { kind: "none" });
});

test("malformed list-row attributes yield no zone", () => {
	const bounds = { bottom: 90, left: 0, right: 400, top: 0 };
	assert.equal(parseListRowDropZone(undefined, "0", bounds), null);
	assert.equal(parseListRowDropZone("PAY-118", undefined, bounds), null);
	assert.equal(parseListRowDropZone("PAY-118", "", bounds), null);
	assert.equal(parseListRowDropZone("PAY-118", "1.5", bounds), null);
	assert.equal(parseListRowDropZone("PAY-118", "row", bounds), null);
	assert.deepEqual(
		parseListRowDropZone("PAY-118", "0", bounds),
		{ bounds, issueKey: "PAY-118", kind: "list-row", rowIndex: 0 },
	);
});


test("cancelling a transaction clears its armed target and resolves to no action", () => {
	const transaction = createBoardAgentSessionDragTransaction(
		cohortOf(session()),
		{ kind: "attached", sourceCardCode: "PAY-121" },
		{ x: 300, y: 80 },
		ZONES,
	);
	const cancelled = cancelBoardAgentSessionDragTransaction(transaction);

	assert.equal(cancelled.target, null);
	assert.deepEqual(resolveBoardAgentSessionDropAction(cancelled), { kind: "none" });
});

const UNTRACKED_ORIGIN = { kind: "untracked" };

test("attach proximity ramps by smoothstep from 1 inside the rect to 0 at the range", () => {
	assert.equal(SESSION_ATTACH_PROXIMITY_RANGE_PX, 120);

	// Inside PAY-128; PAY-121 is 100px away so nearest-wins picks the card under
	// the pointer rather than the merely-eligible neighbour.
	const inside = resolveBoardAgentSessionAttachProximity(
		UNTRACKED_ORIGIN,
		{ x: 300, y: 80 },
		ZONES,
	);
	assert.equal(inside.cardCode, "PAY-128");
	assert.equal(inside.distance, 0);
	assert.equal(inside.nearness, 1);

	// 60px past PAY-128's right edge is the exact midpoint of the ramp, where
	// smoothstep reads 0.5 and a linear ramp would too — the curves only differ
	// either side of it.
	const midRange = resolveBoardAgentSessionAttachProximity(
		UNTRACKED_ORIGIN,
		{ x: 480, y: 100 },
		ZONES,
	);
	assert.equal(midRange.cardCode, "PAY-128");
	assert.equal(midRange.distance, 60);
	assert.equal(midRange.nearness, 0.5);

	// A quarter of the way in, smoothstep is still well under the linear 0.25.
	const earlyApproach = resolveBoardAgentSessionAttachProximity(
		UNTRACKED_ORIGIN,
		{ x: 510, y: 100 },
		ZONES,
	);
	assert.equal(earlyApproach.distance, 90);
	assert.ok(earlyApproach.nearness < 0.25);
});

test("attach proximity is exclusive of the range and reports nothing beyond it", () => {
	assert.equal(
		resolveBoardAgentSessionAttachProximity(UNTRACKED_ORIGIN, { x: 540, y: 100 }, ZONES),
		null,
	);
	assert.equal(
		resolveBoardAgentSessionAttachProximity(UNTRACKED_ORIGIN, { x: 560, y: 100 }, ZONES),
		null,
	);
});

test("attach proximity ties prefer the leftmost card, then the first registered zone", () => {
	// 10px right of PAY-121 and 10px left of PAY-128.
	const tiedPointer = { x: 210, y: 100 };

	for (const zones of [[SOURCE_ISSUE, TARGET_ISSUE], [TARGET_ISSUE, SOURCE_ISSUE]]) {
		const winner = resolveBoardAgentSessionAttachProximity(UNTRACKED_ORIGIN, tiedPointer, zones);
		assert.equal(winner.cardCode, "PAY-121");
		assert.equal(winner.distance, 10);
	}

	const stacked = resolveBoardAgentSessionAttachProximity(
		UNTRACKED_ORIGIN,
		{ x: 300, y: 80 },
		[TARGET_ISSUE, { ...TARGET_ISSUE, cardCode: "PAY-130" }],
	);
	assert.equal(stacked.cardCode, "PAY-128");
});

test("attach proximity ignores unlink zones and the card the session is dragged off", () => {
	assert.equal(
		resolveBoardAgentSessionAttachProximity(
			{ kind: "detached", sourceCardCode: "PAY-121" },
			{ x: 100, y: 175 },
			[SOURCE_UNLINK],
		),
		null,
	);

	// Attached to PAY-121 and hovering it: the source can never arm, so the
	// backdrop must bleed onto the eligible neighbour instead.
	const winner = resolveBoardAgentSessionAttachProximity(
		{ kind: "attached", sourceCardCode: "PAY-121" },
		{ x: 150, y: 80 },
		ZONES,
	);
	assert.equal(winner.cardCode, "PAY-128");
	assert.equal(winner.distance, 70);

	assert.equal(
		resolveBoardAgentSessionAttachProximity(
			{ kind: "attached", sourceCardCode: "PAY-121" },
			{ x: 100, y: 80 },
			[SOURCE_ISSUE, SOURCE_UNLINK],
		),
		null,
	);
});

test("attach proximity passes a measured shell and land rect through and falls back to null", () => {
	const dockRect = { bottom: 220, left: 200, right: 440, top: 160 };
	const landRect = { bottom: 220, left: 208, right: 432, top: 196 };
	const docked = resolveBoardAgentSessionAttachProximity(
		UNTRACKED_ORIGIN,
		{ x: 300, y: 80 },
		[{ ...TARGET_ISSUE, dockRect, landRect }],
	);
	assert.deepEqual(docked.dockRect, dockRect);
	assert.deepEqual(docked.landRect, landRect);
	assert.deepEqual(docked.bounds, TARGET_ISSUE.bounds);

	assert.equal(
		resolveBoardAgentSessionAttachProximity(UNTRACKED_ORIGIN, { x: 300, y: 80 }, ZONES).dockRect,
		null,
	);
	assert.equal(
		resolveBoardAgentSessionAttachProximity(UNTRACKED_ORIGIN, { x: 300, y: 80 }, ZONES).landRect,
		null,
	);
	assert.equal(
		resolveBoardAgentSessionAttachProximity(
			UNTRACKED_ORIGIN,
			{ x: 300, y: 80 },
			[{ ...TARGET_ISSUE, dockRect: null, landRect: null }],
		).dockRect,
		null,
	);
});

test("attach proximity reports nothing for a card an outranking drop zone already owns", () => {
	const railIssue = { bounds: UNTRACKED.bounds, cardCode: "PAY-128", kind: "issue" };
	const attachedOrigin = { kind: "attached", sourceCardCode: "PAY-121" };
	const railPointer = { x: 500, y: 80 };

	// The rail wins the drop, so the card underneath must not arm an attach it
	// will never receive.
	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(attachedOrigin, railPointer, [railIssue, UNTRACKED]),
		{ kind: "untracked" },
	);
	assert.equal(
		resolveBoardAgentSessionAttachProximity(attachedOrigin, railPointer, [railIssue, UNTRACKED]),
		null,
	);
	// Untracked origins ignore the rail entirely, so the card underneath is still
	// the real drop target and still arms.
	assert.equal(
		resolveBoardAgentSessionAttachProximity(UNTRACKED_ORIGIN, railPointer, [railIssue, UNTRACKED])
			.cardCode,
		"PAY-128",
	);

	const wellIssue = { bounds: CREATE_WORK_ITEM.bounds, cardCode: "PAY-131", kind: "issue" };
	const wellPointer = { x: 300, y: 250 };

	assert.deepEqual(
		resolveBoardAgentSessionDropTarget(UNTRACKED_ORIGIN, wellPointer, [wellIssue, CREATE_WORK_ITEM]),
		{ columnTitle: "In review", kind: "create" },
	);
	assert.equal(
		resolveBoardAgentSessionAttachProximity(
			UNTRACKED_ORIGIN,
			wellPointer,
			[wellIssue, CREATE_WORK_ITEM],
		),
		null,
	);
	// The create well is only eligible for untracked origins, so an attached drag
	// over the same overlap keeps attaching to the card underneath.
	assert.equal(
		resolveBoardAgentSessionAttachProximity(
			attachedOrigin,
			wellPointer,
			[wellIssue, CREATE_WORK_ITEM],
		).cardCode,
		"PAY-131",
	);

	// Precedence is a containment rule, not a proximity one: merely approaching
	// an outranking zone still lets the nearest card arm.
	assert.equal(
		resolveBoardAgentSessionAttachProximity(
			attachedOrigin,
			{ x: 500, y: 260 },
			[railIssue, UNTRACKED],
		).cardCode,
		"PAY-128",
	);
});

test("transactions carry proximity alongside the discrete target and clear both on cancel", () => {
	const approach = createBoardAgentSessionDragTransaction(
		cohortOf(session()),
		UNTRACKED_ORIGIN,
		{ x: 480, y: 100 },
		ZONES,
	);
	assert.equal(approach.target, null);
	assert.equal(approach.proximity.cardCode, "PAY-128");
	assert.equal(approach.proximity.nearness, 0.5);

	const armed = updateBoardAgentSessionDragTransaction(approach, { x: 300, y: 80 }, ZONES);
	assert.deepEqual(armed.target, { cardCode: "PAY-128", kind: "attach" });
	assert.equal(armed.proximity.nearness, 1);

	// Cancelling mid-approach has no target to clear, but the backdrop must still
	// go out, so proximity is cleared and a fresh transaction is returned.
	const cancelledApproach = cancelBoardAgentSessionDragTransaction(approach);
	assert.notEqual(cancelledApproach, approach);
	assert.equal(cancelledApproach.proximity, null);
	assert.equal(cancelledApproach.target, null);

	const cancelledArmed = cancelBoardAgentSessionDragTransaction(armed);
	assert.equal(cancelledArmed.proximity, null);
	assert.equal(cancelledArmed.target, null);

	const idle = updateBoardAgentSessionDragTransaction(approach, { x: 900, y: 900 }, ZONES);
	assert.equal(idle.proximity, null);
	assert.equal(cancelBoardAgentSessionDragTransaction(idle), idle);
});

test("a named card resolves as its own link target, with no pointer to measure", () => {
	// Assigning an agent from the card's own menu links the same agent to the
	// same card a drop does, so it reuses the drop path's proximity shape rather
	// than growing a second one. There is no pointer, so the card is the winner
	// by construction: distance 0, nearness 1.
	const winner = toBoardAgentSessionCardProximity(ZONES, "PAY-128");
	assert.equal(winner.cardCode, "PAY-128");
	assert.equal(winner.distance, 0);
	assert.equal(winner.nearness, 1);
	assert.deepEqual(winner.bounds, TARGET_ISSUE.bounds);

	// The geometry the effect needs is carried through, absent when unmeasured.
	assert.equal(winner.dockRect, null);
	assert.equal(winner.landRect, null);
	assert.equal(winner.surfaceRect, null);
	const measured = toBoardAgentSessionCardProximity(
		[{ ...TARGET_ISSUE, surfaceRect: { bottom: 190, left: 230, right: 410, top: 10 } }],
		"PAY-128",
	);
	assert.deepEqual(measured.surfaceRect, { bottom: 190, left: 230, right: 410, top: 10 });
});

test("only an issue zone can be a named card's link target", () => {
	// A card not on the board, and a same-code zone of another kind, both yield
	// nothing: the acknowledgement must not point at a card it cannot measure,
	// nor at the unlink well sharing that card's code.
	assert.equal(toBoardAgentSessionCardProximity(ZONES, "PAY-999"), null);
	assert.equal(toBoardAgentSessionCardProximity([SOURCE_UNLINK], "PAY-121"), null);
	assert.equal(toBoardAgentSessionCardProximity([], "PAY-121"), null);
});
